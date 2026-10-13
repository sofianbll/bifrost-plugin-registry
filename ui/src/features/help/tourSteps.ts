// The guided tour (#96): where it goes, and whether this browser has been offered it.
export const tourKey = "bifrost-registry.tour.v1";

export type TourPage = "models" | "groups" | "keys";
// Each step names the page it needs and the `data-tour` anchors it can point at, best first.
export type TourStep = { id: "models" | "groups" | "keys" | "adoption"; page: TourPage; anchors: string[] };
export const tourSteps: TourStep[] = [
  { id: "models", page: "models", anchors: ["first-model", "filters"] },
  { id: "groups", page: "groups", anchors: ["first-group", "groups"] },
  { id: "keys", page: "keys", anchors: ["first-key", "keys"] },
  { id: "adoption", page: "keys", anchors: ["adoption", "keys"] },
];

// The first anchor of the step that the page has; undefined means the step is skipped.
export const pickAnchor = (step: TourStep, present: (anchor: string) => boolean) => step.anchors.find(present);

type Memory = Pick<Storage, "getItem" | "setItem">;
const browserStorage = (): Memory | null => {
  try {
    return localStorage;
  } catch {
    return null;
  }
};

// A browser that keeps nothing (private window, blocked site data) reads as "seen": it is not offered
// the tour on every load, and "?" still starts it.
export const tourSeen = (storage: Memory | null = browserStorage()) => {
  try {
    return storage ? storage.getItem(tourKey) !== null : true;
  } catch {
    return true;
  }
};
export const markTourSeen = (storage: Memory | null = browserStorage()) => {
  try {
    storage?.setItem(tourKey, "1");
  } catch {
    /* the page keeps its own flag for this load */
  }
};
