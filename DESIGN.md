---
name: Registry
description: Admin panel for the Bifrost model registry. Zinc surfaces, one emerald-green accent, Geist type.
# Source of truth: ui/src/globals.css (OKLCH, light + .dark). LIGHT values below; dark counterparts live in
# .impeccable/design.json -> extensions.colorMeta.<slug>.dark. Every slug notes the CSS variable it maps to.
colors:
  brand-green: "oklch(0.5081 0.1049 165.61)"      # --primary: default Button fill, links, focus border, tab underline, checked box
  on-brand-green: "oklch(0.985 0 0)"              # --primary-foreground: text on brand-green
  page-zinc: "#f4f4f5"                            # --background (the only hex in globals.css): page, sidebar, content card, outline Button fill
  ink: "oklch(0.141 0.005 285.823)"               # --foreground = --card-foreground = --popover-foreground = --sidebar-foreground
  surface-white: "oklch(1 0 0)"                   # --card = --popover: cards, sheets, dialogs, popovers
  zinc-wash: "oklch(0.967 0.001 286.375)"         # --secondary = --muted = --accent: hover fill, selected segment fill, attention badge, skeleton
  nav-active-zinc: "oklch(0.94 0.001 286.375)"    # --sidebar-accent: hovered / active sidebar entry
  wash-ink: "oklch(0.21 0.006 285.885)"           # --secondary-foreground = --accent-foreground: text on zinc-wash
  muted-ink: "oklch(0.53 0.016 285.938)"          # --muted-foreground: secondary text, placeholders, unselected segments (at least 4.5:1 on page-zinc, per the UI contract)
  hairline: "oklch(0.92 0.004 286.32)"            # --border: every 1px border and divider (also the global default border colour)
  field-hairline: "oklch(0.92 0.004 286.32)"      # --input: field borders (differs from hairline in dark mode)
  focus-grey: "oklch(0.705 0.015 286.067)"        # --ring: focus ring colour (cards, rows, tabpanel, selects)
  alert-red: "oklch(0.577 0.245 27.325)"          # --destructive: errors, required-field errors, destructive Button, "Modifie Bifrost" badge border
  status-teal: "oklch(0.63 0.11 182)"             # --chart-success: selected card border/tint, verified / ok text, Expert switch on-state
  status-amber: "oklch(0.74 0.13 62)"             # --chart-warning: warning card border/tint ("Unpublished", blocked adoption)
  status-amber-ink: "oklch(0.5 0.12 62)"          # --chart-warning-ink: text-safe amber for 12px reason lines (17 uses)
typography:
  # Geist everywhere; Geist Mono only for IDs, native model names and code. Variable woff2, weights 100-900, self-hosted.
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.875rem"   # 1.5rem / 2rem below 40rem (text-2xl sm:text-3xl)
    fontWeight: 600
    lineHeight: "2.25rem"
    letterSpacing: "-0.025em"
  headline-compact:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"     # key page h1 (text-xl sm:text-2xl): 1.25rem / 1.75rem below 40rem
    fontWeight: 600
    lineHeight: "2rem"
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"       # section h2 (text-base font-semibold)
    fontWeight: 600
    lineHeight: "1.5rem"
  title-dialog:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"   # DialogTitle (text-lg leading-none font-semibold)
    fontWeight: 600
    lineHeight: "1"
  card-title:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"   # model / group / key name on a card (text-sm font-semibold leading-snug)
    fontWeight: 600
    lineHeight: "1.375"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"   # text-sm: running text, field values at md+ (Input is 1rem below 48rem)
    fontWeight: 400
    lineHeight: "1.25rem"
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"   # Button, Label, Tab, ToggleGroup item (text-sm font-medium)
    fontWeight: 500
    lineHeight: "1.25rem"
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"    # text-xs: secondary metadata, counts, reason lines. Never below 12px.
    fontWeight: 400
    lineHeight: "1rem"
  badge:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"    # Badge (text-xs font-medium)
    fontWeight: 500
    lineHeight: "1rem"
  overline:
    fontFamily: "Geist, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"    # capability-panel section heads: Input / Output / Features (uppercase, leading-none)
    fontWeight: 600
    lineHeight: "1"
  mono:
    fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, 'Liberation Mono', monospace"
    fontSize: "0.75rem"    # model IDs, native IDs, endpoints (font-mono text-xs)
    fontWeight: 400
    lineHeight: "1rem"
