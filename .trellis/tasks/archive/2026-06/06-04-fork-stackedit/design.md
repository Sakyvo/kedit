# Design — Fork StackEdit

> Bring-up design at decision altitude. StackEdit's internal layout is unknown until the source is in hand, so concrete integration points are deferred to a research pass (`implement.md` Step 1).

## Decision basis

`docs/adr/0001-fork-stackedit-as-base.md` (fork StackEdit engine; flat source+preview, not WYSIWYG) + `docs/adr/0002-github-private-repo-source-of-truth.md` (GitHub private repo = single source of truth; interval sync; no realtime backend).

## Shape

- Upstream: StackEdit (Vue 3 / Vuex / Vite, markdown-it). Apache-2.0.
- KEDIT = StackEdit engine, restyled later by a markra-derived skin (separate task). **This task delivers the working, unstyled engine.**

## Integration points (confirm during research)

- **Build**: Vite config, dependency install, dev + production build.
- **Sync**: StackEdit's GitHub provider → Author's private repo; pure-`.md`, discussions/comments off; single source of truth (ADR-0002).
- **Markdown pipeline**: confirm KaTeX/Mermaid/footnotes/tables ship and render.

## Compatibility / guards

- **Paradigm**: flat Markdown source+preview only (ADR-0001) — reject any block/WYSIWYG path.
- **Sync model**: one source of truth = private repo (ADR-0002); no second backend.

## Risks

- Upstream coupling to StackEdit's hosted services (account, app-data repo) must be neutralised for private-repo-only operation.
- Build/dependency drift — pin upstream version/commit.
