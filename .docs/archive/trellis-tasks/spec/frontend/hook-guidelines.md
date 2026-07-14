# Hook Guidelines

## Overview

This project does not use React hooks or Vue Composition API composables as a
primary pattern. Shared stateful logic lives in Vuex modules, services, global
directives, and optional service registration modules.

## Shared Stateful Logic

Use these existing mechanisms before adding a new pattern:

- Vuex modules in `src/store/` for shared app state.
- Services in `src/services/` for side effects and orchestration.
- Provider classes/helpers under `src/services/providers/`.
- Global directives in `src/main.js` for small DOM behaviors such as `v-focus`,
  `v-title`, and `v-clipboard`.
- Optional feature modules in `src/services/optional/` for opt-in editor
  behavior registration.

## Data Fetching

There is no React Query/SWR-style fetch layer. Data comes from:

- Browser IndexedDB/localStorage through `localDbSvc`.
- Provider services for GitHub, Gitee, GitLab, Gitea, GitCode, Google Drive,
  Dropbox, etc.
- Flask support endpoints for OAuth token exchange, `/conf`, and export.

Provider and sync changes should follow `syncSvc.js`, `workspaceSvc.js`, and
`src/services/providers/common/Provider.js` instead of creating hook-like
fetch wrappers.

## Naming Conventions

- Do not create `use*` composables unless a task explicitly moves an area toward
  Composition API.
- Service objects use `*Svc.js` names (`localDbSvc`, `workspaceImageSvc`).
- Provider helpers use `<provider>Helper.js`.

## Common Mistakes

- Adding a composable for logic that already belongs to a Vuex module or
  service.
- Fetching provider data directly from components instead of going through the
  provider/service layer.
- Creating another global event mechanism when Vuex or `mitt`-based existing
  services already cover the case.
