# Référentiel du design system — UI Bifrost

Source : dépôt Bifrost (Maxim AI), version `transports/v2.2.1`, frontend React 19 + TanStack Router dans `ui/`.
Stack : **Tailwind CSS 4** (config CSS-first dans `app/globals.css`, aucun `tailwind.config.js`), **shadcn/ui** (composants dans `components/ui/`, CVA + Radix UI primitives), icônes **lucide-react** (principales) et **@phosphor-icons/react** (menu topbar), toasts **sonner**, tables **TanStack Table**, formulaires **react-hook-form + zod**.

> Toutes les classes citées sont reprises telles quelles du source. Les valeurs de couleurs sont les valeurs exactes des custom properties.

---

## 1. Design tokens

### 1.1 Palette — thème clair (`:root` dans `globals.css`)

```css
--background: #f4f4f5;                                   /* fond global de l'app (gris zinc-100) */
--foreground: oklch(0.141 0.005 285.823);                /* texte primaire (presque noir, léger violet-gris) */
--card: oklch(1 0 0);                                    /* surfaces : blanc pur */
--card-foreground: oklch(0.141 0.005 285.823);
--popover: oklch(1 0 0);
--popover-foreground: oklch(0.141 0.005 285.823);
--primary: oklch(0.5081 0.1049 165.61);                  /* accent teal foncé — le SEUL accent de la marque */
--primary-foreground: oklch(0.985 0 0);
--secondary: oklch(0.967 0.001 286.375);                 /* gris très clair (chips, boutons secondaires) */
--secondary-foreground: oklch(0.21 0.006 285.885);
--muted: oklch(0.967 0.001 286.375);                     /* identique à secondary */
--muted-foreground: oklch(0.552 0.016 285.938);          /* texte secondaire/ternaire */
--accent: oklch(0.967 0.001 286.375);                    /* identique à secondary (fond de hover) */
--accent-foreground: oklch(0.21 0.006 285.885);
--destructive: oklch(0.577 0.245 27.325);                /* rouge */
--border: oklch(0.92 0.004 286.32);                      /* bordures génériques */
--input: oklch(0.92 0.004 286.32);                       /* identique à border */
--ring: oklch(0.705 0.015 286.067);                      /* focus ring */
--color-cream-100: oklch(0.98 0 0);                      /* base de la sidebar (color-mix 20 % transparent) */
```

Points clés de la palette claire :

- L'**accent primaire est un teal** (`oklch(0.5081 0.1049 165.61)`, ≈ `#1b8a6b` / `teal-700`), utilisé pour l'état actif de la navigation, les boutons primaires, les switchs cochés, le focus des inputs.
- Le fond d'app est `#f4f4f5` (zinc-100) ; **toutes les surfaces de contenu sont blanches** (`bg-white` est codé en dur dans le layout, pas `bg-card`).
- `secondary`, `muted` et `accent` sont **la même valeur** : gris très clair `oklch(0.967 …)`.
- Pas de token sémantique success/warning/info côté UI — les statuts passent par des classes Tailwind ad hoc (`green-*`, `amber-*`, `red-*`, `blue-*`, `yellow-*`) et par la palette chart (§ 1.3).

### 1.2 Palette — thème sombre (`.dark`)

```css
--color-ink-900: oklch(0.141 0.005 285.823);
--background: color-mix(in oklch, var(--color-ink-900) 20%, transparent);  /* très léger voile sombre */
--foreground: oklch(0.985 0 0);
--card: oklch(0.21 0.006 285.885);                       /* zinc-900 */
--card-foreground: oklch(0.985 0 0);
--popover: oklch(0.21 0.006 285.885);
--popover-foreground: oklch(0.985 0 0);
--primary: oklch(0.92 0.004 286.32);                     /* INVERSE : le primary sombre est un blanc cassé */
--primary-foreground: oklch(0.21 0.006 285.885);
--secondary: oklch(0.274 0.006 286.033);
--secondary-foreground: oklch(0.985 0 0);
--muted: oklch(0.274 0.006 286.033);
--muted-foreground: oklch(0.705 0.015 286.067);
--accent: oklch(0.274 0.006 286.033);
--accent-foreground: oklch(0.985 0 0);
--destructive: oklch(0.704 0.191 22.216);
--border: oklch(1 0 0 / 10%);
--input: oklch(1 0 0 / 15%);
--ring: oklch(0.552 0.016 285.938);
```

Le thème sombre inverse la hiérarchie : `primary` clair devient presque blanc (les boutons primaires sombres sont donc clairs sur fond sombre), et `border`/`input` passent en blanc à 10–15 % d'opacité.

### 1.3 Palette charts (statuts + séries) — clair, puis sombre

Statuts sémantiques (remplissages / barres) :

```css
/* clair */                        /* sombre */
--chart-success: oklch(0.63 0.11 182);      --chart-success: oklch(0.72 0.115 182);
--chart-error:   oklch(0.6 0.16 27);        --chart-error:   oklch(0.68 0.155 27);
--chart-warning: oklch(0.74 0.13 62);       --chart-warning: oklch(0.8 0.125 62);
--chart-neutral: oklch(0.8 0.012 200);      --chart-neutral: oklch(0.55 0.015 220);
```

Versions « ink » (texte sur fond clair, WCAG 4.5:1) :

```css
/* clair */                        /* sombre */
--chart-success-ink: oklch(0.45 0.1 182);   --chart-success-ink: oklch(0.84 0.1 182);
--chart-error-ink:   oklch(0.48 0.16 27);   --chart-error-ink:   oklch(0.82 0.12 27);
--chart-warning-ink: oklch(0.5 0.12 62);    --chart-warning-ink: oklch(0.86 0.11 62);
```

Séquentielles (séries ordonnées — teal pour `seq`, indigo pour `ord`) :

