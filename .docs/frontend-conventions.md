# Frontend Conventions

> 由 Trellis spec 迁移合并：component-guidelines + hook-guidelines + type-safety + quality-guidelines（2026-07-14）。

### Components (SFC)

### Overview

Components are Vue single-file components using the Options API. They commonly
read from the shared Vuex store, call services for side effects, and keep
transient UI-only state in `data()`.

### Component Structure

The usual order is:

```text
<template>
<script>
<style lang="scss">
```

Use the existing style in nearby components. `ExplorerNode.vue` is a typical
recursive component with:

- `props` for caller-provided node/depth data.
- `computed` getters that derive display state from Vuex.
- `methods` that call Vuex mutations/actions and services.
- BEM-like SCSS classes under a component root class.

### Props Conventions

- Existing older components often use array props such as
  `props: ['node', 'depth']`.
- New or significantly edited shared components should prefer object prop
  declarations with `type` and defaults, as in `DropdownMenu.vue`.
- Keep prop names aligned with domain terms (`node`, `file`, `workspace`,
  `location`, `providerId`) instead of generic names.
- Do not mutate props directly; update Vuex state or emit events.

### Store and Service Interaction

- Use Vuex for shared application state. Existing components mix direct
  `store.commit(...)` calls with `mapActions` / `mapMutations`.
- Use services for side effects: `workspaceSvc`, `explorerSvc`, `badgeSvc`,
  provider helpers, etc.
- Keep expensive or cross-component logic out of template expressions.
- Preserve async UI behavior that avoids blocking the editor. For example,
  `ExplorerNode.vue` uses a short timeout before opening files/folders.

### Styling Patterns

- Component styles use SCSS in the SFC unless the style is global.
- Global app/theme styles live in `src/styles/`.
- Existing classes are BEM-like: `explorer-node__item`,
  `explorer-node--selected`.
- Use existing theme hooks such as `.app--dark &` when adding dark-mode
  variants.
- Avoid new styling systems or dependencies.

### Accessibility

- Reuse the global `v-title` directive when an element needs both `title` and
  `aria-label`; it is registered in `src/main.js`.
- Preserve keyboard handlers on editable controls, such as Enter/Escape flows
  in `ExplorerNode.vue`.
- Icon-only controls need accessible labels through existing directives or
  attributes.

### Common Mistakes

- Duplicating service logic inside a component instead of extending
  `src/services/`.
- Adding local component state for data already owned by Vuex.
- Introducing Composition API style into an area that otherwise uses Options
  API without a task-level reason.
- Renaming visible StackEdit strings together with persisted identifiers. Only
  user-visible branding was rebranded to KEDIT.

### Overlay Z-Index Ladder

Fixed stacking order for app-level overlays (established 2026-07; keep new
overlays consistent and never rely on DOM order alone once any layer has an
explicit z-index):

- `CustomScrollbar` 1 (panel-local)
- `.modal` 100
- `.notification` 200
- `.context-menu` 300
- `ImageLightbox` 1000

`.editor`/`.layout` ancestors create no stacking context, so any explicit
z-index inside them competes at root level — pick values from this ladder.

### Hooks（无 hook 模式与指令替代）

### Overview

This project does not use React hooks or Vue Composition API composables as a
primary pattern. Shared stateful logic lives in Vuex modules, services, global
directives, and optional service registration modules.

### Shared Stateful Logic

Use these existing mechanisms before adding a new pattern:

- Vuex modules in `src/store/` for shared app state.
- Services in `src/services/` for side effects and orchestration.
- Provider classes/helpers under `src/services/providers/`.
- Global directives in `src/main.js` for small DOM behaviors such as `v-focus`,
  `v-title`, and `v-clipboard`.
- Optional feature modules in `src/services/optional/` for opt-in editor
  behavior registration.

### Data Fetching

There is no React Query/SWR-style fetch layer. Data comes from:

- Browser IndexedDB/localStorage through `localDbSvc`.
- Provider services for GitHub, Gitee, GitLab, Gitea, GitCode, Google Drive,
  Dropbox, etc.
- Flask support endpoints for OAuth token exchange, `/conf`, and export.

Provider and sync changes should follow `syncSvc.js`, `workspaceSvc.js`, and
`src/services/providers/common/Provider.js` instead of creating hook-like
fetch wrappers.

### Naming Conventions

- Do not create `use*` composables unless a task explicitly moves an area toward
  Composition API.
- Service objects use `*Svc.js` names (`localDbSvc`, `workspaceImageSvc`).
- Provider helpers use `<provider>Helper.js`.

### Common Mistakes

- Adding a composable for logic that already belongs to a Vuex module or
  service.
- Fetching provider data directly from components instead of going through the
  provider/service layer.
- Creating another global event mechanism when Vuex or `mitt`-based existing
  services already cover the case.

### Type Safety (JS Contracts)

### Overview

The frontend is JavaScript, not TypeScript. Type safety comes from stable item
shapes, empty factories, runtime normalization, focused utilities, and tests.
Do not invent TypeScript-only conventions for this codebase.

### Shape Organization

- Persisted item defaults live under `src/data/empties/`.
- Store modules use those empty factories when setting or patching items.
- Shared constants live under `src/data/constants.js` and related data files.
- Provider content serialization shape is centralized in
  `src/services/providers/common/Provider.js`.

