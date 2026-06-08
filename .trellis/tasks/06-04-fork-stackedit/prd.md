# Fork StackEdit as KEDIT's editor engine

## Goal

Bring StackEdit into the KEDIT repo as the editor engine per `docs/adr/0001-fork-stackedit-as-base.md` — forked, building, running, and syncing Documents to the GitHub private repo as pure `.md` (`docs/adr/0002-github-private-repo-source-of-truth.md`). **Foundational**: unblocks `06-03-image-storage-model` and all KEDIT feature work.

## Requirements

- **R1 — Source integrated**: StackEdit (Vue 3 / Vuex / Vite, markdown-it pipeline, Apache-2.0) forked into this repo and tracked in git.
- **R2 — Builds & runs**: builds with its toolchain and launches a local dev server showing the **source + preview** editor (explicitly **not** WYSIWYG, per ADR-0001).
- **R3 — Sync (ADR-0002)**: StackEdit's GitHub-backed workspace sync works against the Author's **private repo** as single source of truth; Documents persist as pure `.md` (discussions/comments disabled); no realtime/CRDT backend.
- **R4 — Feature integrity**: StackEdit's guaranteed features (KaTeX, Mermaid, footnotes, tables, …) render in preview.
- **R5 — License**: Apache-2.0 LICENSE/NOTICE and attribution preserved.

## Acceptance Criteria

- [ ] The project's install + dev commands launch KEDIT; the editor loads with source + preview.
- [ ] A Document round-trips: an edit Syncs to the GitHub private repo as a pure `.md` file; a fresh load pulls the latest.
- [ ] Production build succeeds.
- [ ] KaTeX / Mermaid / footnotes / tables render in preview.
- [ ] Discussions/comments disabled; repo holds only `.md` (no discussion sidecars).
- [ ] Apache-2.0 LICENSE + NOTICE present.

## Definition of Done

- KEDIT runs and Syncs from a clean checkout; foundation ready for feature tasks.
- ADR-0001 (fork/paradigm) and ADR-0002 (sync) honored.

## Technical Approach

- Obtain upstream StackEdit source; integrate into the repo; reconcile the Vite build and dependencies.
- Configure the GitHub private-repo workspace sync; disable discussions; ensure pure-`.md` persistence.
- Concrete steps depend on StackEdit's actual source layout → a **research pass precedes detailed planning** (see `implement.md` Step 1).

## Out of Scope

- markra design skin (ink-black restyle) — **separate follow-up** (ADR-0001 names it, but it is non-blocking and cosmetic).
- The 8 known StackEdit UX pain-point fixes — separate tasks.
- Sync-interval tightening + sync-on-open tuning (ADR-0002) — small follow-up once bring-up is stable.
- `06-03-image-storage-model` — separate task that this one **unblocks**.

## Technical Notes

- Paradigm guard (ADR-0001): keep flat source+preview Markdown; do **not** introduce block-based/WYSIWYG editing.
- StackEdit upstream may couple to its hosted services (account, app-data repo); these must be neutralised for a private-repo-only model.
- This task brings the codebase into existence; until it lands, `06-03-image-storage-model` Step 0 stays gated.

## Domain & Decisions

- ADRs: `docs/adr/0001-fork-stackedit-as-base.md` (this), `docs/adr/0002-github-private-repo-source-of-truth.md` (sync).
- Terms: `CONTEXT.md` — **KEDIT**, **Document**, **Sync**, **Publish**.
- Unblocks: `.trellis/tasks/06-03-image-storage-model`.

## Pre-execution Review Checklist

- [ ] Requirements complete & unambiguous
- [ ] Acceptance criteria testable
- [ ] No conflict with `CONTEXT.md` terms or any ADR
- [ ] Scope matches the deliverable; out-of-scope explicit
- [ ] Feasible — a research pass on StackEdit source is the first execution step
