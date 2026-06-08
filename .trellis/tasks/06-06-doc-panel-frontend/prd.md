# Doc panel — frontend (sort UI, rename fix, menu, mobile)

> **Track: 🟦 FE / Claude Code** · order 5 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`, `06-06-doc-panel-backend`

## Goal

Surface the doc-panel UX: a sort control, a fixed rename input, an enriched context menu, and a mobile-friendly menu + move flow.

## Requirements

- **R6 (UI)** — a sort control (name / modified / created × asc·desc) in the panel header, bound to the backend comparator/setting; default modified-desc.
- **R7 — fix rename bug**: the rename input must edit normally and preselect the current name.
- **R8 (menu UI)** — context-menu entries for **move (folder picker) / duplicate / export `.md`**, alongside existing new/rename/delete/copy-path.
- **R9 — mobile**: **long-press** opens the same context menu; a **"move to…" folder picker** replaces drag (HTML5 DnD doesn't fire on touch).

## Code anchors

- `Explorer.vue` side-title toolbar (:3-32) → add sort control.
- `ExplorerNode.vue`: rename binding bug `editingNodeName` get/set asymmetry (:69-76); context menu `onContextMenu` (:181-217); HTML5 DnD `draggable`/`@dragstart`/`@drop` (:2,:6) is desktop-only → long-press + picker.

## Out of Scope

- Timestamps, comparator, and move/duplicate/export operations → `06-06-doc-panel-backend`.

## Domain & Decisions

- ADRs: `docs/adr/0001-fork-stackedit-as-base.md` (content-as-interface yields to pragmatism — long-press keeps the panel clean, picker guarantees mobile move).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
