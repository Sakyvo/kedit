# Trim StackEdit cruft — badges off, image hosts dormant

> **Track: 🟥 BE / Codex** · order 2 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`
> Note: badge call-sites live in `.vue` files; their removal is mechanical and stays in this BE task.

## Goal

Remove the StackEdit badge subsystem and make the external image-host subsystem dormant (default to the bound private workspace), keeping the host code for possible future use.

## Requirements

- **R18 — remove badges**: delete the badge feature (`badgeSvc` + its store/data) and every `badgeSvc.addBadge(...)` call-site. The `.stackedit-data/badgeCreations.json` path parse must stay tolerant (don't break sync if the file is absent).
- **R5 — image hosts dormant**: `imageSvc.updateImg` routes to the `workspace` (private repo) store by default; hide the storage-chooser UI; keep smms/custom/gitea provider code in place but unreachable.

## Code anchors

- Badges: `services/badgeSvc.js`; call-sites incl. `NavigationBar.vue` (:202,:219), `ExplorerNode.vue` (:110,:127,:145,:178), `Explorer.vue` (:139); tolerant parse at `gitWorkspaceSvc.js` (:158 `badgeCreations`).
- Hosts: `services/imageSvc.js` (:24-81 `getCheckedStorage` switch); chooser UI in `modals/ImageModal.vue`; `img/` store (`checkedStorage`).

## Out of Scope

- Deleting the external-host providers (chose dormant, not removal).
- Image storage/naming/Publish projection → `06-03-image-storage-model`.

## Domain & Decisions

- ADRs: `docs/adr/0003-private-image-storage-base64-publish-projection.md` (external hosts rejected → dormant here).
- Related: `06-03-image-storage-model`.

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
