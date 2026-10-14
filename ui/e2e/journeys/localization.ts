import { test, expect } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function localizationJourney({
  page,
  nav,
  button,
  scope,
  sheet,
  keyCard,
  keyFilters,
  emptyShelf,
}: JourneyContext) {
  await test.step("one language per UI: the English UI shows no French, the French UI no English", async () => {
    // Sentinels: UI words of the other language, in visible text and accessible names. Fixture data
    // is English in both UIs ("QA Development Key", "Synthetic … client", "QA Opus saved", "Synthetic
    // Provider"), so the English sentinels avoid its words; proper names (Registry, Bifrost, Models.dev)
    // are shared.
    const sentinels = {
      en: /[àâçéèêëîïôûùœ«»]|\b(Oui|Non|Autre|[Ii]nconnue?|nouveau|Fournisseur|[Ff]iche)\b/,
      fr: /\b(Unknown|unknown|Yes|No|Other|Saved|Partial|Loading|Search|Creator|(?<!Synthetic )Provider|Reference|Datasheet|Model|Models(?!\.dev)|Native|Workspace|Catalog|Access|Accesses|Capabilities|Modalities|Series|Tasks|Settings|Show|View|Create|Delete|Name|Review|Cancel|Save|Open|Edit|Declared|declared|Configured|available|[Dd]etails|Input|Output|[Pp]rice|the|and|with|of)\b/,
    };
    const sweep = async (language: "en" | "fr", where: string) => {
      const text = await page.evaluate(() =>
        [
          document.body.innerText,
          ...[...document.querySelectorAll("[aria-label], [title], [placeholder]")].flatMap(el =>
            ["aria-label", "title", "placeholder"].map(name => el.getAttribute(name) || ""),
          ),
        ].join("\n"),
      );
      expect
        .soft(
          text.split("\n").filter(line => sentinels[language].test(line)),
          `${where} in ${language === "en" ? "English" : "French"}`,
        )
        .toEqual([]);
    };
    const tour = async (language: "en" | "fr") => {
      const t = (english: string, french: string) => (language === "fr" ? french : english);
      const open = (name: string) =>
        page.getByRole("button", { name: t(`Open ${name} details`, `Ouvrir la fiche ${name}`), exact: true });
      const card = (name: string) => page.locator('[data-slot="card"]').filter({ has: open(name) });
      const popover = page.locator('[data-slot="popover-content"]');
      const accesses = async (name: string) => {
        await card(name)
          .getByRole("button", { name: new RegExp(`^${t("Accesses", "Accès")}`) })
          .click();
        await popover
          .getByText(t("Access IDs, matching and sources", "Identifiants, correspondances et sources"), { exact: true })
          .click();
      };
      await nav(t("My models", "Mes modèles")).click();
      await sweep(language, "My models");
      // The switch is announced as "Expert mode" / "Mode Expert", which contains the "Expert" it shows (WCAG 2.5.3).
      await expect(page.getByRole("switch", { name: t("Expert mode", "Mode Expert"), exact: true })).toBeVisible();
      // #96: the help panel and the tour read in one language too, and the help covers adoption.
      await button(t("Help for My models", "Aide pour Mes modèles")).click();
      const help = page.getByRole("dialog", { name: t("Help", "Aide"), exact: true });
      await expect(help).toContainText(t("Keep [provider] in Bifrost", "Garder [fournisseur] dans Bifrost"));
      await sweep(language, "Help panel");
      await help.getByRole("button", { name: t("Start the tour", "Commencer la visite"), exact: true }).click();
      for (const [i, name] of [
        t("My models", "Mes modèles"),
        t("Groups", "Groupes"),
        t("Virtual keys", "Clés virtuelles"),
        t("Adopting a key", "Adopter une clé"),
      ].entries()) {
        await expect(page.getByRole("dialog", { name, exact: true })).toBeVisible();
        await sweep(language, `Tour step ${i + 1}`);
        if (i < 3) await button(t("Next", "Suivant")).click();
      }
      await button(t("Done", "Terminé")).click();
      // "+1 available" agrees with its count ("+1 disponible", never "+1 disponibles") and is said once, by the badge.
      await expect(card("QA Opus saved").locator("[data-attention]")).toHaveText(
        language === "fr" ? "+1 disponible" : "+1 available",
      );
      await expect(
        card("QA Opus saved").getByRole("button", { name: new RegExp(`^${t("Accesses", "Accès")}`) }),
      ).toHaveAccessibleName(`${t("Accesses", "Accès")} · 1 · QA Opus saved`);
      await accesses("QA Opus saved");
      await sweep(language, "Accesses popover of a saved card");
      await page.keyboard.press("Escape");
      const view = async (name: string) => {
        await button(t("View options", "Options d’affichage")).click();
        await page.getByRole("radio", { name, exact: true }).click();
        await page.keyboard.press("Escape");
      };
      await view(t("Table", "Tableau"));
      await sweep(language, "My models as a table");
      await view(t("Grid", "Grille"));
      // Prices follow the UI language without float noise: Bifrost's 2e-7 per token reads 0.2 per million.
      await scope(new RegExp(`^${t("To add", "À ajouter")}`)).click();
      await page
        .getByRole("textbox", { name: t("Search models", "Rechercher des modèles"), exact: true })
        .fill("qa-opus");
      await expect(card("QA Opus").locator("[data-attention]")).toHaveText(
        t("Add to QA Opus saved", "Ajouter à QA Opus saved"),
      );
      await expect(
        card("QA Opus").getByRole("button", { name: new RegExp(`^${t("Add to card", "Ajouter à la fiche")}`) }),
      ).toBeVisible();
      await sweep(language, "A model to add that fits saved cards");
      await page
        .getByRole("textbox", { name: t("Search models", "Rechercher des modèles"), exact: true })
        .fill("qa-reasoner");
      await accesses("QA Reasoner");
      await expect(popover).toContainText(language === "fr" ? /Prix entrée 0,2\s\$\/M/ : /Input price \$0\.2\/M/);
      await expect(popover).not.toContainText("0.19999");
      await sweep(language, "Accesses popover of a model to add");
      await page.keyboard.press("Escape");
      // #100: registering ends on one plain sentence of consequence, IDs folded away, in both languages.
      await open("QA Reasoner").click();
      // The Call name field and its hint read in one language too.
      await expect(sheet().getByRole("textbox", { name: t("Call name", "Nom d’appel"), exact: true })).toHaveValue(
        "qa-reasoner",
      );
      await expect(
        sheet().getByText(
          t(
            "The name applications use to call this model",
            "Le nom que les applications utilisent pour appeler ce modèle",
          ),
          { exact: true },
        ),
      ).toBeVisible();
      await sweep(language, "Register accesses step");
      await button(t("Next: model details", "Suivant : fiche modèle")).click();
      await button(t("Review", "Vérifier")).click();
      await expect(sheet().locator("#editor-journey-step-2")).toContainText(
        language === "fr"
          ? /Vous enregistrez QA Reasoner depuis (votre abonnement|vos abonnements) .+\. Il apparaîtra dans Mes modèles ; aucune clé ne pourra l’utiliser tant que vous ne l’aurez pas ajouté à une clé\./
          : /You’re registering QA Reasoner from your .+ subscriptions?\. It appears in My models; no key can use it until you add it to one\./,
      );
      await expect(sheet().getByText(t("Technical details", "Détails techniques"), { exact: true })).toBeVisible();
      await expect(
        sheet().getByText(t("Registry exposed ID", "ID exposé Registry"), { exact: false }).first(),
      ).toBeHidden();
      await sweep(language, "Register review");
      await button(t("Cancel", "Annuler")).click();
      await sheet().waitFor({ state: "hidden" });
      await page.getByRole("textbox", { name: t("Search models", "Rechercher des modèles"), exact: true }).fill("");
      await scope(new RegExp(`^${t("In Registry", "Dans Registry")}`)).click();
      // The card sheet: every tab, the access chooser and Review.
      await open("QA Opus saved").click();
      for (const tab of [
        t("Overview", "Vue d’ensemble"),
        t("Properties", "Propriétés"),
        t("Sources", "Sources"),
        t("Access", "Accès"),
      ]) {
        await sheet().getByRole("tab", { name: tab, exact: true }).click();
        await sweep(language, `Card sheet, ${tab} tab`);
      }
      await button(t("More actions", "Plus d’actions")).click();
      await sweep(language, "Card actions menu");
      await page.keyboard.press("Escape");
      await button(t("Edit accesses", "Modifier les accès")).click();
      await sweep(language, "Access chooser");
      await button(t("Review", "Vérifier")).click();
      await expect(sheet().locator("#editor-journey-step-2")).toContainText(
        t("No changes to save for QA Opus saved yet.", "Rien à enregistrer pour QA Opus saved pour le moment."),
      );
      await sweep(language, "Card review (nothing to save)");
      await page.keyboard.press("Escape");
      await sheet().waitFor({ state: "hidden" });
      await nav(t("Groups", "Groupes")).click();
      await sweep(language, "Groups");
      await button(t("Edit group", "Modifier le groupe")).first().click();
      await expect(sheet()).toContainText(
        t("Review the key impact before publishing.", "Vérifiez l’impact sur les clés avant la publication."),
      );
      await sweep(language, "Group sheet");
      await page.keyboard.press("Escape");
      await sheet().waitFor({ state: "hidden" });
      await nav(t("Virtual keys", "Clés virtuelles")).click();
      await sweep(language, "Virtual keys");
      // The adoption dialog reads the reasons Bifrost sends in plain words (a key allowed every provider blocks this one).
      await keyCard("QA All Providers Key")
        .getByRole("button", {
          name: t("See what blocks it · QA All Providers Key", "Voir ce qui bloque · QA All Providers Key"),
          exact: true,
        })
        .click();
      await button(t("Adopt this key", "Adopter cette clé")).click();
      await expect(page.getByRole("dialog")).toContainText(
        t(
          "allows every provider, including ones added later",
          "autorise tous les fournisseurs, y compris ceux ajoutés plus tard",
        ),
      );
      await expect(page.getByRole("dialog")).not.toContainText("allow_all_providers");
      await sweep(language, "Adoption dialog");
      // #93: the native edit offered here (and for the Mistral key below) reads in one language too; Cancel writes nothing.
      const nativeEdit = async (action: string, title: string, where: string) => {
        await page
          .getByRole("dialog")
          .getByRole("button", { name: new RegExp(`^${action}`) })
          .click();
        const edit = page.getByRole("dialog", { name: title, exact: true });
        await expect(edit.getByRole("list", { name: t("Allowed afterwards", "Autorisé ensuite") })).toBeVisible();
        await sweep(language, where);
        await edit.getByRole("button", { name: t("Cancel", "Annuler"), exact: true }).click();
        await expect(edit).toHaveCount(0);
      };
      await nativeEdit(
        t("Replace “all providers” by the explicit list", "Remplacer « tous les fournisseurs » par la liste explicite"),
        t("Replace “all providers” on the key", "Remplacer « tous les fournisseurs » sur la clé"),
        "Native edit preview of the all-providers key",
      );
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("Cancel", "Annuler"), exact: true })
        .click();
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      // #87: readiness filter, per-provider permission counts and the grouped blockers (models Bifrost
      // does not list, models to add) read in one language too.
      await keyFilters();
      await page
        .getByRole("combobox", { name: t("Filter by readiness", "Filtrer par état d’adoption"), exact: true })
        .click();
      await sweep(language, "Readiness filter");
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape"); // closes Filters
      await emptyShelf();
      // An empty key asks for models in Bifrost; a key allowing every model of a provider says why it cannot be adopted.
      await keyCard("QA Unmanaged Key")
        .getByRole("button", { name: t("Open · QA Unmanaged Key", "Ouvrir · QA Unmanaged Key"), exact: true })
        .click();
      await expect(
        page.getByText(
          t("Add models to this key in Bifrost first", "Ajoutez d’abord des modèles à cette clé dans Bifrost"),
          { exact: true },
        ),
      ).toBeVisible();
      await sweep(language, "Key page of the empty key");
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      await keyCard("QA Claude Key")
        .getByRole("button", {
          name: t("See what blocks it · QA Claude Key", "Voir ce qui bloque · QA Claude Key"),
          exact: true,
        })
        .click();
      await button(t("Adopt this key", "Adopter cette clé")).click();
      await sweep(language, "Adoption dialog of the all-models key");
      await page
        .getByRole("dialog")
        .getByRole("button", { name: t("Cancel", "Annuler"), exact: true })
        .click();
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      for (const name of ["QA Mistral Key", "QA Hermes Key", "QA To Add Key"]) {
        await keyCard(name)
          .getByRole("button", { name: t(`See what blocks it · ${name}`, `Voir ce qui bloque · ${name}`), exact: true })
          .click();
        await page
          .getByRole("list", { name: t("Bifrost allows today", "Bifrost autorise aujourd’hui") })
          .locator("summary")
          .first()
          .click();
        await sweep(language, `Key page of ${name}`);
        await button(t("Adopt this key", "Adopter cette clé")).click();
        // The intro and the models are said in the dialog's own language, with nothing to open.
        await expect(page.getByRole("dialog")).toContainText(
          t(
            "Adopting itself changes nothing in Bifrost; the options marked “Changes Bifrost” do.",
            "Adopter ne change rien dans Bifrost en soi ; les options marquées « Modifie Bifrost » le font.",
          ),
        );
        await expect(page.getByRole("dialog")).not.toContainText(
          t("Show model names", "Afficher les noms des modèles"),
        );
        await sweep(language, `Adoption dialog of ${name}`);
        // Mistral is disabled in Bifrost, so it starts kept (swept above); undoing it shows the offers.
        if (name !== "QA To Add Key") {
          await page
            .getByRole("dialog")
            .getByRole("button", {
              name: t("Stop keeping Mistral in Bifrost", "Ne plus garder Mistral dans Bifrost"),
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog")
            .getByRole("button", { name: t("Keep Mistral in Bifrost", "Garder Mistral dans Bifrost"), exact: true })
            .waitFor();
          // #100: the blockers read as plain sentences in both languages.
          if (name === "QA Mistral Key")
            await expect(page.getByRole("dialog")).toContainText(
              t(
                "So Bifrost shows none of its models, and Registry can’t manage the 3 models this key allows.",
                "Bifrost ne montre donc aucun de ses modèles : Registry ne peut pas gérer les 3 modèles que cette clé autorise.",
              ),
            );
          if (name === "QA Mistral Key")
            await expect(page.getByRole("dialog")).toContainText(
              t("1 model is allowed through Codex and Claude.", "1 modèle est autorisé via Codex et Claude."),
            );
          if (name === "QA Mistral Key")
            await expect(page.getByRole("dialog")).toContainText(t("Model: qa-shared", "Modèle : qa-shared"));
          if (name === "QA Mistral Key")
            await expect(
              page.getByRole("dialog").getByRole("button", {
                name: t("Use Codex for this model", "Utiliser Codex pour ce modèle"),
                exact: true,
              }),
            ).toBeVisible();
          await sweep(language, `Adoption dialog of ${name}, provider not kept`);
        }
        if (name === "QA Hermes Key")
          await nativeEdit(
            t("Remove these models from the key in Bifrost", "Retirer ces modèles de la clé dans Bifrost"),
            t("Remove models from the key in Bifrost", "Retirer des modèles de la clé dans Bifrost"),
            "Native edit preview of the Hermes key",
          );
        await page
          .getByRole("dialog")
          .getByRole("button", { name: t("Cancel", "Annuler"), exact: true })
          .click();
        await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      }
      // #110: the page checks the key with Bifrost as it opens, in both languages; no click is needed.
      await keyCard("QA Visual Key")
        .getByRole("button", { name: t("Open · QA Visual Key", "Ouvrir · QA Visual Key"), exact: true })
        .click();
      await expect(
        page.getByRole("heading", {
          name: t("This key can call 1 model", "Cette clé peut appeler 1 modèle"),
          level: 2,
        }),
      ).toBeVisible();
      await sweep(language, "Key page, checked on open");
      await button(t("All virtual keys", "Toutes les clés virtuelles")).click();
      await keyCard("QA Development Key")
        .getByRole("button", { name: t("Open · QA Development Key", "Ouvrir · QA Development Key"), exact: true })
        .click();
      await sweep(language, "Key page");
      await button(t("More actions", "Plus d’actions")).click();
      await expect(
        page.getByRole("menuitem", {
          name: t("Re-link the Bifrost key", "Relier à nouveau la clé Bifrost"),
          exact: true,
        }),
      ).toBeVisible();
      await sweep(language, "Key actions menu");
      await page.keyboard.press("Escape");
      await button(t("Edit selection", "Modifier la sélection")).click();
      await sweep(language, "Key editor");
      await page
        .getByRole("list", { name: t("Key composition steps", "Étapes de composition de la clé") })
        .getByRole("button", { name: new RegExp(`^\\d ${t("Review", "Vérifier")}`) })
        .click();
      await sweep(language, "Key review");
      await nav(t("Settings", "Réglages")).click();
      for (const section of [
        t("General", "Général"),
        t("Appearance", "Affichage"),
        t("Catalog sources", "Sources"),
        t("Connection", "Connexion"),
        t("AI assistance", "Assistance"),
        t("Help", "Aide"),
      ]) {
        await button(section).click();
        await sweep(language, `Settings, ${section}`);
      }
      await button(t("Open catalog data", "Ouvrir les données du catalogue")).click();
      await page.getByRole("button").filter({ hasText: "synthetic-provider/qa-chat" }).first().click();
      await sweep(language, "Catalog data");
    };
    await tour("en");
    await page.getByRole("combobox", { name: "Language: English", exact: true }).click();
    await page.getByRole("option", { name: "Français", exact: true }).click();
    await tour("fr");
    const bare = await page.context().newPage();
    await bare.goto("/");
    await expect(bare.locator("html")).toHaveAttribute("lang", "fr");
    await bare.goto("/?lang=en");
    await expect(bare.locator("html")).toHaveAttribute("lang", "en");
    await bare.close();
    await page.getByRole("combobox", { name: "Langue : français", exact: true }).click();
    await page.getByRole("option", { name: "English", exact: true }).click();
  });
}
