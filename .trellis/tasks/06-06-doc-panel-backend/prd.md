# Doc panel — backend (sort stamps, comparator, file ops)

> **Track: 🟥 BE / Codex** · order 4 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`
> Pairs with `06-06-doc-panel-frontend` (the FE slice consumes this).

## Goal

Provide the data layer for doc-panel sorting and file operations: per-file timestamps, a multi-key comparator, and move/duplicate/export operations.

## Requirements

- **R6 (data)** — stamp `createdOn` on file creation and `updatedOn` on every save; a comparator supporting **name / `updatedOn` (modified) / `createdOn` (created)**, each asc·desc, folders-before-files preserved. Legacy files without stamps sort as oldest until next edit. Stamps live in item **metadata** (not in the `.md`) → no ADR-0002 conflict.
- **R8 (ops)** — operations behind the context menu: **move** (re-parent), **duplicate** (copy file + content), **export** (download as `.md`).

## Code anchors

- `data/empties/emptyFile.js` (add `createdOn`/`updatedOn`); `services/workspaceSvc.js` (`storeItem`/`createFile` set stamps).
- `store/explorer.js`: `compare` (:16-17, name-only now), `sortChildren` (:30-36) → multi-key + direction.
- Ops via `workspaceSvc.storeItem` (move: set `parentId`), `createFile` (duplicate), download util (export).

## Out of Scope

- All UI (sort control, menu, rename, long-press) → `06-06-doc-panel-frontend`.

## Domain & Decisions

- ADRs: `docs/adr/0002-github-private-repo-source-of-truth.md` (metadata vs pure `.md`).
- Terms: `CONTEXT.md` — Document.

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
