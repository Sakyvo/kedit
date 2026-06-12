# State Management

## Overview

KEDIT uses Vuex 4 as the global state layer. The root store is built in
`src/store/index.js`; most item collections use namespaced modules generated
from `src/store/moduleTemplate.js`.

## State Categories

- Global app state: Vuex modules under `src/store/`.
- Persisted local state: IndexedDB and localStorage via `localDbSvc`.
- Provider/sync state: Vuex data modules plus provider services and sync data.
- Component-only state: transient UI values in `data()`, for example edit input
  state in `ExplorerNode.vue`.
- URL action state: query parameters parsed through utilities and provider
  action flows.

## Vuex Patterns

- Modules are namespaced.
- Item modules keep `itemsById` maps and expose `items` getters.
- Mutations use `setItem`, `patchItem`, and `deleteItem` where possible.
- Empty item factories under `src/data/empties/` define persisted item shape.
- Derived cross-module getters live in `src/store/index.js`, for example
  `gitPathsByItemId`, `itemsByGitPath`, and path maps.

## When to Use Global State

Use Vuex when state:

- Is shared by multiple components.
- Must be persisted or synced.
- Represents Documents, folders, content, locations, workspace settings,
  notifications, modals, layout, or editor state.
- Participates in provider serialization or git path projection.

Use component `data()` only for ephemeral UI state that does not need to survive
component boundaries.

## Persistence and Sync

- `localDbSvc.js` owns browser persistence and cross-tab transaction syncing.
- `syncSvc.js` owns provider synchronization and content merge flow.
- `Provider.serializeContent` and `Provider.parseContent` own the embedded
  StackEdit metadata contract.
- `workspaceImageSvc.js` reads private image records and produces data URLs for
  projection. Do not store those data URLs in Document source.

## Common Mistakes

- Writing directly to IndexedDB from components.
- Adding derived git/path logic in components instead of root getters.
- Treating Sync and Publish as the same flow. Sync is private device mirroring;
  Publish is manual public handoff.
- Persisting transient projections, especially base64 image data.