```css
/* clair */
--chart-seq-1: oklch(0.38 0.085 205);   --chart-seq-2: oklch(0.48 0.115 200);
--chart-seq-3: oklch(0.6 0.115 190);    --chart-seq-4: oklch(0.72 0.095 186);
--chart-seq-5: oklch(0.86 0.055 184);
/* sombre : rampe inversée, la plus claire = plus grande valeur */
--chart-seq-1: oklch(0.9 0.05 184);  …  --chart-seq-5: oklch(0.44 0.09 205);

--chart-token-input:  oklch(0.48 0.115 200);   --chart-token-output: oklch(0.68 0.1 188);
--chart-token-cached: oklch(0.86 0.055 184);

--chart-ord-1: oklch(0.82 0.055 265);  --chart-ord-2: oklch(0.7 0.095 265);
--chart-ord-3: oklch(0.57 0.125 267);  --chart-ord-4: oklch(0.44 0.135 270);
```

Catégorielles (6 teintes par rang, puis gris pour « Other ») :

```css
/* clair */
--chart-cat-1: oklch(0.55 0.13 255);   /* indigo */
--chart-cat-2: oklch(0.63 0.13 300);   /* violet */
--chart-cat-3: oklch(0.67 0.13 340);   /* rose */
--chart-cat-4: oklch(0.66 0.12 135);   /* vert */
--chart-cat-5: oklch(0.42 0.1 225);    /* bleu */
--chart-cat-6: oklch(0.45 0.09 155);   /* teal */
--chart-cat-other: oklch(0.78 0.012 200);
--chart-track: oklch(0.965 0.004 195); /* fond des barres/pistes */
```

Règle documentée dans le source : les teintes 0–70 (rouge/orange/jaune) sont **réservées aux statuts**, aucune catégorie ne doit ressembler à une erreur.

### 1.4 Sidebar tokens

```css
/* clair */                        /* sombre */
--sidebar: color-mix(in oklch, --color-cream-100 20%, transparent);
--sidebar: color-mix(in oklch, --color-ink-900 20%, transparent);
--sidebar-foreground: = --foreground        --sidebar-foreground: oklch(0.985 0 0)
--sidebar-primary: oklch(0.21 0.006 285.885)  --sidebar-primary: oklch(0.488 0.243 264.376)
--sidebar-primary-foreground: oklch(0.985 0 0)
--sidebar-accent: oklch(0.94 0.001 286.375)   --sidebar-accent: oklch(0.274 0.006 286.033)
--sidebar-accent-foreground: oklch(0.21 0.006 285.885)
--sidebar-border: = --border                 --sidebar-border: oklch(1 0 0 / 10%)
--sidebar-ring: = --ring
```

La sidebar est **transparente** (`bg-transparent border-none` dans le code) : elle laisse voir le `--background`.

### 1.5 Typographie

Familles (auto-hébergées en woff2 variable) :

```css
--font-geist-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", "Roboto", sans-serif;
--font-geist-mono: "Geist Mono", ui-monospace, "SFMono-Regular", "Menlo", "Monaco", "Liberation Mono", monospace;
--font-sans: var(--font-geist-sans);
--font-mono: var(--font-geist-mono);
```

Poids : variable 100–900, mais l'UI n'utilise que `font-normal` (400), `font-medium` (500), `font-semibold` (600), plus `font-normal` forcé sur le bouton destructive.

Échelle (overrides Tailwind — **tailles non standard, c'est un signal fort du look Bifrost**) :

```
--text-xs:   0.75rem  / line-height 1rem      (labels, badges, pagination)
--text-sm:   0.825rem / 1.25rem               (⚠ pas 0.875rem — corps de texte UI dominant)
--text-base: 0.95rem  / 1.5rem               (⚠ pas 1rem — titres de topbar, inputs desktop)
--text-lg:   1.125rem / 1.75rem               (titres de dialog)
--text-xl:   1.25rem  / 1.75rem               (titres d'empty states, page d'erreur)
--text-2xl:  1.5rem   / 2rem
```

Usages typographiques types :

- Titre de topbar : `text-base font-semibold` (0.95 rem).
- Titres de page (portés par le topbar, pas dans le contenu) : voir § 2.3.
- Description sous-titre de section : `text-muted-foreground text-xs`.
- Code / IDs / clés API : `font-mono text-sm`.
- Texte courant : `text-sm` (≈ 13 px), jamais de `leading` explicite sauf `leading-6` ou `leading-relaxed` sur paragraphes d'aide.

### 1.6 Rayons de bordure

```css
--radius: 0.5rem;   /* base = 8px */
--radius-sm: calc(var(--radius) - 4px);   /* 4px — LE rayon par défaut de presque tout */
--radius-md: calc(var(--radius) - 2px);   /* 6px */
--radius-lg: var(--radius);               /* 8px — TabsList, DialogContent */
--radius-xl: calc(var(--radius) + 4px);   /* 12px */
```

Observé dans le code : **boutons, inputs, badges, tables, sidebar items, checkbox : `rounded-sm` (4 px)**. Cards : `rounded-sm`. Dialogs : `rounded-lg` (8 px). Select content / dropdown : `rounded-sm`. Le pill utilisateur de la topbar : `rounded-full`.

### 1.7 Ombres

- `shadow-sm` : cards (`bg-card … shadow-sm`), tabs actifs (`data-[state=active]:shadow-sm`).
- `shadow-md` : tooltips, select content, dropdown content, popovers.
- `shadow-lg` : dialogs, sheets, switch thumb.
- Aucune grande ombre décorative (pas de `shadow-xl`/`2xl` sauf cas exceptionnels).

### 1.8 Constantes de layout (CSS custom properties)

```css
--app-topbar-height: 3.25rem;          /* 52px */
--app-content-viewport: calc(100dvh - var(--app-topbar-height) + 0.5rem);
--app-bottom-padding: 20px;
--height-base: calc(var(--app-content-viewport) - 130px);
```

Largeurs de la sidebar (dans `components/ui/sidebar.tsx`) :

```ts
SIDEBAR_WIDTH        = "15rem"    /* 240px, état développé */
SIDEBAR_WIDTH_MOBILE = "18rem"    /* sheet mobile */
SIDEBAR_WIDTH_ICON   = "3.25rem"  /* 52px, état réduit (rail d'icônes) */
```

### 1.9 Breakpoints

Breakpoints Tailwind par défaut (aucun override dans le source) : `sm 640px`, `md 768px`, `lg 1024px`, `xl 1280px`, `2xl 1536px`.

Le point de bascule principal de l'app est **`md`** : sidebar fixe et topbar complète en `md:`, sidebar en sheet + logo mobile en dessous.

### 1.10 Scrollbars custom

Utilité `custom-scrollbar` (globals.css) : scrollbar fine 8 px, thumb `rgba(228,228,231,1)` (≈ zinc-200) devenant `rgba(82,82,91,1)` (≈ zinc-600) au hover, visible seulement au hover (`opacity: 0 → 1` on hover), track transparent. Classe `.no-scrollbar` pour masquer totalement.

---

## 2. Structure de page

### 2.1 Le shell global (`app/clientLayout.tsx`)

Arbre : `SidebarProvider` > `Sidebar` + colonne de contenu en flex vertical :

```
<div className="flex h-dvh w-full min-w-0 flex-col">
  <Topbar />                       /* hauteur 52px (h-13) */
  <div className="dark:bg-card custom-scrollbar content-container
                  mx-0 min-h-0 min-w-0 flex-1 overflow-auto
                  border border-gray-200 bg-white
                  md:mr-3 md:mb-3 md:rounded-md md:px-10 dark:border-zinc-800">
    <main className="custom-scrollbar content-container-inner relative mx-auto
                     flex h-full min-h-0 flex-col overflow-y-hidden md:p-4">
      {page}
    </main>
  </div>
</div>
```

Caractéristiques :

- La **grande carte blanche** est le conteneur unique : fond blanc (clair) / `bg-card` (sombre), bordure `gray-200` (`zinc-800` en sombre), rayon `rounded-md` (6 px), marges droite/bas `12px` (`md:mr-3 md:mb-3`), padding horizontal `40px` (`md:px-10`), scrollbar custom.
- La sidebar est transparente, sans bordure : le fond d'app `#f4f4f5` se voit derrière elle et derrière la topbar (qui n'a **aucun fond**).
- La page se cale en hauteur sur `--app-content-viewport - --app-bottom-padding`.

