import { useState } from "react";

// Page view state (search, filters, grouping) kept for this browser session only, never written
// to storage: leaving a page and coming back restores it; a reload or sign-out clears it.
const memory = new Map<string, unknown>();

export function useSessionState<T>(key: string | undefined, initial: T) {
  const [value, setValue] = useState<T>(() => key && memory.has(key) ? memory.get(key) as T : initial);
  const set = (next: T) => { if (key) memory.set(key, next); setValue(next); };
  return [value, set] as const;
}

export const clearSessionState = () => memory.clear();
