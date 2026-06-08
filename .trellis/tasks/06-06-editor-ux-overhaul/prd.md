# KEDIT editor UX overhaul — parent

> **Parent task.** Owns the source requirement set (R1–R20), the child map, and cross-child integration review. Not itself an implementation target.
> **All children depend on `06-04-fork-stackedit`** (the fork must land before any child runs).
> Each child is tagged **🟦 FE / Claude Code** or **🟥 BE / Codex** per the FE/BE routing decision.

## Goal

Fix the 8 known StackEdit UX pain points on the KEDIT fork as independently-verifiable child slices, split by track so backend/engine work routes to Codex and frontend/visual work routes to Claude Code.

## Requirements (R1–R20)

- **Toolbar #1** — R1 mobile single-row horizontal-scroll, all buttons reachable; R2 desktop list-format button lag; R3 image button reachable on mobile.
- **Image #2** — R4 keep paste+drop+dialog(camera/gallery) insertion paths; R5 external image hosts (smms/custom/gitea) hidden & dormant, default `workspace`.
- **Doc panel #4** — R6 sort by name/`updatedOn`/`createdOn` ×asc·desc (stamp on create/save); R7 fix rename binding bug; R8 context menu adds move/duplicate/export-md; R9 mobile long-press menu + folder-picker move.
- **TOC #5** — R10 first-class toolbar entry; R11 side drawer + click-to-jump, drop proportional scrubber, keep current-section highlight.
- **List #6** — R12 auto-number respects CommonMark boundaries (`---`/`***`/`___` + heading terminate; single blank line doesn't; respect typed first number; per-list independent).
- **Copy #7** — R13 mobile copy/cut: keep clean-`.md` override; sync selection on copy/cut + add `selectionchange`/`touchend`.
- **Preview #8** — R14 frontmatter rendered specially (not setext heading, not stripped); R15 long-link wrap; R16 no auto-divider under headings; R17 blank lines preserved.
- **Cruft** — R18 remove badge subsystem (`badgeSvc`).
- **Rebrand** — R19 rename visible StackEdit branding to KEDIT; R20 preserve data-contract identifiers + Apache NOTICE.

## Child map (execution order)

| # | Task | Track | Owns | Depends on |
|---|---|---|---|---|
| 1 | `06-06-rebrand-kedit` | 🟦 FE/CC | R19, R20 | 06-04 |
| 2 | `06-06-trim-cruft` | 🟥 BE/Codex | R5, R18 | 06-04 |
| 3 | `06-06-toolbar-single-row` | 🟦 FE/CC | R1, R2, R3 | 06-04 |
| 4 | `06-06-doc-panel-backend` | 🟥 BE/Codex | R6 (stamps+comparator), R8 (ops) | 06-04 |
| 5 | `06-06-doc-panel-frontend` | 🟦 FE/CC | R6 (UI), R7, R8 (menu), R9 | 06-04, #4-backend |
| 6 | `06-06-toc-drawer` | 🟦 FE/CC | R10, R11 | 06-04, #3-toolbar |
| 7 | `06-06-list-autonumber` | 🟥 BE/Codex | R12 | 06-04 |
| 8 | `06-06-copy-cut-mobile` | 🟥 BE/Codex | R13 | 06-04 |
| 9 | `06-06-preview-backend` | 🟥 BE/Codex | R14 | 06-04 |
| 10 | `06-06-preview-frontend` | 🟦 FE/CC | R15, R16, R17, frontmatter-chip CSS | 06-04, #8-backend |

R4 split: button reachability → child 3 (toolbar); paste/drop/dialog store-as-private-file → existing `06-03-image-storage-model`.

## Out of Scope

- **Sync model** (last-write-wins + event-driven, drop 3-way merge `diffUtils.mergeText`; ADR-0002) — separate sync task, known follow-up, **not** under this parent.
- **Image storage model #3** → existing `06-03-image-storage-model`.
- **The StackEdit fork itself** → existing `06-04-fork-stackedit` (prerequisite for every child).
- **markra design skin** (ink-black restyle, ADR-0001) — separate cosmetic follow-up.
- External image host **removal** (chose dormant, R5); touch-**drag** file move (chose picker, R9); `text/html` rich-text paste variant (ADR-0003 rejected); data-contract **rename/migration** (ADR-0005 rejected).

## Domain & Decisions

- Terms: `CONTEXT.md` — KEDIT, Document, Publish, Sync, Public/Private image, Self-contained copy.
- ADRs: `docs/adr/0001-fork-stackedit-as-base.md`, `0002-github-private-repo-source-of-truth.md`, `0003-private-image-storage-base64-publish-projection.md`, `0004-preview-diverges-at-render-layer-source-stays-commonmark.md`, `0005-rebrand-ui-to-kedit-preserve-data-identifiers.md`.
- Related tasks: `06-03-image-storage-model`, `06-04-fork-stackedit`.

## Cross-child integration criteria

- After all children: mobile toolbar shows all buttons; TOC drawer opens from the toolbar and jumps on click; doc panel sorts by 3 keys and moves/renames on mobile; lists renumber correctly across `---`; mobile copy/cut works; frontmatter & links render per ADR-0004; no badge UI; UI says KEDIT while `.stackedit-*` data paths still resolve.
- Each child carries its own testable acceptance criteria (added at micro-refine).