rounded:
  # --radius: 0.5rem; sm = radius - 4px, md = radius - 2px, lg = radius. sm is the house radius (about 220 of 230 uses).
  sm: "4px"     # Button, Input, Select, Badge, Card, CatalogCard, Toggle, tooltip, sheet, brand tile
  md: "6px"     # the content card from md (48rem) up
  lg: "8px"     # Dialog only
  full: "9999px"
spacing:
  # Tailwind 4px unit (--spacing: 0.25rem). Only the steps the panel actually repeats.
  xs: "4px"     # gap-1: icon + label inside chips, capability icon strip
  sm: "8px"     # gap-2 (the most used gap, 168 uses), card header gap, p-2
  md: "12px"    # gap-3 / p-3: catalog card inner padding, panel sections (102 p-3 uses)
  lg: "16px"    # gap-4 / p-4: card grid gap, page gutter on phones (px-4)
  xl: "24px"    # p-6: Dialog, base Card, desktop sheet
  topbar: "3.25rem"      # --app-topbar-height
  sidebar: "15rem"       # SIDEBAR_WIDTH (3.25rem collapsed, 18rem as mobile sheet)
  content-max: "90rem"   # main column max width
components:
  button-primary:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.on-brand-green}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "2.25rem"
  button-compact:
    backgroundColor: "{colors.brand-green}"
    textColor: "{colors.on-brand-green}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "2rem"
  button-outline:
    backgroundColor: "{colors.page-zinc}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
    height: "2.25rem"
  button-outline-hover:
    backgroundColor: "{colors.zinc-wash}"
    textColor: "{colors.wash-ink}"
  button-ghost-hover:
    backgroundColor: "{colors.zinc-wash}"
    textColor: "{colors.wash-ink}"
  toggle-segment:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "2.25rem"
  toggle-segment-hover:
    backgroundColor: "{colors.zinc-wash}"
    textColor: "{colors.muted-ink}"
  toggle-segment-selected:
    backgroundColor: "{colors.zinc-wash}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "4px 12px"
    height: "2.25rem"
  badge-attention:
    backgroundColor: "{colors.zinc-wash}"
    textColor: "{colors.wash-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  # Success and warning Badge variants come from the inherited component set: Tailwind green-100 / yellow-100 fills with black text, one treatment in both themes.
  badge-success:
    backgroundColor: "oklch(96.2% 0.044 156.743)"
    textColor: "#000000"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  badge-warning:
    backgroundColor: "oklch(97.3% 0.071 103.193)"
    textColor: "#000000"
    typography: "{typography.badge}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
  card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "24px"
  catalog-card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "12px"
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    typography: "{typography.label}"
    rounded: "4px 4px 0 0"
    padding: "0 12px"
    height: "2.25rem"
  tab-selected:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
  dialog:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  sheet:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "16px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px"
    height: "2rem"
  nav-item-active:
    backgroundColor: "{colors.nav-active-zinc}"
    textColor: "{colors.brand-green}"
---

# Design System: Registry

## Overview

<!-- Style wording inferred from the code by the assistant on 2026-10-13, not chosen by the owner; edit freely. -->

**Creative North Star: "The Ledger"**

Registry looks like the Bifrost dashboard it sits beside, tightened into a calm zinc workbench. Information sits in white, hairline-bordered cards on a cool zinc page, and nothing competes with the facts: visual weight goes to names and counts, never to chrome. A ledger is ruled rows read top to bottom, one entry per thing, and that is the shape of the interface, from a key's single register with one row per model to a catalogue of cards that all share one fixed anatomy. The mood is sober, exact and unhurried.

Colour is rationed by job. One emerald marks what you can act on; teal and amber report state; red is reserved for errors and for steps that change Bifrost. Everything else is zinc. Type is Geist at 12 to 14px, controls are 36px (32px compact) with 4px corners, and a selected state is told by tone plus a 1px outline rather than by a new colour. Light and dark are the same layout with re-anchored lightness, and Basic and Expert change how much detail is shown, not how it looks.

The accepted style is a fixed constraint, not a variable: no new colour, radius or component is introduced. Visual rejections already confirmed by the owner: capability variants drawn as circles or diamonds, the first grouped capability panel, the earlier `ReferenceCatalogBrowser` render, the home-made components of the Hermes prototype, variable-height Grid cards and a scrolling Square body, and a permanent red Delete button on a card.

