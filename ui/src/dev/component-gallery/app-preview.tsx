// Same-origin preview iframe: this window owns its hash and uses memory-only preferences.
import { createRoot } from "react-dom/client";
import { App } from "../../app/App";
import { installGalleryApi } from "./gallery-api";
import "../../globals.css";

const values = new Map<string, string>();
const memoryStorage: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: key => values.get(key) ?? null,
  key: index => [...values.keys()][index] ?? null,
  removeItem: key => { values.delete(key); },
  setItem: (key, value) => { values.set(key, String(value)); },
};
Object.defineProperty(window, "localStorage", { configurable: true, value: memoryStorage });
installGalleryApi();
createRoot(document.getElementById("root")!).render(<App />);
