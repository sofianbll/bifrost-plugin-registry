#!/usr/bin/env python3
"""Importe la configuration prod Bifrost (vk-groups + dumps SQLite) en registry.json
pour le plugin bifrost-registry.

Sources :
  - vk-groups.json (Homelab-OS) : taxonomie groupes/providers/modèles
  - vks.json        : [{id, name, hash, active}]  (governance_virtual_keys, hash = sha256 du jeton)
  - vkconfigs.json  : [{vk, provider, models}]     (allowed_models par VK/provider, ["*"] = tout)
  - keys.json       : [{key_db_id, name, provider}] (config_keys)
  - routingrules.json : [{id, name, cel, targets, scope, scope_id}] (routing_rules actives)
    Les règles CEL `model == "<alias>"` deviennent des modèles passthrough : la garde
    valide l'alias mais laisse Bifrost routing faire la résolution (targets pré-autorisés).

Sortie : registry JSON sur stdout. Aucun secret ne transite : seuls les SHA-256 des
jetons VK (déjà stockés ainsi par Bifrost) figurent dans la sortie.
"""
import json, re, sys, argparse

SLUG = re.compile(r"^[a-z0-9][a-z0-9._-]{0,127}$")
CHAT_ENDPOINTS = ["chat/completions", "responses"]

def slug_provider(p): return p.lower()
def is_image(m): return m.startswith(("gpt-image-", "gemini-3.1-flash-image"))
def is_embed(m): return m.startswith(("mistral-embed", "codestral-embed", "text-embedding", "textembedding", "multimodalembedding"))
def is_tts(m): return "tts" in m
def is_fim(m): return "fim" in m

def endpoints_for(m):
    if is_image(m): return ["images/generations"]
    if is_embed(m): return ["embeddings"]
    if is_tts(m): return ["audio/speech"]
    if is_fim(m): return ["completions", "chat/completions"]
    return list(CHAT_ENDPOINTS)

