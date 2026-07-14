# Frontend Development Guidelines

KEDIT is a Vue 3 + Vuex + Vite fork of StackEdit. The frontend owns the editor,
workspace model, provider integrations, local IndexedDB persistence, Sync, and
Publish handoff behavior.

## Pre-Development Checklist

- Read `CONTEXT.md` for KEDIT domain language before naming UI, state, or
  service concepts.
- Read ADRs under `docs/adr/` when touching editor architecture, Sync, images,
  preview rendering, or branding/data identifiers.
- Search existing components/services before adding a new abstraction.
- Preserve raw Markdown as the Author-edited source. Preview may diverge at the
  render layer, but stored Document text should remain portable Markdown.
- Preserve private-at-rest image behavior. Base64 is a transient copy/Publish
  projection only.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Source tree layout and feature placement | Filled |
| [Component Guidelines](./component-guidelines.md) | Vue SFC patterns, props, styling, accessibility | Filled |
| [Hook Guidelines](./hook-guidelines.md) | Current no-hook pattern and service/directive alternatives | Filled |
| [State Management](./state-management.md) | Vuex modules, IndexedDB, provider state | Filled |
| [Type Safety](./type-safety.md) | JavaScript contracts and validation patterns | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Build/test/style checks and review expectations | Filled |

## Project Boundaries

- Use Vue Options API and Vuex patterns already present in the fork.
- Keep reusable business logic in `src/services/`, not duplicated inside
  components.
- Keep provider-specific remote behavior under `src/services/providers/`.
- Keep persisted StackEdit identifiers unless a migration task explicitly
  changes them.
