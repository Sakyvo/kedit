# Mobile copy/cut — selection sync

> **Track: 🟥 BE / Codex** · order 8 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`

## Goal

Fix mobile copy/cut (IME/system buttons) by keeping the clean-Markdown clipboard override and syncing the editor's selection model from the live DOM/touch selection.

## Requirements

- **R13** —
  - **Keep** cledit's `copy`/`cut` override (clipboard gets clean `.md`, not highlighter HTML; cut goes through the model). Do **not** fall back to native copy.
  - At `copy`/`cut`, **sync the selection first** (`saveSelectionState`) before reading the selected text.
  - Add **`selectionchange`** (focus-gated, debounced) and **`touchend`** to the selection-state triggers so touch selections enter the model.

## Code anchors

- `services/editor/cledit/cleditCore.js`: `copy`/`cut` handlers (:335-351) read `selectionMgr.getSelectedText()` then `preventDefault()`; selection-state is currently driven only by `mousedown`/`mouseup`/`contextmenu`/`keydown` (:252-278) — **no `selectionchange`/touch** → stale selection on mobile → empty copy.
- `services/editor/cledit/cleditSelectionMgr.js`: `saveSelectionState` (:145-314), `getSelectedText` (:336-).

## Out of Scope

- The "Copy for Publish" base64 action → `06-03-image-storage-model`.

## Domain & Decisions

- ADRs: `docs/adr/0003-private-image-storage-base64-publish-projection.md` (clean-`.md` copy matters for pasting into pdir).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
