# Database Guidelines

## Overview

The Python backend currently has no server-side database, ORM, migrations, or
persistent model layer. KEDIT's durable source of truth is the Author's private
GitHub repository plus browser storage managed by the frontend.

Browser-side persistence is implemented in `src/services/localDbSvc.js` with
IndexedDB object stores:

- `objects` for Document/workspace metadata and content objects.
- `imgs` for private image records.

This is a frontend persistence boundary, not a Flask database.

## Query Patterns

There are no backend SQL queries. Backend code should:

- Read runtime config through `Config`.
- Call external OAuth/export services directly inside provider/export helpers.
- Return data to the frontend without creating hidden server-side state.

For frontend IndexedDB patterns, read `src/services/localDbSvc.js` before
changing persistence behavior. It coordinates read/write transactions, hash
tracking, delete markers, and cross-tab synchronization.

## Migrations

There are no backend migrations. IndexedDB schema changes happen in
`localDbSvc.js` via the `dbVersion` and `onupgradeneeded` path. The current
version creates `objects` and `imgs` stores.

If a task requires a persistence schema change:

- Treat it as cross-layer work.
- Document the old and new browser storage shape.
- Preserve existing Author data.
- Add tests or a manual migration check that exercises old data.

## Naming Conventions

- Persisted StackEdit-era identifiers are intentionally preserved:
  `.stackedit-data/`, `.stackedit-trash/`, `stackedit-app-data`,
  `resetStackEdit`.
- Private image files are conceptually stored under `/imgs/` and must remain
  private until Publish.
- Do not rename persisted identifiers as part of visible KEDIT rebranding.

## Common Mistakes

- Treating the Flask backend as the place for document persistence. Current
  Document state is frontend-managed and synced through provider services.
- Introducing base64 as stored Document data. Base64 is only a transient Publish
  or copy projection.
- Renaming StackEdit data-contract paths during visual rebranding.
