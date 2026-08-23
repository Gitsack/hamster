---
name: Hamster
description: Operator-grade media management for music, movies, TV and books — one control room instead of five dashboards.
colors:
  signal-violet: "oklch(0.52 0.27 277)"
  signal-violet-dark: "oklch(0.65 0.24 277)"
  chassis-white: "oklch(1 0 0)"
  chassis-black: "oklch(0.141 0.005 285.823)"
  panel-graphite: "oklch(0.21 0.006 285.885)"
  rail-bone: "oklch(0.985 0 0)"
  tray-ash: "oklch(0.967 0.001 286.375)"
  tray-slate: "oklch(0.274 0.006 286.033)"
  readout-grey: "oklch(0.552 0.016 285.938)"
  readout-grey-dark: "oklch(0.705 0.015 286.067)"
  seam-light: "oklch(0.92 0.004 286.32)"
  seam-dark: "oklch(1 0 0 / 10%)"
  alarm-red: "oklch(0.577 0.245 27.325)"
  alarm-red-dark: "oklch(0.704 0.191 22.216)"
  status-complete-green: "oklch(0.55 0.15 152)"
  status-transfer-cyan: "oklch(0.55 0.14 228)"
  status-transit-magenta: "oklch(0.55 0.19 330)"
  status-queued-amber: "oklch(0.56 0.12 70)"
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 2rem
    letterSpacing: "-0.01em"
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.75rem
    letterSpacing: "normal"
  subtitle:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5rem
    letterSpacing: "normal"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.25rem
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1rem
    letterSpacing: "normal"
  micro:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 0.875rem
    letterSpacing: "0.01em"
  readout:
    fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1rem
    letterSpacing: "normal"
    fontFeature: "tnum"
rounded:
  sm: "0.225rem"
  md: "0.425rem"
  lg: "0.625rem"
  xl: "0.825rem"
  full: "9999px"
spacing:
  hairline: "4px"
  tight: "8px"
  step: "12px"
  block: "16px"
  section: "24px"
components:
  button-primary:
    backgroundColor: "{colors.signal-violet}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "oklch(0.52 0.27 277 / 0.9)"
    textColor: "{colors.chassis-white}"
  button-outline:
    backgroundColor: "{colors.chassis-white}"
    textColor: "{colors.chassis-black}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.tray-ash}"
    textColor: "{colors.panel-graphite}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.chassis-black}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "36px"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.chassis-black}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  card-surface:
    backgroundColor: "{colors.chassis-white}"
    textColor: "{colors.chassis-black}"
    rounded: "{rounded.xl}"
    padding: "24px"
  status-badge-complete:
    backgroundColor: "{colors.status-complete-green}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "24px"
  status-badge-transfer:
    backgroundColor: "{colors.status-transfer-cyan}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "24px"
  status-badge-transit:
    backgroundColor: "{colors.status-transit-magenta}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "24px"
  status-badge-queued:
    backgroundColor: "{colors.status-queued-amber}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "24px"
  status-badge-failed:
    backgroundColor: "{colors.alarm-red}"
    textColor: "{colors.chassis-white}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 8px"
    height: "24px"
  nav-item-active:
    backgroundColor: "{colors.tray-ash}"
    textColor: "{colors.panel-graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "32px"
---

# Design System: Hamster

## Overview

**Creative North Star: "The Control Room"**

Hamster is the panel a single operator stands in front of. Four media types, a dozen external services, and a queue that is always doing something — all of it legible at a glance, all of it truthful about its own state. The chassis is deliberately quiet: near-neutral cool greys, hairline seams, flat surfaces. Everything that carries chroma carries meaning. A green badge is a fact. A magenta badge is a fact. The violet accent is the application speaking in its own voice, and it appears rarely enough that you notice when it does.

This is an expert's instrument, not an onboarding experience. Density is a feature: release names, quality strings, byte counts and progress percentages are the payload, and the system's job is to rank them, align them, and get out of the way. Type is small and tight (14px is the working size, not 16px), rows are compact, and the eye travels down aligned columns rather than across decorated cards. Where the interface is showing artwork — posters, covers, backdrops — the art is allowed to be the loudest thing in the frame, because at that moment identification is the task.

The system is designed to be read in two lighting conditions with equal fidelity. Dark is not a courtesy mode here; a homelab tool lives on a second monitor in a dim room as often as it lives in daylight. Every surface, every status colour and every border is specified in both ramps, and a surface that only resolves in one of them is unfinished.

