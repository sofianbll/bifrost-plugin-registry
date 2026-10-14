import { skipTour, expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function catalogResilienceJourneys({
  baseURL,
  browser,
  errors,
  api,
  workspace,
  cardActions,
  duplicates,
}: JourneyContext) {
  await test.step("large catalogs remain reachable and metadata failure keeps model editing", async () => {
    const stress = await browser.newPage({ baseURL, viewport: { width: 1440, height: 950 } });
    await skipTour(stress);
    stress.setDefaultTimeout(10_000);
    stress.on("pageerror", e => errors.push(e.message));
    const catalog = await api("catalog");
    // qa-1 shares qa-0's display name: their card actions must still be told apart.
    const models = Array.from({ length: 65 }, (_, i) => ({
      ...structuredClone(workspace.data.models[0]),
      id: `qa-${i}`,
      name: `QA Model ${i === 1 ? 0 : i}`,
      accesses: [
        {
          provider: "synthetic-provider",
          id: `synthetic-provider/qa-${i}`,
          nativeModel: `qa-${i}`,
          status: "Configured",
          route: "Direct provider",
        },
      ],
    }));
    const large = { ...workspace, data: { ...workspace.data, models }, discovery: [] };
    const references = models.map(m => ({
      ...structuredClone(catalog.references[0]),
      id: `fixture/${m.id}`,
      fields: { name: { value: m.name, source: "fixture", kind: "declared" } },
    }));
    const accesses = models.map(m => ({
      id: `synthetic-provider/${m.id}`,
      provider: "synthetic-provider",
      model: m.id,
      referenceId: `fixture/${m.id}`,
      configured: true,
      fields: {},
      overrides: {},
    }));
    await stress.route("**/api/workspace", r => r.fulfill({ json: large }));
    let release!: () => void;
    const held = new Promise<void>(resolve => {
      release = resolve;
    });
    await stress.route("**/api/catalog", async r => {
      await held;
      await r.fulfill({ json: { ...catalog, references, accesses } });
    });
    await stress.goto("/");
    await expect(
      stress.getByRole("status", { name: "Loading model cards…" }),
      "A skeleton holds the place of the cards",
    ).toBeVisible();
    const registry = stress.getByRole("radio", { name: /^In Registry/ });
    await expect(registry, "The saved-card count does not wait for the catalogue").toHaveAccessibleName(
      "In Registry (65)",
    );
    release();
    await stress.getByRole("button", { name: /Show more/ }).waitFor();
    await expect(registry).toHaveAccessibleName("In Registry (65)");
    await stress.getByRole("button", { name: /Show more/ }).click();
    await expect(stress.getByRole("button", { name: /^Open .* details$/ })).toHaveCount(65);
    const shared = await cardActions(stress);
    expect(shared).toEqual(
      expect.arrayContaining(["Open QA Model 0 (qa-0) details", "Open QA Model 0 (qa-1) details"]),
    );
    expect(duplicates(shared), "Cards sharing a display name").toEqual([]);
    await stress.getByRole("link", { name: "Settings", exact: true }).click();
    await stress.getByRole("button", { name: "Open catalog data", exact: true }).click();
    await stress.getByRole("button", { name: /Show more/ }).click();
    await stress.getByText("Showing 65 of 65 matching entries.", { exact: false }).waitFor();
    await stress.unroute("**/api/catalog");
    await stress.route("**/api/catalog", r =>
      r.fulfill({ status: 503, json: { error: "Synthetic metadata offline" } }),
    );
    await stress.getByRole("link", { name: "My models", exact: true }).click();
    await stress.reload(); // the catalogue is read once per revision: a failure shows on the next load
    await stress.getByText(/Model details unavailable/).waitFor();
    const fallback = await cardActions(stress);
    expect(fallback).toEqual(expect.arrayContaining(["View details · QA Model 0 (qa-1)"]));
    expect(duplicates(fallback), "Fallback cards sharing a display name").toEqual([]);
    await stress
      .getByRole("button", { name: /^View details/ })
      .first()
      .click();
    await stress.locator('[data-slot="sheet-content"]').getByRole("button", { name: "Edit", exact: true }).waitFor(); // read-first; was Save model
    await stress.close();
  });

  await test.step("no browser JavaScript errors", async () => {
    expect(errors).toEqual([]);
  });
}
