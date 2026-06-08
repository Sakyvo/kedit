# Preview diverges at the render layer; the Markdown source stays standard CommonMark

KEDIT may customize how a **Document** *looks* in the preview pane, but never changes what the source *means*. Every presentation fix lives at the render layer (a render-only markdown-it tweak, the preview DOM, or CSS), leaving the stored `.md` as standard, portable CommonMark that round-trips and pastes cleanly (ADR-0001).

## Context

Several of the reviewed pain points are really preview-rendering complaints, and the tempting fixes would mutate source semantics or rewrite the stored text:

- YAML frontmatter's closing `---` is parsed as a setext H2 (markdown-it `lheading` rule in `src/extensions/markdownExtension.js`), so the metadata block renders as a giant heading.
- Long bare URLs overflow the preview width.
- Headings render with an unwanted divider rule beneath them.
- Authors expect the blank lines they typed to survive.

A naive fix — strip frontmatter from the text, rewrite the URL, post-process the source, or disable setext headings globally — would make KEDIT's `.md` diverge from CommonMark. That breaks portability, Sync round-trips, and the "pastes cleanly into any other Markdown tool" guarantee ADR-0001 rests on.

## Decision

- **Source of truth = standard CommonMark.** KEDIT never rewrites, normalizes, or strips the Author's Markdown to achieve a visual effect. What Syncs to the private repo is exactly what the Author typed.
- **Divergence lives only in the render path** — markdown-it *render* rules, the preview DOM, and CSS. The token stream's *meaning* is untouched; only its *presentation* changes.
- Concrete projections from the review:
  - **Frontmatter** — detect a leading YAML block and render it specially (hidden, or a styled metadata chip); **not** by deleting it from the source, and **not** by letting the closing `---` parse as a heading.
  - **Long links** — wrap/break at the CSS layer (`overflow-wrap`/`word-break`), never by editing the URL.
  - **No auto-divider under headings** — a render/CSS choice; the source carries no rule there.
  - **Blank lines** — preserved verbatim in the source (already an ADR-0001 guarantee); any preview spacing is CSS, never added or removed newlines.

## Consequences

- The preview can be made as elegant as the markra skin wants, without ever forking the Markdown dialect.
- Copy / Publish payloads stay standard Markdown, so pdir and any other tool ingest them unchanged — reinforces ADR-0003's "base64 is transport, not storage" projection.
- Cost: presentation logic cannot lean on "just edit the text." Some effects (e.g. hiding frontmatter) need render-layer detection while the source parser still sees the raw block. Accepted.
- **Guard:** any future preview feature achievable *only* by changing source semantics must return as a new ADR — never a silent divergence.