Two things this is explicitly not. It is not the \*arr apps: no Bootstrap-era chrome, no cramped undifferentiated tables, no settings screens that are a thousand identical form rows with no hierarchy. And it is not the untouched shadcn/new-york default: generic rounded cards floating on white with uniform grey text and no point of view is the starting kit, not the destination. The measure of this system is whether a screenshot is recognisable as Hamster with the logo cropped out.

**Key Characteristics:**

- Neutral cool-grey chassis; chroma is reserved for meaning
- One accent voice (Signal Violet), used sparingly and consistently
- A named status ramp that is the same in both themes
- Flat surfaces, hairline seams, shadow only where something truly floats
- Compact density: 14px body, 36px controls, 24px status badges
- Dual-theme parity as a hard requirement, not a setting
- Monospaced tabular numerals wherever numbers are compared

## Colors

A near-neutral cool-grey chassis (zinc family, hue ~286) carrying one violet accent and a five-colour status ramp; nothing else in the system is allowed to be saturated.

### Primary

- **Signal Violet** (`oklch(0.52 0.27 277)` light / `oklch(0.65 0.24 277)` dark): the application's own voice. Primary buttons, the active navigation item's mark, focus rings, selection highlight, and links. It never encodes media state — that is the status ramp's job. At 0.27 chroma it is genuinely loud, which is exactly why it must stay rare.

### Secondary

The system has no second brand accent, and should not acquire one. Secondary and tertiary emphasis are achieved with neutral tone steps, not with additional hues.

### Neutral

- **Chassis White** (`oklch(1 0 0)`): page and card background in light theme.
- **Chassis Black** (`oklch(0.141 0.005 285.823)`): primary text in light theme; page background in dark theme. The same value doing opposite jobs is what makes the two ramps feel like one system.
- **Panel Graphite** (`oklch(0.21 0.006 285.885)`): card, popover and sidebar surface in dark theme; strong secondary text in light theme.
- **Rail Bone** (`oklch(0.985 0 0)`): sidebar surface in light theme; primary text in dark theme.
- **Tray Ash** (`oklch(0.967 0.001 286.375)`): muted fills, hover states, secondary buttons and inactive chips in light theme.
- **Tray Slate** (`oklch(0.274 0.006 286.033)`): the same roles in dark theme.
- **Readout Grey** (`oklch(0.552 0.016 285.938)` light / `oklch(0.705 0.015 286.067)` dark): supporting metadata — years, runtimes, file paths, timestamps, counts. Every screen has more of this than it does of primary text, and it must stay readable at 12px.
- **Seam** (`oklch(0.92 0.004 286.32)` light / `oklch(1 0 0 / 10%)` dark): the hairline that does the work shadows would otherwise do. Card edges, table rules, header underline, sidebar divider.

### Tertiary — the Status Ramp

Media state is the product's primary information, so it gets a first-class, named colour vocabulary. These five are **theme-independent**: identical values in light and dark, always carrying white text, so an operator learns one mapping and never re-learns it.

- **Complete Green** (`oklch(0.55 0.15 152)`): the file exists on disk. Terminal, successful, restful.
- **Transfer Cyan** (`oklch(0.55 0.14 228)`): actively downloading. Pairs with a percentage.
- **Transit Magenta** (`oklch(0.55 0.19 330)`): importing — the download landed and is being moved and renamed. The one state that animates.
- **Queued Amber** (`oklch(0.56 0.12 70)`): requested, monitored, waiting for a release. Nothing is wrong; nothing has happened yet.
- **Alarm Red** (`oklch(0.577 0.245 27.325)` light / `oklch(0.704 0.191 22.216)` dark): failure, destructive action, and the hover state of any cancellable badge. The only status colour that shifts between themes, because it doubles as the destructive UI colour.

These values **retune** the incumbent implementation, which uses raw Tailwind classes (`bg-green-600`, `bg-blue-600`, `bg-purple-600`, `bg-yellow-600`) outside the token system. Two defects motivated the change: `blue-600` sits 14° from Signal Violet and `purple-600` 26° from it, so the app's own voice was indistinguishable from two media states; and `bg-yellow-600` with `text-white` measures roughly 2.6:1, a straightforward contrast failure. The retuned hues sit at 27°, 70°, 152°, 228° and 330°, leaving Signal Violet alone in a ~50° gap on either side, and every ramp value holds white text at 4.5:1 or better.

**The One Voice Rule.** Signal Violet means "Hamster is speaking." Status colour means "your media is in this state." A screen never uses violet to indicate media state, and never uses a status colour for an interface affordance. When both would apply to the same element, status wins — the operator came for the media, not the app.

