# Image storage model: private files at rest + base64 Publish projection

## Goal

Implement KEDIT's image-storage model per `docs/adr/0003-private-image-storage-base64-publish-projection.md`: pasted images stay **Private files** in the existing StackEdit private repo; base64 is **never stored**; a dedicated **"Copy for Publish"** action serialises images to base64 only at copy time so pdir ingests them with zero change.

## Requirements

- **R1 — Private file storage**: a pasted image is stored as a file in the bound StackEdit GitHub **private repo** (same repo as the Document source-of-truth, per ADR-0002), flat under `/imgs/`.
- **R2 — Naming**: filename is `Kedit_YYYY-MM-DD_HH-MM-SS.<ext>` from the **paste-time local clock**; collisions within the same second get `(1)`, `(2)`… inserted **before** the extension. Replaces StackEdit's `/imgs/<date>/<random>` scheme.
- **R3 — No base64 at rest**: the synced `.md` never contains `data:image` for a stored image; the source/preview panes render from the `/imgs/...` ref.
- **R4 — Copy for Publish**: a dedicated action writes the clipboard as **`text/plain` ONLY** = the active Document's raw Markdown with every **local private `/imgs/...`** reference replaced by an inline base64 data URI. External `http(s)` image URLs **pass through untouched**. No `text/html` flavour is set.
- **R5 — pdir zero-change**: the payload is consumed by pdir admin's existing paste → `collapseImages` → `publish()` pipeline unchanged.

## Acceptance Criteria

- [ ] Pasting an image creates `/imgs/Kedit_<timestamp>.<ext>` and inserts `![...](/imgs/Kedit_<timestamp>.<ext>)`; a second paste in the same second yields `...(1).<ext>`.
- [ ] The at-rest `.md` (and what Sync sends) contains **zero** `data:image` strings.
- [ ] "Copy for Publish" puts a `text/plain` payload on the clipboard with each local `/imgs/...` ref replaced by `data:image/<ext>;base64,...`, and sets **no** `text/html` flavour.
- [ ] An external `![](https://...)` ref is left verbatim in that payload.
- [ ] Pasting the payload into pdir admin's source area, then Publish, materialises images to `/images/N.<ext>` with **no edit to pdir**.
- [ ] The editor source pane never shows base64 for a stored image.

## Definition of Done

- All acceptance criteria pass against the forked StackEdit codebase.
- No regression to interval Sync (ADR-0002) or raw-Markdown editing (ADR-0001).
- If implementation reality diverges from ADR-0003 / `CONTEXT.md`, those docs are updated (not silently contradicted).

## Technical Approach

- Patch StackEdit's image paste/upload path to write the R2 flat timestamped name into the bound private repo.
- Add a "Copy for Publish" command: walk the active Document's Markdown; for each ref matching the local `/imgs/` pattern, read bytes from the locally-cloned repo and substitute a base64 data URI; leave `http(s)` refs alone; write the result to the clipboard as `text/plain` only (do **not** set `text/html`).
- Reuse StackEdit's private-repo storage and interval Sync unchanged.

## Decision (ADR-lite)

Recorded in `docs/adr/0003-private-image-storage-base64-publish-projection.md`. Rejected: (A) base64-as-storage — breaks raw editing + bloats Sync/git; (B) external image host — breaks Private-until-Publish. base64 is a Publish **transport**, not a storage form.

## Out of Scope

- The StackEdit fork itself (ADR-0001) — **prerequisite**, separate task.
- Rich-text/Word/Notion paste display (no `text/html` copy variant — confirmed not needed).
- Direct KEDIT→Codeberg push (Publish stays manual paste into pdir admin).
- Any pdir-side change.
- Image dedup/management UI; GIF/video-specific handling.

## Technical Notes

- pdir contract verified in `K:/Projects/website/pdir/js/admin.js`: `htmlToMarkdown` img branch (:1415), `publish()`→`fetchAsDataUrl` for http URLs (:1689), content-hash dedup (:1697), `getMaxNumberedImageIndex` re-number (:1667). `text/plain`-only deliberately avoids pdir's html-first paste branch (:1170), which would lossily run `htmlToMarkdown` over KaTeX/Mermaid.
- **Prerequisite/blocker**: depends on `.trellis/tasks/06-04-fork-stackedit` (the KEDIT repo currently has no source — StackEdit is not yet forked). Stays in `planning` until that fork task completes.

## Domain & Decisions

- Terms: `CONTEXT.md` — **Public/Private image**, **Self-contained copy**, **Publish**, **Sync**.
- ADRs: `docs/adr/0003-*` (this decision), `docs/adr/0001-fork-stackedit-as-base.md` (fork — prerequisite), `docs/adr/0002-github-private-repo-source-of-truth.md` (Sync constraints).

## Pre-execution Review Checklist

- [ ] Requirements complete & unambiguous
- [ ] Acceptance criteria testable
- [ ] No conflict with `CONTEXT.md` terms or any ADR
- [ ] Scope matches the deliverable; out-of-scope explicit
- [ ] Feasible with current architecture — **requires the StackEdit fork (ADR-0001) to exist first**