**Key Characteristics:**
- Cool zinc page, white cards, one 1px hairline: tone first, border second.
- One emerald for action only; teal and amber for state; red for errors and Bifrost-changing steps.
- 4px corners everywhere except the 8px Dialog and the 6px inset content card.
- Geist at 12 to 14px, Geist Mono for identifiers only, nothing needed to act below 12px.
- 36px controls, 32px compact; selected state by tone plus a 1px outline.
- Columns and folded controls follow the container width; design floor 375px, no horizontal scroll.
- Light and dark share one layout; dark lifts the emerald and puts dark text on it.

## Colors

A cool zinc ramp carries almost everything; one emerald says "act here", teal and amber say "this is the state", red says "stop". Values are OKLCH tokens in `ui/src/globals.css` (page-zinc is the only hex), light shown here, dark counterparts in the sidecar.

### Primary
- **Settled Emerald** (oklch(0.5081 0.1049 165.61), `--primary`): the action colour. Default Button fill, links, the focus border of text inputs, the selected tab underline, checked boxes, and the active main navigation entry. Text on it is **Primary Foreground White** (oklch(0.985 0 0)).

### Secondary
State colours, not action colours. They come from the `--chart-*` tokens.
- **Verified Teal** (oklch(0.63 0.11 182), `--chart-success`): selected card border and 5% tint, verified and ok text, a fresh sync (under 24 hours), the Expert switch when on.
- **Caution Amber** (oklch(0.74 0.13 62), `--chart-warning`): warning card border at 50% with a 5% tint (unpublished, blocked adoption), and the one tinted section of the adoption dialog.
- **Caution Amber Ink** (oklch(0.5 0.12 62), `--chart-warning-ink`): the text-safe amber for 12px reason lines.

### Tertiary
- **Signal Red** (oklch(0.577 0.245 27.325), `--destructive`): errors and required-field messages, the destructive Button, and the border of the "Changes Bifrost" badge. Nothing else.

