#!/usr/bin/env python3
"""Build the static, source-linked model-property inventory fragment."""

import argparse
import html
import json
from collections import defaultdict
from pathlib import Path
from urllib.parse import quote


HERE = Path(__file__).resolve().parent
UPSTREAM = "https://github.com/maximhq/bifrost/blob/411d62b28b03b03bd3b4025b2cfab50af45f05f4/"
PANELS = (
    ("native", "Bifrost natif", "Configuration d’accès + contrats de lecture ; lire un champ ne signifie pas pouvoir l’éditer."),
    ("datasheet", "Datasheets", "Prix/limites et paramètres/capacités : deux sources importées par Bifrost."),
    ("target", "Model card cible", "Cible de conception, pas comportement livré. « Direction validée » confirme l’intention produit, pas le mapping ni son mécanisme. Les champs réutilisés gardent leur origine."),
)
FIELDS = ("id", "group", "label", "path", "type", "origin", "scope", "read", "write", "note")
ORIGINS = {
    "native": ("Natif Bifrost",),
    "mixed": ("Natif Bifrost", "Datasheets"),
    "datasheet": ("Datasheets",),
    "registry": ("Registry",),
}
STATUSES = {"confirmed": "Direction validée", "proposed": "Proposé", "pending": "À préciser"}
SCOPES = {"model": "Modèle", "access": "Accès", "selection": "Sélection"}


def esc(value):
    return html.escape(str(value), quote=True)


def load(panel):
    data = json.loads((HERE / f"{panel}.json").read_text(encoding="utf-8"))
    rows = data["rows"] if isinstance(data, dict) else data
    if not isinstance(rows, list) or not rows:
        raise ValueError(f"{panel}: expected a nonempty rows list")
    ids = set()
    for row in rows:
        if not isinstance(row, dict) or any(not isinstance(row.get(k), str) or (k != "note" and not row[k].strip()) for k in FIELDS):
            raise ValueError(f"{panel}: invalid or missing row field")
        if row["id"] in ids:
            raise ValueError(f"{panel}: duplicate id {row['id']}")
        ids.add(row["id"])
        if row["origin"] not in ORIGINS or row["scope"] not in SCOPES:
            raise ValueError(f"{panel}/{row['id']}: invalid origin or scope")
        source = row.get("source")
        if not isinstance(source, dict) or not isinstance(source.get("path"), str) or not isinstance(source.get("line"), int) or isinstance(source["line"], bool) or source["line"] < 1:
            raise ValueError(f"{panel}/{row['id']}: invalid source")
        path = source["path"].removeprefix("registry:")
        if not path or path.startswith("/") or ".." in Path(path).parts or "://" in path or "\\" in path:
            raise ValueError(f"{panel}/{row['id']}: unsafe source path")
        if panel == "target":
            if row.get("status") not in STATUSES:
                raise ValueError(f"{panel}/{row['id']}: invalid status")
            if not isinstance(row.get("references"), list):
                raise ValueError(f"{panel}/{row['id']}: references must be a list")
    return rows


def source_markup(source):
    path, line = source["path"], source["line"]
    label = f"{path.removeprefix('registry:')}:{line}"
    if path.startswith("registry:"):
        return f"<code>{esc(label)}</code>"
    url = UPSTREAM + quote(path, safe="/") + f"#L{line}"
    return f'<a href="{esc(url)}" target="_blank" rel="noopener noreferrer"><code>{esc(label)}</code></a>'


def property_markup(row, panel):
    badges = "".join(f'<span class="viz-badge">{esc(value)}</span>' for value in ORIGINS[row["origin"]])
    if panel == "target":
        badges += f'<span class="viz-badge">{STATUSES[row["status"]]}</span>'
    details = (
        ("Type", row["type"]),
        ("Portée", SCOPES[row["scope"]]),
        ("Lecture", row["read"]),
        ("Modification", row["write"]),
        ("Note", row["note"]),
    )
    items = "".join(f"<dt>{esc(key)}</dt><dd>{esc(value)}</dd>" for key, value in details if value)
    refs = ""
    if panel == "target" and row["references"]:
        links = []
        for ref in row["references"]:
            title = next(title for key, title, _ in PANELS if key == ref["panel"])
            anchor = f"properties-{ref['panel']}-{ref['id']}"
            links.append(f'<a href="#{esc(anchor)}" data-panel="{ref["panel"]}" data-row="{esc(anchor)}">{esc(title)} · {esc(ref["id"])}</a>')
        refs = f"<dt>Références</dt><dd>{', '.join(links)}</dd>"
    return (
        f'<details class="property" id="properties-{esc(panel)}-{esc(row["id"])}"><summary class="cursor-interaction">'
        f'<span class="property-main"><strong>{esc(row["label"])}</strong> <code>{esc(row["path"])}</code></span>'
        f'<span class="property-badges">{badges}</span></summary>'
        f'<dl>{items}<dt>Source</dt><dd>{source_markup(row["source"])}</dd>{refs}</dl></details>'
    )


