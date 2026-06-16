# Implementation Plan

## Pre-Implementation

- Ensure `task.json` routes this as BE/Codex (`meta.domain: "be"`) before
  execution.
- Re-read:
  - `CONTEXT.md`
  - `docs/adr/0003-private-image-storage-base64-publish-projection.md`
  - `.trellis/spec/frontend/state-management.md`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/quality-guidelines.md`

## Ordered Checklist

1. Badge state and service cleanup
   - Remove `badgeSvc` imports/calls across `src/`.
   - Remove/delete `src/services/badgeSvc.js`.
   - Remove/delete `src/data/features.js` if no consumers remain.
   - Remove badge getters/actions from `src/store/data.js`.
   - Remove `badgeCreations` from `src/data/constants.js`.
   - Remove `syncDataItem('badgeCreations')` from `src/services/syncSvc.js`.

2. Badge UI cleanup
   - Remove Badge entry and computed counters from `MainMenu.vue`.
   - Remove BadgeManagementModal registration from `Modal.vue`.
   - Delete `BadgeManagementModal.vue` if unreferenced.

3. Test cleanup for badges
   - Remove `specUtils.expectBadge` if no consumers remain.
   - Update Explorer/ExplorerNode tests to assert real behavior without badge
     side-effect checks.
   - Search and remove any remaining badge assertions.

4. Image host dormant changes
   - Simplify `imageSvc.updateImg` to workspace/private storage only.
   - Ensure stale external `img/checkedStorage` cannot route uploads externally.
   - Hide ImageModal image-host chooser/add-storage UI.
   - Hide AccountManagementModal SM.MS/custom image-host account entries.
   - Preserve GitHub/Gitea general account entries for non-image-host workflows.
   - Keep URL input and upload behavior usable.

5. Focused tests
   - Add/update image service tests for workspace-only upload.
   - Add/update tests for stale external checked storage ignored/normalized.
   - Update component tests affected by hidden badge/image-host UI.

6. Final checks
   - `rg "badgeSvc|addBadge|badgeTree|allBadges|badgeCreations" src test`
   - `rg "checkedStorage|changeCheckedStorage|getCheckedStorage|smms|custom|tokenRepo" src/services/imageSvc.js src/components/modals/ImageModal.vue src/components/Editor.vue src/store/img.js`
   - `npm run build`
   - Focused Jest command if the test harness is fixed; otherwise record the
     known Jest harness blocker from frontend quality guidelines.
   - `git diff --check`

## Risky Files

- `src/store/data.js`
- `src/services/syncSvc.js`
- `src/services/gitWorkspaceSvc.js`
- `src/services/imageSvc.js`
- `src/components/modals/ImageModal.vue`
- `src/components/modals/AccountManagementModal.vue`
- `src/components/menus/MainMenu.vue`
- `test/unit/specs/specUtils.js`

## Follow-Up Checks Before Start

- Verify no unrelated dirty files in the planned edit set.
- Verify the active Trellis task pointer is switched to `06-06-trim-cruft` only
  when implementation is explicitly approved.