### Runtime Validation and Normalization

Existing patterns include:

- `utils.sanitizeText(...)` before storing content parsed from providers.
- `htmlSanitizer.sanitizeHtml(...)` and `sanitizeUri(...)` for rendered HTML.
- `imageTypeUtils.js` for MIME/extension normalization.
- Explicit fallback behavior, for example `getImageExt(..., "png")` and PDF
  page size fallback to `A4`.

Add small validation helpers near the data owner rather than repeating ad hoc
checks in multiple components.

### Common Patterns

- Object spread and `Object.assign` merge patches into known empty shapes.
- Hashes identify persisted item changes.
- Provider parsing catches malformed embedded metadata and falls back to empty
  content plus sanitized text.
- Tests cover utility normalization with concrete cases, as in
  `imageTypeUtils.spec.js`.

### Forbidden Patterns

- Do not scatter raw payload parsing across multiple consumers. Put decoders or
  normalizers near the service/provider that owns the payload.
- Do not trust provider, Markdown, or HTML payloads without sanitation at the
  established boundary.
- Do not use base64 strings as a stored type for Document images.
- Do not rename persisted identifiers without a migration.

### Review Checklist

- Is the data owner clear?
- Does the input have one normalization path?
- Are empty/null/invalid cases handled?
- Do utility tests cover new normalization behavior?

### Quality（构建/回归/评审预期）

### Overview

Quality checks are centered on Vite build output, stylelint during style builds,
and Jest unit tests for services/components. The project is a StackEdit fork, so
compatibility with existing data and editor behavior matters as much as local
code cleanliness.

### Formatting and Style

- `.editorconfig` requires UTF-8, LF, final newline, trimmed trailing
  whitespace, and 2-space indentation.
- SCSS is checked with `stylelint-config-standard` through
  `stylelint-processor-html`.
- Keep comments minimal and useful. Existing code has legacy comments; do not
  churn unrelated comments.

### Forbidden Patterns

- Do not change persisted StackEdit identifiers during visual KEDIT rebranding.
- Do not store base64 image data in Document source or persisted image state
  unless a future ADR explicitly changes the model.
- Do not add broad dependencies or rewrite framework patterns for a narrow fix.
- Do not duplicate provider parsing, path projection, or content serialization
  logic in components.
- Do not make preview/source changes that break raw Markdown portability unless
  the task explicitly updates the source contract.

### Required Patterns

- Search before adding a new utility, store getter, service method, or constant.
- Keep source Markdown as the canonical Author-edited text.
- For preview-only Markdown behavior, add markdown-it rules under
  `src/extensions/`, register block rules before the CommonMark rule they must
  preempt, and escape raw token content before emitting preview HTML.
- Put cross-component logic in services or Vuex.
- Keep provider contracts centralized under `src/services/providers/`.
- Preserve frontend/backing-store compatibility unless the task includes a
  migration and tests.

### Testing Requirements

Use focused tests for changed behavior:

- Services/libs: add or update tests under `test/unit/specs/services/` or
  `test/unit/specs/libs/`.
- Components: use Vue Test Utils patterns under `test/unit/specs/components/`.
- Store-driven UI flows should assert Vuex state and user-observable effects,
  as `ExplorerNode.spec.js` does for selection, rename, drag/drop, and badges.
- For visual/style-only changes, run the build and inspect the affected UI when
  practical.

Available project commands:

- `npm run build`
- `npm run build-style`
- Jest config exists at `test/unit/jest.conf.js`, but there is no npm test
  script in the current `package.json`.

### Current Jest Harness Gotcha

The current package is `"type": "module"`, while `test/unit/jest.conf.js` is a
CommonJS config that calls `require`. Running Jest directly with that config
fails before tests load. If you bypass that first layer with a temporary CJS
config, the repo also lacks `jest-environment-jsdom` for Jest 29 and references
`vue-jest`, which is not installed. Until the harness is fixed in a dedicated
testing-infra task, report focused Jest runs as blocked by the project test
stack and rely on `npm run build` plus code review for task-level verification.

### Code Review Checklist

- Does the change preserve KEDIT domain terms from `CONTEXT.md`?
- Does it preserve Sync vs Publish separation?
- Does it keep private images private at rest?
- Does it avoid breaking `.stackedit-*` data-contract identifiers?
- Does it reuse existing services/store getters?
- Are edge cases covered by focused tests or an explicit manual check?

### Common Mistake: Signature Change Without Sweeping Call Sites

**Symptom**: A feature dies silently at runtime (e.g., every sidebar/explorer
toggle click threw `TypeError`) while `npm run build` and CI stay green.

**Cause**: A helper's parameter list changed (`toggleLayoutSetting` dropped its
badge `featureId` param in the cruft-trim), but two direct call sites in
`src/store/data.js` kept passing the old arity. Arguments shifted one position:
a string landed in the `getters` slot. **Vite/Rollup do not check argument
arity or types** — only ESLint `no-undef`-class errors or runtime hits it.

**Fix**: `rg "<helperName>("` and reconcile EVERY call site in the same commit
as the signature change (bf7aca6e).

**Prevention**: Changing any function/action signature triggers the
Pre-Modification Rule (`.trellis/spec/guides/index.md`): grep all call sites
first; count arguments, not just names. Plain-JS refactors have NO compiler
net — assume the build proves nothing about call compatibility.
