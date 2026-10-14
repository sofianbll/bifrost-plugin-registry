import { expect, test } from "../fixtures";
import type { JourneyContext } from "./helpers";

export async function groupJourney({ nav, button, sheet, page, api }: JourneyContext) {
  await test.step("group filter retains hidden selections and cancel protects draft", async () => {
    // Creating a group is now a three-step sheet: Details, Models, Review.
    await nav("Groups").click();
    await button("Create group").click();
    // Critique round 5: the sheet says "publishing", as its last button does, and "Required" is a neutral hint, not
    // an error, until the name is left empty.
    await expect(sheet()).toContainText("Review the key impact before publishing.");
    const groupName = page.getByRole("textbox", { name: "Group name *", exact: true });
    await expect(groupName).not.toHaveAttribute("aria-invalid", "true");
    await expect(sheet().getByText("Required", { exact: true })).not.toHaveClass(/destructive/);
    await page.getByRole("textbox", { name: "Description", exact: true }).click(); // leaves the empty name
    await expect(groupName).toHaveAttribute("aria-invalid", "true");
    await expect(sheet().getByText("Enter a group name.", { exact: true })).toBeVisible();
    await groupName.fill("QA Browser Group");
    await expect(groupName).not.toHaveAttribute("aria-invalid", "true");
    await button("Continue").click();
    await page.getByRole("checkbox", { name: "Select QA Code", exact: true }).check();
    // qa-haiku was saved with its common ID as name: the list reads its reference name, the ID below.
    await expect(
      page
        .locator('[data-slot="card"]')
        .filter({ has: page.getByRole("checkbox", { name: "Select QA Haiku", exact: true }) }),
    ).toContainText("qa-haiku");
    await page.getByRole("textbox", { name: "Search models", exact: true }).fill("vision");
    await page.getByRole("checkbox", { name: "Select QA Vision", exact: true }).check();
    await page.getByText(/2 total selected/).waitFor();
    await button("Cancel").click();
    await button("Keep editing").click();
    await button("Previous").click();
    await expect(page.getByRole("textbox", { name: "Group name *", exact: true })).toHaveValue("QA Browser Group");
    await button("Continue").click();
    await button("Continue").click();
    await button("Publish group").click();
    await sheet().waitFor({ state: "hidden" });
    const group = (await api("workspace")).data.groups.find((g: { name: string }) => g.name === "QA Browser Group");
    expect(group.members.sort()).toEqual(["qa-code", "qa-vision"]);
  });
}