### Neutral
- **Cool Paper Zinc** (#f4f4f5, `--background`): the page, the sidebar, the inset content card and the outline Button fill.
- **Card White** (oklch(1 0 0), `--card`, `--popover`): cards, sheets, dialogs, popovers.
- **Blue-Black Zinc Ink** (oklch(0.141 0.005 285.823), `--foreground`): primary text everywhere.
- **Quiet Zinc Ink** (oklch(0.53 0.016 285.938), `--muted-foreground`): secondary text, placeholders, unselected segments, the idle tab.
- **Pale Zinc Wash** (oklch(0.967 0.001 286.375), `--secondary`, `--muted`, `--accent`): hover fill, selected segment fill, the attention badge, skeleton blocks. Text on it is **Wash Ink** (oklch(0.21 0.006 285.885)).
- **Active Nav Zinc** (oklch(0.94 0.001 286.375), `--sidebar-accent`): hovered and active sidebar entries.
- **Hairline Zinc** (oklch(0.92 0.004 286.32), `--border`): every 1px border and divider, and the global default border colour. **Field Hairline Zinc** (`--input`) is the same value in light and diverges in dark.
- **Focus Ring Grey** (oklch(0.705 0.015 286.067), `--ring`): the focus ring on cards, rows, the tab panel and selects.

### Dark Theme
Dark mode keeps every role and re-anchors lightness (`.dark`, `color-scheme: dark`). The page is a translucent mix of the dark ink; cards and popovers rise to a lighter zinc (oklch(0.21 0.006 285.885)) with a 10% white hairline. Settled Emerald lifts to **Lifted Emerald** (oklch(0.72 0.12 165.61)) with dark text on it, about 7.5:1 as text on the dark card. Teal, amber, amber ink and red each lift in lightness; the exact dark values sit beside each token in `.impeccable/design.json`.

### Named Rules
**The One Voice Rule.** Settled Emerald marks what the operator can act on, and only that. It is the default Button, the link, the focus border, the active tab and the active nav entry; it never reports a state. Its rarity on a screen is what makes it readable.

**The Two Greens Rule.** Settled Emerald (hue 165.6) and Verified Teal (hue 182) are different greens with different jobs: emerald is action, teal is state. Never swap them, and never add a third green.

**The No New Colour Rule.** The UI contract is explicit: no new colour. New emphasis is an existing token at an opacity step already in use (the card hover border is emerald at 40%, selected and warning tints are 5%, the warning border is 50%).

## Typography

**Sans Font:** Geist (variable woff2, weights 100 to 900, self-hosted) with ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif
**Mono Font:** Geist Mono (with ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", monospace)

**Character:** One family at small sizes. Hierarchy comes from weight (500 and 600) and from the step between 12px and 14px, not from size jumps. 12px is the working size for metadata (it is the most used size) and 14px for running text.

### Hierarchy
- **Headline** (600, 1.875rem, 2.25rem, -0.025em): the page `h1` on Models, Groups, Keys and Settings; 1.5rem below 40rem. Printed once per page.
- **Headline Compact** (600, 1.5rem, 2rem, -0.025em): the `h1` of a single key's page; 1.25rem below 40rem.
- **Title** (600, 1rem, 1.5rem): section `h2` and shelf titles, with a muted count beside them.
- **Dialog Title** (600, 1.125rem, line-height 1): the dialog or sheet title above a muted description.
- **Card Title** (600, 0.875rem, 1.375): the model, group or key name in a card header, clamped to two lines and underlined on hover.
- **Body** (400, 0.875rem, 1.25rem): running text and field values. Inputs are 1rem below 48rem.
- **Label** (500, 0.875rem, 1.25rem): Button, form label, tab and toggle segment text.
- **Caption** (400, 0.75rem, 1rem): secondary metadata, counts, reason lines, tooltips.
- **Badge** (500, 0.75rem, 1rem): attention and status badges.
- **Overline** (600, 0.75rem, line-height 1, uppercase): the Input, Output and Features heads of the capability panel only.
- **Mono** (400, 0.75rem, 1rem): model IDs, native IDs, endpoints.

### Named Rules
**The Twelve-Pixel Floor Rule.** Running text is 14px or 16px; secondary metadata is 12px. Nothing needed to act on is ever set at 10 or 11px.

**The Identifier Rule.** Geist Mono is for identifiers only: model IDs, native model names, endpoints. Long IDs truncate at the start so the distinctive tail survives.

## Layout

A shell of topbar, sidebar and one main column. The topbar is 3.25rem. The sidebar is 15rem, collapses to a 3.25rem icon rail with a visible control, and becomes an 18rem sheet on phones. The main column is capped at 90rem. On phones the page has a 16px side gutter and 24px top and bottom padding; from 48rem the sidebar is persistent and the content sits in an inset card with 6px corners, 2.5rem side padding and 2rem top and bottom padding. The page title is printed once: each page owns its `h1`, and the topbar never repeats it (on a key page it names only the parent).

Spacing is Tailwind's 4px unit, used in a few repeated steps: 4px inside chips and icon strips, 8px as the default gap (the most used by far), 12px for card insides and panel sections, 16px between cards and as the card grid gap, 24px for dialogs, base Cards and the desktop sheet. A catalogue card is padded 12px, its header, body and footer rows sharing the same 12px side inset, with one hairline between body and footer.

The catalogue grid answers to its container, not the window: one column below 28rem, two from 28rem, three from 42rem, four from 56rem, capped by the density choice (Small, Medium, Large = 4, 3, 2 columns at wide containers). The default is Grid, Rectangle, Small. Rectangle cards are wider than tall with equalised rows; Square is a true 1:1 with no inner scroll; Table is the dense alternative. Under 42rem the view, shape and density controls and the filters fold into two popovers, a Filters (n) button and a Display options button, with the search always visible. Basic keeps only search, Filters and Display options at every width; Expert, from 1280px, keeps the full inline bar.

Viewport breakpoints in use are 40rem (page headings step up), 48rem (persistent sidebar, inset card, inputs drop to 0.875rem) and 80rem (Expert switch appears; the Expert key composer splits into editor and draft panel). The design floor is 375px with no horizontal scroll.

### Named Rules
**The Container Rule.** Columns, folded controls and any internal split follow the width of the container the component sits in, never the window alone; this is what keeps a resized panel correct.

**The One Scroll Rule.** An editor, dialog or sheet has exactly one scrolling container, and its footer stays visible. At 375px the decisions come first.

## Elevation & Depth

Tonal first, hairline second, shadow only to say "this floats". Depth is a stack of tones: the cool zinc page, then a white card with a 1px hairline. The card is not lifted off the page: it carries a whisper-weight shadow beside the hairline. Layers that leave the page (popovers, menus, tooltips, dialogs, sheets) are the only ones that get a visible shadow. There are no custom shadow tokens and no coloured shadows; every value below is Tailwind's default scale. State is told by border and tint, never by lift.

### Shadow Vocabulary
- **Card rest** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): every Card, including CatalogCard, and the sticky key-draft panel. A whisper beside the border, not a lift.
- **Segment edge** (`box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)`): outline toggles only.
- **Popover** (`box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): popover, select menu, dropdown, tooltip.
- **Modal** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): Dialog, Sheet, the Switch thumb. Dialogs sit over a scrim of rgb(0 0 0 / 50%).

### Named Rules
**The Whisper Rule.** Every Card carries the card-rest shadow, so the system is not flat at rest, but it is not lifted either. Plain bordered sections built directly (the key ledger) carry the hairline alone. Do not stack more shadow on a card.

**The Float Rule.** A visible shadow means "this floats". Popover weight for small floating layers, modal weight for dialogs and sheets, nothing in between.

**The Border Carries State Rule.** Hover moves a card border to emerald at 40%; selected is a teal border with a 5% tint; warning is an amber border at 50% with a 5% tint; a pressed Button scales down 1%. State never arrives as a glow, a lift or a new shadow.

## Shapes

A 4px house radius (`rounded.sm`, from `--radius` 0.5rem minus 4px) on almost everything: Button, Input, Select, Badge, Card, CatalogCard, Toggle, tooltip, popover, Sheet and the brand tile. Exceptions are few and fixed: the inset content card is 6px from 48rem, the Dialog is 8px, a 2px corner on the dialog close button, a 4px checkbox, and tabs that round only their top corners. Pills (9999px) are used twice.

Borders are 1px Hairline Zinc, and a border is the default way to separate two things. The selected segment gets a 1px Quiet Zinc Ink outline drawn inside its edge. Icons are Lucide at 16px with a 2px stroke (12px inside a Badge, a slightly heavier stroke in the capability panel). The brand tile is a 32px bordered square (24px compact) holding a 20px logo mark; skeletons are bordered 4px blocks on Pale Zinc Wash.

### Named Rules
**The Four-Pixel Rule.** Corners are 4px unless this section names the exception. Do not introduce 12px or 16px "friendly" radii; the contract adds no new radius.

## Components

Compact and exact: 36px controls (32px compact), small type, 4px corners, selected state by tone plus a 1px outline. All components are shadcn/Radix primitives restyled to the tokens, with no bespoke chrome.

### Buttons
- **Shape:** 4px corners (`rounded.sm`); 36px high (2.25rem) by default, 32px compact (2rem), 40px large, 36px square for icon-only. Padding 8px 12px (compact 0 12px); gap 8px; icons 16px; label is 14px at weight 500.
- **Primary:** Settled Emerald fill with Primary Foreground White text; hover is the same fill at 95%. One per view: the action the view leads with.
- **Outline:** the secondary action everywhere (Cancel, Details, Associate a reference). Cool Paper Zinc fill, 1px hairline, Blue-Black Zinc Ink text; hover turns to Pale Zinc Wash with Wash Ink text. In dark mode the fill is the input token at 30%, hover 50%.
- **Ghost:** no fill or border; hover is Pale Zinc Wash. Used for icon buttons and as the base of tabs.
- **Destructive:** Signal Red fill, white text at normal weight; 60% red in dark mode. Reserved for the confirming step of a destructive or Bifrost-changing action. Delete never appears as a permanent red button on a card; it lives in the More actions menu with a confirmation.
- **Hover / Focus:** press is `scale(0.99)` over 100ms; disabled is 50% opacity; a loading Button shows a spinner. Focus is a 1px ring at 50% with a 1px offset (see Focus and Motion).

### Toggle and Segments
Segmented controls choose Grid or Table, Rectangle or Square, Small, Medium or Large; the same segment look marks the chosen option among `aria-pressed` buttons in the adoption dialog.
- **Shape:** 36px high (32px compact, 40px large), 0 12px padding, 4px corners.
- **Unselected:** transparent, Quiet Zinc Ink text; hover is Pale Zinc Wash.
- **Selected:** Pale Zinc Wash fill, a 1px Quiet Zinc Ink outline inset by 1px, and Blue-Black Zinc Ink text. Contrast of the outline against the fill and the surface is at least 3:1 in both themes.
- **Switch and Checkbox:** the Switch is 36px by 20px; the Basic and Expert switch is 24px high and Verified Teal when on. The Checkbox is a 16px box with a 4px corner, Settled Emerald when checked.

### Inputs / Fields
- **Style:** transparent fill, 1px Field Hairline Zinc border, 4px corners, 36px high, padding 4px 12px, Blue-Black Zinc Ink text; 16px below 48rem and 14px from there. Placeholders use Quiet Zinc Ink at full opacity. In dark mode the fill is the input token at 30%. Select triggers are 36px (32px compact).
- **Focus:** the border turns Settled Emerald; there is no ring. Select triggers turn the border to Focus Ring Grey with a 1px ring at 50%.
- **Error / Disabled:** invalid turns the border Signal Red with a 20% red ring (40% in dark) and shows the message below the field in red; required fields are marked and errors sit next to the field. Disabled dims to 50%.

### Badges
12px at weight 500, 2px 8px padding, 4px corners, 1px border, 4px gap to a 12px icon, never wrapping.
- **Attention:** the secondary badge, Pale Zinc Wash fill with Wash Ink text and no visible border, set under a card title for things that need a look: "+N available", "no reference", "inferred creator". A registered card with nothing to flag carries none.
- **Status:** the success and warning variants come from the inherited component set (Tailwind green-100 and yellow-100 fills with black text, one treatment in both themes); outline is text only with a hairline.
- **Changes Bifrost:** the destructive badge (red at 10% fill, red border at 50%, pencil icon) labels any step that edits Bifrost. The button beside it stays outline until the final confirm.

### Cards / Containers
- **Corner Style:** 4px (`rounded.sm`).
- **Background:** Card White with Blue-Black Zinc Ink text and a 1px Hairline Zinc border.
- **Shadow Strategy:** card-rest, the whisper (see Elevation & Depth).
- **Internal Padding:** base Card 24px (vertical padding and gap 24px); CatalogCard 12px.
- **CatalogCard anatomy:** header carries identity (brand tile, name as a button clamped to two lines, creator line, mono ID, attention badges) and the selection box; body carries facts (description, capability icons with a `+N` overflow, modalities); footer carries the provider and actions, split from the body by one hairline. Hover moves the border to emerald at 40% over 150ms; selected is the Verified Teal border with a 5% tint; warning is Caution Amber at 50% with a 5% tint. Cards in a grid are 16px apart.

### Tabs
Underline tabs, not a Radix Tabs component: a `tablist` of ghost Buttons on a hairline bottom border, 36px high, with arrows, Home and End handled by hand.
- **Selected:** a 2px Settled Emerald bottom border and Blue-Black Zinc Ink text. **Idle:** transparent border and Quiet Zinc Ink text.
- **Responsive:** two columns on phones, a scrollable row from 40rem.

### Dialog and Sheet
- **Dialog:** Card White, 1px border, 8px corners, 24px padding, the Modal shadow over a 50% black scrim; opens with a 200ms fade and zoom. The header is the title, a muted description and a close button. The dialog is the one scroll container, and its footer sticks to the bottom: a hairline above it, the card fill, Cancel (outline) on the left of the primary action.
- **Sheet:** the same pattern from the right edge, a floating inset panel with 4px corners that slides in over 100ms; 16px padding, 24px on desktop. Focus returns to the trigger on close.

### Navigation
- **Sidebar:** 15rem, entries 32px high with 8px padding, 4px corners and 14px text, a 16px icon beside each label. The order is Models, then Groups, then Keys; Settings lives in the footer. The sidebar reads as the page (a translucent mix), with a visible collapse control.
- **States:** hover and active fill with Active Nav Zinc. The active main entry also takes Settled Emerald text, a 1px emerald border at 20% and weight 500; the active Settings entry takes Wash Ink text.
- **Header:** the Basic and Expert switch sits beside the theme control and appears only from 1280px; language is shown as FR and EN with the full name accessible.

### Key Ledger
The signature surface of a key's page: a bordered Card White section with 16px padding and a Title `h2`, then a hairline-divided list (14px, 6px row padding) with one row per model. Each row is the model name, a muted mono ID only when two names collide, and a right-aligned muted 12px "via <subscription>". Warnings are 12px Caution Amber Ink lines under the row. A `details` toggle below a top border holds the technical verification.

### Capability Summary and Panel
Capabilities show as icons alone, with `+N` when there are too many. After a 500ms hover or on keyboard focus, the full comparison panel opens: Input, Output and Features sections with Overline heads, and a braces icon for Structured Output. Image and Video labels stay explicit and modalities live in their own panel.

### Focus and Motion
- **Focus:** the base layer removes the native outline, so focus is always a ring or a border. Buttons: a 1px ring at 50% with a 1px offset (emerald for default, ring grey for outline). Badge, Toggle and Checkbox: a 3px ring at 50%. Rows, links, the tab panel and brand buttons: a 2px solid Focus Ring Grey ring. Inputs: the emerald border alone.
- **Motion:** 150ms on the standard ease (`cubic-bezier(0.4, 0, 0.2, 1)`) for colour and border changes; Button press 100ms; Dialog 200ms fade and zoom; Sheet 100ms slide; sidebar width 200ms linear; spinner 1s linear; skeleton pulse. Card transitions turn off under reduced motion.

### Named Rules
**The Tone-Plus-Outline Rule.** A selected segment is told by Pale Zinc Wash fill, a 1px Quiet Zinc Ink outline and full-strength text, with the unselected ones at Quiet Zinc Ink. It never gets a new colour.

**The One Primary Rule.** Each view leads with one default emerald Button. Every other action is outline or ghost, and the only red button is a confirming step.

## Do's and Don'ts

### Do:
- **Do** reserve Settled Emerald for action: the default Button, links, the input focus border, the active tab and the active nav entry, with one default Button leading each view.
- **Do** colour state from the `--chart-*` tokens: Verified Teal for selected, verified and fresh; Caution Amber at a 50% border and 5% tint for warnings; Caution Amber Ink for 12px reason text.
- **Do** build every surface from the existing tokens, and make new emphasis an existing token at an opacity step already in use (40%, 50%, 5%).
- **Do** use 4px corners, 36px controls and 32px compact controls, and keep the standard Button at least as tall as the compact one.
- **Do** give every card the same anatomy: identity in the header, facts in the body, provider and actions in the footer, one hairline between body and footer.
- **Do** mark a selected segment with the Pale Zinc Wash fill, a 1px Quiet Zinc Ink outline and Blue-Black Zinc Ink text.
- **Do** size columns and folded controls from the container: 28rem, 42rem and 56rem for 2, 3 and 4 columns.
- **Do** keep text needed to act at 12px or larger, secondary text at Quiet Zinc Ink, and pair a colour with text or an icon so meaning never rests on colour alone.
- **Do** keep a visible focus ring or border on every interactive element, and return focus to the trigger after a sheet, dialog or popover closes.
- **Do** set Geist Mono on identifiers only, and truncate long IDs at the start.
- **Do** label any step that edits Bifrost with the destructive "Changes Bifrost" badge, and keep that step's button outline until the final confirm.
- **Do** give new transitions a reduced-motion fallback, as the CatalogCard does.

### Don't:
- **Don't** add a colour, a radius or a component; the accepted style is a fixed constraint.
- **Don't** use Settled Emerald for state or Verified Teal for action, and don't add a third green.
- **Don't** colour new status UI with raw Tailwind palette values (green, yellow, emerald, amber); status colours come from the `--chart-*` state tokens.
- **Don't** use red for anything but errors, the destructive Button and the "Changes Bifrost" label, and never as a permanent Delete button on a card.
- **Don't** draw capability variants as circles or diamonds, tint capability icons, or bring back the first grouped capability panel.
- **Don't** take the earlier `ReferenceCatalogBrowser` render or the Hermes prototype's home-made components as a reference.
- **Don't** let Grid cards vary in height with their content or let a Square card scroll inside; Square is a true 1:1.
- **Don't** set anything needed to act at 10 or 11px.
- **Don't** print the page title twice.
- **Don't** add coloured shadows, glows or lift on hover; state lives in the border and a tint.
- **Don't** give an editor, dialog or sheet a second scroll container.
- **Don't** drive a component's internal layout from the window width alone.
