# Quality Guidelines

## Overview

Quality checks are centered on Vite build output, stylelint during style builds,
and Jest unit tests for services/components. The project is a StackEdit fork, so
compatibility with existing data and editor behavior matters as much as local
code cleanliness.

## Formatting and Style

- `.editorconfig` requires UTF-8, LF, final newline, trimmed trailing
  whitespace, and 2-space indentation.
- SCSS is checked with `stylelint-config-standard` through
  `stylelint-processor-html`.
- Keep comments minimal and useful. Existing code has legacy comments; do not
  churn unrelated comments.

## Forbidden Patterns

- Do not change persisted StackEdit identifiers during visual KEDIT rebranding.
- Do not store base64 image data in Document source or persisted image state
  unless a future ADR explicitly changes the model.
- Do not add broad dependencies or rewrite framework patterns for a narrow fix.
- Do not duplicate provider parsing, path projection, or content serialization
  logic in components.
- Do not make preview/source changes that break raw Markdown portability unless
  the task explicitly updates the source contract.

## Required Patterns

- Search before adding a new utility, store getter, service method, or constant.
- Keep source Markdown as the canonical Author-edited text.
- Put cross-component logic in services or Vuex.
- Keep provider contracts centralized under `src/services/providers/`.
- Preserve frontend/backing-store compatibility unless the task includes a
  migration and tests.

## Testing Requirements

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

## Current Jest Harness Gotcha

The current package is `"type": "module"`, while `test/unit/jest.conf.js` is a
CommonJS config that calls `require`. Running Jest directly with that config
fails before tests load. If you bypass that first layer with a temporary CJS
config, the repo also lacks `jest-environment-jsdom` for Jest 29 and references
`vue-jest`, which is not installed. Until the harness is fixed in a dedicated
testing-infra task, report focused Jest runs as blocked by the project test
stack and rely on `npm run build` plus code review for task-level verification.

## Code Review Checklist

- Does the change preserve KEDIT domain terms from `CONTEXT.md`?
- Does it preserve Sync vs Publish separation?
- Does it keep private images private at rest?
- Does it avoid breaking `.stackedit-*` data-contract identifiers?
- Does it reuse existing services/store getters?
- Are edge cases covered by focused tests or an explicit manual check?
