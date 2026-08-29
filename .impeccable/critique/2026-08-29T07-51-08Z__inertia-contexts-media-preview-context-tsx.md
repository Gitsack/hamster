---
target: detail sheets
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-29T07-51-08Z
slug: inertia-contexts-media-preview-context-tsx
---
Method: dual-agent (A: design review · B: detector + source evidence). No live browser evidence — browser automation not exposed to the evidence agent; dev server on :3333 is behind auth. All findings source-verified.

# Design Health Score — Movie & TV detail sheets

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Skeleton lacks gallery/cast/similar placeholders; nothing states which quality profile or root folder an Add commits to. |
| 2 | Match System / Real World | 2 | Two unrelated "status" vocabularies (TMDB production status :514 vs library badge :436). One act, three verbs. |
| 3 | User Control and Freedom | 1 | No way to close the sheet on a phone once scrolled. Similar-title tap replaces the sheet with no way back. |
| 4 | Consistency and Standards | 2 | Sheet and full page disagree on content, order, chip variant. Revised up from A's 1 — internally consistent, uses system components. |
| 5 | Error Prevention | 1 | Single-profile movie add fires a grab with searchOnAdd:true on one tap, no confirm, destination never shown. |
| 6 | Recognition Rather Than Recall | 2 | No poster, no year beside the title (200px down at :461). |
| 7 | Flexibility and Efficiency | 1 | Primary action is the last element, under a lazily-loaded lane; ~1300px scroll on a phone. |
| 8 | Aesthetic and Minimalist Design | 2 | Minimalist about the wrong things: unbounded genres/cast/price chips, zero operational facts. |
| 9 | Error Recovery | 1 | No error state exists. Failed fetch closes the sheet (:155, :180). Failed and empty render identically. |
| 10 | Help and Documentation | 1 | Every explanation in the signature control is a hover tooltip, unreachable on touch. |
| **Total** | | **15/40** | **Needs rework** |

## Design Specificity Verdict

Generic. The composition is the TMDB/JustWatch consumer-discovery layout in a drawer: backdrop carousel → meta row → genre pills → Where to Watch with EUR rental prices → cast → overview → similar. That is a request app's household-member page, not an operator's commit-disk decision.

Breaks a named DESIGN.md "Don't" head-on: no full-bleed cinematic backdrop heroes. The sheet opens with an aspect-video backdrop carousel with autoplaying trailer as its largest element. MediaHero on the full page gets this right and demotes the gallery to a "Media" section.

Missing: is this in my library, which root folder, which profile, is it monitored. movie/[id].tsx:601-637 renders all of it. The sheet declares imdbId (:37) and originalTitle (:38) and never uses either.

Deterministic scan: CLEAN. detect.mjs exit 0 / zero findings on media_preview_context.tsx, sheet.tsx, media-gallery.tsx, media-status-badge.tsx, similar-lane.tsx. Five findings in inertia/components/library/ are Storybook decorator scaffolding only. Zero raw palette colours, zero off-ramp font sizes, zero unpaired outline-none, 5/5 imgs have alt. The detector is clean and the surface scores 15/40 — every real problem is structural.

Visual overlays: none. No user-visible overlay exists.

## What's Working

1. MediaStatusBadge — closed DESIGN.md Known Gap #2, uses real status tokens, is a real button via Badge asChild, and every aria-label names the consequence not the state. Problem is how the sheet feeds it.
2. The Readout Rule honoured without exception (:461, :467, :476, :479, :597, :609, :789).
3. MediaGallery is authored: IntersectionObserver dot state, aria-current, maxres→hq fallback, on-artwork play button using the DESIGN poster-ring with a comment justifying it.
4. season-picker-dialog.tsx:312-316 is the model error copy for the product.

## Priority Issues

### [P0] The sheet cannot be closed on a phone once scrolled
Close button is the last child of SheetContent at absolute top-4 right-4 (sheet.tsx:208-215); the caller adds overflow-y-auto to that same div (:405), so it is positioned in the scrolled coordinate system and rides off the top. That className is also w-full, which twMerge resolves over the base w-3/4 — below 640px the sheet is 100vw and no backdrop is tappable. No Escape on touch, no history integration.
Fix: move close into a sticky top-0 SheetHeader or the outer fixed wrapper; mobile width w-[calc(100%-3rem)]; overscroll-behavior: contain; SheetTitle pr-8 → pr-12.
Command: /impeccable harden