### 2.2 La sidebar (`components/sidebar.tsx`)

**Header** : logo `h-[22px] w-auto max-w-[150px]` à gauche (lien vers `/workspace/logs`), bouton collapse `size-7` (`PanelLeftClose`, `text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-md`) à droite. État réduit : icône seule `size-[22px]` cliquable.

**Env label** (si défini) : bandeau `rounded-sm bg-amber-400/20`, texte `font-mono text-[10px] font-semibold tracking-widest text-amber-700 dark:text-amber-400`.

**Recherche** : input `h-8 rounded-sm border bg-transparent pl-8 pr-14 text-sm`, icône `Search size-3.5` à gauche, raccourci clavier à droite :

```html
<kbd class="text-muted-foreground … text-[10px]">
  <span class="border-border bg-muted rounded-sm px-1 font-mono shadow-sm">⌘</span>
  <span class="border-border bg-muted rounded-sm px-1 font-mono shadow-sm">K</span>
</kbd>
```

Placeholder : `Search…`. ⌘K focusse l'input ; flèches + Entrée naviguent dans les résultats.

**Items racine** (ordre exact) : Observability ▾, Models ▾, MCP Gateway ▾, Plugins, Alerting ▾, Governance ▾, Guardrails ▾, Webhooks, Edge Control ▾, Cluster Config, Adaptive Routing ▾, Prompt Repository, Skills Repository, Settings ▾.

Chaque item racine, état développé :

```html
<button class="group/nav-item relative h-7.5 cursor-pointer rounded-sm border px-3 transition-all duration-200 …">
  <!-- actif :     bg-sidebar-accent text-primary border-primary/20 -->
  <!-- inactif :   border-transparent text-slate-500 dark:text-zinc-400
                     hover:bg-sidebar-accent hover:text-accent-foreground -->
  <!-- sans droit : text-muted-foreground cursor-not-allowed hover:bg-destructive/5 -->
  <svg/icône class="h-4 w-4 shrink-0" />          <!-- text-primary si actif, sinon text-muted-foreground -->
  <span class="truncate text-sm">Observability</span>   <!-- font-medium si actif -->
  <ChevronRight class="h-4 w-4 transition-transform …" />  <!-- rotate-90 si ouvert -->
</button>
```

- Icônes lucide (`h-4 w-4`), item actif = **texte teal + fond `--sidebar-accent` + bordure `primary/20`**.
- Sous-items : liste indentée `border-sidebar-border mt-1 ml-4 border-l pl-2 space-y-0.5`, chaque sous-item `h-7 rounded-sm px-2 text-sm`, icône réduite `h-3.5 w-3.5`, même logique d'état actif.
- Items externes : icône `ArrowUpRight` en fin de ligne.
- État réduit (`collapsible=icon`, 52 px) : icônes seules, tooltips Radix, parents avec sous-items → flyout `Popover side="right"` (`w-48 p-1`, titre en `text-muted-foreground px-2 py-1.5 text-xs font-medium`).
- Point vert animé `h-2 w-2 animate-pulse rounded-full bg-green-800 dark:bg-green-200` sur l'item Logs quand le websocket est connecté.

**Footer de sidebar** : pile de cartes promo (`PromoCardStack` — restart required, onboarding incomplet, nouvelle release, aide production) au-dessus du bouton d'expansion rail. Le reste (social, thème, user, version) vit dans la **topbar**.

### 2.3 La topbar (`components/topbar.tsx`)

```html
<header class="flex h-13 w-full shrink-0 items-center gap-2 px-3 pt-1 md:pr-3 md:pl-0">
```

