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

## Image Upload And Legacy Badge Contract

### 1. Scope / Trigger

- Image insertion from paste, drop, or the image dialog is a Private image write.
  It must stay inside the current private git workspace.
- StackEdit badge data is legacy-compatible only. KEDIT does not surface, earn,
  write, or sync badges.

### 2. Signatures

- `imageSvc.updateImg(imgFile)` returns `{ url }` for a private workspace image
  path or `{ error }` when the current workspace cannot store private images.
- `img/checkedStorage` may still exist in localStorage, but it is not an upload
  routing contract for external providers.

### 3. Contracts

- Good upload path: `imageSvc.updateImg` derives a workspace image path, stores
  base64 content in IndexedDB through `localDbSvc.saveImg`, and returns the
  workspace-relative URL for Markdown insertion.
- External image-host providers such as SM.MS, custom HTTP uploaders, GitHub
  image repos, and Gitea image repos must not be executable from KEDIT image
  insertion.
- `.stackedit-data/badgeCreations.json` may appear in historical synced
  workspaces. Parsers may tolerate the path, but no live Vuex getter, UI, sync
  write, or test assertion should depend on badge state.

### 4. Validation & Error Matrix

- Current workspace is not git/private-image capable -> `updateImg` returns the
  existing image-storage error and performs no external upload.
- `localStorage["img/checkedStorage"]` contains `token` or `tokenRepo` ->
  upload still uses workspace storage or fails as workspace storage, never the
  external provider.
- Historical `badgeCreations.json` exists remotely -> parsing must remain
  non-fatal; KEDIT ignores it as product state.

### 5. Good/Base/Bad Cases

- Good: paste an image while a stale SM.MS storage is in localStorage; the image
  is saved as a Private workspace image.
- Base: an old synced repo contains `.stackedit-data/badgeCreations.json`; sync
  does not crash and no badge UI appears.
- Bad: a component imports `badgeSvc`, reads `data/allBadges`, or adds a UI path
  that lets the Author choose an external image host for insertion.

### 6. Tests Required

- Service tests for `imageSvc.updateImg` assert workspace-only behavior and stale
  external `checkedStorage` ignored.
- Component tests for image/account dialogs assert external image-host chooser
  and SM.MS/custom creation entries are absent.
- Search check before finish:
  `rg "badgeSvc|addBadge|badgeTree|allBadges|badgeCreations" src test`
  should return only the documented legacy parser tolerance point if retained.

### 7. Wrong vs Correct

Wrong:

```js
const currStorage = store.getters['img/getCheckedStorage'];
if (currStorage.type === 'token') {
  return smmsHelper.uploadFile(...);
}
```

Correct:

```js
const path = getImagePath(workspacePath, imgFile);
await localDbSvc.saveImg({ path: absolutePath, content: base64 });
return { url: path.replaceAll(' ', '%20') };
```

## File Timestamp Metadata Contract

### 1. Scope / Trigger

- File items persisted by Vuex/IndexedDB carry sort metadata for the Document
  panel. This is browser persistence metadata, not Markdown source content.

### 2. Signatures

- `workspaceSvc.createFile({ name, parentId, text, properties, discussions, comments }, background)`
  creates a `file` item with `createdOn` and `updatedOn`.
- `workspaceSvc.storeItem(item)` updates file metadata and refreshes
  `updatedOn`.
- `store.dispatch('content/patchCurrent', patch)` updates current Document
  content and refreshes the owning file's `updatedOn`.
- `explorer` sort state accepts `sortBy: 'name' | 'updatedOn' | 'createdOn'`
  and `sortDirection: 'asc' | 'desc'`.

### 3. Contracts

- File metadata fields:
  - `createdOn: number` Unix epoch milliseconds; legacy/missing value is `0`.
  - `updatedOn: number` Unix epoch milliseconds; legacy/missing value is `0`.
- New files set both stamps to the same `Date.now()` value.
- Metadata/content saves refresh `updatedOn` and preserve `createdOn`.
- Git workspace projection must preserve local stamps and must not serialize
  them into `.md` content.

### 4. Validation & Error Matrix

- Missing file item -> workspace file operations return `null` where the
  service method is nullable.
- Missing/non-numeric stamp -> explorer treats it as `0` so legacy Documents
  sort as oldest.
- Invalid sort field/direction -> explorer normalizes to
  `updatedOn`/`desc`.

### 5. Good/Base/Bad Cases

- Good: create a Document, edit content, then sort by modified descending; it
  appears before untouched legacy Documents.
- Base: rename or move a Document through `workspaceSvc.storeItem`; metadata is
  persisted and path uniqueness still runs.
- Bad: write timestamps into Document Markdown or provider-serialized `.md`
  metadata.

### 6. Tests Required

- Service tests assert create/save timestamp behavior and legacy `0` handling.
- Store/service tests assert `content/patchCurrent` refreshes the owning file's
  `updatedOn`.
- Explorer tests assert `name`, `updatedOn`, and `createdOn` sorting in both
  directions while preserving folders-before-files.

### 7. Wrong vs Correct

Wrong:

```js
store.commit('content/patchItem', { id: contentId, text });
```

Correct:

```js
store.dispatch('content/patchCurrent', { text });
```

Use the action so the Document content and the owning file's modified timestamp
stay in sync.

## Common Mistakes

- Writing directly to IndexedDB from components.
- Adding derived git/path logic in components instead of root getters.
- Treating Sync and Publish as the same flow. Sync is private device mirroring;
  Publish is manual public handoff.
- Persisting transient projections, especially base64 image data.
