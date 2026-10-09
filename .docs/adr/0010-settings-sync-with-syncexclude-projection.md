# Settings sync with per-device syncExclude projection

Status: accepted (the conflict-resolution half is superseded by ADR 0013)

`data/settings` joins workspace sync (`syncDataItem('settings')`, previously
commented out in `syncSvc.js`), but through a **yaml-text projection layer**,
not as a raw blob:

- Each device declares exclusions via a `syncExclude: [colorTheme, ...]` key in
  its custom settings yaml; the key itself never syncs. Built-in defaults:
  `colorTheme`, `fontSizeFactor`, `maxWidthFactor`.
- Upload strips excluded keys (line surgery) before writing `.stackedit-data/
  settings.json`; download applies the remote yaml but re-injects the local
  values of locally-excluded keys. If the two sides disagree about whether a key
  syncs, it does not sync.

Why the projection instead of plain syncDataItem: settings `data` is a yaml
**string**, and blob conflicts fell back to server-wins (the
`diffUtils.mergeObjects` branch needs an object). Key-level exclusion therefore
cannot live inside the existing merge — it must happen as text projection. The
server-wins fallback itself is superseded by ADR 0013 (local-first three-way
reconcile against a per-device baseline), which also replaced the raw text
projection with a canonical one.

Rejected: migrating excluded keys to `localSettings` (schema churn, and keys stay
per-user-adjustable under one yaml); editing buttons/theme per device without
exclusions (full-sync clobbers per-device preferences).

Consequence (accepted, documented): editing only an excluded key (e.g. switching
theme) still marks the item dirty and triggers one no-op upload cycle; v1 has no
projection-level hash optimisation.
