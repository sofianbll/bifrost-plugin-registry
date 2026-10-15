// @ts-expect-error — Tests run in Node through tsx; the browser tsconfig excludes Node types.
import assert from "node:assert/strict";
import React from "react";
import { copy, exposed, type Demo, type Model } from "../../domain/registry";
import type { Confirm } from "../shared/useConfirmation";
import { useModelEditing } from "./useModelEditing";

// Only React's state/ref runtime is substituted; every mutation runs the production hook.
function editor(data: Demo) {
  const slots: unknown[] = [];
  let cursor = 0;
  let confirmation: Confirm | undefined;
  const writes: Demo[] = [];
  const internals = (
    React as unknown as { __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE: { H: unknown } }
  ).__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  const render = () => {
    cursor = 0;
    const previous = internals.H;
    internals.H = {
      useState(initial: unknown) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = initial;
        return [slots[index], (value: unknown) => (slots[index] = value)];
      },
      useRef(initial: unknown) {
        const index = cursor++;
        if (!(index in slots)) slots[index] = { current: initial };
        return slots[index];
      },
    };
    try {
      return useModelEditing(
        data,
        en => en,
        { current: false },
        () => data.models,
        () => null,
        value => {
          confirmation = value;
        },
        async next => {
          writes.push(next);
          return true;
        },
      );
    } finally {
      internals.H = previous;
    }
  };
  return {
    render,
    writes,
    confirm: () => {
      if (!confirmation) throw new Error("Missing confirmation");
      return confirmation.action();
    },
  };
}

const model: Model = {
  id: "sample",
  name: "Sample",
  creator: "Unknown",
  family: "Unknown",
  summary: "",
  context: "Unknown",
  inputModalities: [],
  outputModalities: [],
  tasks: [],
  kind: "Unknown",
  capabilities: {},
  accesses: ["alpha", "beta", "gamma"].map(provider => ({
    provider,
    id: `${provider}/sample`,
    nativeModel: "native",
    route: "Direct provider",
    status: "Configured",
    endpoints: ["chat/completions"],
  })),
};
const other: Model = { ...copy(model), id: "other", accesses: [{ ...model.accesses[0], id: "alpha/other" }] };
const fixture = (): Demo => ({
  models: [copy(model), copy(other)],
  groups: [],
  campaigns: [],
  keys: [
    {
      id: "key",
      name: "Key",
      client: "",
      active: true,
      revision: 3,
      observed: null,
      readError: false,
      policy: {
        groups: [],
        added: ["sample", "other"],
        excluded: ["sample"],
        naming: "provider/model",
        accessSelection: { sample: { added: ["alpha/sample"], excluded: ["beta/sample", "gamma/sample"] } },
      },
    },
  ],
});

const data = fixture();
const before = copy(data);
const deletion = editor(data);
deletion.render().deleteModel(model);
await deletion.confirm();
assert.equal(deletion.writes.length, 1);
assert.deepEqual(deletion.writes[0].keys[0].policy, {
  groups: [],
  added: ["other"],
  excluded: [],
  naming: "provider/model",
});
assert.deepEqual(data, before, "the live workspace is not mutated before commit");
console.log("model deletion cleans the last access selector and model references");

const removalData = fixture();
removalData.keys[0].policy.excluded = [];
removalData.keys[0].policy.accessSelection!.other = { added: [], excluded: ["alpha/other"] };
removalData.keys.push({
  ...copy(removalData.keys[0]),
  id: "witness",
  policy: { groups: [], added: ["other"], excluded: [], naming: "model" },
});
const removalBefore = copy(removalData);
const removal = editor(removalData);
removal.render().openModel(model, false);
removal.render().setModelDraft({ ...copy(model), accesses: model.accesses.slice(0, 2) });
await removal.render().updateModel([]);
assert.equal(removal.writes.length, 1);
const removed = removal.writes[0];
assert.deepEqual(removed.keys[0].policy.accessSelection, {
  sample: { added: ["alpha/sample"], excluded: ["beta/sample"] },
  other: { added: [], excluded: ["alpha/other"] },
});
assert.deepEqual(exposed(removed.keys[0].policy, removed.groups, removed.models), ["alpha/sample"]);
assert.deepEqual(removed.keys[1], removalBefore.keys[1], "other keys remain exact");
assert.deepEqual(removed.groups, removalBefore.groups);
assert.deepEqual(removed.models[1], removalBefore.models[1]);
assert.deepEqual(removalData, removalBefore);
console.log("access removal cleans stale selectors without selecting the other excluded access");

for (const selector of [
  { added: [], excluded: ["beta/sample", "gamma/sample"] },
  { added: ["beta/sample"], excluded: ["gamma/sample"] },
]) {
  const data = fixture();
  data.keys[0].policy.excluded = [];
  data.keys[0].policy.accessSelection = { sample: selector };
  const editing = editor(data);
  editing.render().openModel(model, false);
  editing.render().setModelDraft({ ...copy(model), accesses: model.accesses.slice(0, 1) });
  await editing.render().updateModel([]);
  const saved = editing.writes[0];
  assert.equal(Object.hasOwn(saved.keys[0].policy, "accessSelection"), false);
  assert.deepEqual(exposed(saved.keys[0].policy, saved.groups, saved.models), ["alpha/sample", "alpha/other"]);
}

const grouped = fixture();
grouped.groups = [
  { id: "simple", name: "Simple", description: "", members: ["sample", "other"] },
  { id: "locked", name: "Hidden rules", description: "Keep", members: ["other"], membersLocked: true },
];
grouped.keys[0].policy.accessSelection!.other = { added: ["alpha/other"], excluded: [] };
const groupedDeletion = editor(grouped);
groupedDeletion.render().deleteModel(model);
await groupedDeletion.confirm();
assert.deepEqual(groupedDeletion.writes[0].groups, [{ ...grouped.groups[0], members: ["other"] }, grouped.groups[1]]);
assert.deepEqual(groupedDeletion.writes[0].keys[0].policy.accessSelection, {
  other: { added: ["alpha/other"], excluded: [] },
});
console.log("empty selectors are omitted; unrelated selectors and hidden-rule groups survive");
