# Trim StackEdit Cruft

> Parent: `06-06-editor-ux-overhaul`<br>
> Track: BE / Codex<br>
> Owns: R5 external image hosts dormant, R18 badge subsystem removed<br>
> Depends on: `06-04-fork-stackedit`

## Goal

Remove StackEdit-era badge mechanics and make external image hosting unreachable
in normal KEDIT use. Pasted, dropped, and dialog-uploaded images should default
to the Author's private workspace storage, preserving Private-until-Publish from
ADR-0003.

## User Value

- KEDIT stops exposing gamified badge UI and badge notifications that do not
  belong in a focused single-author editor.
- Image insertion no longer nudges the Author toward public or third-party image
  hosts before Publish.
- Existing provider/helper code can remain available for future tasks without
  being reachable from the current product surface.

## Confirmed Facts From Repository Inspection

- Parent task maps `06-06-trim-cruft` to BE/Codex and owns R5/R18.
- `task.json` had a stale `meta.domain: "fe"` despite the parent map and task
  description saying BE/Codex.
- Badge state is currently first-class data:
  - `src/services/badgeSvc.js`
  - `src/data/features.js`
  - `src/data/constants.js` includes `badgeCreations` in `localStorageDataIds`
  - `src/store/data.js` exposes `badgeCreations`, `badgeTree`, `allBadges`,
    and `patchBadgeCreations`
  - `src/services/syncSvc.js` syncs `badgeCreations`
  - `src/services/gitWorkspaceSvc.js` recognizes
    `.stackedit-data/badgeCreations.json`
- Badge UI is reachable from `src/components/menus/MainMenu.vue` and
  `src/components/modals/BadgeManagementModal.vue`, registered by
  `src/components/Modal.vue`.
- Badge side effects are broad: `badgeSvc.addBadge(...)` appears across
  components, menus, modals, services, provider helpers, and tests.
- Current tests use `specUtils.expectBadge`, especially explorer component
  tests.
- Image upload currently branches by `store.getters['img/getCheckedStorage']` in
  `src/services/imageSvc.js`.
- `src/store/img.js` defaults `checkedStorage` to workspace, but
  `src/components/Editor.vue` restores old `img/checkedStorage` from
  `localStorage`, so stale external-host selections remain reachable unless
  explicitly ignored or migrated.
- `src/components/modals/ImageModal.vue` exposes workspace path entries, external
  token entries, token-repo entries, and add-account/add-storage commands for
  SM.MS, custom, Gitea, and GitHub image hosts.
- ADR-0003 rejects external image hosts for KEDIT's private-at-rest model and
  chooses workspace-private files plus transient Publish projection.

## Requirements

### R18: Remove Badge Subsystem

- Remove `badgeSvc` and all `badgeSvc.addBadge(...)` imports/calls.
- Remove badge UI entry from the main menu and unregister/delete the badge
  management modal.
- Remove feature/badge derived state from the data store.
- Stop writing and syncing `badgeCreations`.
- Keep parsing/downloading tolerant for historical `.stackedit-data/badgeCreations.json`
  so existing repos do not break if the file exists or disappears.
- Update tests and shared test helpers so behavior assertions no longer depend
  on badge earning.

### R5: Make External Image Hosts Dormant

- `imageSvc.updateImg(imgFile)` should always use workspace/private storage for
  KEDIT image uploads.
- Existing `img/checkedStorage` values in localStorage must not route uploads to
  SM.MS, custom, Gitea, GitHub, or any other external host.
- Hide the image-storage chooser surface from `ImageModal.vue`; the dialog can
  still provide URL input and upload, but should not present external image-host
  choices.
- Hide SM.MS/custom image-host account entry points in
  `AccountManagementModal.vue`.
- Preserve GitHub/Gitea general account entry points because they still serve
  Sync/workspace workflows outside image hosting.
- Keep external host helper/provider code in place for future tasks, but make it
  unreachable from this workflow.
- Preserve `workspaceImgPath` support only if it still points to private
  workspace storage; do not broaden image storage/naming beyond this task.

## Acceptance Criteria

- `rg "badgeSvc|addBadge|badgeTree|allBadges|badgeCreations" src test`
  returns no live feature references except an explicitly retained tolerant
  parser/migration compatibility point if needed.
- Main menu no longer shows the badge entry.
- Badge management modal is no longer registered or reachable.
- Project tests no longer assert badge earning.
- `imageSvc.updateImg` has no executable external-host upload branch.
- Stale `localStorage["img/checkedStorage"]` cannot make paste/drop/dialog image
  upload use external hosts.
- ImageModal does not expose SM.MS/custom/Gitea/GitHub image-host chooser entries.
- Account Management no longer exposes SM.MS/custom image-host account creation
  entries.
- Account Management still exposes GitHub/Gitea general account entries when
  those entries are used by non-image-host workflows.
- `npm run build` passes.
- Focused unit/component tests are updated or added for:
  - badge-free explorer/menu flows
  - workspace-only `imageSvc.updateImg`
  - stale external `checkedStorage` ignored or normalized

## Out Of Scope

- Deleting provider/helper code for SM.MS, custom, Gitea, GitHub, or general
  account/sync providers.
- Renaming StackEdit data-contract paths such as `.stackedit-data/`.
- Implementing the full image storage naming and Publish projection model from
  `06-03-image-storage-model`.
- Changing Sync or Publish provider contracts unrelated to badges.

## Decisions

- SM.MS/custom image-host account entry points in Account Management are hidden
  as part of making external image hosts dormant.
- GitHub/Gitea general account entry points are preserved because they still
  serve Sync/workspace workflows.
