// @ts-expect-error Node-only test tooling; the UI tsconfig intentionally includes browser types only.
import assert from "node:assert/strict";
// @ts-expect-error Node-only test tooling; no runtime dependency or Node types are needed by the UI.
import { registerHooks } from "node:module";

// Only React's scheduling is replaced; the hook and override calculation run unchanged.
let states: unknown[] = [];
let cursor = 0;
let effects: (() => void)[] = [];
const hooks = {
  useState(initial: unknown) {
    const index = cursor++;
    if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
    return [
      states[index],
      (value: unknown) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      },
    ];
  },
  useEffect(effect: () => void) {
    effects.push(effect);
  },
};
Object.assign(globalThis, { preferenceTestHooks: hooks });
const registration = registerHooks({
  resolve(
    specifier: string,
    context: { parentURL?: string },
    nextResolve: (specifier: string, context: { parentURL?: string }) => { url: string },
  ) {
    if (specifier === "react" && context.parentURL?.endsWith("/useViewPreferences.ts"))
      return {
        url: "data:text/javascript,export const {useState,useEffect}=globalThis.preferenceTestHooks",
        shortCircuit: true,
      };
    return nextResolve(specifier, context);
  },
});
const { useViewPreferences } = await import("./useViewPreferences");
registration.deregister();
const { defaultViewOptions } = await import("../../components/registry/ViewOptions");
const render = () => {
  cursor = 0;
  effects = [];
  const result = useViewPreferences();
  for (const effect of effects) effect();
  return result;
};
const mount = (storage: Pick<Storage, "getItem" | "setItem">) => {
  states = [];
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  return render();
};

const denied = () => {
  throw new DOMException("Storage denied", "SecurityError");
};
let view = mount({ getItem: denied, setItem: denied });
assert.deepEqual(view.preferences, defaultViewOptions);
const exerciseMemory = () => {
  view.setPreferences({ ...view.preferences, size: "large" });
  view = render();
  assert.equal(view.preferences.size, "large", "a denied write keeps the preference in memory");
  view.setView("models", { ...view.viewFor("models"), layout: "table" });
  view = render();
  assert.equal(view.viewFor("models").layout, "table");
  assert.equal(view.viewFor("groups").layout, "grid", "overrides stay scoped");
  view.setPreferences({ ...view.preferences, description: false });
  view = render();
  assert.equal(view.viewFor("models").description, false, "unchanged fields follow global preferences");
  assert.equal(view.viewFor("models").layout, "table", "explicit overrides survive a global change");
  view.resetView("models");
  view = render();
  assert.deepEqual(view.viewFor("models"), view.preferences, "reset returns to current defaults");
  view.setListOverrides({ groups: { metadata: false } });
  view = render();
  assert.equal(view.viewFor("groups").metadata, false);
  view.setListOverrides({});
  view = render();
  assert.equal(view.viewFor("groups").metadata, true, "bulk reset clears session overrides");
};
exerciseMemory();

Object.defineProperty(globalThis, "localStorage", { configurable: true, get: denied });
states = [];
view = render();
assert.deepEqual(view.preferences, defaultViewOptions, "the storage property itself may be denied");
exerciseMemory();

let saved: string | null = null;
const storage = {
  getItem: () => saved,
  setItem: (key: string, value: string) => {
    assert.equal(key, "registry-prototype-view");
    saved = value;
  },
};
view = mount({ ...storage, getItem: denied });
assert.deepEqual(view.preferences, defaultViewOptions, "read denial falls back even when writes work");
for (const invalid of ["{broken", "null"]) {
  saved = invalid;
  view = mount(storage);
  assert.deepEqual(view.preferences, defaultViewOptions, "invalid saved JSON falls back to defaults");
}

saved = JSON.stringify({ layout: "table", logo: "provider" });
view = mount(storage);
assert.equal(view.preferences.layout, "table", "existing partial preferences load unchanged");
assert.equal(view.preferences.shape, "rectangle", "legacy preferences get the default shape");
assert.equal(view.preferences.logo, "provider");
view.setPreferences({ ...view.preferences, shape: "square", metadata: false });
view = render();
assert.deepEqual(JSON.parse(saved!), view.preferences, "normal writes keep the existing format");
view.setView("models", { ...view.viewFor("models"), size: "large" });
view = render();
assert.equal(JSON.parse(saved!).size, "small", "scope overrides are not persisted globally");
view = mount(storage);
assert.equal(view.preferences.shape, "square", "preferences survive a remount");
assert.equal(view.viewFor("models").size, "small", "scope overrides last only for the session");

let full = false;
view = mount({
  getItem: () => null,
  setItem: (key, value) => {
    if (full) throw new DOMException("Storage full", "QuotaExceededError");
    storage.setItem(key, value);
  },
});
full = true;
exerciseMemory();
assert.equal(JSON.parse(saved!).size, "small", "quota rejection leaves the previous persisted value intact");
console.log(
  "View preference storage checks passed (denied read/write, invalid JSON, quota, persistence, scope overrides)",
);
