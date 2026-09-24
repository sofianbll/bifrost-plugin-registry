import { fixture } from "./demo";
import { emptyTargetFilters, visibleHarnessTargets } from "./harness-targets";
import { selectionCounts, setVisibleSelection } from "./selection";

const assert = (condition: unknown) => { if (!condition) throw new Error("Harness target assertion failed"); };

const model = fixture.models.find(item => item.accesses.length > 1)!;
const provider = model.accesses[0].provider;
const other = model.accesses[1].id;
const visible = visibleHarnessTargets([model], [], { ...emptyTargetFilters, provider });
const ids = visible.flatMap(row => row.accesses.map(access => access.id));
assert(ids.length > 0 && !ids.includes(other));
const selected = setVisibleSelection([other], ids, true);
assert(selected.includes(other) && ids.every(id => selected.includes(id)));
assert(selectionCounts(selected, ids).hiddenSelected === 1);
assert(JSON.stringify(setVisibleSelection(selected, ids, false)) === JSON.stringify([other]));
assert(visibleHarnessTargets([model], [{ id: "empty", name: "Empty", description: "", members: [] }], { ...emptyTargetFilters, group: "empty" }).length === 0);
console.log("Harness target filtering and hidden selection: OK");