def build(data):
    out = ['<div id="bifrost-model-properties">',
           '<p class="text-small text-muted">Contrats Bifrost 2.2.3 · Cible Registry en cours de définition</p>',
           '<p class="text-small text-muted">Origine = provenance de la valeur ; elle ne dit pas où elle est stockée.</p>',
           '<div class="nav nav-pills" role="tablist" aria-label="Inventaire des propriétés">']
    for index, (key, title, _) in enumerate(PANELS):
        active = index == 0
        out.append(f'<button class="nav-link{" active" if active else ""}" id="properties-tab-{key}" role="tab" aria-controls="properties-panel-{key}" aria-selected="{str(active).lower()}" type="button">{title}</button>')
    out.append("</div>")
    rendered = 0
    for index, (key, _, subtitle) in enumerate(PANELS):
        out.append(f'<section id="properties-panel-{key}" role="tabpanel" aria-labelledby="properties-tab-{key}"{" hidden" if index else ""}>')
        out.append(f'<p class="text-small text-muted">{subtitle} · {len(data[key])} entrées</p>')
        groups = defaultdict(list)
        for row in data[key]:
            groups[row["group"]].append(row)
        for group_index, (name, rows) in enumerate(groups.items()):
            out.append(f'<details class="property-group"{" open" if key == "target" and group_index == 0 else ""}><summary class="cursor-interaction"><strong>{esc(name)}</strong> <span class="text-small text-muted">{len(rows)}</span></summary>')
            for row in rows:
                out.append(property_markup(row, key))
                rendered += 1
            out.append("</details>")
        out.append("</section>")
    out.append("</div>")
    out.append("""<style>
#bifrost-model-properties { color: var(--foreground); }
#bifrost-model-properties [role="tabpanel"] > p { margin: 1rem 0; }
#bifrost-model-properties .property-group { margin: 1rem 0; }
#bifrost-model-properties .property-group > summary { padding: .5rem 0; }
#bifrost-model-properties .property { border-top: 1px solid var(--border); }
#bifrost-model-properties .property > summary { padding: .65rem 0; }
#bifrost-model-properties .property-main, #bifrost-model-properties .property-badges { display: inline-flex; flex-wrap: wrap; gap: .35rem .6rem; align-items: baseline; max-width: 100%; }
#bifrost-model-properties .property-main code, #bifrost-model-properties dd code { overflow-wrap: anywhere; word-break: break-word; }
#bifrost-model-properties .property-badges { margin-inline-start: .5rem; }
#bifrost-model-properties dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: .4rem 1rem; margin: .3rem 0 1rem 1.25rem; }
#bifrost-model-properties dt { color: var(--muted-foreground); }
#bifrost-model-properties dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 480px) { #bifrost-model-properties dl { grid-template-columns: 1fr; gap: .15rem; } #bifrost-model-properties dd { margin-bottom: .45rem; } }
</style>""")
    out.append("""<script>
(() => {
  const root = document.getElementById('bifrost-model-properties');
  const keys = ['native', 'datasheet', 'target'];
  let activeTab = 'native';
  const restore = state => {
    const key = state?.privateContent?.tab;
    if (!keys.includes(key) || key === activeTab) return;
    for (const name of keys) {
      const selected = name === key;
      const button = document.getElementById('properties-tab-' + name);
      button.classList.toggle('active', selected);
      button.setAttribute('aria-selected', String(selected));
      document.getElementById('properties-panel-' + name).hidden = !selected;
    }
    activeTab = key;
  };
  restore(window.openai?.widgetState);
  window.addEventListener('openai:set_globals', event => restore(event.detail?.globals?.widgetState));
  root.addEventListener('click', event => {
    const tab = event.target.closest('[role="tab"]');
    if (tab && root.contains(tab)) {
      const key = tab.id.replace('properties-tab-', '');
      if (keys.includes(key)) {
        activeTab = key;
        if (window.openai?.setWidgetState) {
          window.openai.setWidgetState({modelContent: null, privateContent: {tab: key}}).catch(() => {});
        }
      }
    }
    const link = event.target.closest('a[data-panel][data-row]');
    if (!link || !root.contains(link)) return;
    event.preventDefault();
    document.getElementById('properties-tab-' + link.dataset.panel).click();
    const row = document.getElementById(link.dataset.row);
    row.closest('.property-group').open = true;
    row.open = true;
    requestAnimationFrame(() => row.scrollIntoView({block: 'nearest'}));
  });
})();
</script>""")
    fragment = "\n".join(out) + "\n"
    assert rendered == sum(map(len, data.values()))
    assert fragment.count('<details class="property" id=') == rendered
    assert all(f'id="properties-panel-{key}"' in fragment for key, _, _ in PANELS)
    return fragment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="absolute output path for the HTML fragment")
    args = parser.parse_args()
    if not args.output.is_absolute():
        parser.error("output path must be absolute")
    data = {key: load(key) for key, _, _ in PANELS}
    known = {key: {row["id"] for row in rows} for key, rows in data.items()}
    for row in data["target"]:
        for ref in row["references"]:
            if not isinstance(ref, dict) or ref.get("panel") not in ("native", "datasheet") or ref.get("id") not in known[ref["panel"]]:
                raise ValueError(f"target/{row['id']}: invalid reference")
    fragment = build(data)
    if len(fragment.encode("utf-8")) >= 1_000_000:
        raise ValueError("fragment exceeds 1 MB")
    args.output.write_text(fragment, encoding="utf-8")
    print(f"{args.output}: " + ", ".join(f"{key}={len(rows)}" for key, rows in data.items()))


if __name__ == "__main__":
    main()
