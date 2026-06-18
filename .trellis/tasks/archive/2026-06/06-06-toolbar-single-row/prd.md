# Mobile toolbar — single-row horizontal scroll

> **Track: 🟦 FE / Claude Code** · order 3 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`

## Goal

Make every toolbar button reachable on mobile via a single-row horizontally-scrollable formatting bar, instead of buttons being clipped when the title grows.

## Requirements

- **R1 — single-row horizontal scroll**: the formatting (pagedown) button row scrolls horizontally; no button is clipped by the title or chrome on narrow screens.
- **R2 — desktop list-format responsiveness**: address the laggy list-formatting button behavior on desktop.
- **R3 — image button reachable** on mobile (it lives among the pagedown buttons).

## Code anchors

- `NavigationBar.vue`: root cause = `float` layout + `.navigation-bar { overflow: hidden }` (:262) clips `.navigation-bar__inner--edit-pagedownButtons` (:37-46) once the title input grows toward `titleMaxWidth`. pagedown buttons filtered by `editor.headButtons` (:118-125).

## Out of Scope

- Adding/removing which buttons exist (only their reachability/layout).

## Domain & Decisions

- ADRs: `docs/adr/0001-fork-stackedit-as-base.md` (philosophy: pragmatism > minimal chrome — a scrollable bar accepts chrome to guarantee access).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
