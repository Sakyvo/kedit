# Directory Structure

> 由 Trellis spec 迁移合并（2026-07-14）。

### Frontend (src/)

### Overview

The frontend is organized by technical layer, following the inherited StackEdit
shape. Components are not grouped into feature folders; feature behavior is
usually split across a Vue component, a Vuex module, and one or more services.

### Directory Layout

```text
src/
  main.js                   Vue app bootstrap, directives, PWA update hook
  components/               Vue single-file components
  components/common/        Shared component helpers
  components/menus/         Menu components
  components/modals/        Modal components and provider modals
  components/gutters/       Editor/preview discussion gutter components
  data/                     Constants, defaults, empty item factories, templates
  extensions/               Markdown-it and render extensions
  icons/                    Vue icon components and generated static SVGs
  libs/                     Legacy/general libraries such as sanitizer
  services/                 App services and editor/provider logic
  services/editor/          Editor engine integrations
  services/optional/        Optional feature registration modules
  services/providers/       Provider implementations and helpers
  store/                    Vuex modules
  styles/                   Global SCSS and theme styling
```

Tests live under `test/unit/specs/`, mirroring components, services, and libs.

### Module Organization

- Put UI in `src/components/`; use subdirectories only when an existing group
  matches (`menus`, `modals`, `gutters`, `common`).
- Put cross-component behavior in `src/services/`.
- Put provider-specific code in `src/services/providers/` and shared provider
  contracts in `src/services/providers/common/`.
- Put reusable store CRUD shape in `src/store/moduleTemplate.js`; new item
  types should follow existing Vuex module patterns.
- Put default/empty persisted shapes in `src/data/defaults/` or
  `src/data/empties/`.
- Put markdown renderer changes under `src/extensions/` or
  `src/services/markdown*` depending on whether the change is parser extension
  or service orchestration.

### Naming Conventions

- Vue components use PascalCase filenames, for example `ExplorerNode.vue`.
- Vuex modules and services use camelCase filenames, for example
  `workspaceImageSvc.js`, `localDbSvc.js`.
- Icon components use PascalCase and are globally registered in
  `src/icons/index.js`.
- Empty factories use `empty<Type>.js`, for example `emptyFile.js`.
- Tests use `<Subject>.spec.js` and live under a matching area in
  `test/unit/specs/`.

### Examples

- `src/components/ExplorerNode.vue`: component plus Vuex/service interaction.
- `src/store/file.js`: Vuex module extending `moduleTemplate`.
- `src/services/workspaceImageSvc.js`: focused service for local image paths and
  data URL projection.
- `src/services/providers/common/Provider.js`: shared provider content
  serialization contract.
- `test/unit/specs/services/imageTypeUtils.spec.js`: focused service utility
  tests.

### Backend (server/)

### Overview

The backend is a flat `server/` package. `server/app.py` owns Flask app
construction, environment-controlled runtime flags, route declarations, and
static file serving. Provider-specific OAuth token exchanges and export helpers
live in sibling modules.

### Directory Layout

```text
server/
  app.py             Flask app, routes, static assets, runtime flags
  conf.py            Config loaded from server/.env.<STACKEDIT_ENV>
  github.py          GitHub OAuth token exchange
  gitee.py           Gitee OAuth token exchange
  gitcode.py         GitCode OAuth token exchange
  gitea.py           Gitea OAuth token exchange
  gitlab.py          GitLab OAuth token exchange
  pdf.py             wkhtmltopdf export helper
  pandoc.py          Pandoc export helper
  requirements.txt   Python runtime dependencies
```

### Module Organization

- Keep route registration in `server/app.py`.
- Keep provider-specific token logic in `server/<provider>.py`; expose one route
  function such as `github_token(args)`.
- Keep heavy export subprocess logic in helper modules (`pdf.py`, `pandoc.py`),
  not inline in `app.py`.
- Keep configuration access through `Config` in `server/conf.py`; do not read
  OAuth secrets directly in route files when a `Config` field already exists.
- The built frontend is served from `dist/` and `dist/static/`; backend code
  should not depend on source files under `src/` at runtime except static
  pass-throughs such as Prism components.

### Naming Conventions

- Python module names are lowercase snake_case.
- Flask route functions use snake_case matching the route purpose:
  `github_token`, `pdf_export`, `static_files`.
- Environment variables are uppercase and read in one place where possible:
  `LISTENING_PORT`, `DEBUG_FLAG`, `LOG_LEVEL`, `HTTP_ACCESS_LOG`.
- Provider modules mirror frontend provider names where practical:
  `github.py`, `gitee.py`, `gitlab.py`, `gitea.py`.

### Examples

- `server/app.py`: central route table and static asset serving.
- `server/github.py`: minimal OAuth token helper with `requests.post`.
- `server/pdf.py`: subprocess-backed export helper with explicit response
  status handling.
- `server/conf.py`: public vs private config split.

### Avoid

- Adding nested backend packages for one-off helpers; the current backend is
  intentionally flat.
- Moving Document, Sync, Publish, or workspace behavior out of frontend
  services without a dedicated architecture task.
- Exposing source-tree paths or development-only assets from production routes.
