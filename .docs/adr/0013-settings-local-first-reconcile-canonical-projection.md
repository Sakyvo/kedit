# Settings reconciliation is local-first three-way; the synced wire text is a canonical projection

Status: accepted (supersedes the conflict half of ADR 0010)

Settings Sync used to build the new local yaml as **remote text + locally
excluded keys re-injected** (ADR 0010), so every key the remote projection did
not carry — every key of a device that had pushed defaults, and everything the
remote side had deleted — silently replaced the local value. The Author's report:
"I changed my config locally, a Sync then reverted it to the remote default."
Local-first now decides conflicts; the projection idea of ADR 0010 stays.

## Decision

- **Reconcile is a local-first three-way over yaml keys.** The template is the
  **local** text (comments and formatting survive); the merge base is a new
  **device-local baseline** — the projection text this device last reconciled as
  synced (`localSettings.settingsProjectionBaseline`, alongside `gitTombstones`,
  the W4 precedent). Per key, recursively for mappings:
  - local value ≠ baseline → the local edit wins (kept, and re-uploaded);
  - local value = baseline → the remote value applies (a key the remote dropped
    is deleted);
  - **no baseline at all** (first sync after this lands, or after a cache clear)
    → local-first in full: the local value wins and the remote only fills in keys
    the device does not carry at all (a fresh device still pulls everything);
  - an excluded key (`syncExclude`, ADR 0010) is local by construction and is
    never read from or written to the remote side.
- **The wire text is canonical.** `settingsYamlSvc.projectForSync` dumps the
  parsed object minus excluded top-level keys, `sortKeys` and `lineWidth: -1`.
  Two devices holding the same values therefore produce byte-identical text, so
  hash comparisons (dirty check, server comparison, upload) can never disagree
  over yaml formatting — which the previous line-surgery projection could, and a
  three-way reconcile would then have ping-ponged indefinitely. The wire file is
  canonical text, not a copy of the Author's file; nothing parses it back as
  line surgery. An unparseable local yaml is never rewritten (the raw text
  passes through, keeping the one no-op upload cycle ADR 0010 accepted).

## Consequences

- **No baseline = local-first too.** On the first sync after this change lands (or
  after a cache clear) the device has no baseline record, and the local text is
  its only evidence of its own pre-sync state: the local value wins, the remote
  projection only fills in keys the device does not carry at all. A fresh device
  (empty text) therefore still pulls the whole remote config, and the adopted
  values become the baseline for the next round. The cost: after a cache clear
  the device can no longer tell that a remote change happened while it was
  offline, so its own value wins that one round.
- Cross-device propagation survives: a key edited on A and pushed, then changed
  on B while A is offline, comes back as a conflict A wins (A's value re-uploads)
  — last writer is no longer silently authoritative.
- Changing the exclude set per device needs a re-baseline (delete
  `localSettings.settingsProjectionBaseline`) or the newly excluded keys look
  edited and re-upload once.
- Verified by `test/unit/harness/settingsSync.harness.mjs` (device round model
  over the real service): remote default can no longer discard a local edit
  (with and without a baseline), fresh device still pulls, concurrent edits to
  different keys both survive, remote deletions and remote multi-line changes
  still land, excluded keys stay local, rounds converge.