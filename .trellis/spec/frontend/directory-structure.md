# Directory Structure

## Overview

The frontend is organized by technical layer, following the inherited StackEdit
shape. Components are not grouped into feature folders; feature behavior is
usually split across a Vue component, a Vuex module, and one or more services.

## Directory Layout

```text
src/
  main.js                   Vue app bootstrap, directives, PWA update hook
  components/               Vue single-file components
  components/common/        Shared component helpers
  components/menus/         Menu components
  components/modals/        Modal components and provider modals
  components/gutters/       Editor/preview discussion gutter components
  data/                     Constants, defaults, empty item factories, templates
  extensions/               Markdown-it and render extensions
  icons/                    Vue icon components and generated static SVGs
  libs/                     Legacy/general libraries such as sanitizer
  services/                 App services and editor/provider logic
  services/editor/          Editor engine integrations
  services/optional/        Optional feature registration modules
  services/providers/       Provider implementations and helpers
  store/                    Vuex modules
  styles/                   Global SCSS and theme styling
```

Tests live under `test/unit/specs/`, mirroring components, services, and libs.

## Module Organization

- Put UI in `src/components/`; use subdirectories only when an existing group
  matches (`menus`, `modals`, `gutters`, `common`).
- Put cross-component behavior in `src/services/`.
- Put provider-specific code in `src/services/providers/` and shared provider
  contracts in `src/services/providers/common/`.
- Put reusable store CRUD shape in `src/store/moduleTemplate.js`; new item
  types should follow existing Vuex module patterns.
- Put default/empty persisted shapes in `src/data/defaults/` or
  `src/data/empties/`.
- Put markdown renderer changes under `src/extensions/` or
  `src/services/markdown*` depending on whether the change is parser extension
  or service orchestration.

## Naming Conventions

- Vue components use PascalCase filenames, for example `ExplorerNode.vue`.
- Vuex modules and services use camelCase filenames, for example
  `workspaceImageSvc.js`, `localDbSvc.js`.
- Icon components use PascalCase and are globally registered in
  `src/icons/index.js`.
- Empty factories use `empty<Type>.js`, for example `emptyFile.js`.
- Tests use `<Subject>.spec.js` and live under a matching area in
  `test/unit/specs/`.

## Examples

- `src/components/ExplorerNode.vue`: component plus Vuex/service interaction.
- `src/store/file.js`: Vuex module extending `moduleTemplate`.
- `src/services/workspaceImageSvc.js`: focused service for local image paths and
  data URL projection.
- `src/services/providers/common/Provider.js`: shared provider content
  serialization contract.
- `test/unit/specs/services/imageTypeUtils.spec.js`: focused service utility
  tests.
