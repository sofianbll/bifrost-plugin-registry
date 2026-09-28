import { cardFormat, defaultViewOptions, displayFormat, gridColumns, updateViewOverride, type ViewOptions } from "./ViewOptions";

const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

// cardFormat maps shape/layout to the card format used by CatalogCard/CatalogGrid.
assert(cardFormat({ layout: "grid", shape: "rectangle" }) === "compact", "rectangle grid should be compact");
assert(cardFormat({ layout: "grid", shape: "square" }) === "square", "square grid should be square");
assert(cardFormat({ layout: "table", shape: "rectangle" }) === "compact", "table layout falls back to compact card");

// displayFormat maps the complete view state to the legacy three-way toggle format.
assert(displayFormat({ layout: "grid", shape: "rectangle", size: "small" }) === "compact", "legacy compact display");
assert(displayFormat({ layout: "grid", shape: "square", size: "medium" }) === "square", "legacy square display");
assert(displayFormat({ layout: "table", shape: "rectangle", size: "small" }) === "table", "legacy table display");

// gridColumns maps density to the large-screen column count.
assert(gridColumns("small") === 4, "small density -> 4 columns");
assert(gridColumns("medium") === 3, "medium density -> 3 columns");
assert(gridColumns("large") === 2, "large density -> 2 columns");

// updateViewOverride tracks overrides for the new shape key.
const base: ViewOptions = defaultViewOptions;
const override = updateViewOverride(base, {}, { ...base, layout: "table" });
assert(override.layout === "table", "layout override recorded");
assert(override.shape === undefined, "shape unchanged from base -> no override");
const withShape = updateViewOverride(base, override, { ...base, layout: "table", shape: "square" });
assert(withShape.layout === "table", "layout override kept");
assert(withShape.shape === "square", "shape override recorded");
const backToBase = updateViewOverride(base, withShape, base);
assert(Object.keys(backToBase).length === 0, "returning to base clears overrides");

console.log("ViewOptions state checks passed");