- **Gauche** : `SidebarTrigger` (mobile), logo mobile `h-[22px] md:hidden`, titre de page `<h1 class="hidden truncate text-base font-semibold md:block">Virtual Keys</h1>`.
- Les pages déclarent leur titre via `<PageTitle title="…">description…</PageTitle>` : le titre est *hoisted* dans le topbar, et la description devient une **icône Info** (`size-5 text-muted-foreground hover:text-foreground cursor-help`) à côté du titre, ouvrant un `HoverCard w-80 rounded-sm text-sm leading-relaxed shadow-none` au survol. Badge `Beta` (vert) possible.
- **Breadcrumbs** : pour les pages imbriquées, trail `text-base font-semibold`, ancêtres `text-muted-foreground` cliquables, séparateur `/` en `text-muted-foreground/50 font-normal`, page courante jamais un lien.
- **Droite** : `NotificationCenter` (cloche), `ThemeToggle`, pill utilisateur `md:h-8 md:w-auto md:max-w-[220px] md:rounded-full md:border md:bg-card` avec avatar `size-6 rounded-full bg-muted` + nom `text-sm font-medium truncate` + `ChevronDown size-3.5`. Sans session : bouton `Menu size-4`.
- **Menu** (`DropdownMenuContent align="end" sideOffset={2} w-60`) : label utilisateur (nom + email `text-muted-foreground text-xs`), puis liens externes avec icônes **phosphor/lucide** `size-4` : « Discord Server », « GitHub Repository », « Report a bug », « Full Documentation », puis **Sign out** (`LogOut`), puis ligne « Version » en `font-mono`.

### 2.4 Système d'onglets (`components/ui/tabs.tsx`)

Radix Tabs avec comportement d'overflow : onglets qui débordent sont déplacés dans un dropdown « N ⌄ ».

```html
<!-- TabsList : pilule grise -->
<div class="bg-muted text-muted-foreground inline-flex h-9 w-fit items-center
            justify-center rounded-lg p-[3px]">
  <button class="inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5
                 rounded-sm border border-transparent px-2 py-1 text-sm font-medium
                 data-[state=active]:bg-white data-[state=active]:shadow-sm …">
    General
  </button>
</div>
```

Onglet actif = fond blanc + `shadow-sm` à l'intérieur de la piste grise `bg-muted` — le pattern « segmented control inversé ». Sombre : `dark:data-[state=active]:bg-input/30 dark:data-[state=active]:border-input`.

---

## 3. Composants (markup exact)

### 3.1 Button (`components/ui/button.tsx`)

Base :

```
inline-flex items-center ring-none justify-center gap-2 whitespace-nowrap rounded-sm
text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50
[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0
outline-none focus-visible:ring-1 focus-visible:ring-offset-1
aria-invalid:border-destructive active:scale-[0.99] transition-transform duration-100
```

Variantes :

```css
default:     bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary/50
destructive: bg-destructive text-white font-normal hover:bg-destructive/90
             focus-visible:ring-destructive/50 dark:bg-destructive/60
outline:     border bg-background hover:bg-accent hover:text-accent-foreground
             focus-visible:ring-ring/50 dark:bg-input/30 dark:border-input dark:hover:bg-input/50
secondary:   bg-secondary text-secondary-foreground hover:bg-secondary/80
             focus-visible:ring-secondary-foreground/30
ghost:       hover:bg-accent hover:text-accent-foreground
             focus-visible:ring-accent-foreground/30 dark:hover:bg-accent/50
link:        text-primary underline-offset-4 hover:underline
```

Tailles :

```css
default: h-7.5 px-2 py-1 has-[>svg]:px-2     /* ⚠ 30px de haut — boutons compacts */
sm:      h-8 rounded-sm gap-1.5 px-3 has-[>svg]:px-2.5
lg:      h-10 rounded-sm px-6 has-[>svg]:px-4
icon:    size-9
```

Loading : `isLoading` remplace le contenu par `<Loader2 className="size-4 animate-spin" />`. Icônes `size-4` par défaut. Le bouton fait un micro-`scale-[0.99]` au clic.

### 3.2 Badge (`components/ui/badge.tsx`)

Base : `inline-flex items-center justify-center rounded-sm border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap …`.

```css
default:     border-transparent bg-primary/10 border-primary/50 text-primary
secondary:   border-transparent bg-secondary text-secondary-foreground
destructive: border-transparent bg-destructive/10 border-destructive/50
             text-black dark:text-destructive-foreground dark:bg-destructive/60
outline:     text-foreground
success:     border-transparent bg-green-100 border-green-500 text-black
warning:     border-transparent bg-yellow-100 border-yellow-500 text-black
```

Pattern d'usage : les badges de statut dans les tables utilisent souvent `variant="destructive"` ou des couleurs ad hoc (`bg-amber-400/20 text-amber-700`…). Mono pour les scopes/flags : `<Badge variant="outline" className="font-mono text-xs font-normal">`.

### 3.3 Table (`components/ui/table.tsx`)

```html
<div class="relative w-full overflow-x-auto">          <!-- Table container -->
  <table class="w-full caption-bottom text-sm">
    <thead class="bg-muted/50 [&_tr]:border-b">        <!-- sauf header sticky : bg-muted -->
    <tr class="hover:bg-muted/50 dark:hover:bg-muted/75 data-[state=selected]:bg-muted border-b transition-colors">
    <th class="text-foreground h-10 px-4 text-left align-middle font-medium whitespace-nowrap">
    <td class="px-4 py-2 align-middle whitespace-nowrap">
```

Patterns réels vus dans les pages :

- Header sticky : `TableHeader className="bg-muted sticky top-0 z-20"` dans un conteneur `h-full overflow-auto`.
- Cellule clé API : `<code class="cursor-default py-1 font-mono text-sm">sk-…</code>` + boutons ghost `Eye`/`EyeOff`/`Copy` `size-4`.
- Colonne d'actions épinglée à droite : `sticky right-0 z-20 bg-white dark:bg-card` + ombre portée (`PIN_SHADOW_RIGHT`, voir § 3.11).
- Ligne cliquable : `group hover:bg-muted/50 cursor-pointer`.
- « Aucun résultat » : `<td colSpan={n} class="h-24 text-center"><span class="text-muted-foreground text-sm">No matching virtual keys found.</span></td>`.
- Largeurs de colonnes fixées au px près (`w-[250px]`, `w-[440px]`, `table-fixed min-w-[1528px]`).

