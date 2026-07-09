# Research: Sidebar / Explorer UX batch (sync buttons, sort, drag order, trash, rename overlay)

- **Query**: Duplicate sync buttons, logged-out sync, existing sort feature, manual drag ordering, trash/permanent delete, rename overlay bug
- **Scope**: internal (KEDIT codebase, Vue 3 + Vuex 4 — note: package.json has `vue ^3.5.13`, NOT Vue 2)
- **Date**: 2026-07-06

## 1. Duplicate sync buttons on desktop

### Files

| File | Lines | Description |
|---|---|---|
| `src/components/NavigationBar.vue` | 11 | Quick sync button (`--sync-quick`), added by commit 10bfa2b9 |
| `src/components/NavigationBar.vue` | 24 | Original sync button (`--sync`) in the Sync/Publish title area |
| `src/store/layout.js` | 25-33, 145-147 | Layout constants + `hideLocations` computation |

### Why two buttons appear on desktop

Commit 10bfa2b9 replaced the old theme-toggle button with an always-visible quick sync button in the right button group (NavigationBar.vue:11):

```html
<button class="navigation-bar__button navigation-bar__button--sync-quick button"
  :class="'navigation-bar__button--' + syncStatus" v-title="'立即同步'" tour-step-anchor="theme"
  :disabled="!isSyncPossible || isSyncRequested || offline" @click="requestSync"><icon-sync></icon-sync></button>
```

The original sync button still exists at NavigationBar.vue:24 inside the title/locations block (line 22):

```html
<div class="flex flex--row" :class="{'navigation-bar__hidden': styles.hideLocations}">
  ...
  <button class="navigation-bar__button navigation-bar__button--sync button" ...>
```

**There is NO media query.** Visibility gating is:

