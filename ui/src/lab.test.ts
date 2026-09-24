import { defaultViewOptions, updateViewOverride } from "./ViewOptions";
import { selectionCounts, setVisibleSelection } from "./selection";

const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const sizeOverride = updateViewOverride(defaultViewOptions, {}, { ...defaultViewOptions, size: "large" });
assert(Object.keys(sizeOverride).join() === "size", "local view change must not freeze global fields");
const changedBase = { ...defaultViewOptions, description: false };
const view = { ...changedBase, ...sizeOverride };
assert(view.description === false, "untouched field must follow later global settings");
const resetSize = updateViewOverride(changedBase, sizeOverride, { ...view, size: changedBase.size });
assert(Object.keys(resetSize).length === 0, "matching global value clears local override");

const counts = selectionCounts(["a", "b"], ["a", "c", "c"]);
assert(counts.visibleSelected === 1 && counts.visibleTotal === 2 && counts.hiddenSelected === 1, "counts must dedupe visible IDs and retain hidden choices");
assert(setVisibleSelection(["a", "b"], ["a", "c"], true).join() === "a,b,c", "select visible keeps hidden choices");
assert(setVisibleSelection(["a", "b"], ["a", "c"], false).join() === "b", "deselect visible keeps hidden choices");
assert(setVisibleSelection(["a"], [], false).join() === "a", "empty visible scope is a no-op");
console.log("View override and filtered selection: OK");
