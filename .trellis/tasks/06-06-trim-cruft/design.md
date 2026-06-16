# Design

## Boundaries

This task removes badge behavior and image-host reachability while keeping
unrelated provider, Sync, and Publish behavior intact. The change is a product
surface cleanup, not a provider-system rewrite.

## Badge Removal Design

- Delete `src/services/badgeSvc.js` and remove all imports/calls.
- Delete `src/data/features.js` unless another non-badge consumer appears during
  implementation.
- Remove badge-derived getters/actions from `src/store/data.js`:
  `badgeCreations`, `badgeTree`, `allBadges`, and `patchBadgeCreations`.
- Remove `badgeCreations` from `constants.localStorageDataIds` so it is no
  longer read from/written to localStorage.
- Remove `syncDataItem('badgeCreations')` from `syncSvc`.
- Keep `gitWorkspaceSvc` tolerant when it sees
  `.stackedit-data/badgeCreations.json`; implementation can either leave the
  parser whitelist entry in place and avoid consumers, or explicitly skip that
  id while preserving non-fatal behavior.
- Remove the Badge menu entry from `MainMenu.vue`.
- Remove `BadgeManagementModal.vue` registration from `Modal.vue`; delete the
  modal file if no longer referenced.
- Rewrite tests that use `specUtils.expectBadge` so they assert the actual
  behavior being tested instead of badge side effects.

## Image Host Dormant Design

- Treat workspace storage as the only supported upload path for KEDIT image
  insertion in this task.
- `imageSvc.updateImg` should not import or call SM.MS/custom/Gitea/GitHub image
  upload helpers.
- `imageSvc.updateImg` should derive a workspace path from the private workspace
  configuration and save image content through `localDbSvc.saveImg`, as the
  current workspace branch does.
- Existing external `img/checkedStorage` localStorage values should be ignored
  or normalized to workspace before upload. This prevents stale selections from
  keeping external hosts reachable.
- `ImageModal.vue` should hide the storage chooser and external image-host add
  paths. The URL field and upload button may remain.
- `AccountManagementModal.vue` should hide SM.MS/custom image-host account
  creation entry points.
- GitHub/Gitea general account entry points should stay available because they
  support non-image-host workflows such as Sync/workspace access.
- External provider/helper code remains in the repository for future tasks, but
  this task removes references from the image insertion workflow.

## Compatibility

- Existing `.stackedit-data/badgeCreations.json` in a synced repo must not crash
  parsing or sync. The app no longer needs to surface, sync, or update it.
- Existing localStorage `badgeCreations` may remain on disk but should be
  ignored by the app after this task.
- Existing localStorage `img/checkedStorage` may remain on disk but should not
  affect upload routing unless it is workspace-compatible.

## Risks

- Badge calls are widespread and easy to miss; implementation must use exact
  search checks before finish.
- Tests currently encode badge behavior as secondary assertions, so removing
  badges will require test rewrites rather than simple deletions.
- `imageSvc.updateImg`, `ImageModal.vue`, and `AccountManagementModal.vue`
  interact with shared account helpers; implementation must distinguish
  image-only SM.MS/custom entries from GitHub/Gitea entries used by non-image
  workflows.

## Rollback

- Badge removal can be rolled back by restoring `badgeSvc`, `features`, data
  store badge getters/actions, and modal/menu registration.
- Image-host dormancy can be rolled back by restoring `imageSvc` branching and
  `ImageModal` chooser UI.
