# Component Guidelines

## Overview

Components are Vue single-file components using the Options API. They commonly
read from the shared Vuex store, call services for side effects, and keep
transient UI-only state in `data()`.

## Component Structure

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

## Props Conventions

- Existing older components often use array props such as
  `props: ['node', 'depth']`.
- New or significantly edited shared components should prefer object prop
  declarations with `type` and defaults, as in `DropdownMenu.vue`.
- Keep prop names aligned with domain terms (`node`, `file`, `workspace`,
  `location`, `providerId`) instead of generic names.
- Do not mutate props directly; update Vuex state or emit events.

## Store and Service Interaction

- Use Vuex for shared application state. Existing components mix direct
  `store.commit(...)` calls with `mapActions` / `mapMutations`.
- Use services for side effects: `workspaceSvc`, `explorerSvc`, `badgeSvc`,
  provider helpers, etc.
- Keep expensive or cross-component logic out of template expressions.
- Preserve async UI behavior that avoids blocking the editor. For example,
  `ExplorerNode.vue` uses a short timeout before opening files/folders.

## Styling Patterns

- Component styles use SCSS in the SFC unless the style is global.
- Global app/theme styles live in `src/styles/`.
- Existing classes are BEM-like: `explorer-node__item`,
  `explorer-node--selected`.
- Use existing theme hooks such as `.app--dark &` when adding dark-mode
  variants.
- Avoid new styling systems or dependencies.

## Accessibility

- Reuse the global `v-title` directive when an element needs both `title` and
  `aria-label`; it is registered in `src/main.js`.
- Preserve keyboard handlers on editable controls, such as Enter/Escape flows
  in `ExplorerNode.vue`.
- Icon-only controls need accessible labels through existing directives or
  attributes.

## Common Mistakes

- Duplicating service logic inside a component instead of extending
  `src/services/`.
- Adding local component state for data already owned by Vuex.
- Introducing Composition API style into an area that otherwise uses Options
  API without a task-level reason.
- Renaming visible StackEdit strings together with persisted identifiers. Only
  user-visible branding was rebranded to KEDIT.
