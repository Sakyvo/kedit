# Preview — backend (frontmatter render rule)

> **Track: 🟥 BE / Codex** · order 9 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`
> Pairs with `06-06-preview-frontend` (CSS/chip styling consumes this rule's markup).

## Goal

Render a leading YAML frontmatter block specially in the preview — never parsed as a setext heading and never stripped from the source.

## Requirements

- **R14** — detect a leading YAML frontmatter block; render it as a distinct, render-only element (hidden or a styled metadata chip). The closing `---` must **not** parse as a setext H2; the source `.md` is **never** rewritten or stripped (ADR-0004).

## Code anchors

- `extensions/markdownExtension.js` (:25-145): `lheading`/setext rule (:30) currently turns frontmatter's closing `---` into an H2. Add a render-only frontmatter rule (a markdown-it block/render rule) that emits chip markup; source token meaning unchanged.

## Out of Scope

- The frontmatter chip's CSS + the other preview CSS fixes → `06-06-preview-frontend`.

## Domain & Decisions

- ADRs: `docs/adr/0004-preview-diverges-at-render-layer-source-stays-commonmark.md` (divergence only at the render layer).

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
