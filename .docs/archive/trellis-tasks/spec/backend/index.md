# Backend Development Guidelines

KEDIT's backend is a small Python/Flask support layer for built frontend assets,
OAuth token exchange, runtime configuration, and document export helpers. Most
product behavior lives in the Vue/Vuex frontend and provider services under
`src/`.

## Pre-Development Checklist

- Read `CONTEXT.md` before changing behavior that touches Sync, Publish,
  Documents, or image privacy.
- Read relevant ADRs under `docs/adr/` when touching sync, private images,
  preview rendering, or branding/data identifiers.
- For Flask route changes, read `server/app.py` and the specific helper module
  first.
- Do not introduce a database, ORM, queue, or new backend service unless the
  task explicitly asks for an architectural change.
- Keep OAuth secrets server-side; only expose values that already appear in
  `Config.public_values()`.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Flask routes and helper module layout | Filled |
| [Database Guidelines](./database-guidelines.md) | Current no-database backend and browser persistence boundary | Filled |
| [Error Handling](./error-handling.md) | Existing Flask/OAuth/export error patterns | Filled |
| [Logging Guidelines](./logging-guidelines.md) | Python logging configuration and sensitive-data limits | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Backend review and verification expectations | Filled |

## Project Boundaries

- Backend routes should remain thin bridges. Business rules for Documents,
  workspace sync, provider contracts, and local persistence usually belong in
  `src/services/` and Vuex modules.
- KEDIT preserves StackEdit-era persisted identifiers by design:
  `.stackedit-data/`, `.stackedit-trash/`, `stackedit-app-data`, and
  `resetStackEdit`.
- Private images stay private at rest. Backend work must not create a public
  image host or store base64 in Documents.
