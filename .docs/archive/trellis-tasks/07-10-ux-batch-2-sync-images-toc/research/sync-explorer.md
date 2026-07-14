# Research: batch-2 UX — explorerOrder sync root cause / sync button / explorer folders / move-to / scrollbar

- **Query**: M1 explorerOrder cross-device sync bug root cause; S1-S4 sync button states; M2 manual-sort toggle styling; R1 trash context menu; G1-G4 imgs folder + move-to picker + node colors + GitHub jump; B1 scrollbar facts
- **Scope**: internal (KEDIT codebase, Vue 3.5 + Vuex 4 StackEdit fork)
- **Date**: 2026-07-10
- **Screenshots**: `research/assets/004.png` / `005.png` (manual-sort toggle on/off), `006.png` (move-to picker with imgs folder)

---

## M1 — CRITICAL: explorerOrder does NOT sync across devices — ROOT CAUSE

### TL;DR (conclusive)

**The sync plumbing added in 07-06 (commit 31fe3372) is complete and works. The bug is in the PAYLOAD: `explorerOrder` stores local Vuex item IDs, and in the main (git-backed) workspace item IDs are randomly generated PER DEVICE. The order file round-trips through GitHub correctly, but its IDs mean nothing on any other device. Worse, each device's `materializeOrder` compaction then strips the foreign IDs and re-uploads its own, so devices permanently clobber each other.**

### Verified: every plumbing link works (all generic, no hardcoded dataId list)

1. **Sync call** — `src/services/syncSvc.js:769-774`, inside `syncWorkspace`:
   ```js
   if (workspace.id === 'main') {
     await syncDataItem('workspaces');
     await syncDataItem('explorerOrder');
   }
   ```
2. **`syncDataItem(dataId)`** — `src/services/syncSvc.js:569-647`. Generic. Skip-guard `oldSyncData && oldItem && oldItem.hash === oldSyncData.hash` (line 576). Download passes a synthetic syncData when none exists: `syncData: oldSyncData || { id: dataId }` (line 583) — so first download works. Merge (lines 589-611): server wins when no `dataSyncData`; client wins when `dataSyncData.hash === serverItem.hash`; object-merge when both changed. Uploads when `!serverItem || serverItem.hash !== mergedItem.hash` (line 634).
3. **Provider methods are generic** — `src/services/providers/githubAppDataProvider.js`:
   - `downloadWorkspaceData` (127-155): `const path = ".stackedit-data/${syncData.id}.json"` — works for ANY dataId. Returns `{}` when `!sha`.
   - `uploadWorkspaceData` (196-223): `const path = ".stackedit-data/${item.id}.json"` — also generic.
   - Repo constants: `appDataRepo = 'kedit-app-data'`, `appDataBranch = 'master'` (lines 7-8). `giteeAppDataProvider.js` is byte-identical in these methods (repo `stackedit-app-data`).
4. **404 tolerance (no chicken-egg)** — `src/services/providers/helpers/githubHelper.js:337-342`: `downloadFile` catches 404 and returns `{}` **specifically for paths containing `.stackedit-data`**, so the first-ever download (file not yet on server) doesn't throw and the subsequent upload creates it.
5. **Download trigger via tree scan** — `src/services/gitWorkspaceSvc.js:159-185`: whitelist regex at line 161 includes `explorerOrder`:
   ```js
   const [, id] = path.match(/^\.stackedit-data\/(settings|workspaces|badgeCreations|templates|explorerOrder)\.json$/) || [];
   ```
   When the file exists in the tree and `syncData.sha` mismatches, it creates a `{syncDataId: id, item: {hash:1}, syncData: {hash:1}}` change → `applyChanges` (syncSvc.js:149-205) stores the syncData stub (data items are not committed there, line 191 skips `type === 'data'`) → `syncDataItem` then downloads + merges. Line 163-164 also registers `idsByPath[path]/[id]` so the deletion pass (231-235) doesn't remove it.
6. **Local persistence** — `explorerOrder` is NOT in `constants.localStorageDataIds` (`src/data/constants.js:17-23`), so it lives in `state.data.itemsById` and is persisted to IndexedDB by `localDbSvc.writeAll` (`src/services/localDbSvc.js:251-297`, iterates `allItemsById` which includes type `data` via `constants.types`, `src/store/index.js:78-82`).