- Quick button: always rendered. CSS rule at NavigationBar.vue:389-396 sets `.navigation-bar__button { display: none; }` EXCEPT inside `.navigation-bar__inner--button` containers or `.navigation-bar--editor` — the quick button is inside an `--inner--button` container, so it always shows.
- Original button: hidden only when `styles.hideLocations` is true. `hideLocations` is computed in `src/store/layout.js:145-147` — true only when `titleMaxWidth + navigationBarEditButtonsWidth < 200` (narrow screens) or light mode (line 47). On desktop it is false → **both buttons visible** (rationale in commit msg: the title-area sync button vanished with `hideLocations` on narrow screens; the fix added a permanent one but didn't remove/gate the old one on wide screens).

Both call the same `requestSync()` (NavigationBar.vue:148-152) and share `syncStatus` coloring (`--unsynced` red / `--synced` green, lines 323-340).

### Sort button ("排序") and sidebar overflow

- Rendered in `src/components/Explorer.vue:20-22` — 6th button in the explorer side-title left group:
  ```html
  <button class="side-title__button side-title__button--sort button" @click="openSortMenu" v-title="'排序'">
    <icon-view-list></icon-view-list>
  </button>
  ```
- Sidebar (explorer) width const: **`explorerWidth: 260`** in `src/store/layout.js:27` (`constants`), applied inline in `src/components/Layout.vue:4` (`:style="{width: ... constants.explorerWidth + 'px'}"`). Also `sideBarWidth: 280` (right sidebar).
- Button sizing: `.side-title__button { width: 38px; }` in `src/styles/app.scss:317-335`; `.side-title { height: 44px; padding: 4px 4px 0; }` (app.scss:309-315).
- **Overflow math**: left group = 6 x 38px = 228px, + close button 38px = 266px, + 8px side-title horizontal padding = 274px > 260px panel width. The container is `flex--space-between` with a plain `flex--row` left group; `.side-title__button` has `margin-bottom: 20px` with comment "prevent from seeing wrapped buttons" — the overflowing close button wraps below the 44px-high bar and becomes invisible/clipped.

## 2. Sync when logged out

### Current behavior

- Click handler: `requestSync()` in `src/components/NavigationBar.vue:148-152` — guarded by `this.isSyncPossible`; **silently does nothing** when false. The button is also `:disabled="!isSyncPossible || ..."` (lines 11, 24), so logged-out users get a disabled grey button, no explanation.
- `isSyncPossible` computed (NavigationBar.vue:111-114):
  ```js
  return store.getters['workspace/syncToken'] || store.getters['syncLocation/current'].length;
  ```
- Service-side: `src/services/syncSvc.js:55-56` `isSyncPossible = () => !store.state.offline && (isWorkspaceSyncPossible() || hasCurrentFileSyncLocations())`; `isWorkspaceSyncPossible = () => !!store.getters['workspace/syncToken']` (line 45). `requestSync` (syncSvc.js:900-965) throws `'无法同步。'` if not possible mid-queue.

### Login state getters (`src/store/workspace.js`)

- `syncToken` (line 80-98): token for the current workspace's provider (falls back to `mainWorkspaceToken`).
- `mainWorkspaceToken` (line 63): first Gitee/GitHub token found.
- `loginToken` (line 119-121): `rootGetters['data/tokensByType'][loginType][currentWorkspace.sub]` — this is the canonical "logged in" check (used by MainMenu.vue:49 `v-if="!loginToken"` for the login entry, and discussion.js:137-138).

### Existing "sign in to use X" modal pattern

- `src/store/discussion.js:136-149` — `createNewDiscussion`: if `!loginToken`, opens simple modal `signInForComment`, then `githubHelper.signin()` / `giteeHelper.signin()`, `syncSvc.afterSignIn()`, `syncSvc.requestSync()`.
- Simple modals are declared in `src/data/simpleModals.js` via the `simpleModal(contentHtml, rejectText, resolveText, resolveArray)` helper (lines 1-6); e.g. `signInForComment` (lines 73-85) with `resolveArray` buttons. A new `signInForSync` entry ("登录以使用同步功能") would follow this exact pattern.
- Modal opening: `store.dispatch('modal/open', 'typeName' | { type, ...config })` — promise resolves on confirm, rejects on cancel (`src/store/modal.js:19-32`).
- Current login flow is GitHub PAT: `src/components/menus/MainMenu.vue:189-198` (`modal/open {type:'githubPat'}` → `githubHelper.signinWithToken(accessToken)` → `syncSvc.afterSignIn()` → `requestSync()`). Note commit 844e7e49 removed the Gitee login entry, so `signInForComment`'s Gitee option is stale precedent — model new modal on the PAT flow.
- Notifications (toast alternative): `src/store/notification.js` — `dispatch('notification/info'|'badge'|'confirm'|'error', content)`, 5s default timeout.

## 3. Sort feature (existing, KEDIT custom)

### UI — no dedicated panel component; it's a context menu

`src/components/Explorer.vue:154-179` `openSortMenu(evt)`:

```js
const options = [
  ['name', 'asc', '名称 ↑'],
  ['name', 'desc', '名称 ↓'],
  ['updatedOn', 'desc', '修改时间（新→旧）'],
  ['updatedOn', 'asc', '修改时间（旧→新）'],
  ['createdOn', 'desc', '创建时间（新→旧）'],
  ['createdOn', 'asc', '创建时间（旧→新）'],
];
const items = options.map(([field, direction, label]) => ({
  name: `${sortBy === field && sortDirection === direction ? '● ' : '　'}${label}`,
  perform: () => { store.commit('explorer/setSortBy', field); store.commit('explorer/setSortDirection', direction); },
}));
store.dispatch('contextMenu/open', { coordinates: {left: evt.clientX, top: evt.clientY}, items });
```

The "selected" marker is a literal `● ` prefix vs full-width space `　` inside the item name string — alignment/padding issues come from this hack plus ContextMenu CSS.

### ContextMenu markup/CSS (`src/components/ContextMenu.vue`)

- Items: `.context-menu__item { display:block; color:#333; padding: 0 25px; }` (lines 55-60); `$padding: 5px`; `.context-menu__inner { background:#ebebeb; border-radius:5px; padding: 5px 0; box-shadow: ... }` (47-53); hover `#338dfc` (62-69). Font-size 14 / line-height 18 on `.context-menu` (35-43). **Horizontal padding 25px both sides; no left gutter reserved for a check indicator** — hence restyle need.
- ContextMenu store: `src/store/contextMenu.js`.

### Sort state — NOT persisted

`src/store/explorer.js:87-88` state `sortBy: 'updatedOn', sortDirection: 'desc'` (defaults); mutations `setSortBy`/`setSortDirection` (95-100) with normalizers (17-20: fields `name|updatedOn|createdOn`, directions `asc|desc`). No write to `data/localSettings` or `layoutSettings` — sort resets on reload. (Persistence pattern available: `store.dispatch('data/patchLocalSettings', {...})`, see `src/store/data.js:176/247` and usage at `src/services/localDbSvc.js:407`.)

### Node sorting

`src/store/explorer.js:26-36` `compare({sortBy, sortDirection})` — name uses `Intl.Collator` (line 16), timestamps numeric; desc negates; tie-break by name. Applied recursively in `Node.sortChildren` (49-56, folders and files sorted separately) from `nodeStructure` getter at line 167 `rootNode.sortChildren(state)`.

## 4. Manual drag ordering

### Existing drag & drop (desktop, HTML5 events)

`src/components/ExplorerNode.vue`:

- Node root (line 2): `@dragover.prevent @dragenter.stop="node.noDrop || setDragTarget(node)" @dragleave.stop="isDragTarget && setDragTarget()" @drop.prevent.stop="onDrop"`.
- Item row (line 6): `draggable="true" @dragstart.stop="setDragSourceId" @dragend.stop="setDragTarget()"`.
- `setDragSourceId(evt)` (154-163): commits `explorer/setDragSourceId`, sets `evt.dataTransfer.setData('Text','')` (Firefox fix).
- `onDrop()` (169-182): reads `dragSourceNode` + `dragTargetNodeFolder` getters, then `workspaceSvc.storeItem({ ...sourceNode.item, parentId: targetNode.item.id })` — **drop only re-parents; there is no positional insert**.
- Store side: `src/store/explorer.js:83-84` state `dragSourceId/dragTargetId`; `setDragTarget` action (221-242, blocks dropping into own child); `dragTargetNodeFolder` getter (196-201, always resolves to a FOLDER — so a drop between two files is impossible today); `fakeFileNode` (61-63) appended to root (line 177) so root has a drop area; `openDragTarget` debounced auto-open (218-220).
- Alternative "移动到…" picker already exists via context menu: ExplorerNode.vue:211-213 + `buildMoveTargets()` (246-269) → `workspaceSvc.moveItem(sourceId, folderId)`.

### Why mobile drag doesn't work

Drag uses HTML5 `dragstart/dragenter/drop` on `draggable="true"` elements. Mobile browsers do not fire HTML5 drag events from touch input (no polyfill in the codebase). Touch handlers that DO exist on the item (line 6: `@touchstart.passive="onTouchStart" @touchend/@touchmove/@touchcancel="clearLongPress"`) are used only for the 500ms long-press context menu (lines 277-294). Confirmed: no touch-based drag anywhere.

### Data model for a manual order index

- File item shape: `src/data/empties/emptyFile.js` — `{ id, type:'file', name, parentId, createdOn, updatedOn, hash }`. Folder: `src/data/empties/emptyFolder.js` (same minus timestamps presumably).
- Items live in Vuex modules built from `src/store/moduleTemplate.js` (`file.js`, `folder.js`); `setItem` merges onto `empty(id)` and recomputes `hash = utils.getItemHash(item)` (moduleTemplate.js:17-23). `getItemHash` (src/services/utils.js:146-154) hashes ALL fields except `id/hash/history` — **adding an `order` field to the item changes its hash → triggers sync churn for every reorder** (syncSvc compares `file.hash === syncData.hash`, e.g. syncSvc.js:925).
- Persistence: items are persisted to IndexedDB by `localDbSvc` per workspace; updates go through `workspaceSvc.storeItem` / `setOrPatchItem` (src/services/workspaceSvc.js:76+).
- Caveat for git-backed workspaces: file/folder identity maps to repo paths (`src/store/index.js:89-90` `.stackedit-trash/`, `src/services/gitWorkspaceSvc.js:79-80`); an `order` field on items would not round-trip through the repo. A safer home is a data item (e.g. `data/localSettings` via `patchLocalSettings`, or a new data key) mapping folderId → ordered id list, kept local.
- Insertion point: sorting is centralized in `explorer.js` `compare`/`sortChildren` — a `manual` sort mode would branch there using the stored order map.

## 5. Trash / permanent delete

- Trash is a virtual folder: node id `'trash'`, name `回收站`, built in `src/store/explorer.js:116-122`, unshifted to root (line 174). A file is "in trash" when `file.parentId === 'trash'`.
- Delete flow: `src/services/explorerSvc.js:18-94` `deleteItem()`:
  - If selected node is trash or inside trash (line 24-31): opens `modal/open 'trashDeletion'` — an **info-only modal** ("回收站中的文件在不活动7天后会自动删除。" / OK button, `src/data/simpleModals.js:123-126`). **No permanent delete exists from the trash UI.**
  - Temp folder/files delete permanently (`tempFolderDeletion`/`tempFileDeletion` confirm modals, moveToTrash=false → `workspaceSvc.deleteFile(id)`).
  - Normal folder: `folderDeletion` confirm modal; files re-parented to trash via `workspaceSvc.setOrPatchItem({ id, parentId: 'trash' })` (lines 55-64); folder items deleted (`folder/deleteItem`).
- Auto-clean after 7 days (`constants.cleanTrashAfter = 7*24*60*60*1000`, `src/data/constants.js:4`):
  - Unsynced workspaces: `src/services/localDbSvc.js:415-423` — on startup, if no `workspace/syncToken` and `lastFocus` older than 7 days → `deleteFile` every trash file.
  - Synced workspaces: `src/services/syncSvc.js:917-929, 947-953` — if last sync activity older than 7 days, trash files whose `hash === syncData.hash` are deleted after successful sync.
- Confirm-dialog pattern for destructive actions: `simpleModal(content, '取消', '确认删除')` in `src/data/simpleModals.js` (e.g. `folderDeletion` lines 30-34, `tempFileDeletion` 113-117), awaited via `store.dispatch('modal/open', {type, item})` with try/catch for cancel. A "永久删除" for trash items would add a `trashPermanentDeletion` simpleModal + a real-delete branch in `explorerSvc.deleteItem` (using existing `workspaceSvc.deleteFile`).

## 6. Rename / new-item overlay bug — ROOT CAUSE FOUND

### The dimmed "overlay"

Not a real overlay element: `src/components/Explorer.vue:36` adds class `explorer__tree--new-item` when `!newChildNode.isNil`, and `src/components/ExplorerNode.vue:328-330` dims every item:

```scss
.explorer__tree--new-item & { opacity: 0.33; }
```

The dim clears only when `explorer/setNewItem(null)` is committed, which happens exclusively in `submitNewChild()` (ExplorerNode.vue:122-138), wired to the new-child input (line 13):

```html
<input type="text" class="text-input" v-focus @blur="submitNewChild()" @keydown.stop
  @keydown.enter="submitNewChild()" @keydown.esc.stop="submitNewChild(true)" v-model.trim="newChildName">
```

### Why blur/click-outside doesn't dismiss

The app is **Vue 3** (`createApp`, `vue ^3.5.13`, no @vue/compat), but the global `focus` directive still uses the **Vue 2 hook name `inserted`**:

- `src/main.js:50-58`:
  ```js
  app.directive('focus', {
    inserted(el) { el.focus(); ... },   // Vue 3 requires `mounted`
  });
  ```
- Same dead code in `src/components/common/vueGlobals.js:6-14` (also `bind`/`update`/`unbind` in `show`/`title`/`clipboard` there — that whole file appears to be legacy; main.js's `title` directive also uses Vue-2 `bind`/`update`, main.js:64-73).

Because `inserted` never fires in Vue 3, **`v-focus` is a no-op → the new-child input never receives focus → clicking outside produces no `blur` event → `submitNewChild()` never runs → `newChildNode` stays set → the 0.33-opacity dim persists** until the user manually clicks INTO the input and then presses Enter/Esc or blurs it.

Fix direction: rename hook to `mounted` (and audit the other legacy directive hooks); optionally also cancel on outside click / Escape at the tree level.

### Rename (edit existing node) — different path, works

`src/components/ExplorerNode.vue:3-5` edit input uses explicit focus in the `isEditing` watcher (lines 71-84: `this.$refs.editInput.focus(); input.select()`), so blur→`submitEdit()` (139-153) works there. Rename has no dim class; the bug is specific to NEW item creation. Entry points that set the state: `explorerSvc.newItem()` (`explorerSvc.js:5-17` → `setNewItem`) from Explorer.vue buttons (lines 5-10) and the node context menu (ExplorerNode.vue:197-203).

## Caveats / Not Found

- No component named anything like SortPanel exists; the sort UI is entirely the shared ContextMenu — "已选" alignment issue is the `● `/`　` string-prefix hack (Explorer.vue:165).
- Sort setting persistence: confirmed absent (grep for `setSortBy` shows only Explorer.vue + explorer.js).
- No mobile flag / media query anywhere in NavigationBar; "mobile" in commit 10bfa2b9 means narrow-width behavior (`hideLocations`), not UA detection.
- `signInForComment`/`signInForSponsorship` modals still offer Gitee login although the Gitee entry was removed (commit 844e7e49) — new sync-login modal should use the GitHub PAT flow (`MainMenu.vue:189-198`).
- Did not trace `workspaceSvc.moveItem` internals (used by 移动到… picker) — assumed same `storeItem` reparent path.
