# Research: Batch-4 data-safety flows (W3 same-name / W4 rename resurrection / W5 unreferenced images)

- **Query**: W3 same-name collision behavior; W4 rename→sync resurrection root cause + tombstone feasibility; W5 image inventory/reference-scan/deletion/tracking/menu integration
- **Scope**: internal (Vue 3.5 + Vuex 4 StackEdit fork, githubAppData git workspace)
- **Date**: 2026-07-12

---

## Shared data model (needed by all three items)

| Concept | Where | Notes |
|---|---|---|
| `pathsByItemId` | `src/store/index.js:83-105` | Walks `explorer/rootNode`; folders get trailing `/`; trash node forces `.stackedit-trash/` prefix (index.js:89-90) |
| `itemsByPath` | `src/store/index.js:106-114` | path → **array** of items (duplicates possible transiently) |
| `gitPathsByItemId` | `src/store/index.js:115-148` | file → `{path}.md`; content → `/{path}.md` (leading slash, index.js:123); folder → `path/`; data → `.stackedit-data/{id}.json` |
| `itemIdsByGitPath` / `itemsByGitPath` | `src/store/index.js:149-165` | Plain map — if two items ever produced the same git path, **last writer wins** silently |
| `syncDataById` | `src/store/data.js:206` | Per-device data item in IDB (id `syncData`); for git workspaces **keyed by git path** (file `A.md`, content `/A.md`) |
| `syncDataByItemId` | `src/store/data.js:207-222` | git: itemId → `syncDataById[gitPath]` |
| Item hash | `src/services/utils.js:146-160` | `getItemHash` excludes `id`/`hash`/`history` but **includes `createdOn`/`updatedOn`** (file items carry both: `src/data/empties/emptyFile.js`; folders don't: `emptyFolder.js`). `moduleTemplate.setItem/patchItem` always recompute (`src/store/moduleTemplate.js:17-33`) |
| `currentWorkspaceHasUniquePaths` | `src/store/workspace.js:53-60` | TRUE for `githubAppData` (main workspace) — all uniqueness machinery is active |
| Sync cycle order | `src/services/syncSvc.js:654-843` | `getChanges` (tree scan) → `applyChanges` → save-item loop → **remove-item loop** → data items (`workspaces`, `explorerOrder`, main only, :770-776) → per-file content sync → `uploadImgs` after workspace sync (:939-948) |

---

## 1. W3 — Same-name files

### Uniqueness helpers (the only ones in the codebase)

- **`workspaceSvc.makePathUnique(id)`** — `src/services/workspaceSvc.js:351-379`. If `itemsByPath[path].length > 1`, renames the item to `{name}.{suffix}` (`A` → `A.1`, `A.2`, …; folders handled by stripping trailing slash). Suffix style is **`.N`**, not ` (1)`. There is no other `makeUniqueName` anywhere (grep confirms).
- **`workspaceSvc.ensureUniquePaths(idsToKeep)`** — `workspaceSvc.js:336-345`. Loops `makePathUnique` over ALL items until stable. Called from `sanitizeWorkspace` (:305-311), which runs after every remote `applyChanges` (`syncSvc.js:203`) and after cross-tab IDB reads (`localDbSvc.js:137-141`). `idsToKeep` = remote-changed items, so on conflict **the local item gets suffixed, remote wins its name**.
- **`pathConflict` warning modal** — `src/data/simpleModals.js:45-49` ("已经存在。您要添加后缀吗？", 取消/确认添加).

### (a) Create file with existing sibling name

`workspaceSvc.createFile` (`workspaceSvc.js:12-74`):
1. `utils.sanitizeFilename` (utils.js:101-106; strips `/`, control chars).
2. Non-background: if `itemsByPath[parentPath + name]` exists → opens `pathConflict` modal (:49-59). Cancel rejects → exception → caller catches → **file not created** (`ExplorerNode.vue submitNewChild:140-156` catches as cancel).
3. Confirm → commits content+file, then `makePathUnique(id)` (:65-67) → stored as `A.1`.

Result: **no overwrite possible via UI create**. `duplicateFile` (workspaceSvc.js:260-275) calls `createFile(..., background=true)` — skips the modal but still runs `makePathUnique` → silent `.1` suffix.

### (b) Rename to existing sibling name

`ExplorerNode.vue submitEdit` (:157-171) → `workspaceSvc.storeItem` (workspaceSvc.js:105-160):
- Same `pathConflict` modal when another item (`id !== own`) holds the path (:126-137). Cancel → rename aborted (caught :167-169).
- Confirm → `setOrPatchItem` (:165-208) → commit → `makePathUnique` (:200-202) → name becomes `B.1`.

### (c) Move into folder containing same-name file

Three entry points, all funnel into `storeItem`/`setOrPatchItem` → same modal + suffix:
- Legacy drop re-parent: `ExplorerNode.vue onDrop` (:187-210) → `storeItem({...item, parentId})`.
- Manual-sort positional drop: `executeManualDrop` (:238-337), cross-parent move at :300-309 — explicitly catches the pathConflict cancel (comment :307).
- 移动到… FolderPicker: `openFolderPicker` (:400-410) → `workspaceSvc.moveItem` (workspaceSvc.js:249-258) → `storeItem`. Note: `moveItem` promise is not awaited at ExplorerNode.vue:407 → cancelling the conflict modal leaves an unhandled rejection (harmless; move aborted).

### Collision consequences if duplicates DID coexist

- **Local Vuex/IDB**: no collision — items keyed by uid, contents by `{fileId}/content`. `itemsByPath` holds arrays, so state is representable.
- **Git path level**: two items → same `A.md` → `itemIdsByGitPath`/`itemsByGitPath` silently keep the later one (index.js:151-163); syncData keyed `A.md`/`/A.md` is a single slot; each `syncFile` would upload its own content to the same blob (`githubAppDataProvider.uploadWorkspaceContent:156-195` path from `gitPathsByItemId[file.id]`, sha from `shaByPath`) → **last-writer-wins → real data loss at remote**.
- In practice this window is closed synchronously: every mutation path (create/rename/move, and `sanitizeWorkspace` after every sync/IDB read) runs `makePathUnique` in the same tick. Residual risk is multi-window/multi-device concurrent creation of the same path before either syncs: both devices believe path is unique; first upload creates blob; second upload with `sha: undefined` → GitHub contents API rejects create-over-existing (422) → sync error, not silent loss; the tree scan then adopts the remote file (path-keyed reuse, `gitWorkspaceSvc.js:52-74`) and `ensureUniquePaths` suffixes the loser locally.

**W3 conclusion**: same-name create/rename/move is already guarded (warn + `.N` suffix). Anything batch-4 adds (e.g., nicer suffix or pre-emptive inline validation) layers on `makePathUnique` + the `pathConflict` modal; there is no overwrite bug here today.

---

## 2. W4 — Rename → auto-sync resurrection (deep dive)

### Reproduction chain (rename A.md → B.md, then sync)

State after local rename (item X): `gitPathsByItemId[X] = 'B.md'`; stale syncData `'A.md'` (type file, hash incl. old timestamps) and `'/A.md'` (type content, sha of remote blob) remain; `itemsByGitPath['A.md']` is now empty.

Next `syncWorkspace()` (`syncSvc.js:654`):

1. **Tree scan first** — `getChanges` (`githubAppDataProvider.js:36-44` → `githubHelper.getTree:174-190`, full recursive tree) → `gitWorkspaceSvc.makeChanges` (`src/services/gitWorkspaceSvc.js:8-238`). Remote still has `A.md`:
   - `getIdFromPath('A.md', true)` (:52-74): `itemIdsByGitPath['A.md']` → undefined (item moved to B.md) → **`utils.uid()` → brand-new item id Y** (:64-66).
   - File change condition (:105-132): candidate `item = addItemHash({id: Y, type:'file', name:'A', parentId, createdOn: existingItem.createdOn || 0, updatedOn: existingItem.updatedOn || 0})` where `existingItem = itemsByGitPath['A.md'] || {}` (:111) → **timestamps 0/0**. Stored `syncDataByPath['A.md'].hash` was computed with the real timestamps → **hash mismatch → re-creation change pushed** (:122-132).
   - Content change usually NOT pushed: `contentSyncData.sha === shaByPath['A.md']` (remote unchanged, :135-136).
   - makeChanges deletion pass (:230-235) does not fire: `idsByPath['A.md']` was registered by `getIdFromPath` (:69-71).
2. **`applyChanges`** (`syncSvc.js:149-205`): change has `item.hash` → `store.commit('file/setItem', Y)` (:193) → **file A resurrected locally** (no content item yet). syncData `'A.md'` hash updated to the 0/0-timestamps hash → the resurrection is *stable* on subsequent scans (hash now matches; no repeated churn).
3. **Save loop** (:680-721): renamed item X is skipped until its content syncs (`item.type === 'file' && !syncDataByItemId[id/content]`, :700-701 — `/B.md` doesn't exist yet).
4. **Remove loop** (:724-768): for git, `getItem = syncData => itemsByGitPath[syncData.id]` (:728-732). `'A.md'` → **item Y now occupies it → not removable**; `'/A.md'` → `getFileItem` finds Y → kept. **This is why remote A.md is never deleted: step 1 re-created an item at the old path before the delete phase of the same sync.**
5. **Content sync** (:778-828): `syncFile(X)` uploads `B.md` (create, `uploadWorkspaceContent` with `sha: shaByPath['B.md']` = undefined → new blob; returns `/B.md` + `B.md` syncData, `githubAppDataProvider.js:156-195`). `syncFile(Y)` sees `Y/content` out of sync (hashMap empty vs `/A.md` syncData, :798-822) → `downloadWorkspaceContent` (provider :89-112) pulls the old A.md blob → **A fully resurrected with old text**.

End state: local A (new id Y) + B (id X); remote `A.md` + `B.md`. Matches the reported symptom exactly.

### Root cause (KEDIT regression, not upstream behavior)

`utils.getItemHash` excludes `id` but **includes `createdOn`/`updatedOn`** (utils.js:146-154). Upstream StackEdit file items had no timestamps, so the tree-scan candidate for a path-with-no-local-item hashed identically to the stored syncData → no change pushed → item stayed absent → the remove loop then deleted the remote blob. KEDIT's tree-scan candidate fills `createdOn/updatedOn` from the (missing) local item as `0/0` (`gitWorkspaceSvc.js:111-119`, introduced in commit `b8547b8f` "feat(doc-panel): add backend file operations") → guaranteed hash mismatch → guaranteed resurrection.

**Scope of the bug is wider than rename**: any local git-path change orphans the old path the same way —
- move between folders (same mechanics),
- move to trash (`.stackedit-trash/A.md` vs stale `A.md` → deleted file reappears at its old location),
- **permanent delete** (`explorerSvc.permanentlyDeleteItem:18-47` → `workspaceSvc.deleteFile:285-300`; stale `.stackedit-trash/A.md` syncData + remote blob → file resurrects in trash; the comment at explorerSvc.js:33-34 assumes the remove loop works, but it is preempted by resurrection),
- folder rename: the folder candidate hashes equal (no timestamps on folders) so the folder itself is not re-created, but each descendant `.md` resurrects with `parentId` pointing at a **never-committed folder uid** → explorer re-parents them to root (`store/explorer.js:194-201`) — files appear scattered at root level.

### Where renames are observable (tombstone write hook)

`workspaceSvc.setOrPatchItem` (`workspaceSvc.js:165-208`) already captures `oldGitPath` before the commit (:191) and compares to the new path in `remapExplorerOrderPaths(oldGitPath, newGitPath)` (:205, batch-3 explorerOrder remap, :216-247 including folder-prefix descendant handling). This is the exact reusable seam: same old/new pair, already ordered AFTER `makePathUnique` so the new path is final. All UI renames/moves/trash-moves flow through it (`storeItem`, `moveItem`, `explorerSvc.deleteItem:85-94`). Two additional hooks needed for full coverage:
- `workspaceSvc.deleteFile` (:285-300) — permanent delete produces an orphaned path without a "new" path.
- NOT `applyChanges`/`localDbSvc.readDbItem` — those commit directly to store (remote/other-tab driven; must not create tombstones).

### Where remote deletions actually execute

- Remove loop picks ONE orphaned syncData per iteration (`syncSvc.js:740-768`) → `provider.removeWorkspaceItem` (`githubAppDataProvider.js:76-88`): only acts if `gitWorkspaceSvc.shaByPath[syncData.id]` is set (populated for every blob during each tree scan, `gitWorkspaceSvc.js:20-25`; content ids `/A.md` have no sha entry → local-only cleanup) → `githubHelper.removeFile` (`githubHelper.js:290-307`, GitHub contents DELETE with path+sha) → syncData entry dropped (`syncSvc.js:764-766`).
- Remote deletions propagate to other devices via the makeChanges deletion pass (:230-235) → `applyChanges` item-less change → local item removed (`syncSvc.js:167-176`).

### Tombstone design feasibility (assessment)

The existing remove loop already implements "delete remote path with no local item" — the ONLY thing missing is stopping the tree scan from resurrecting first. Minimal shape:

1. On path change/delete, record `{oldGitPath, newGitPath?, sha?, timestamp}` (folder renames: record the folder prefix; match descendants by prefix like `remapExplorerOrderPaths` does).
2. In `makeChanges`, for tree paths matching a live tombstone: skip file+content change creation AND skip registering them in the deletion pass exemption — concretely, don't let `getIdFromPath` mint a new uid for them, but DO keep their syncData out of the deletion-pass changes (`:230-235`) so the stale syncData survives until the remove loop handles it. (`shaByPath` is already recorded before any filtering at :25, so `removeFile` has its sha.)
3. Remove loop then fires naturally in the SAME sync; after `removeWorkspaceItem` succeeds, clear the tombstone (hook at `syncSvc.js:760-767`).
4. Expiry/safety: clear tombstone if an item re-occupies the old path locally (re-rename back), and optionally compare recorded sha vs tree sha — mismatch means another device rewrote the path since the rename (conflict: prefer keeping the remote file instead of deleting). Timestamp allows N-day expiry.
5. Storage: `localSettings` is the natural per-device store — a data item in IDB (NOT in `constants.localStorageDataIds`, `src/data/constants.js:17-23`; not synced — the makeChanges data regex only syncs `settings|workspaces|badgeCreations|templates|explorerOrder`, `gitWorkspaceSvc.js:161`). Precedent for patching: `store.dispatch('data/patchLocalSettings', {...})` (`syncSvc.js:663`, `localDbSvc.js:407-413`). Per-device is CORRECT here: only the renaming device holds the delete obligation. Other devices that already resurrected self-heal: their resurrected item's syncData hash matches, they never re-upload it, and once the remote blob disappears their next tree scan emits the deletion change → local copy removed. Residual edge: a user editing the resurrected copy on another device before the deletion lands would re-upload it (document as accepted risk or guard by sha).

Alternative/simpler complement: make the tree-scan candidate hash-compatible again (e.g., when `itemsByGitPath[path]` is missing but `syncDataByPath[path]` exists, skip pushing the file change — restores upstream semantics where "syncData without item" flows to the remove loop). This fixes rename/move/trash/permanent-delete in one spot (`gitWorkspaceSvc.js:105-132`) but loses the sha-conflict guard a tombstone can provide; the "another device edited the old path" case would then delete that edit (upstream behavior). Both approaches can combine: skip-condition for correctness, tombstone list for conflict awareness + UX (queued-deletion visibility).

---

## 3. W5 — Unreferenced image scan & delete

### (a) Inventory — where the complete imgs list lives

- **Image blobs are NOT items and have NO syncData.** `makeChanges` only maps `.md`/`.sync`/`.publish`/`.stackedit-data` blobs (`gitWorkspaceSvc.js:26-44`); everything else contributes only:
  - `gitWorkspaceSvc.shaByPath[path] = sha` for EVERY blob (:25) — **the only complete local list of `imgs/…` git paths + shas**, in-memory, rebuilt on each sync tree scan (reset :12). On demand it can be rebuilt via `workspaceProvider.getChanges()` (`githubAppDataProvider.js:36-44`, `githubHelper.getTree:174-190` — recursive tree, throws on truncation).
  - Parent dirs become REAL folder items + path-keyed syncData (:29-35, :78-102) — that's why `imgs/` shows in the explorer at all; it's rendered as the special placeholder (`store/explorer.js:209-231`, `isImgs/noDrag/noDrop`, subtree hidden `ExplorerNode.vue:10`; click → jump-to-repo `ExplorerNode.vue:412-426` via `provider.getFilePathUrl` `githubAppDataProvider.js:286-292`). When all blobs under a dir are deleted, git drops the dir → next tree scan emits deletion changes for the folder syncData → local folder items auto-clean.
- **Local IDB `imgs` store** (`src/services/localDbSvc.js:10, 52-56, 195-246`): records `{id: MD5(absolutePath), path: '/imgs/…' (leading slash, %20-escaped), content: base64, uploaded: 0|1, sha}` + a `waitUploadImgIds` queue record. Only images viewed/uploaded on THIS device — **not** a complete inventory. No enumerate API exists (only `getImgItem`/`writeImgItem`/`saveImg`); a cursor method would need to be added mirroring `getWorkspaceItems` (`localDbSvc.js:481-500`, which cursors the `objects` store only).
- Rendering pipeline for reference: editor inline images `editorSvc.js:53-160` — `pathUrlMap` (module-private path→blobURL cache with refcounts :53-99), `getImgUrl` (:134-160): local cache via `localDbSvc.getImgItem(MD5(path))`, else download via `syncSvc.syncImg` (`syncSvc.js:845-862` → `provider.downloadFile` `githubAppDataProvider.js:113-126`, base64 via `githubHelper.downloadFile:312-344` git/blobs fallback). Preview/export path: `workspaceImageSvc.getDataUrl` (`src/services/workspaceImageSvc.js:16-27`), used by `PreviewInPageButtons.vue:73-77`, `exportSvc.js:88`.
- Upload pipeline: paste/drop `Editor.vue:83-114` (inserts `![输入图片说明](/imgs/YYYY-MM-DD/{uid}.png)`, %20-escaped) / `ImageModal.vue:47-76` → `imageSvc.updateImg` (`src/services/imageSvc.js:22-42`, path template from `store/img.js` — **user-configurable** via `WorkspaceImgPathModal`, default `/imgs/{YYYY}-{MM}-{DD}`, may contain `{MDNAME}` etc.) → saved to imgs store unuploaded → `syncSvc.uploadImgs` after each workspace sync (`syncSvc.js:864-898`, git path = `item.path.substring(1)` with `%20`→space :880).
  - ⚠ Because the path template is configurable, inventory scans should not hard-code `imgs/`; safest definition of "image blob" = tree blob that is none of `.md`/`.sync`/`.publish`/`.stackedit-data/*` (mirror the makeChanges classifier), or at minimum union of configured `workspaceImagePath` prefixes (`store/img.js:19-21`, localStorage `img/workspaceImgPath`).

### (b) Reference scan — iterating ALL document texts without loading them

- **Ready-made precedent: `workspaceBackupSvc.js` already implements the entire pipeline**:
  - `localUriMatcher` matches both `![…](uri)` and `<img src="…">` (:9); reference-style definitions + usages (:10-11); `collectImageUris(text)` filters remote URIs (:68-89, `isRemoteUri` :13).
  - Per-file relative-path resolution against the file's OWN folder: `getFileDirPath`/`getAbsoluteImagePath` (:22-61) — correct, unlike editor-time resolution which uses the currently selected node (`editorSvc.js:69-72`).
  - Canonicalization to img-store form: `normalizeAbsolutePath` (decodeURIComponent + space→`%20`, :63) and to git-path form: `getWorkspaceRemotePath` (strip leading `/`, `%20`→space, :65-66).
  - Whole-workspace walk without store loading: `getWorkspaceItems(workspaceId)` promise wrapper (:110-115) over `localDbSvc.getWorkspaceItems` (raw IDB cursor over the `objects` store — includes every `content` item with full `.text`, no Vuex pollution; same mechanism as Explorer file search, `Explorer.vue:109-147`).
  - `collectReferencedImages(itemsById)` (:147-166) → deduped `{path, uri, fileId, fileName}` set. **Unreferenced = tree-scan inventory (a) minus this set** (compare in git-path or normalized-absolute form consistently; imgs store uses `/`-prefixed %20-escaped, shaByPath uses unprefixed unescaped).
  - Decision needed: contents of trashed/temp files ARE in the objects store and would count as references (safer default: count them).
- IDB dump completeness caveat: `content` items live in IDB regardless of memory unloading (`localDbSvc.unloadContents:360-373` only evicts from Vuex), so the cursor sees all synced/local docs of the CURRENT workspace db.

### (c) Deletion — remote + local cleanup

- **Remote**: exactly the primitive the trash flow uses — `githubHelper.removeFile({owner, repo: 'kedit-app-data', branch: 'master', path, sha})` (`githubHelper.js:290-307`), as invoked by `removeWorkspaceItem` (`githubAppDataProvider.js:76-88`). For images: path = git path (`imgs/2025-07-10/x.png`), sha from `gitWorkspaceSvc.shaByPath` (or from a fresh `getTree`). There is no batch endpoint in the helper — one commit per file (acceptable; N deletes = N commits, or extend helper with git-data tree/commit API later).
- **Local**: imgs store has NO delete method — add `dbStore.delete(MD5(absolutePath))` on the `imgs` object store (pattern: `writeImgItem` `localDbSvc.js:221-230`); also drop the id from `waitUploadImgIds` if pending (`saveImg` logic :195-211). Blob-URL cache: `pathUrlMap` is module-private to editorSvc with `releaseImgUrl`/`releaseAllImgUrls` (`editorSvc.js:79-99`) — deleting an image not currently rendered needs no action; if rendered, refcounting reclaims on next re-render. `imgsFolderJump`-style confirm and `imgStorageDeletion` modal texts exist as tone precedents (`simpleModals.js:35-44`).
- Cross-device caveat: other devices keep their imgs-store cache entry; `getImgUrl` serves cache-first (`editorSvc.js:141-156`), so a deleted-but-still-referenced image would keep rendering there until cache miss — fine for "unreferenced" deletions, worth a line in the PRD.

### (d) Persistent {imgPath: firstSeenUnreferencedAt} store

Two options, both with precedent:
1. **Synced data item (recommended by prompt, matches explorerOrder)** — one JSON blob `.stackedit-data/<id>.json`. Wiring points to replicate explorerOrder:
   - empty template + getter/actions: `src/store/data.js:33-36, 182-185, 261-270`;
   - tree-scan regex allowlist: `gitWorkspaceSvc.js:159-185` (`/^\.stackedit-data\/(settings|workspaces|badgeCreations|templates|explorerOrder)\.json$/` — add the new id);
   - sync call: `syncSvc.syncWorkspace` (:770-776, main workspace only — the githubAppData workspace IS main) via `syncDataItem` (:569-649; merge = `diffUtils.mergeObjects`, syncSvc.js:601-607; provider upload/download `githubAppDataProvider.js:127-155, 196-224`);
   - persisted automatically in IDB (`data` ∈ `constants.types`, constants.js:7-16).
   Cross-device single tracker avoids double-counting the 3-day clock; any device can execute the delete.
2. **`localSettings`** (per-device, IDB, `patchLocalSettings`) — simpler, no sync-format concerns, but each device tracks independently → a device that never opens the app never deletes, and clocks reset per device. Acceptable only for manual-trigger UX.

Auto-delete cadence hook: piggyback the existing post-sync window in `requestSync` (`syncSvc.js:909-968` — the 7-day trash cleaning pattern `fileHashesToClean` :920-931, executed after `syncWorkspace()` :950-956) — same place a "3-day unreferenced" sweep fits (tree scan fresh, shaByPath populated).

### (e) Menu integration + dialog patterns

- **打印 entry**: `src/components/menus/MainMenu.vue:94-97` (`<menu-entry @click.native="print">`, icon-printer; method :206-208). Insert "图片引用检测" as a sibling `menu-entry` directly below (before the `<hr>` at :98); handler pattern = other entries: `store.dispatch('modal/open', 'imageReferenceCheck')` wrapped in try/catch (:199-233).
- **Modal plumbing**: component modals are looked up by `config.type` → capitalize + `Modal` suffix against `Modal.vue`'s components map (`src/components/Modal.vue:185-198`); falls back to `data/simpleModals.js`. New dialog = new `components/modals/ImageReferenceCheckModal.vue` built with `modalTemplate` (`components/modals/common/modalTemplate.js` — injects ModalInner/FormEntry, `config.resolve/reject`) + import/register in Modal.vue (:105-…).
- **Checkbox list precedent**: `WorkspaceBackupExportModal.vue` (`form-entry__checkbox` label+input pattern, resolve payload). Scrollable management-list precedents: `SyncManagementModal`/`PublishManagementModal`. **No existing modal renders image thumbnails** — closest primitives: `workspaceImageSvc.getDataUrl(path, true)` for data-URL thumbnails (cache-first; falls back to remote download via `syncSvc.syncImg` — for large unreferenced sets prefer lazy/on-scroll loading or placeholder + count), and `ImageLightbox.vue` (Layout-level zoom overlay, `Layout.vue:50`, z-index above modals) for click-to-preview.
- Long-running scan UX precedent: Explorer search's `searching` flag + tips row (`Explorer.vue:42-51`).

---

## Caveats / Not found

- No existing ` (1)`-style rename helper; only `.N` suffix (`makePathUnique`). If batch-4 wants `(1)` style it's a new convention.
- W4 analysis is code-derived (deterministic given the hash definitions); not yet reproduced live in this session. Recommend a quick manual repro (rename + sync, watch network tab) during implementation to confirm the `0/0` timestamp mismatch path before building the fix.
- `getTree` throws on truncated trees (`githubHelper.js:186-188`) — very large repos would break both sync and the image inventory; existing limitation, not introduced by W5.
- Image reference matching in `workspaceBackupSvc` does not resolve HTML `<img>` inside code fences or exotic syntaxes (matcher-based); acceptable for a safety feature that only deletes when NO reference is found anywhere — false "referenced" is safe, false "unreferenced" would need the same matcher bug in every doc.
- `syncImg`/`uploadImgs` treat img-store paths with leading `/` + `%20`; tree paths are unprefixed with real spaces — every W5 comparison must normalize (helpers exist: `workspaceBackupSvc.js:63-66`).