### 3.4 Input / Textarea / Label

Input : `h-9 w-full rounded-sm border border-input bg-transparent px-3 py-1 md:text-sm`, placeholder `text-muted-foreground/70`, focus = **bordure seule** (`focus-visible:border-primary`), pas de ring coloré, disabled `opacity-50`. Erreur : `aria-invalid:border-destructive`.

Variante recherche (toolbar de table) : `relative` + icône `Search absolute left-3 size-4 text-muted-foreground` + `<Input className="pl-9" placeholder="Search by name..." />`.

Textarea : même base, `min-h-16 px-3 py-2`, `field-sizing-content` (auto-hauteur natif) ; `AutoSizeTextarea` pour l'autoresize.

Label : `flex items-center gap-2 text-sm leading-none font-medium`.

### 3.5 Select (Radix)

Trigger : `h-9 rounded-sm border border-input bg-transparent px-3 py-2 text-sm`, chevron `ChevronDown size-4 opacity-50`, placeholder `data-[placeholder]:text-muted-foreground`, focus `focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:ring-offset-1`. Content : `bg-popover rounded-sm border shadow-md z-[9999]`, items avec `CheckIcon`.

### 3.6 Switch

`h-5 w-9` (taille `md`, la plus utilisée ; `default` = `h-6 w-11`), track `rounded-sm border-2 border-transparent data-[state=checked]:bg-primary data-[state=unchecked]:bg-input`, thumb `size-4 rounded-sm bg-white dark:bg-zinc-900 shadow-lg`. Supporte un état loading async (spinner `Loader2 animate-spin` dans le thumb). **Le switch est carré (`rounded-sm`), pas pill.**

### 3.7 Checkbox

`size-4 rounded-[4px] border border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary`, coche `CheckIcon size-3.5 text-primary-foreground`, focus `focus-visible:ring-[3px] focus-visible:ring-ring/50`.

### 3.8 Dialog / AlertDialog

```html
<!-- Overlay -->
<div class="fixed inset-0 z-50 bg-black/50 animate-in fade-in-0">
<!-- Content -->
<div class="fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)]
            translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border bg-white
            dark:bg-card p-6 shadow-lg duration-200 sm:max-w-lg
            max-h-[calc(100dvh-40px)] overflow-y-auto
            animate-in fade-in-0 zoom-in-95">
  <button class="absolute top-6 right-4 z-10 rounded-xs opacity-70 hover:opacity-100">×</button>
```

- `DialogHeader` : `flex flex-col gap-2 pb-4 text-center sm:text-left` ; `DialogTitle` : `text-lg leading-none font-semibold` ; `DialogDescription` : `text-muted-foreground text-sm`.
- `DialogFooter` : `flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end`.
- **Clic à l'extérieur désactivé par défaut** (`disableOutsideClick = true` → `onInteractOutside` preventDefault).
- AlertDialog de confirmation destructive : `AlertDialogAction` = `buttonVariants({variant:"destructive"})`, `AlertDialogCancel` = `variant outline`.

### 3.9 Sheet (panneau latéral)

Overlay identique au dialog. Content (côté droit par défaut) : `bg-card fixed z-50 flex flex-col shadow-lg custom-scrollbar …`. Utilisé massivement pour la **création/édition** (virtual key sheet, add plugin sheet, MCP client sheet) et les détails.

### 3.10 Tabs — voir § 2.4.

### 3.11 Ombres de colonnes épinglées (`components/table/columnPinning.ts`)

```css
PIN_SHADOW_RIGHT = before:absolute before:-left-6 before:h-full before:w-6
  before:shadow-[inset_-6px_0_6px_-6px_rgba(0,0,0,0.15)]
  dark:before:shadow-[inset_-6px_0_6px_-6px_rgba(0,0,0,0.5)]
PIN_SHADOW_LEFT  = after:… inset_6px_0_6px_-6px …
```

### 3.12 Tooltip / HoverCard

Tooltip content : `bg-popover text-popover-foreground border shadow-md rounded-sm px-3 py-1.5 text-xs`, `sideOffset=8`, `delayDuration=0` (immédiat). HoverCard (descriptions de page, scopes) : même surface, `w-80` pour les descriptions, `openDelay=100 closeDelay=100`.

### 3.13 Toasts (sonner)

Montage : `<Toaster closeButton />` (racine du layout). Overrides CSS : bouton de fermeture repositionné en haut à droite (`translate(35%, -35%)`), `pointer-events: auto` pour rester cliquable au-dessus des modales Radix. Utilisation :

```ts
toast.success("Virtual key deleted successfully");
toast.error(`Failed to load virtual keys: ${getErrorMessage(error)}`);
```

### 3.14 Skeleton / Loaders

- `Skeleton` : `bg-accent pointer-events-none animate-pulse rounded-sm`.
- FullPageLoader : `flex items-center justify-center` + `Loader2 h-4 w-4 animate-spin` (spinner discret de 16 px, centré verticalement).
- Mini-loaders : `Loader2 size-4 animate-spin` inline dans les boutons.

### 3.15 Empty states

Pattern strictement identique sur toutes les pages (voir § 5) : `flex min-h-[80vh] flex-col items-center justify-center gap-4 py-16 text-center`, icône lucide `h-[5.5rem] w-[5.5rem] strokeWidth={1}` en `text-muted-foreground`, titre `text-muted-foreground text-xl font-medium`, description `text-sm max-w-[600px]`, puis boutons `outline` « Read more ↗ » + `default` « Add X ».

### 3.16 Pagination

Footer de table, `flex items-center justify-between text-xs` :

```html
<div class="text-muted-foreground flex items-center gap-2">1-25 of 1,234 entries</div>
<div class="flex items-center gap-2">
  <Button variant="ghost" size="sm" disabled><ChevronLeft class="size-3"/></Button>
  <span>Page 1 of 50</span>
  <Button variant="ghost" size="sm"><ChevronRight class="size-3"/></Button>
</div>
```

