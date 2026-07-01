# Rebrand the UI to KEDIT; preserve StackEdit-era data-contract identifiers

KEDIT renames all *user-visible* StackEdit branding to "KEDIT", but deliberately **keeps the StackEdit-era persisted identifiers** — the `.stackedit-data/` and `.stackedit-trash/` repo folders, the `stackedit-app-data` repo name, and the `resetStackEdit` localStorage key — unchanged, to preserve continuity with the Author's existing synced data.

## Context

"stackedit" appears ~155× across ~53 files in the fork. They split into three tiers:

- **Visible branding** — tooltips (`NavigationBar.vue`), welcome / FAQ / Tour / About text, export-template footers, `defaultSettings.yml` commit messages, and the logo icon/asset plus its internal id/CSS (`icons/Provider.vue`, `iconStackedit.svg`, `.icon-provider--stackedit`). Cosmetic; safe to rename.
- **Data-contract identifiers** that name where the Author's data already lives: `.stackedit-data/` (settings/workspaces/templates — `gitWorkspaceSvc.js`, `store/index.js`, `githubHelper.js`), `.stackedit-trash/` (trash), the `stackedit-app-data` GitHub repo (`githubHelper.js`), and the `resetStackEdit` key (`localDbSvc.js`).
- **Apache-2.0 NOTICE/attribution** to upstream StackEdit — a license obligation, retained regardless (ADR-0001).

Renaming the data-contract identifiers would orphan the Author's existing private-repo data and demand a one-time migration (move folders, regenerate the app-data repo) — risk with no user-visible benefit, since these are hidden dotfolders / internal repo names a single Author never sees.

## Decision

- **Rename only the visible-branding tier** to KEDIT. The logo icon id/CSS/asset rename is internal-consistent and not persisted, so it is included here.
- **Preserve the data-contract identifiers** verbatim: `.stackedit-data/`, `.stackedit-trash/`, `stackedit-app-data`, `resetStackEdit`. KEDIT keeps reading/writing them as-is.
- **Keep the Apache-2.0 NOTICE/attribution** to StackEdit (license requirement), separate from product branding.

## Consequences

- Zero data-migration risk; existing Sync/storage keeps working untouched (honors ADR-0002's single-source-of-truth model).
- Trade-off: the codebase and the private repo still carry `stackedit` internally. Intentional and invisible to Author/Visitor.
- **Guard:** any future clean-rebrand of the persisted identifiers must ship with an explicit data migration and return as a new ADR — never a blind rename.

## Addendum — 2026-07 (from rebrand implementation, task 06-06-rebrand-kedit)

Implementing the rebrand surfaced two more data-contract identifiers, preserved under the same decision and more load-bearing than the originals:

- `stackedit-db` — the IndexedDB database name (`src/services/utils.js`). Renaming it orphans **all** of the Author's local data; the single most destructive identifier to touch.
- `<!--stackedit_data:…-->` — the embedded sync-data marker appended to synced content (`src/services/providers/common/Provider.js`). A parsed data format; renaming breaks ingestion of already-synced Documents.

No decision change — this **extends**, not alters, the preserve list above. The same Guard applies: renaming either requires an explicit data migration and a new ADR.
