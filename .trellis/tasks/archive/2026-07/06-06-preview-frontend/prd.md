# Preview — frontend (CSS render-layer fixes)

> **Track: 🟦 FE / Claude Code** · order 10 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`, `06-06-preview-backend`

## Goal

Apply the render-layer (CSS) preview fixes, including styling the frontmatter chip emitted by the backend rule — all without touching the Markdown source.

## Requirements

- **R15** — long bare links wrap within the preview width (`overflow-wrap`/`word-break`), never by editing the URL.
- **R16** — no auto-divider rule rendered beneath headings.
- **R17** — typed blank lines are preserved in the source; any preview spacing is CSS only (no added/removed newlines).
- **Frontmatter chip** — style the markup emitted by `06-06-preview-backend` (hidden or a calm metadata chip).

## Code anchors

- Preview styles (`styles/`); heading-divider rule to remove; link wrapping CSS; frontmatter chip markup from `extensions/markdownExtension.js` (via `06-06-preview-backend`).

## Out of Scope

- The frontmatter detection/render rule itself → `06-06-preview-backend`.
- Any change to source semantics (ADR-0004 guard).

## Domain & Decisions

- ADRs: `docs/adr/0004-preview-diverges-at-render-layer-source-stays-commonmark.md` (this is the render-layer half).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