Taille de page standard : **25**, polling des données toutes les **5 s** (`POLLING_INTERVAL = 5000`).

### 3.17 InfoBox (callout maison, `components/infoBox.tsx`)

`bg-muted/30 rounded-md border p-4` ; titre `flex items-center gap-2` avec icône `text-muted-foreground` + `text-foreground text-sm font-medium` ; contenu `text-sm mt-2.5`.

### 3.18 Alert (`components/ui/alert.tsx`)

`relative w-full rounded-sm border px-4 py-3 text-sm`, icône `size-4 translate-y-0.5`. Variantes (toutes en teintes à 30–40 % d'opacité sur fond) :

```css
destructive: border-red-200/30 bg-red-50/30 text-red-900 (dark: red-800/30 / red-950/30 / red-100)
info:        border-blue-200/30 bg-blue-50/30 text-blue-900 …
warning:     border-amber-200/40 bg-amber-50/40 text-amber-900 …
```

### 3.19 DropdownMenu

Content : `bg-popover rounded-sm border shadow-md z-50 min-w-[8rem] p-1` (`sideOffset=4`). Items `flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive`. Menu « ⋯ » de ligne de table : trigger `Button variant="ghost" size="icon"` avec `MoreHorizontal size-4`.

### 3.20 CopyableId / TruncatedBadge / ScopeChips (utilitaires maison)

- `CopyableId` : bouton `size-6 inline-flex rounded hover:bg-muted`, icône `Copy/Check size-3.5`, tooltip « Copy team ID » + valeur en `font-mono`.
- `TruncatedBadge` : `Badge variant="outline" block max-w-full truncate`, tooltip portant la valeur complète.
- `ScopeChips` : badges mono `outline` (`font-mono text-xs font-normal`), overflow « +N » en `text-muted-foreground text-xs` ouvrant un HoverCard avec titre `font-mono text-[10px] tracking-wider uppercase` « Granted scopes ».
- `SectionHeader` (formulaires MCP) : `Label text-sm font-medium` + icône Info + description `text-muted-foreground text-xs`, action à droite optionnelle.
- `FormFooter` : `DialogFooter mt-4` avec bouton `Cancel` (outline) + submit `Save icon` + « Create X » / « Update X » / « Saving… », désactivé avec tooltip d'erreur de validation.

---

## 4. Patterns d'écrans admin (3 pages analysées)

### 4.1 Virtual Keys (`app/workspace/governance/virtual-keys` + `views/virtualKeysTable`)

**Layout** : page pleine hauteur `h-[calc(var(--app-content-viewport)_-_var(--app-bottom-padding))] flex-col overflow-hidden p-4`, classe `no-padding-parent` qui annule le padding du conteneur shell.

**Toolbar** (`mb-4 flex flex-wrap items-center gap-3`) :

1. `<PageTitle title="Virtual Keys">Manage virtual keys, their permissions, budgets, and rate limits.</PageTitle>` — le titre vit dans la topbar ; l'info-bulle dans la toolbar.
2. Recherche `Input pl-9` `max-w-sm`, placeholder « Search by name… », debounce 300 ms.
3. Filtres par entité (Customer / Team / User) via selecteurs, séparés par un « or » `text-muted-foreground text-xs font-medium`.
4. Actions à droite (`sm:ml-auto`) : `Rotate` (outline), `Export` (outline, dialog avec options), `Add Virtual Key` (default, icône `Plus size-4`).

**Table** : colonnes Nom (`font-medium truncate`), Assigned To (badges tronqués), Key (`font-mono` masquée, Eye/Copy), Budget (`BudgetDisplay` — barres de progression), Rate Limits, Statut (switch actif/inactif ou badge « Expired » `variant="destructive"`), actions ⋯ épinglées à droite. Tri par en-tête cliquable (`Button ghost !px-0` + `ArrowUpDown/ArrowUp/ArrowDown`). Sélection multiple par checkbox → barre d'actions en masse (rotation). Export CSV.

**Édition** : `VirtualKeySheet` (sheet latérale) avec react-hook-form + zod ; sections avec Label + description ; `FormFooter` Create/Update.

**Confirmation destructive** : « Delete Virtual Key — Are you sure you want to delete "…"? This action cannot be undone. » → Cancel / Delete (destructive).

**Empty state** : icône `KeyRound` 88 px, « Virtual keys control access, budgets, and rate limits », boutons « Read more ↗ » (docs) + « Add Virtual Key ».

### 4.2 Plugins (`app/workspace/plugins`)

**Layout master-detail** dans `mx-auto w-full max-w-7xl` :

- Colonne liste `md:w-[250px] md:min-w-[250px]`, carte `rounded-md bg-zinc-50/50 p-4 dark:bg-zinc-800/20`, libellé « Plugins » `text-muted-foreground mb-2 text-xs font-medium`.
- Items : `mb-1 flex max-h-[32px] w-full items-center gap-2 rounded-sm border px-3 py-1.5 text-sm` ; actif `bg-secondary`, inactif `border-transparent hover:bg-secondary hover:border` ; icône `Puzzle size-3.5 text-muted-foreground` + nom tronqué + **dot de statut** `h-2 w-2 animate-pulse rounded-full bg-green-800 dark:bg-green-200` (ou rouge si inactif).
- Boutons outline `w-full justify-start` : « Install New Plugin », « Edit Plugin Sequence ».
- Colonne détail : `PluginsView` (header, statuts, config du plugin sélectionné) ; sur mobile, navigation bouton retour `ghost` « ← Plugins ».

La sélection est pilotée par query param (`?plugin=name`), pas d'état local.

### 4.3 MCP Server Catalog (`app/workspace/mcp-registry`)

**Layout** : identique à Virtual Keys — page pleine hauteur, toolbar, table.

**Toolbar** : `<PageTitle title="MCP Server Catalog">Manage servers that can connect to the MCP Tools endpoint.</PageTitle>`, recherche « Search by name… », filtres via **sidebar de filtres** (`MCPClientsFilterSidebar`) — panneau latéral de facettes (connection type, auth type, state, code mode, status, virtual keys) — et bouton « Add MCP Server ».

**Table** (`mcpClientsTable`) : mêmes conventions (header sticky `bg-muted`, cellules `whitespace-nowrap`, colomne actions épinglée, pagination « entries » 25/page, polling 5 s).

**Formulaires** : `mcpClientSheet` + sous-composants `SectionHeader` (title + description + tooltip Info + action), champs de connexion, auth (OAuth2 avec `ScopeChips`, headers authorizer, TLS, token exchange), organisés en sections espacées dans un sheet scrollable.

**Empty state** : icône `Server` 88 px, « MCP servers connect tools and context to the gateway », boutons « Read more ↗ », « Add MCP Server », « Browse Library » (Link avec icône `Boxes`).

**États d'erreur** : toast destructif, jamais de page d'erreur complète sauf config injoignable (page « We can't reach the dashboard » : carte `max-w-lg rounded-sm border p-6`, icône `WifiOff` dans un carré `bg-muted size-11`, titre `text-xl font-semibold`, texte d'aide `text-muted-foreground text-sm leading-6`, bouton « Try again » + note rassurante `text-xs`).

---

## 5. Tone & copywriting

Style : **anglais, bref, technique, orienté action**. Titres de pages = noms d'entités au pluriel ou fonctionnels ; descriptions = une phrase au présent, sans marketing ; empty states = phrase d'abord bénéfice (« X control/extend/connect … ») puis instruction ; boutons = verbe d'action + nom d'entité, jamais de ponctuation finale ; toasts = confirmation courte au passé ou erreur préfixée.

Exemples repris tels quels :

1. Titre page : « Virtual Keys » — description : « Manage virtual keys, their permissions, budgets, and rate limits. »
2. Titre page : « MCP Server Catalog » — description : « Manage servers that can connect to the MCP Tools endpoint. »
3. Empty state : « Virtual keys control access, budgets, and rate limits » / « Create virtual keys to assign permissions, spending limits, and usage quotas to teams, customers, or API clients. »
4. Empty state : « Custom plugins extend Bifrost with your own business logic » / « Build and deploy plugins for custom integrations, workflow automation, and AI governance. »
5. Empty state : « MCP servers connect tools and context to the gateway » / « Add MCP servers to expose tools and resources to the MCP Tools endpoint. Configure connection type, auth, and which tools to enable. »
6. Confirmation : « Delete Virtual Key » / « Are you sure you want to delete "…"? This action cannot be undone. » — boutons « Cancel » / « Delete ».
7. Toasts : « Virtual key deleted successfully », « Virtual key enabled » / « Virtual key disabled », « Exported 25 virtual keys », « Failed to load virtual keys: … », « Export failed: … ».
8. Boutons vides : « Read more ↗ » (lien docs, aria-label « Read more about virtual keys (opens in new tab) »), « Add Virtual Key », « Add MCP Server », « Browse Library », « Install New Plugin », « Edit Plugin Sequence ».
9. Placeholders : « Search by name… », « e.g., Production API Key », « This key is used for... ».
10. Champs : « Max entries (optional) » ; note d'aide : « API tokens are excluded from the export. » ; footer de sheet : « Create Virtual Key » / « Update Virtual Key » / « Saving… », tooltip de bouton désactivé : « Please fix validation errors », « You don't have permission to perform this action ».
11. Placeholders de recherche sidebar : « Search… » avec raccourci ⌘K.
12. Page d'erreur config : « We can't reach the dashboard » / « Bifrost didn't return its configuration. This is usually a brief interruption, especially while Bifrost is being upgraded. » / « Try again » / « Your settings and data are unaffected. »

Conventions récurrentes : noms propres d'entités capitalisés (Virtual Key, MCP Server, Plugin), jargon gateway assumé (endpoint, tokens, budget, rate limit, scope), ellipse `…` et non `...` dans les placeholders UI, apostrophes typographiques dans les phrases longues.

---

## 6. Recette : composant par composant, comment reproduire

Prérequis : Tailwind 4 (CSS-first), les tokens du § 1 copiés dans `@theme inline` + `:root` / `.dark`, fontes Geist + Geist Mono self-hosted, `tw-animate-css`. Classes utilitaires `custom-scrollbar`, `truncate-start`. Icônes lucide (défaut `size-4`, strokeWidth 2).

**Button** — `<button class="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 outline-none focus-visible:ring-1 focus-visible:ring-offset-1 active:scale-[0.99] duration-100 h-7.5 px-2">` + variante : primaire `bg-primary text-primary-foreground hover:bg-primary/90` ; secondaire `bg-secondary text-secondary-foreground hover:bg-secondary/80` ; outline `border bg-background hover:bg-accent` ; ghost `hover:bg-accent` ; destructive `bg-destructive text-white hover:bg-destructive/90`. Loading → spinner `Loader2 size-4 animate-spin`.

**Badge** — `inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium`. Statut soft : `bg-primary/10 border-primary/50 text-primary` (accent) ; `bg-destructive/10 border-destructive/50` (danger) ; succès : `bg-green-100 border-green-500 text-black` ; warning : `bg-yellow-100 border-yellow-500 text-black`. Tag neutre : `bg-secondary`. Scope/flag : ajouter `font-mono font-normal`.

**Table** — conteneur `relative w-full overflow-x-auto` ; table `w-full text-sm` ; header `bg-muted sticky top-0` (ou `bg-muted/50`) avec `th h-10 px-4 text-left font-medium whitespace-nowrap` ; lignes `border-b transition-colors hover:bg-muted/50 cursor-pointer` ; cellules `px-4 py-2 whitespace-nowrap` ; clés/IDs en `<code class="font-mono text-sm">` ; colonne d'actions `sticky right-0 bg-white dark:bg-card` + ombre `inset` (§ 3.11) ; vide → `h-24 text-center text-muted-foreground text-sm`.

**Champ de formulaire** — `h-9 w-full rounded-sm border border-input bg-transparent px-3 py-1 text-sm outline-none focus-visible:border-primary disabled:opacity-50`, erreur `aria-invalid:border-destructive`. Label `text-sm font-medium`. Description de champ `text-muted-foreground text-xs`. Recherche : wrapper relatif + `Search size-4 absolute left-3 text-muted-foreground` + `pl-9`.

**Select** — trigger identique à l'input + `justify-between` + chevron `opacity-50` ; menu `bg-popover rounded-sm border shadow-md`.

**Switch** — `h-5 w-9 rounded-sm border-2 border-transparent bg-input data-[checked]:bg-primary`, thumb `size-4 rounded-sm bg-white shadow-lg translate-x-4`.

**Tabs** — liste `bg-muted rounded-lg p-[3px] inline-flex h-9` ; trigger `rounded-sm px-2 py-1 text-sm font-medium data-[active]:bg-white data-[active]:shadow-sm`.

**Dialog** — overlay `fixed inset-0 z-50 bg-black/50` ; carte `fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full sm:max-w-lg rounded-lg border bg-white dark:bg-card p-6 shadow-lg gap-4 grid animate-in fade-in-0 zoom-in-95 max-h-[calc(100dvh-40px)] overflow-y-auto` ; titre `text-lg font-semibold`, description `text-muted-foreground text-sm`, footer boutons alignés à droite (outline Cancel + primaire). Bloquer le clic extérieur.

**Sheet d'édition** — panneau droit `bg-card fixed inset-y-0 right-0 z-50 w-full sm:max-w-lg flex flex-col shadow-lg`, sections `SectionHeader` (Label + Info tooltip + `text-xs` description), pied `FormFooter` (Cancel outline + `Save` Create/Update, désactivé + tooltip si invalide).

**Empty state** — `min-h-[80vh] flex flex-col items-center justify-center gap-4 text-center` ; icône lucide `h-[5.5rem] w-[5.5rem] strokeWidth={1} text-muted-foreground` ; titre `text-muted-foreground text-xl font-medium` ; description `text-muted-foreground text-sm max-w-[600px]` ; actions `mt-6 gap-2` : `outline` « Read more ↗ » + `default` « Add X ».

**Pagination** — `flex items-center justify-between text-xs` ; `text-muted-foreground` « 1-25 of 1,234 entries » ; `ghost sm` ChevronLeft/Right `size-3` + « Page 1 of 50 ».

**Toast** — sonner `<Toaster closeButton />`, coin par défaut, close bouton décalé `translate(35%,-35%)`. Succès : « X deleted successfully » ; erreur : « Failed to load X: {message} ».

**Tooltip** — `bg-popover border rounded-sm px-3 py-1.5 text-xs shadow-md`, ouverture immédiate (delay 0), offset 8.

**Loader** — spinner seul `Loader2 h-4 w-4 animate-spin` centré ; skeletons `bg-accent animate-pulse rounded-sm`.

**Sidebar item** — `h-7.5 rounded-sm border px-3 text-sm flex items-center gap-2` ; actif `bg-sidebar-accent text-primary border-primary/20 font-medium` + icône `text-primary` ; inactif `border-transparent text-slate-500 dark:text-zinc-400 hover:bg-sidebar-accent` ; sous-items `ml-4 border-l pl-2`, entrées `h-7 px-2` icônes `size-3.5`. Recherche `h-8` + ⌘K. Rail réduit 52 px, tooltips.

**Topbar** — `h-13 flex items-center gap-2 px-3` sans fond ; titre page `text-base font-semibold` (+ Info `HoverCard w-80` pour la description) ; droite : cloche, theme toggle, pill user `rounded-full border bg-card h-8` ; menu `w-60`.

**Page** — carte blanche `flex-1 overflow-auto border border-gray-200 dark:border-zinc-800 bg-white dark:bg-card rounded-md mr-3 mb-3 px-10` autour d'un `main md:p-4` ; toolbar `mb-4 flex flex-wrap items-center gap-3` ; table dans `rounded-sm border grow overflow-hidden` ; hauteur `calc(100dvh - 3.25rem + 0.5rem - 20px)`.

---

## Résumé — points essentiels

1. **Accent unique teal** `oklch(0.5081 0.1049 165.61)` en clair, inversé en blanc cassé en sombre ; fond app `#f4f4f5`, surfaces blanches.
2. **Geist + Geist Mono** self-hosted ; corps de texte `text-sm` = **0.825 rem** (pas 0.875), `text-base` = **0.95 rem** — tailles non standard indispensables pour le rendu exact.
3. Rayons quasi partout **`rounded-sm` (4 px)** ; boutons compacts **`h-7.5`** (30 px) ; ombres faibles (`shadow-sm/md/lg` uniquement).
4. Shell = sidebar transparente 240 px (rail 52 px) + topbar 52 px sans fond + **grande carte blanche** bordée occupant le reste (`px-10`, `rounded-md`, scrollbar custom invisible jusqu'au hover).
5. Titres de pages vivent dans la **topbar** (`text-base font-semibold`), avec description en icône Info → HoverCard `w-80` ; breadcrumbs mutés pour pages imbriquées.
6. Tables : header sticky `bg-muted`, lignes `hover:bg-muted/50`, clés en `font-mono`, colonne d'actions épinglée avec ombre `inset`, pagination « 1-25 of N entries / Page X of Y », 25 lignes, polling 5 s.
7. Édition dans des **sheets latéraux** (pas de page dédiée), formulaires react-hook-form + zod, `FormFooter` Create/Update avec tooltip de validation ; suppression = AlertDialog « This action cannot be undone. » avec bouton destructive.
8. **Empty states strictement normalisés** : icône 88 px stroke 1, titre bénéfice `text-xl text-muted-foreground`, description `max-w-[600px]`, boutons « Read more ↗ » outline + « Add X » primaire.
9. Copywriting : anglais court et technique, boutons verbe + entité, toasts « X deleted successfully » / « Failed to load X: … », placeholder « Search by name… ».
10. Switch carré `rounded-sm`, tabs en segmented control inversé (piste `bg-muted`, onglet actif blanc + `shadow-sm`), badges soft à 10–50 % de teinte, tooltips immédiats `text-xs`.