### [P0] Primary action is the last element, below a lazily-loaded lane
Add to Library at :529 / :669, after SimilarLane, which fetches async and reflows — the button can move under a thumb mid-tap. The full page keeps actions in the sticky header.
Fix: real SheetFooter as sticky bottom-0 border-t p-4 outside the scrolling body, holding the primary button plus profile and root folder in .readout. Move the status badge up beside the title. Cut or collapse SimilarLane.
Command: /impeccable layout

### [P1] The signature control reports a state that isn't true
media_preview_context.tsx:437-443 — both branches of the ternary end at 'downloaded'. A library movie with no file and no request renders Complete Green "Downloaded". :575 does the same for TV. onToggleRequest is supplied only when !hasFile && requested, exactly the case already routed to 'requested' — so every 'downloaded' badge has no handler: hover-swaps to Alarm Red, says Remove, tooltips "Deletes the file from disk", does nothing. Neither sheet imports useActiveDownloads, so downloading/importing are unreachable.
Fix: call getMediaItemStatus() (media-status-badge.tsx:331) and pass useActiveDownloads(). Guard MediaStatusBadge so an interactive state with no handler renders non-interactive.
Command: /impeccable harden

### [P1] "The badge is the control" is a hover rule on the most mobile surface in the product
On coarse pointer the swap never renders, Alarm Red never appears, the warning tooltip never opens. Tap "Requested" and it silently unrequests. Constructive path equally unguarded: one tap adds with searchOnAdd:true and a root folder from rootFolders.find().
Fix: on @media (pointer: coarse) route the destructive branch through delete-media-dialog.tsx. Render the destination inline above the button; make multiple matching root folders a choice.
Command: /impeccable adapt

### [P2] Not the abbreviated page — a competing product, and it deletes itself on failure
No version of this sheet is the page with rows removed. Both open handlers close the sheet on a failed fetch (:155, :180) — the failure mode PRODUCT.md names explicitly makes the diagnostic surface vanish. Also :714 passes title={`Add ${title}`} into add-media-dialog.tsx:86 which renders "Add {title}" → "Add Add Dune".
Fix: cut to identity + library state + destination + action + overview. Inline error block plus Retry. Drop the duplicate Add.
Command: /impeccable distill

## Persona Red Flags

Solo homelab operator on a phone: cannot close the sheet after scrolling; ~1300px to the button; gallery prev/next are opacity-0 group-hover (invisible on touch) and the only visible controls are w-2 h-2 dots — 8px targets against a 44px minimum; cast and similar lanes lack overscroll-behavior-x: contain so over-swiping triggers iOS back-navigation.

Keyboard / screen-reader operator: sheet.tsx:192 has role="dialog" aria-modal="true" with no aria-labelledby; no focus trap, no initial focus, no focus restore; close is rendered after {children} so it is the last tab stop; heading outline h2 → h4 → h2.

Operator diagnosing a provider behind gluetun: fetch fails → toast + setSheetOpen(false), the diagnostic surface removes itself; SimilarLane, StreamingOffers and CastLane all return null on absence so failed and empty are identical.

## Minor Observations

- Two nested overflow-y-auto (:405 and :421/:559); the inner never scrolls.
- sheet.tsx:146 and dialog.tsx:133 both bind Escape on document with no layer stack — Escape out of the season picker closes the sheet too.
- dialog.tsx:122 resets document.body.style.overflow on unmount while the sheet behind is still open.
- Overview unclamped; MediaHero clamps line-clamp-5 max-w-[70ch].
- Genres unbounded vs slice(0,5) on pages; secondary vs outline chip variant.
- StreamingOffers and CastLane are unexported functions inside a context provider — untestable, unstoryboardable, unreusable.
- SimilarLane mounts useVisibleWatchProviders, firing per-item fetches for a lane below the primary action.

## Questions to Consider

1. Delete the backdrop carousel, cast lane, rental prices and similar lane. What is left — and is what is left the entire decision?
2. The operator already knows what the film is; they tapped its poster. What do they not know? None of those answers are on this surface; the EUR rental price is.
3. "The badge is the control" is a hover rule. On a phone there is no hover — so what is the control?
