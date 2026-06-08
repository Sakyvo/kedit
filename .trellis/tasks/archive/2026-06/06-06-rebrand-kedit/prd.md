# Rebrand UI StackEdit → KEDIT

> **Track: 🟦 FE / Claude Code** · order 1 · parent `06-06-editor-ux-overhaul`
> **Depends on:** `06-04-fork-stackedit`

## Goal

Rename all user-visible StackEdit branding to KEDIT, while leaving the StackEdit-era persisted identifiers untouched (ADR-0005).

## Requirements

- **R19 — rename visible branding** to KEDIT: nav tooltips, welcome/FAQ/Tour/About text, export templates, commit-message templates, and the logo icon (id/CSS/asset, internal-consistent rename).
- **R20 — preserve data-contract identifiers** verbatim: `.stackedit-data/`, `.stackedit-trash/`, the `stackedit-app-data` repo, the `resetStackEdit` key. Keep the Apache-2.0 NOTICE/attribution to upstream StackEdit.

## Code anchors

- Rename (visible): `NavigationBar.vue` (:5/:11/:12 tooltips "打开/关闭/切换StackEdit"); `data/welcomeFile.md`, `data/faq.md`, `data/features.js`, `components/Tour.vue`, `modals/AboutModal.vue`; `data/templates/*.html`; `data/defaults/defaultSettings.yml` (:116-118 commit msgs, :125 footer); logo: `icons/Provider.vue` (:37-38 `'stackedit'` id, :56 `.icon-provider--stackedit`) + `assets/iconStackedit.svg` + `.navigation-bar__button--stackedit`.
- **Preserve (do NOT rename):** `gitWorkspaceSvc.js` (`.stackedit-data/`, `.stackedit-trash/`), `store/index.js` (:86,:114), `githubHelper.js` (:9 `stackedit-app-data`, :124,:171,:309), `localDbSvc.js` (:13,:15 `resetStackEdit`).

## Out of Scope

- Any rename of persisted identifiers or data migration (ADR-0005 guard).

## Domain & Decisions

- ADRs: `docs/adr/0005-rebrand-ui-to-kedit-preserve-data-identifiers.md` (this), `docs/adr/0001-fork-stackedit-as-base.md` (Apache NOTICE).
- Terms: `CONTEXT.md` — KEDIT.

*Skeleton — `design.md`/`implement.md` + testable acceptance criteria added at micro-refine.*