**The Chroma Budget Rule.** Outside artwork, saturated colour covers under 5% of any screen. If a layout needs more colour than that to feel alive, the layout is failing, not the palette.

**The Two Ramps, One System Rule.** Every colour decision is specified in both themes before it ships. A surface that has only been looked at in light mode is not done.

## Typography

**Display Font:** none — the interface font carries all roles.
**Body Font:** system UI sans (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial`)
**Label/Mono Font:** system monospace (`ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`)

**Character:** Deliberately unbranded and locally rendered. The self-hosted constraint forbids CDN-loaded webfonts, and the Control Room does not want a personality font anyway — the operator's eye should land on the release name, not on the letterforms. Distinction comes from the scale being tighter than a consumer app's and from monospace appearing wherever numbers must be compared.

### Hierarchy

- **Headline** (700, 24px / 32px, -0.01em): page-level titles on library detail and dashboard sections. Rare — most screens open at Title.
- **Title** (600, 18px / 28px): the app header's `h1` and the dominant heading of a detail view.
- **Subtitle** (600, 16px / 24px): section headings inside a page, card titles, dialog titles.
- **Body** (400, 14px / 20px): the working size and the system's centre of gravity — table cells, descriptions, form values, list rows. Prose blocks such as overviews cap at 65–75ch.
- **Label** (500, 12px / 16px): metadata, badge text, form labels, column headers, timestamps.
- **Micro** (500, 10px / 14px, 0.01em): annotations that sit *on* artwork — the genre chip, the tiny status badge, the provider overflow counter. Legitimate only over an image, where the text is a secondary annotation on a surface that already carries its own contrast.
- **Readout** (mono, 400, 12px, `tabular-nums`): byte counts, progress percentages, durations, bitrates, file paths, release names, indexer identifiers, log lines.

The ramp bottoms out at Micro. 9px and 11px are off-system: 9px is below the legibility floor even on artwork, and 11px is an unmotivated step between Micro and Label. Both exist in the incumbent code and both are defects.

**The Readout Rule.** Any number an operator might compare against another number is set in mono with tabular figures. Percentages, sizes, durations, counts. A column of proportional digits that will not align is a defect, not a style choice.

**The 14 Is Normal Rule.** Body text is 14px, not 16px. This is an expert tool with a lot of true content per screen, and inflating the base size to consumer defaults costs rows without adding comprehension.

## Layout

The frame is a persistent left rail plus a single scrolling work area. The sidebar is 16rem expanded, 3rem collapsed to icons, and 18rem when it becomes an overlay sheet below 768px; its state persists in a cookie and toggles with ⌘/Ctrl+B. The header is a fixed 56px minimum bar carrying the sidebar trigger, a vertical hairline, the page title, and a right-aligned action cluster that wraps rather than truncating. Content is padded 16px and, when the audio player is mounted, gains 96px of bottom clearance so the last row is never trapped behind it.

The spacing rhythm is a 4px base expressed in five working steps: **hairline 4px** (icon-to-label), **tight 8px** (the default gap — inline clusters, badge rows), **step 12px** (related controls), **block 16px** (card padding, page padding, unrelated controls), **section 24px** (between page sections and inside cards). Denser than a marketing surface by design; the gap between two things should read as their relationship, not as breathing room.

Media grids are the system's signature layout and follow one canonical ramp: **2 columns → 3 at 640px → 4 at 768px → 5 at 1024px → 6 at 1280px**. Posters hold a 2:3 aspect ratio, horizontal lanes fix cards at 150px wide, and the small variant at 128px. Any new media grid uses this ramp; introducing a second column progression fragments the library's rhythm across pages.

**The One Ramp Rule.** 2/3/4/5/6 at the standard breakpoints. A grid that needs different counts is a different component, and needs a reason.

**The 768 Reflow Rule.** 768px is the real boundary: the rail becomes a sheet, side-by-side hero layouts stack, and action clusters wrap. Every screen is verified at 375px and 1440px before it is called done — the operator checks the queue from a phone, and a horizontally scrolling table is a bug.

## Elevation & Depth

The system is **flat with tonal layering**. Depth is communicated by surface tone and a hairline seam, never by a resting shadow. In light theme, cards separate from the page by their border alone (both are white); in dark theme, cards lift by tone (Panel Graphite on Chassis Black) plus a 10%-white seam. This is what makes dense screens stay calm — twenty shadowed cards in a grid produce visual noise that competes with the artwork they exist to frame.

Shadow is reserved for things that genuinely leave the plane: dialogs, dropdowns, popovers, tooltips, sheets and toasts. Those float above the work, and the shadow is what says so.

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): dialogs, dropdown menus, popovers, sheets, toasts. The only shadow that appears at rest, and only on detached surfaces.
- **Focus ring** (`box-shadow: 0 0 0 3px <Signal Violet at 50%>`): not decoration — the system's keyboard-visibility contract. Paired with a border shift to the ring colour.
- **Poster ring** (`box-shadow: inset 0 0 0 1px rgb(0 0 0 / 0.4)`): the hairline that keeps a pale provider logo or badge from bleeding into a pale poster. Used on artwork only.

**The Flat-By-Default Rule.** Surfaces are flat at rest. If a card needs a shadow to be findable, its border, background tone or spacing is wrong. Fix the layer, not the lighting.

## Shapes

Corners are consistently soft but never pill-shaped, on a scale derived from a single 0.625rem root: **sm 3.6px** (poster provider logos, inline chips), **md 6.8px** (buttons, inputs, selects, nav items — the workhorse), **lg 10px** (posters, artwork containers, media thumbnails), **xl 13.2px** (cards and panels). Full-round (9999px) is reserved for two things: status and metadata badges, and avatars.

Borders are 1px and always drawn in the Seam colour; the system never uses a heavier rule to signal importance. Artwork is clipped with `overflow: hidden` at the lg radius so the image itself defines the shape, and poster overlays sit inside that clip.

There is no other recurring geometry — no angled cuts, no asymmetric radii, no decorative dividers. The silhouette vocabulary is intentionally small so that alignment and density carry the visual interest.

**The Radius Ladder Rule.** Radius encodes containment depth: chip < control < artwork < panel. A 12px radius on a button or a 4px radius on a card breaks the ladder and reads as a mistake.

## Components

### Buttons

- **Shape:** gently rounded (md, 6.8px), 36px tall at default, 32px small, 40px large; icon-only variants are square at the matching size. Text is 14px/500 with an 8px icon gap and 16px horizontal padding (12px when an icon leads).
- **Primary:** Signal Violet fill with white text; hover drops to 90% opacity. This is the one action on a screen that Hamster wants you to take.
- **Outline:** transparent fill with a Seam border, hover fills with Tray Ash. The default for secondary actions and for the "Request" affordance on media cards.
- **Ghost:** no fill or border until hover, which fills with Tray Ash. Used for icon actions in headers, table rows and toolbars, where a resting border would multiply into visual noise.
- **Destructive:** Alarm Red fill with white text, and a red-tinted focus ring. Delete, cancel, remove, unmonitor.
- **Focus:** border shifts to Signal Violet and a 3px ring at 50% opacity appears. Never removed, never replaced by an outline-none.

### Status Badge — signature component

The one component that most defines Hamster, appearing on posters, in tables, on detail headers and in the queue. Full-round, 12px/500 text, white on a status fill, with a 12px leading icon.

- **Sizes:** tiny (20px, icon only — poster overlays), sm (24px — grids and tables), default (28px — detail pages).
- **States:** Complete Green / Transfer Cyan (with live percentage) / Transit Magenta (icon pulses) / Queued Amber / Alarm Red.
- **The badge is the control.** Where an action is reversible, hovering swaps both the icon and the label in place — "Downloaded" becomes "Remove", "72%" becomes "Cancel", "Requested" becomes "Unrequest" — and the fill switches to Alarm Red to signal the consequence. The badge never grows a separate button; the state and its reversal occupy the same 24 pixels.
- **On artwork:** top-right of the poster, above the hover gradient. When empty (`none`), a request affordance may fade in on hover rather than sitting permanently on the art.

### Cards / Containers

- **Corner Style:** xl (13.2px).
- **Background:** Chassis White (light) / Panel Graphite (dark).
- **Shadow Strategy:** none at rest — see Elevation. The Seam border is the edge.
- **Border:** 1px Seam on all sides.
- **Internal Padding:** 24px vertical, 24px horizontal, with a 24px gap between header, content and footer.

### Inputs / Fields

- **Style:** transparent fill with a 1px Seam border at md radius, 36px tall, 14px text (16px on mobile to defeat iOS zoom), 12px horizontal padding. In dark theme the fill lifts to `oklch(1 0 0 / 15%)` so the field reads against the panel.
- **Focus:** border shifts to Signal Violet plus the 3px ring at 50%.
- **Error:** border and ring switch to Alarm Red, driven by `aria-invalid` rather than a class — validity is announced, not merely coloured.
- **Disabled:** 50% opacity, pointer events off.

### Navigation

The left rail is grouped into **Main** (Dashboard, Library, Calendar, Search), **Activity** (Activity, History), **Settings**, and **System**, each under a 12px Readout Grey group label. Items are 32px tall, md radius, 14px text with a 16px leading icon.

- **Default:** transparent, sidebar foreground.
- **Hover:** Tray Ash / Tray Slate fill.
- **Active:** filled, with weight increasing to 500. The active item is identified by fill and weight; a violet marker is permitted but only one active item exists at a time.
- **Collapsed:** icons only at 3rem, labels move into tooltips.
- **Mobile:** below 768px the rail becomes an 18rem overlay sheet opened from the header trigger.

### Tables and Rows

The queue, history and file lists are the densest surfaces in the product and follow one pattern: 12px Label column headers in Readout Grey, 14px body cells, Seam hairlines between rows, no zebra striping, no vertical rules. Numeric columns are right-aligned and set in Readout mono. Row hover fills with Tray Ash. Status lives in a badge in a fixed column, never as a coloured row background.

### Empty States

Centred stack with 48px of vertical air: a Tray Ash circle holding a 24px icon, an 18px/500 title, and a Readout Grey line of explanation. Deliberately plain — no illustration, no mascot. An empty state on this product usually means something is not configured, so it should name the next action rather than decorate the absence.

## Do's and Don'ts

### Do:

- **Do** reserve Signal Violet for the application's own voice — primary action, focus, selection, active nav — and let the status ramp own everything about media state.
- **Do** set every comparable number in Readout mono with `tabular-nums`: percentages, sizes, durations, bitrates, counts.
- **Do** specify and verify both themes for every surface. Dark parity is a requirement of this system, not an option.
- **Do** use the canonical grid ramp (2/3/4/5/6 at sm/md/lg/xl) for any media grid.
- **Do** separate surfaces with the 1px Seam border and a tone step, not with a resting shadow.
- **Do** keep the status badge as the control — hover swaps icon and label in place and turns Alarm Red to signal the consequence.
- **Do** let artwork be the loudest element in the frame; the chrome around a poster grid should be almost colourless.
- **Do** check every screen at 375px and 1440px before calling it done.

### Don't:

- **Don't** add a second brand accent. Secondary emphasis comes from neutral tone steps.
- **Don't** use raw Tailwind palette classes (`bg-green-600`, `text-blue-500`) for state. Use the named status ramp so the mapping stays learnable and themable.
- **Don't** put white text on a fill lighter than roughly `oklch(0.62 ...)`; that is exactly how the incumbent `bg-yellow-600` badge failed contrast.
- **Don't** add resting shadows to cards, rows or grid items. Overlays only.
- **Don't** raise body text to 16px on desktop or loosen the spacing steps to consumer proportions. Density is the product.
- **Don't** ship a colour-only state signal. Every status carries an icon and a label alongside its fill (the 20px tiny badge is the sole exception, and it is always tooltip-backed).
- **Don't** remove or restyle the focus ring. 3px, Signal Violet at 50%, plus the border shift.
- **Don't** let a settings screen become an undifferentiated wall of form rows — group into cards with subtitles. That is the \*arr failure this product exists to correct.
- **Don't** introduce full-bleed cinematic backdrop heroes with heavy gradient scrims; Hamster manages media, it is not a lean-back streaming surface.

---

## Known gaps in the incumbent implementation

Recorded here because the sections above are normative and the code does not yet meet them:

1. **The dark theme is unreachable.** `inertia/css/app.css:83` defines the complete `.dark` ramp, but nothing in the codebase ever applies the `dark` class — there is no theme provider, no toggle in `inertia/pages/settings/ui.tsx`, and no `documentElement.classList` call anywhere in `inertia/`. The app renders light-only today. Dark parity above is the spec; shipping the toggle is the outstanding work.
2. **Status colours bypass the token system.** `inertia/components/library/media-status-badge.tsx` uses `bg-green-600`, `bg-blue-600`, `bg-purple-600` and `bg-yellow-600` directly. The named ramp above replaces them, and `bg-yellow-600` + `text-white` is a live contrast failure.
3. **`--chart-1` through `--chart-5` are dead.** Defined in both ramps, referenced by no component; there is no charting library in the project. Either a charting surface is coming or these should be removed.
4. **The Readout role is only partly adopted.** `font-mono` appears 8 times and `tabular-nums` 5 times across the frontend, well short of the numeric surfaces that exist in the queue, history and file lists.
