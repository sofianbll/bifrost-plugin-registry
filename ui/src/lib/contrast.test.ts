// @ts-nocheck — Node's test imports run through tsx; the browser tsconfig has no Node types.
import { readFileSync } from "node:fs";

// WCAG 1.4.11: the selected segment of a toggle must stand out from its surroundings at 3:1 or more, in both themes.
// The colours are not restated here: the token names are read from the classes in toggle.tsx and resolved in globals.css.
const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const css = read("../globals.css");
const toggle = read("../components/ui/toggle.tsx");

const block = (selector: string) => {
  const blocks = [...css.matchAll(new RegExp(`^${selector.replace(".", "\\.")} \\{[^}]*\\}`, "gm"))].map(
    match => match[0],
  );
  if (!blocks.length) throw new Error(`no ${selector} block`);
  return blocks.join("\n");
};
const themes = { light: block(":root"), dark: block(".dark") };
const token = (theme: keyof typeof themes, name: string): string | undefined =>
  themes[theme].match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1].trim();

const srgb = (linear: number) => Math.min(1, Math.max(0, linear));
const luminance = (rgb: number[]) => {
  const [r, g, b] = rgb.map(srgb);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
// Opaque colours only: oklch(L C H) via OKLab -> linear sRGB (Ottosson), or #rrggbb.
function linearRgb(value: string): number[] | undefined {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex)
    return [0, 2, 4].map(i => {
      const c = parseInt(hex[1].slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  const lch = value.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/);
  if (!lch) return undefined; // translucent mixes (dark --background, --border) have no single colour
  const [L, C, H] = [Number(lch[1]), Number(lch[2]), (Number(lch[3]) * Math.PI) / 180];
  const a = C * Math.cos(H),
    b = C * Math.sin(H);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const ratio = (a: string, b: string): number => {
  const [x, y] = [a, b].map(value => {
    const rgb = linearRgb(value);
    if (!rgb) throw new Error(`cannot resolve ${value}`);
    return luminance(rgb);
  });
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

const assert = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message);
};

// The checker itself, against worked values: black on white is 21:1, and #767676 on white is the classic 4.54:1.
assert(Math.abs(ratio("#000000", "#ffffff") - 21) < 0.01, "black on white should be 21:1");
assert(Math.abs(ratio("#767676", "#ffffff") - 4.54) < 0.01, "#767676 on white should be 4.54:1");
assert(Math.abs(ratio("oklch(1 0 0)", "#ffffff") - 1) < 0.01, "oklch white is #fff");

const selected = (pattern: string) =>
  [...toggle.matchAll(new RegExp(`data-\\[state=on\\]:${pattern}-([a-z][a-z-]*)`, "g"))]
    .map(match => match[1])
    .find(name => name !== "solid");
const ring = selected("outline"),
  fill = selected("bg"),
  text = selected("text");
assert(
  !!ring && !!fill && !!text,
  `toggle.tsx must style the on state with an outline, a fill and a text colour (got ${ring}, ${fill}, ${text})`,
);
assert(/data-\[state=on\]:outline-solid/.test(toggle), "toggle.tsx must draw the on-state outline (outline-solid)");
const idle = toggle.match(/(?:^|[\s"])text-(muted-foreground)(?=[\s"])/)?.[1];
assert(!!idle, "an unselected segment must use a quieter text colour than the selected one");

// Surfaces a toggle sits on: cards (scope toggle), popovers (view options) and the page.
for (const theme of ["light", "dark"] as const) {
  const value = (name: string) => {
    const v = token(theme, name);
    if (!v) throw new Error(`--${name} missing in ${theme}`);
    return v;
  };
  const report: string[] = [];
  for (const surface of ["card", "popover", "background"]) {
    if (!linearRgb(value(surface))) continue; // dark --background is translucent over the page behind it
    const against = ratio(value(ring!), value(surface));
    report.push(`${surface} ${against.toFixed(2)}`);
    assert(against >= 3, `${theme}: outline --${ring} on --${surface} is ${against.toFixed(2)}:1, under 3:1`);
  }
  const onFill = ratio(value(ring!), value(fill!));
  assert(
    onFill >= 3,
    `${theme}: outline --${ring} against the selected fill --${fill} is ${onFill.toFixed(2)}:1, under 3:1`,
  );
  const selectedText = ratio(value(text!), value(fill!));
  assert(
    selectedText >= 4.5,
    `${theme}: selected text --${text} on --${fill} is ${selectedText.toFixed(2)}:1, under 4.5:1`,
  );
  for (const surface of ["card", "popover"]) {
    const idleText = ratio(value(idle!), value(surface));
    assert(
      idleText >= 4.5,
      `${theme}: unselected text --${idle} on --${surface} is ${idleText.toFixed(2)}:1, under 4.5:1`,
    );
  }
  console.log(`${theme}: selected outline ${ring} ${report.join(", ")}, against fill ${onFill.toFixed(2)}`);
}
console.log("Toggle contrast checks passed");

// WCAG 1.4.3: the default button's text, at rest and hovered. Its hover is bg-primary/NN over the page, and alpha blends in gamma-encoded sRGB.
const hover = Number(read("../components/ui/button.tsx").match(/default: "[^"]*hover:bg-primary\/(\d+)/)?.[1]) / 100;
assert(hover > 0 && hover < 1, "button.tsx must give the default variant a hover:bg-primary/NN fill");
const gamma = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.max(c, 0) ** (1 / 2.4) - 0.055);
const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
for (const theme of ["light", "dark"] as const) {
  const [fill, text, page] = ["primary", "primary-foreground", "background"].map(name =>
    linearRgb(token(theme, name)!),
  );
  assert(
    ratio(token(theme, "primary-foreground")!, token(theme, "primary")!) >= 4.5,
    `${theme}: button text on --primary is under 4.5:1`,
  );
  if (!page) continue; // the dark page is translucent over what lies behind it
  const hovered = fill!.map((c, i) => linear(hover * gamma(c) + (1 - hover) * gamma(page[i])));
  const [a, b] = [luminance(text!), luminance(hovered)];
  const onHover = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  assert(onHover >= 4.5, `${theme}: button text on its hover fill is ${onHover.toFixed(2)}:1, under 4.5:1`);
  console.log(`${theme}: button text ${onHover.toFixed(2)}:1 hovered`);
}
console.log("Button contrast checks passed");

// #85 round 2: the primary button keeps the brand green in dark mode (it had turned light grey), and the
// same token read as text (links, the active sidebar entry) stays legible on the dark card.
const lch = (value: string) =>
  value
    .match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/)!
    .slice(1)
    .map(Number);
const [, lightChroma, lightHue] = lch(token("light", "primary")!);
const [, darkChroma, darkHue] = lch(token("dark", "primary")!);
assert(
  lightChroma > 0.08 && darkChroma > 0.08 && Math.abs(darkHue - lightHue) < 5,
  `dark --primary must be the brand green (hue ${lightHue}), got ${token("dark", "primary")}`,
);
const asText = ratio(token("dark", "primary")!, token("dark", "card")!);
assert(asText >= 4.5, `dark: --primary as text on --card is ${asText.toFixed(2)}:1, under 4.5:1`);
console.log(`dark: brand primary, ${asText.toFixed(2)}:1 as text on the card`);
