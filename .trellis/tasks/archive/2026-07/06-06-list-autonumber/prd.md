# Ordered-list auto-number boundaries

> **Track: 🟥 BE / Codex** · order 7 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`

## Goal

Make ordered-list auto-numbering respect CommonMark list boundaries so a list after a `---` no longer continues the previous list's numbering (the 1→4 bug).

## Requirements

- **R12** — auto-numbering rules:
  - **Thematic breaks** (`---` / `***` / `___`) and headings **terminate** the list.
  - A **single blank line does not** terminate it (stays one loose list).
  - **Respect the author's typed first-item number**; never restart to 1 or merge across `---`.
  - Each list numbers **independently**.

## Code anchors

- `services/optional/keystrokes.js`: `fixNumberedList` → `getHits` (:20-58) currently stops only at headings (:38 `^#+ `) because `indentRegex` (:18) makes the digit prefix optional, so `---` is swallowed as a continuation; `formatHits` (:60-73) then keeps incrementing across it. Fix: treat a thematic-break line like the heading case (flush + stop); the `while` loop (:83-91) then renumbers the next list independently.
- Optional alignment: `libs/pagedown.js` `doList` (:1112-1219) — `previousItemsRegex`/`nextItemsRegex` also swallow `---` via `\n.+`; lower priority (button-triggered only).

## Out of Scope

- List indent/tab behavior beyond numbering boundaries.

## Domain & Decisions

- ADRs: `docs/adr/0004-preview-diverges-at-render-layer-source-stays-commonmark.md` (source follows standard CommonMark).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
