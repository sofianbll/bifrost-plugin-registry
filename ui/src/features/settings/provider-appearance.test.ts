import { providerImageFileError } from "./ProviderAppearance";

const equal = (actual: unknown, expected: unknown) => {
  if (actual !== expected) throw new Error(`Expected ${String(expected)}, got ${String(actual)}`);
};

equal(providerImageFileError({ type: "image/png", size: 256 * 1024 }), undefined);
equal(providerImageFileError({ type: "image/jpeg", size: 1 }), undefined);
equal(providerImageFileError({ type: "image/webp", size: 1 }), undefined);
equal(providerImageFileError({ type: "image/svg+xml", size: 1 }), "unsupported-type");
equal(providerImageFileError({ type: "image/png", size: 256 * 1024 + 1 }), "file-too-large");
console.log("provider appearance checks passed");
