import type { Locator } from "@playwright/test";
import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function nativePermissionJourney({ page, api, nav, keyCard, button }: JourneyContext) {
  await test.step("a blocked key loses what Registry cannot represent only after a preview and a confirmation, then it is adopted (#93)", async () => {
    // The fixture records every native key update exactly as the panel sent it.
    const nativeWrites = async (): Promise<{ keyId: string; body: Record<string, unknown> }[]> =>
      (await page.request.get("/__fixture/native-writes")).json();
    const nativeKey = async (id: string) => (await api("workspace")).data.keys.find((k: { id: string }) => k.id === id);
    const written = (await nativeWrites()).length;
    const dialog = page.getByRole("dialog");
    const lines = (edit: Locator, name: string) => edit.getByRole("list", { name, exact: true });
    await nav("Virtual keys").click();

    // Models Bifrost does not list (Mistral is disabled): the dialog offers to remove them, with the consequence stated.
    await keyCard("QA Hermes Key")
      .getByRole("button", { name: "See what blocks it · QA Hermes Key", exact: true })
      .click();
    await button("Adopt this key").click();
    // Mistral starts kept in Bifrost (it is disabled there); stopping that offers the native edit instead.
    await dialog.getByRole("button", { name: "Stop keeping Mistral in Bifrost", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Adopt", exact: true })).toBeDisabled();
    await expect(dialog).toContainText("Changes the key in Bifrost once you confirm a preview");
    // What changes Bifrost is tagged; keeping the provider in Bifrost is not.
    await expect(dialog.getByText("Changes Bifrost", { exact: true })).toHaveCount(1);
    await dialog.getByRole("button", { name: /^Remove these models from the key in Bifrost/ }).click();
    const edit = page.getByRole("dialog", { name: "Remove models from the key in Bifrost", exact: true });
    await expect(edit).toContainText("This changes the key in Bifrost, not only in Registry.");
    await expect(edit).toContainText("Requests that use these models will be refused.");
    await expect(lines(edit, "Allowed today")).toContainText("Mistral · 2 models");
    await expect(lines(edit, "Allowed afterwards")).toContainText("Claude · 2 models");
    await expect(lines(edit, "Allowed afterwards")).not.toContainText("Mistral");
    await lines(edit, "Removed from the key").getByText("Mistral · 2 models", { exact: true }).click();
    await expect(lines(edit, "Removed from the key")).toContainText("qa-mistral-large, qa-mistral-small");
    // Nothing is written before the confirmation, and Cancel keeps it that way.
    expect(await nativeWrites()).toHaveLength(written);
    await edit.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(edit).toHaveCount(0);
    expect(
      (await nativeKey("vk-qa-hermes")).permissions.providers.map((p: { provider: string }) => p.provider),
    ).toEqual(["mistral", "Claude"]);
    expect(await nativeWrites()).toHaveLength(written);

    await dialog.getByRole("button", { name: /^Remove these models from the key in Bifrost/ }).click();
    const confirmation = page.waitForRequest(
      r =>
        r.method() === "POST" && r.url().endsWith("/api/keys/native-permissions") && r.postDataJSON().phase === "apply",
    );
    await edit.getByRole("button", { name: "Confirm: remove 2 models", exact: true }).click();
    expect((await confirmation).postDataJSON()).toEqual({
      keyId: "vk-qa-hermes",
      operation: "remove-models",
      provider: "mistral",
      phase: "apply",
      previewToken: expect.any(String),
      confirm: true,
    });
    await expect(edit.getByRole("status")).toContainText("Done. 2 models removed from the key in Bifrost.");
    await expect(lines(edit, "Allowed now")).toContainText("Claude · 2 models");
    // The whole key was reposted from its read-back: only the Mistral row is gone.
    const writes = await nativeWrites();
    expect(writes).toHaveLength(written + 1);
    expect(writes[written]).toEqual({
      keyId: "vk-qa-hermes",
      body: {
        name: "QA Hermes Key",
        description: "Synthetic Hermes client",
        is_active: true,
        allow_all_providers: false,
        provider_configs: [
          {
            id: expect.any(Number),
            provider: "Claude",
            weight: null,
            allowed_models: ["qa-haiku", "qa-opus"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
        ],
      },
    });
    await edit.getByRole("button", { name: "Back to adoption", exact: true }).click();
    // The readiness refreshed behind the dialog: the key can be adopted now.
    await expect(dialog).not.toContainText("before adopting");
    await expect(dialog.getByRole("button", { name: /^Remove these models/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    const hermes = await nativeKey("vk-qa-hermes");
    expect(hermes.managed).toBe(true);
    expect([...hermes.policy.added].sort()).toEqual(["qa-haiku", "qa-opus"]);
    expect(await nativeWrites()).toHaveLength(written + 1);

    // "All providers": the dialog offers the explicit list; the preview names what stops being allowed.
    await button("All virtual keys").click();
    await keyCard("QA All Providers Key")
      .getByRole("button", { name: "See what blocks it · QA All Providers Key", exact: true })
      .click();
    await button("Adopt this key").click();
    await expect(dialog).toContainText("This key allows every provider, including ones added later");
    await expect(dialog.getByRole("button", { name: /^Remove these models/ })).toHaveCount(0);
    await dialog.getByRole("button", { name: "Replace “all providers” by the explicit list", exact: true }).click();
    const replace = page.getByRole("dialog", { name: "Replace “all providers” on the key", exact: true });
    await expect(replace).toContainText(
      "Providers added to Bifrost later are not allowed until you add them to the key.",
    );
    await expect(lines(replace, "Allowed today")).toContainText("All providers");
    const afterwards = lines(replace, "Allowed afterwards");
    await expect(afterwards.locator("summary")).toHaveText([
      "Claude · 5 models",
      "Codex · 2 models",
      "Google · 2 models",
      "Synthetic Provider · 3 models",
    ]);
    // Disabled Mistral is not a provider the key can reach today. Left out: qa-shared at Codex (Claude serves it first: one access per model),
    // qa-image (its card was deleted above) and the models without a card.
    await expect(lines(replace, "Removed from the key").locator("summary")).toHaveText([
      "Codex · 1 model",
      "Google · 1 model",
      /^OpenRouter · \d+ models$/,
      "Synthetic Provider · 1 model",
      "Typesafe · 1 model",
    ]);
    expect(await nativeWrites()).toHaveLength(written + 1);
    const replacement = page.waitForRequest(
      r =>
        r.method() === "POST" && r.url().endsWith("/api/keys/native-permissions") && r.postDataJSON().phase === "apply",
    );
    await replace.getByRole("button", { name: "Confirm: replace “all providers”", exact: true }).click();
    expect((await replacement).postDataJSON()).toMatchObject({
      keyId: "vk-qa-all-providers",
      operation: "replace-all-providers",
      phase: "apply",
      confirm: true,
    });
    await expect(replace.getByRole("status")).toContainText("Done. The key no longer allows every provider");
    expect((await nativeWrites())[written + 1]).toEqual({
      keyId: "vk-qa-all-providers",
      body: {
        name: "QA All Providers Key",
        description: "Synthetic client allowed every provider",
        is_active: true,
        allow_all_providers: false,
        provider_configs: [
          {
            provider: "Claude",
            weight: null,
            allowed_models: ["qa-haiku", "qa-opus", "qa-opus-fast", "qa-shared", "qa-sonnet"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
          {
            provider: "Codex",
            weight: null,
            allowed_models: ["qa-codex", "qa-codex-mini"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
          {
            provider: "Google",
            weight: null,
            allowed_models: ["qa-flash", "qa-gemini"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
          {
            provider: "synthetic-provider",
            weight: null,
            allowed_models: ["qa-chat", "qa-code", "qa-vision"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
        ],
      },
    });
    await replace.getByRole("button", { name: "Back to adoption", exact: true }).click();
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await nativeKey("vk-qa-all-providers")).managed).toBe(true);
    expect(await nativeWrites()).toHaveLength(written + 2);

    // Every model of Claude ("*"): the dialog offers the models saved in Registry instead; Bifrost is written
    // only after the confirmation, and the key is then adopted.
    await button("All virtual keys").click();
    await keyCard("QA Claude Key")
      .getByRole("button", { name: "See what blocks it · QA Claude Key", exact: true })
      .click();
    await button("Adopt this key").click();
    await dialog.getByRole("button", { name: /^Replace “all models” by the models saved in Registry/ }).click();
    const narrow = page.getByRole("dialog", { name: "Replace “all models” of Claude on the key", exact: true });
    await expect(narrow).toContainText("Claude stops allowing every model");
    await expect(narrow).toContainText("Models Claude adds later are not allowed until you add them to the key.");
    await expect(lines(narrow, "Allowed today")).toContainText("Claude · all models");
    await expect(lines(narrow, "Allowed afterwards").locator("summary")).toHaveText(["Claude · 5 models"]);
    // Every Claude model has a card: nothing is left out, and the row (with its limits) stays.
    await expect(lines(narrow, "Removed from the key")).toHaveCount(0);
    await expect(narrow).not.toContainText("budgets");
    expect(await nativeWrites()).toHaveLength(written + 2);
    const narrowing = page.waitForRequest(
      r =>
        r.method() === "POST" && r.url().endsWith("/api/keys/native-permissions") && r.postDataJSON().phase === "apply",
    );
    await narrow.getByRole("button", { name: "Confirm: replace “all models”", exact: true }).click();
    expect((await narrowing).postDataJSON()).toEqual({
      keyId: "vk-qa-claude",
      operation: "replace-all-models",
      provider: "Claude",
      phase: "apply",
      previewToken: expect.any(String),
      confirm: true,
    });
    await expect(narrow.getByRole("status")).toContainText("Done. Claude no longer allows every model");
    expect((await nativeWrites())[written + 2]).toEqual({
      keyId: "vk-qa-claude",
      body: {
        name: "QA Claude Key",
        description: "Synthetic Claude client",
        is_active: true,
        allow_all_providers: false,
        provider_configs: [
          {
            id: expect.any(Number),
            provider: "Claude",
            weight: null,
            allowed_models: ["qa-haiku", "qa-opus", "qa-opus-fast", "qa-shared", "qa-sonnet"],
            blacklisted_models: [],
            key_ids: ["*"],
          },
        ],
      },
    });
    await narrow.getByRole("button", { name: "Back to adoption", exact: true }).click();
    await expect(dialog).not.toContainText("before adopting");
    await dialog.getByRole("button", { name: "Adopt", exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect((await nativeKey("vk-qa-claude")).managed).toBe(true);
    expect(await nativeWrites()).toHaveLength(written + 3);
    await button("All virtual keys").click();
  });
}