So upload/download of `.stackedit-data/explorerOrder.json` works end-to-end (you can confirm by looking for the file in the user's `kedit-app-data` repo — it should exist and keep changing).

### The actual bug: per-device item IDs

- `explorerOrder` data shape: `{ [parentKey('root'|folderId)]: [childItemId, ...] }` — `src/store/data.js:33-35`, written by:
  - drag-drop: `ExplorerNode.vue:296-319` (`executeManualDrop` → `data/patchExplorerOrder` with `child.item.id` lists);
  - snapshot/compaction: `explorer.js:261-308` (`materializeOrder` → `data/setExplorerOrder`);
  - create-append: `workspaceSvc.js:80-94` (`appendToExplorerOrder`).
- The main workspace IS git-like: `currentWorkspaceIsGit` includes `githubAppData` and `giteeAppData` — `src/store/workspace.js:45-52`.
- In git workspaces, **items are identified by git PATH on the server; local IDs are arbitrary**. When a device first sees a file/folder in the tree, `gitWorkspaceSvc.makeChanges` assigns it a fresh random ID — `src/services/gitWorkspaceSvc.js:52-74`:
  ```js
  } else {
    // Otherwise, make a new ID for a new item
    itemId = utils.uid();   // line 65 — crypto-random, per device
  }
  ```
  (`utils.uid()` — `src/services/utils.js:131-134`.) Device A's `file X = id "ab3..."`, device B's same file X = a different uid. Only file CONTENT/paths sync; IDs never leave the device.
- Therefore the downloaded `explorerOrder` references IDs that exist on no other device. `sortNodesManually` (`src/store/explorer.js:42-61`) finds no `indexById` matches → every node falls into the `compareCreatedAsc` fallback → looks "not synced".

### The aggravator: materializeOrder clobber loop

`Explorer.vue:204-210` watches `explorer/rootNode` and dispatches `explorer/materializeOrder` on every tree change (immediate). `materializeOrder` compacts every entry: `entry.filter(id => childIdSet.has(id))` (`explorer.js:292`) — foreign IDs are never children on this device, so they are ALL dropped, `changed = true`, and a fresh order keyed by THIS device's IDs is committed → hash changes → next sync cycle uploads it, overwriting the other device's file. Both devices keep round-tripping mutually meaningless data; last writer wins. The server file is effectively "whichever device synced last, in its own private ID space".

### Secondary warts found while tracing (worth fixing in passing)

1. **First-ever upload stores syncData under key `'undefined'`**: `syncDataItem` passes `syncData: store.getters['data/syncDataById'][dataId]` (undefined on first upload, syncSvc.js:638); `uploadWorkspaceData` returns `{...syncData, type, hash, data, sha}` — **no `id` field** (githubAppDataProvider.js:214-222); `updateSyncData` then patches `{[syncData.id]: syncData}` → literal key `"undefined"` (syncSvc.js:295-299). Self-heals next cycle (makeChanges deletion pass removes the junk key, tree scan creates a proper one), but wastes a cycle and pollutes syncData. Fix: default `id: dataId` when passing syncData to upload, or in the provider.
2. `uploadWorkspaceData` embeds the full `data: item.data` into syncData (bloats the persisted syncData item).
3. `githubAppDataProvider.js:12` name is `'Gitee应用数据'` (copy-paste; cosmetic).

### What the fix requires

Make the payload device-portable. Translation infrastructure already exists:

- `gitPathsByItemId` — `src/store/index.js:115-148`: folder → `path/` (trailing slash), file → `path.md`, data → `.stackedit-data/id.json`.
- `itemIdsByGitPath` — `src/store/index.js:149-155` (reverse map).
- Paths are enforced-unique in the main workspace: `currentWorkspaceHasUniquePaths` includes `githubAppData`/`giteeAppData` (`src/store/workspace.js:53-60`), and `workspaceSvc.makePathUnique` enforces it — so path keys cannot collide.

Two viable designs (planning decision):
- **(a) Store paths natively** in `explorerOrder` (`{'root': ['a/', 'b.md'], 'folder/path/': [...]}`) — convert at the three write sites (`executeManualDrop`, `materializeOrder`, `appendToExplorerOrder`) and one read site (`sortChildren`/`sortNodesManually`, mapping path→id via `itemIdsByGitPath` or sorting by `gitPathsByItemId[node.item.id]`). Simplest mental model; renames/moves change paths, but `materializeOrder`'s compaction already tolerates stale entries (unmapped ids fall back to createdOn-asc and get dropped) — same behavior as today when a folder's children change.
- **(b) Translate at the sync boundary only** (ids locally, paths on the wire): `syncDataItem` has no per-dataId transform hook today — would need one (e.g. `serialize`/`deserialize` map keyed by dataId around lines 581/635 of syncSvc.js). Keeps UI code unchanged but adds merge complexity: `diffUtils.mergeObjects` (syncSvc.js:605) would merge path-keyed server data against id-keyed client data unless the transform happens before merge.

Note for either design: `materializeOrder` runs immediately on load, possibly BEFORE the first sync finishes; with portable keys this becomes harmless (paths match across devices), which by itself kills the clobber loop.

---

## S1-S4 — Sync button display

### Where things are

- **Quick-sync (colored) button**: `src/components/NavigationBar.vue:11` — `class="navigation-bar__button--sync-quick"` + dynamic `:class="'navigation-bar__button--' + syncStatus"`, gated `v-if="styles.hideLocations"`, `@click="requestSync"`, `:disabled="syncDisabled"`.
- **White sync button**: `NavigationBar.vue:24` — same dynamic syncStatus class, lives inside the locations group `div` (line 22) which gets `navigation-bar__hidden` (display:none, line 226-228) when `styles.hideLocations`.

### (a) How the state/color is computed — and why fresh-open shows RED

`syncStatus` computed — `NavigationBar.vue:128-139`:
```js
if (this.isSyncRequested) return 'syncing';          // store/queue.js state, true while a sync is enqueued/running
const { lastSyncSuccess } = store.state;             // root state, src/store/index.js:58
if (!lastSyncSuccess) return 'unsynced';             // ← RED on every fresh page load
const dirty = store.getters['file/items']
  .some(file => (file.updatedOn || 0) > lastSyncSuccess);
return dirty ? 'unsynced' : 'synced';
```
- `lastSyncSuccess` is **session-only** (root Vuex state, initial `0`; set by `store.commit('setLastSyncSuccess')` only after a successful sync — `syncSvc.js:956`). So a freshly-opened app is 'unsynced' (red) until the first in-session sync completes, regardless of whether anything actually changed. That is the fresh-open RED.
- The dirty test is a **wall-clock heuristic**: `file.updatedOn` (bumped on every keystroke by `content/patchCurrent` — `src/store/content.js:63-75`) vs the local time of last sync. It is not hash-based and is workspace-wide (any file), not current-file.

**The authoritative "needs sync" predicate to reuse (hash-based, what syncSvc itself uses):**
- Content out-of-sync scan — `syncSvc.js:784-819`: for git workspaces `getSyncData = contentId => syncDataById[gitPathsByItemId[contentId]]`, then a content needs sync iff `!syncData || syncData.hash !== hash` where `hash` = loaded `content.hash` or `localDbSvc.hashMap.content[contentId]` for unloaded contents (lines 805-819).
- Data items — `syncDataItem` guard (syncSvc.js:573-577): needs sync iff `!(oldSyncData && oldItem && oldItem.hash === oldSyncData.hash)`.
- File items — the save scan (syncSvc.js:687-707): `syncData.hash === item.hash` means clean.
- So "current file has no unsynced changes" = `syncDataById[gitPathsByItemId[fileId + '/content']].hash === content.hash` (plus same check for the file item if renames should count). A getter built from these avoids both the fresh-load red and the clock heuristic.

### (b) White sync button + spin

- Button: `NavigationBar.vue:24`; CSS `--sync`/`--publish` at lines 340-344 (`padding: 0 6px; margin: 0 5px;`).
- **Neither sync button spins.** The spinning element is a separate `div.navigation-bar__spinner > div.spinner` (`NavigationBar.vue:17-20`) shown while `!store.state.queue.isEmpty`; the rotation is `@keyframes spin` applied to `.spinner::before/::after` (lines 451-490).
- **There is no CSS rule for `--syncing`**: during sync the dynamic class is `navigation-bar__button--syncing` (no rule) AND the button is `[disabled]` (since `syncDisabled` is true while `isSyncRequested`, lines 119-124), so the `[disabled]` rule (lines 365-372) pins it to default `$navbar-color` (white-ish). Net: red → (click) → white + separate spinner → green/red.

### (c) Height difference red vs green

The state classes only set `color`:
- `--unsynced:not([disabled])` → `color: $error-color` (lines 347-354).
- `--synced:not([disabled])` → `color: #5cb85c` (lines 356-363).
No height/padding/border differs per state. Both render the same `<icon-sync>` (`src/icons/Sync.vue`, svg `class="icon"` viewBox 0 0 24 24; `.icon {width:100%; height:100%}` — `app.scss:86-93`). Box: `.navigation-bar__button` height 36px width 34px (lines 276-288); quick-sync override `width: 34px; padding: 0 7px; opacity: .85` (lines 294-304). **A true height diff between red and green states is not explainable from this CSS** — if the screenshots show one, the likely culprits to check at runtime are: (1) comparing the quick-sync button vs the white `--sync` button (different padding: 7px vs 6px + margins), or (2) the `[disabled]`/syncing frame being compared against an enabled frame. Document-level answer: normalize by giving the quick-sync a single fixed box and only ever varying `color`.

### (d) Why the whole button disappears in preview mode

- `styles.hideLocations` — `src/store/layout.js`: initialized `hideLocations: state.light` (line 47) and **only ever set true inside `if (styles.showEditor) {...}`** (lines 138-148, when `titleMaxWidth + editButtons < 200px`, i.e. narrow/mobile edit mode). In preview mode (`showEditor` false) that branch never runs → `hideLocations` stays false → quick-sync `v-if` fails.
- Additionally the nav bar hides all buttons outside `__inner--button` containers unless the root has `navigation-bar--editor` (`NavigationBar.vue:412-419`; root class bound at line 2 to `styles.showEditor && !revisionContent`) — so the white sync group (inside `__inner--title`) is `display: none` in preview as well.
- Net effect: **preview mode has NO sync button at all**. The quick-sync sits inside `navigation-bar__inner--right navigation-bar__inner--button` (line 10-14) whose buttons ARE displayed in preview (per line 415), so changing its `v-if` to also cover `!styles.showEditor` (e.g. `styles.hideLocations || !styles.showEditor`) would make it appear in preview without CSS changes.

---

## M2 — Manual-sort toggle button styling

- Button: `src/components/Explorer.vue:23-25` — `side-title__button--manual-sort`, active `:class="{'side-title__button--on': manualSortEnabled}"`, `v-if="sortBy === 'manual'"`, icon `<icon-menu>` (hamburger — `src/icons/Menu.vue`, three horizontal bars).
- State: `explorer.manualSortEnabled` — in-memory only, defaults false each session (`src/store/explorer.js:122-124`); `sortBy` default `'manual'` (`defaultLocalSettings.js:4-5`).
- Current CSS:
  - Base (all side-title buttons) — `src/styles/app.scss:346-364`: `width 38px; height 36px; padding 6px; background transparent; opacity: 0.75;` hover/active/focus → `opacity: 1; background rgba(0,0,0,0.1)`.
  - Explorer overrides — `Explorer.vue:233-242`: width narrowed to `36px`; ON state = `opacity: 1; background-color: rgba(0,0,0,0.15);`.
  - So ON vs OFF differs only by a faint 15%-black background (004.png vs 005.png) — easy to miss, and hover makes OFF look like ON.
- Icons available (`src/icons/`, registered in `src/icons/index.js:70-139`): nothing expressing move/drag. Closest existing: `Menu` (current), `ViewList` (used by the sort menu button), `Target`, `ArrowLeft`. **Unregistered .vue in src/icons: only `FolderMultiple.vue`** — no drag icon on disk either.
- Adding an icon is trivial — pattern (`Menu.vue`): single-file component, `<svg class="icon" viewBox="0 0 24 24"><path d="..."/></svg>` + one import/entry in `icons/index.js`. Candidate MDI glyphs: `cursor-move`/`arrow-all` (4-way arrows, path `M13,6V11H18V7.75L22.25,12L18,16.25V13H13V18H16.25L12,22.25L7.75,18H11V13H6V16.25L1.75,12L6,7.75V11H11V6H7.75L12,1.75L16.25,6H13Z` — verify rendering), or `drag` / `drag-horizontal-variant` (dot-grid). Note icons are used at ~24px inside a 36px button with 6px padding.

---

## R1 — Trash context menu

- Menu construction: `src/components/ExplorerNode.vue:326-377` (`openContextMenu`). Trash-file items: `删除` (line 361-362, always present) and `永久删除` (lines 363-366, only `isFile && parentId === 'trash'`), calling `explorerSvc.deleteItem()` / `permanentlyDeleteItem()` (`src/services/explorerSvc.js:18-47`; permanent delete = confirm modal `trashPermanentDeletion` then `workspaceSvc.deleteFile`).
- Rendering: `src/components/ContextMenu.vue:2-8`. Item fields consumed: `type ('separator')`, `disabled`, `selected` (adds the dot column when any item has the key), `name`. **No per-item class/color is passed through** — supporting a red/danger item needs an opt-in field (e.g. `className`) bound in BOTH branches (disabled div line 6, anchor line 7: `:class="item.className"`), plus a rule like `.context-menu__item--danger { color: $error-color; }` (hover currently forces `background #338dfc; color #fff` — line 67-74 — a danger hover override may be wanted).
- Store passthrough is transparent: `src/store/contextMenu.js:22-52` stores `items` as-is (also `menuClass` — existing precedent for style opt-ins, used by the sort menu `context-menu__inner--compact`, Explorer.vue:191). Positioning: opens off-screen then clamps to viewport once measured (contextMenu.js:26-49); **no max-height/scroll for long menus**.

---

## G1-G4 — Explorer special folders, move-to picker, colors, GitHub jump

### (a) Where the `imgs` folder comes from

- Image paste/upload flow (06-03 feature): `src/services/imageSvc.js:19-41` saves the image to the local IndexedDB `imgs` store with `path = absolutePath` built from the default conf `/imgs/{YYYY}-{MM}-{DD}` (line 7) + `utils.uid().ext`; `syncSvc.uploadImgs/uploadImg` (`syncSvc.js:862-896`) later uploads it to the git repo via `uploadWorkspaceContent({file: {type:'img', path}})` (githubAppDataProvider.js:156-180) → real blobs `imgs/2026-07-06/xxx.png` in `kedit-app-data`.
- Explorer shows it because `gitWorkspaceSvc.makeChanges` collects **parent folders of EVERY non-`.stackedit-data` blob** (`gitWorkspaceSvc.js:29-35`) into `treeFolderMap` → folder items are created/committed (`applyChanges`, syncSvc.js:193). But only `.md` blobs become file items (`endsWith(path, '.md')`, line 37-38). **The .png files are not items at all** → `imgs/` and its date subfolders render as normal, empty folder nodes; expanding a date folder shows nothing. That is the observed "non-interactive children".
- The folders themselves are fully interactive regular folders: selectable, renameable, movable, deletable, and they appear in the move-to picker (006.png). Hazards: renaming/moving `imgs` locally breaks nothing remotely at first (folders aren't uploaded for git workspaces — `saveWorkspaceItem` returns syncData only, provider line 48-58), but the blobs still live under `imgs/...`, so the next tree scan **recreates** the folder items — user sees ghost duplication/reversion; markdown links reference `/imgs/...` paths and would break if files ever moved. Special-casing these nodes (lock like trash/temp via `noDrag`/`noDrop` flags, `explorer.js:154-174` pattern) is straightforward in `nodeStructure`.

### (b) The 移动到… picker

- Implementation: `ExplorerNode.vue:349-351` (menu entry `移动到…`, disabled for trash/temp/noDrag) → `openMovePicker(coordinates)` (lines 378-386) opens a SECOND `contextMenu/open` at the same coordinates → `buildMoveTargets()` (lines 387-410):
  - first entry `根目录` (disabled when already at root) → `workspaceSvc.moveItem(sourceId, null)`;
  - then a depth-first `walk` of `explorer/rootNode` folders, skipping `isTrash || isTemp || self`, **NOT skipping imgs** (it's a plain folder) and not skipping descendants-of-self... (it does skip self but children of self are excluded because walk recurses only into pushed folders? No — `walk` returns early for self, so its subtree is skipped too — correct);
  - indentation via full-width-space `'　'.repeat(depth + 1)`; disabled when target == current parent; `perform: () => workspaceSvc.moveItem(sourceId, folder.item.id)` (`workspaceSvc.js:199-208` → `storeItem` with new parentId).
- Positioning/limits: contextMenu clamps into the viewport but has **no max-height/scroll** (store/contextMenu.js:29-49) — long folder trees overflow.
- Modal replacement plug-in points: modal system = `src/store/modal.js` (promise-based `open({type, ...})`, stack) + `src/components/Modal.vue` which maps `config.type` → registered component `${Type}Modal` (lines 183-193) or falls back to `data/simpleModals.js` entries. **No tree-picker modal exists**; nearest structural references: `WorkspaceManagementModal.vue` (list + per-row actions), `FilePropertiesModal.vue` (tabs/forms), all in `src/components/modals/`. A new `MoveToModal` = new component (can render the tree from `explorer/rootNode` getter, reuse `menu-entry` styles), register in Modal.vue's components map, invoke `store.dispatch('modal/open', {type:'moveTo', item})`, resolve with target folder id → `workspaceSvc.moveItem`.

### (c) Node color styling points

- Class binding: `ExplorerNode.vue:2` — `'explorer-node--trash': node.isTrash, 'explorer-node--temp': node.isTemp` (flags set on the synthetic nodes in `explorer.js nodeStructure`, lines 153-168).
- Current colors: `ExplorerNode.vue:652-659`:
  ```scss
  .explorer-node--trash, .explorer-node--temp { color: rgba(0, 0, 0, 0.5); .app--dark & { color: rgba(255, 255, 255, 0.5); } }
  ```
- To color trash red / temp yellow / imgs blue: split the shared rule; for imgs add a flag in `nodeStructure` (e.g. root-level folder named `imgs` → `node.isImgs = true`) + class + rule. Selected/hover states come from `.explorer-node--selected > .explorer-node__item` (lines 602-613) and would sit on top.

### (d) Jump to the kedit-app-data imgs directory on GitHub

- Owner/repo are NOT on the workspace object for the main workspace. Owner = sync token login: `token.name` (`workspace/syncToken` getter → `mainWorkspaceToken`, `workspace.js:63-79`); repo = provider-level constant `appDataRepo = 'kedit-app-data'` (githubAppDataProvider.js:7).
- Existing URL builder: `githubAppDataProvider.getFilePathUrl(path)` (lines 285-291):
  ```js
  return `https://github.com/${token.name}/${appDataRepo}/blob/${appDataBranch}${path}`;
  ```
  Existing usage pattern: `App.vue:72-83` (`viewFileByPath`) — resolves provider from `workspace.providerId` via `providerRegistry.providersById`, calls `getFilePathUrl(absolutePath)`, `window.open(url, '_blank')`. For a DIRECTORY, `getFilePathUrl('/imgs')` yields `/blob/master/imgs`; GitHub redirects blob→tree for directories, but building `/tree/master/imgs` directly (or adding a `getFolderPathUrl`) is cleaner. Gitee equivalent exists (giteeAppDataProvider.js:285-291, `https://gitee.com/...`).

---

## B1 — Scrollbar drag-out aborts (facts for planning)

- **No custom scrollbar component exists.** Only native styling: `src/styles/app.scss:49-76` — `::-webkit-scrollbar` 8px wide, transparent track, thumb `#bbb` (`#666` dark), `min-height: 48px`, radius 4px. Firefox untouched (default). NavigationBar hides its own horizontal bar (NavigationBar.vue:256-260); html.app--touch hides the window bar (app.scss:25-32).
- **Scrollers that matter**:
  - Editor: `.editor` (`src/components/Editor.vue:165-170` — `position: absolute; width/height: 100%; overflow: auto;`), content is `pre.editor__inner`. Parent panel `.layout__panel--editor` chain is `position: relative; overflow: hidden` (`Layout.vue:183-189`) — suitable anchor for an absolutely-positioned overlay scrollbar.
  - Preview: `.preview__inner-1` (`src/components/Preview.vue:3`, has its own `@scroll="onScroll"`), content `.preview__inner-2`. Also listed as a contained scroller in `app.scss:36-42`.
  - Secondary: `.explorer__tree`, `.explorer__search`, `.side-bar__panel` (same app.scss list).
- **Existing hooks to reuse**:
  - `editorSvc.editorElt` = `.editor__inner`, `editorSvc.previewElt` = `.preview__inner-2` (`Layout.vue:146-149` → `editorSvc.init`); the SCROLLERS are `.parentNode` of each — established convention: `editorSvc.js:624-625` attaches `scroll` listeners on both parentNodes (saveContentState); `App.vue:95-108` (touch scroll proxy) resolves the active scroller the same way (`editorSvc.editorElt.parentNode` / `previewElt.parentNode` picked by `styles.showEditor`).
  - Layout resize signal: `layout/updateBodySize` on window resize (`Layout.vue:138-139`); scroll-sync machinery lives in `editorSvc` section descriptions (`sectionUtils`), not needed for a scrollbar overlay.
- No third-party scrollbar/virtualization library exists in the codebase (nothing similar in `package.json` deps beyond editor/markdown libs — no perfect-scrollbar/overlayscrollbars-like package). Any custom overlay must be hand-rolled or a new dependency (planning decision; note the drag-out-abort bug is native-scrollbar behavior on Chromium — pointer leaving the scrollbar track during drag snaps back; an overlay scrollbar with pointer-capture is the standard cure).

---

## Key files

| File | Relevance |
|---|---|
| `src/services/syncSvc.js:569-647, 769-774` | `syncDataItem` generic sync; explorerOrder call site |
| `src/services/gitWorkspaceSvc.js:52-74, 159-185, 231-235` | per-device `utils.uid()` for tree items (M1 root cause); data whitelist regex; deletion pass |
| `src/services/providers/githubAppDataProvider.js` | generic upload/downloadWorkspaceData; `getFilePathUrl`; repo consts |
| `src/services/providers/helpers/githubHelper.js:312-342` | downloadFile 404→`{}` for `.stackedit-data` |
| `src/store/explorer.js:42-61, 261-308` | manual sort lookup; materializeOrder compaction (clobber loop) |
| `src/store/index.js:115-155` | `gitPathsByItemId` / `itemIdsByGitPath` (id↔path translation for the fix) |
| `src/store/workspace.js:45-60` | main workspace is git-like; unique paths enforced |
| `src/components/NavigationBar.vue:11, 24, 128-139, 294-304, 340-372, 412-419` | sync buttons, syncStatus, state CSS, preview hiding |
| `src/store/layout.js:35-48, 138-148` | `hideLocations` computed only in editor mode |
| `src/components/Explorer.vue:23-25, 233-242` | manual-sort toggle + on/off CSS |
| `src/components/ExplorerNode.vue:326-410, 652-659` | context menu, move picker, trash/temp colors |
| `src/components/ContextMenu.vue` | item rendering (no per-item class support) |
| `src/store/contextMenu.js:22-52` | menu positioning/clamping, no scroll |
| `src/services/imageSvc.js`, `src/services/syncSvc.js:862-896` | imgs/ path creation + upload |
| `src/store/modal.js`, `src/components/Modal.vue:183-196`, `src/data/simpleModals.js` | modal system for a MoveTo modal |
| `src/components/Editor.vue:165-170`, `src/components/Preview.vue:3`, `src/styles/app.scss:49-76`, `src/services/editorSvc.js:624-625` | B1 scrollers + hooks |

## Caveats / Not verified

- M1 diagnosis is from code tracing, not a live repro. Cheap confirmations: (1) `.stackedit-data/explorerOrder.json` should exist in the user's `kedit-app-data` repo and its arrays should contain 16-char alphanumeric ids; (2) the ids in that file will not match `gitPathsByItemId` keys on a second device.
- S3 (height diff red vs green): CSS shows no per-state box difference; needs a runtime look (or screenshots of the two states) to name the exact pixel cause; recommendation stands regardless (fixed box, vary color only).
- Whether opening a file (without editing) bumps `file.updatedOn` via an initial `patchCurrent` was not traced through cledit init; the fresh-load RED is fully explained by session-only `lastSyncSuccess` either way.
- MDI path string suggested for the drag icon should be visually verified after paste.