def family_for(provider, alias):
    return {"Google": "gemini", "vertex": "gemini", "Claude": "anthropic",
            "Codex": "openai", "mistral": "mistral"}.get(provider, "")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("vkgroups"); ap.add_argument("vks"); ap.add_argument("vkconfigs"); ap.add_argument("keys")
    ap.add_argument("routingrules", nargs="?", default=None,
                    help="routing_rules actives (JSON) ; CEL 'model == \"<alias>\"' -> modèles passthrough")
    ap.add_argument("--extra", action="append", default=[],
                    help="modèles legacy 'provider:model' ajoutés au groupe legacy")
    a = ap.parse_args()

    vkg = json.load(open(a.vkgroups))["groups"]
    vks = {v["id"]: v for v in json.load(open(a.vks))}
    vkconfigs = json.load(open(a.vkconfigs))
    keys = json.load(open(a.keys))
    key_ids_by_provider = {}
    for k in keys:
        key_ids_by_provider.setdefault(k["provider"], []).append(str(k["key_db_id"]))

    # --- modèles (union de tous les groupes) ---
    alias_providers = {}   # alias -> set(providers)
    for g in vkg.values():
        for prov, models in g.get("providers", {}).items():
            for m in models:
                alias_providers.setdefault(m, set()).add(prov)

    group_model_ids = {}   # group id -> [model id]
    models_by_id = {}
    creator_of = {}
    for gid, g in vkg.items():
        ids = []
        for prov, models in g.get("providers", {}).items():
            for m in models:
                mid = m if len(alias_providers[m]) == 1 else f"{m}.{slug_provider(prov)}"
                if mid not in models_by_id:
                    assert SLUG.match(mid), f"id non slug: {mid}"
                    models_by_id[mid] = {
                        "id": mid, "alias": m, "provider": prov,
                        "provider_key_ids": sorted(key_ids_by_provider.get(prov, [])),
                        "upstream_model": m, "canonical_model": m,
                        "model_family": family_for(prov, m),
                        "endpoints": endpoints_for(m),
                        "enabled": True, "verified": True,
                        "evidence": "import prod vk-groups 2026-09-23",
                    }
                if g.get("kind") == "creator":
                    creator_of.setdefault(mid, gid)
                ids.append(mid)
        group_model_ids[gid] = sorted(set(ids))

    for mid, c in creator_of.items():
        models_by_id[mid]["creator"] = c

    # --- groupe legacy (filet de transition) ---
    legacy_ids = []
    for spec in a.extra:
        prov, m = spec.split(":", 1)
        provs = alias_providers.get(m, set()) | {prov}
        mid = m if len(provs) == 1 else f"{m}.{slug_provider(prov)}"
        if mid not in models_by_id:
            assert SLUG.match(mid)
            models_by_id[mid] = {
                "id": mid, "alias": m, "provider": prov,
                "provider_key_ids": sorted(key_ids_by_provider.get(prov, [])),
                "upstream_model": m, "canonical_model": m,
                "model_family": family_for(prov, m),
                "endpoints": endpoints_for(m),
                "enabled": True, "verified": True,
                "evidence": "import prod transition 2026-09-23",
            }
        legacy_ids.append(mid)
    if legacy_ids:
        group_model_ids["legacy"] = sorted(set(legacy_ids))

    # --- allowlists réelles par VK ---
    allowed = {}  # vk id -> set((provider, alias))
    models_by_provider_alias = {}
    for mid, mo in models_by_id.items():
        models_by_provider_alias.setdefault((mo["provider"], mo["alias"]), mid)
    for row in vkconfigs:
        vk = row["vk"]
        try:
            models = json.loads(row["models"] or "[]")
        except json.JSONDecodeError:
            continue
        for m in models:
            if m == "*":
                for (prov, alias), mid in models_by_provider_alias.items():
                    if prov == row["provider"]:
                        allowed.setdefault(vk, set()).add((prov, alias))
            else:
                allowed.setdefault(vk, set()).add((row["provider"], m))

    # --- alias de routing (règles CEL model == "<alias>") -> modèles passthrough ---
    # La garde valide l'alias pour la VK ; la résolution upstream reste owned par
    # Bifrost routing (rotation CPA etc.). Les targets natives sont pré-autorisées
    # pour le contrôle d'attempt post-routing du plugin.
    alias_group_by_vk = {}  # vk id -> [model ids]
    if a.routingrules:
        cel_alias = re.compile(r'^model == "([a-z0-9][a-z0-9._-]{0,127})"$')
        for rule in json.load(open(a.routingrules)):
            m = cel_alias.match((rule.get("cel") or "").strip())
            targets = rule.get("targets") or []
            if isinstance(targets, str):
                try:
                    targets = json.loads(targets)
                except json.JSONDecodeError:
                    targets = []
            if not m or not targets:
                print(f"WARN rule {rule.get('name')}: CEL ou targets non supportés, ignorée", file=sys.stderr)
                continue
            alias = m.group(1)
            targets = [t for t in targets if isinstance(t, str) and "/" in t]
            if alias in models_by_id or not targets:
                print(f"WARN alias {alias}: collision avec un modèle existant, règle {rule.get('name')} ignorée", file=sys.stderr)
                continue
            prov, upstream = targets[0].split("/", 1)
            mid = alias
            models_by_id[mid] = {
                "id": mid, "alias": alias, "provider": prov,
                "provider_key_ids": sorted(key_ids_by_provider.get(prov, [])) or ["routing-rule"],
                "upstream_model": upstream, "canonical_model": targets[0],
                "model_family": family_for(prov, upstream),
                "endpoints": list(CHAT_ENDPOINTS),
                "enabled": True, "verified": True,
                "passthrough": True, "routing_targets": targets,
                "evidence": f"routing rule {rule.get('name')} ({rule.get('id')})",
            }
            scope = rule.get("scope")
            vids = [rule["scope_id"]] if scope == "virtual_key" else list(vks) if scope == "global" else []
            if not vids:
                print(f"WARN rule {rule.get('name')}: scope {scope} non supporté, ignorée", file=sys.stderr)
                del models_by_id[mid]
                continue
            for vid in vids:
                alias_group_by_vk.setdefault(vid, []).append(mid)

    alias_gid_by_vk = {}
    for vid, mids in alias_group_by_vk.items():
        if vid not in vks:
            print(f"WARN alias groupe: VK {vid} inconnue, ignorée", file=sys.stderr)
            continue
        gid = "aliases." + re.sub(r"[^a-z0-9._-]+", "-", vks[vid]["name"].lower()).strip("-")
        group_model_ids[gid] = sorted(set(mids))
        alias_gid_by_vk.setdefault(vid, []).append(gid)

    # préférences globales pour les alias ambigus (poids vk-groups : go > deepseek, Codex > go)
    PREF_PROVIDER = {"deepseek-v4.1-flash": "opencode-go", "deepseek-v4-pro": "opencode-go",
                     "gpt-5.6-luna": "Codex"}

    groups_sorted = sorted(group_model_ids, key=lambda g: -len(group_model_ids[g]))
    policies, rest_groups = [], []
    for vid, vk in sorted(vks.items(), key=lambda kv: kv[1]["name"]):
        if not vk["active"]:
            continue
        target = allowed.get(vid)
        if target is None:
            continue  # VK sans provider config : rien à exposer
        target_ids = {models_by_provider_alias[(p, m)] for (p, m) in target if (p, m) in models_by_provider_alias}
        if not target_ids:
            continue
        # set-cover glouton par les groupes existants
        chosen, remaining = [], set(target_ids)
        while remaining:
            best = max((g for g in groups_sorted if g not in chosen),
                       key=lambda g: len(set(group_model_ids[g]) & remaining), default=None)
            gain = len(set(group_model_ids[best]) & remaining) if best else 0
            if not best or gain == 0:
                break
            chosen.append(best); remaining -= set(group_model_ids[best])
        if remaining:
            gid = "vk." + re.sub(r"[^a-z0-9._-]+", "-", vk["name"].lower()).strip("-")
            rest_groups.append({"id": gid, "name": f"reste {vk['name']}",
                                "model_ids": sorted(remaining)})
            group_model_ids[gid] = sorted(remaining)
            chosen.append(gid)
        sources = sorted({models_by_id[i]["provider"] for i in target_ids})
        # Alias de routing : rattacher le groupe et élargir les sources au provider
        # de l'alias (sinon le filtre d'éligibilité de la policy l'exclurait).
        for gid in alias_gid_by_vk.get(vid, []):
            if gid not in chosen:
                chosen.append(gid)
            for mid in group_model_ids[gid]:
                prov = models_by_id[mid]["provider"]
                if prov not in sources:
                    sources.append(prov)
        # Prefer par policy : alias éligibles multiples (éligibilité = groupes ∩ sources)
        elig_ids = {i for g in chosen for i in group_model_ids.get(g, [])
                    if not sources or models_by_id[i]["provider"] in sources}
        by_alias = {}
        for i in elig_ids:
            by_alias.setdefault(models_by_id[i]["alias"], []).append(i)
        prefer = {}
        for alias, mids in by_alias.items():
            if len(mids) > 1:
                want = PREF_PROVIDER.get(alias)
                pick = next((i for i in mids if models_by_id[i]["provider"] == want), sorted(mids)[0])
                prefer[alias] = pick
        policies.append({
            "virtual_key_id": vid, "name": vk["name"], "token_sha256": vk["hash"],
            "naming": "both", "groups": chosen, "sources": sources,
            **({"prefer": prefer} if prefer else {}), "enabled": True,
        })

    out = {
        "schema_version": 1, "default_naming": "both",
        "models": sorted(models_by_id.values(), key=lambda m: m["id"]),
        "groups": ([{"id": g, "name": g, "model_ids": ids} for g, ids in sorted(group_model_ids.items())]
                   + rest_groups),
        "policies": policies,
    }
    json.dump(out, sys.stdout, indent=2, ensure_ascii=False)
    print(file=sys.stderr)
    print(f"modèles={len(out['models'])} groupes={len(out['groups'])} policies={len(policies)} "
          f"rest-groups={len(rest_groups)}", file=sys.stderr)

if __name__ == "__main__":
    main()
