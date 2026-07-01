# TOC — side drawer with click-to-jump

> **Track: 🟦 FE / Claude Code** · order 6 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`, `06-06-toolbar-single-row`

## Goal

Replace the buried proportional-scrubber TOC with a first-class side drawer of clickable headings that jump on click.

## Requirements

- **R10 — first-class entry**: a dedicated TOC button in the toolbar (no longer buried in the MainMenu settings).
- **R11 — drawer + click-to-jump**: TOC is a side drawer (desktop slide-in / mobile full overlay); each entry is a clickable heading that smooth-scrolls that heading to the top; drop the proportional drag-scrubber; keep a subtle current-section highlight.

## Code anchors

- `components/Toc.vue`: current proportional scrubber = `onClick` mousedown/mousemove → proportional scroll (:26-61); entries are `pointer-events: none` (:108); 9px font (:94); `toc__mask` current-position band (:3,:64-71). Toggle currently via MainMenu.
- Toolbar entry hooks into `06-06-toolbar-single-row`.

## Out of Scope

- Toolbar layout itself → `06-06-toolbar-single-row`.

## Domain & Decisions

- ADRs: `docs/adr/0001-fork-stackedit-as-base.md` (drawer chosen over floating overlay: reliable access > minimal chrome).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
