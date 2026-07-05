# GitHub private repo as single source of truth; tuned interval auto-sync (no realtime backend)

KEDIT keeps the Author's **GitHub private repository as the single source of truth** for Documents and reuses StackEdit's interval auto-sync and 3-way merge. There is **no** realtime / CRDT backend. The only change over StackEdit is a **shorter sync interval** plus a guaranteed sync-on-open — the Author asked for "slightly more frequent than StackEdit," not true real-time.

## Context

Sync is a hard requirement, but the realistic usage is **one Author across devices used at different times**, not concurrent multi-device editing. A realtime backend (WebSocket/CRDT, Firebase/Supabase) would buy sub-second propagation and conflict-free concurrent editing, but adds a server, cost, and a **second source of truth** that collides with the "mounted on a GitHub private repo" model — overkill for one person. StackEdit already auto-syncs on an interval (~60s default) with built-in 3-way merge.

## Consequences

- **Sync is interval auto-sync** (as upstream): a 1s readiness probe fires a sync only when the user is active, this window holds the multi-window lock, and `autoSyncEvery` (floor 60s) has elapsed — plus sync-on-open and the manual button. (An event-driven regime was proposed in the 2026-06-04 revision and withdrawn on 2026-07-05 — see Revisions.)
- **Conflicts resolve via StackEdit's 3-way merge** (`diffUtils.mergeText`/`mergeContent`), as upstream. (Last-write-wins was proposed and withdrawn — see Revisions.) Safety net = the private repo's git history + the in-app revision History UI.
- Documents are kept as pure `.md` (StackEdit discussions/comments disabled) so the private repo stays portable.

## Revision — 2026-06-04

Superseded this ADR's original "reuses StackEdit's interval auto-sync and **3-way merge**" stance, from the editor-grilling session:

- **3-way merge → last-write-wins.** Recovery via git history + the kept revision History UI. Author chose simplicity; single-author divergence is rare and recoverable.
- **Interval polling → event-driven sync**: pull on open/focus; ~5s-debounced push + best-effort `visibilitychange`→hidden flush; ~30s heartbeat fallback. `minAutoSyncEvery` (`src/services/syncSvc.js`:22, currently 60s) is lowered accordingly.
- **"No realtime backend" still holds**: propagation is "latest on focus," not instant while a device idles in the foreground.

## Revision — 2026-07-05: the 2026-06-04 revision is withdrawn; upstream merge + interval sync reinstated

Neither part of the 2026-06-04 revision was ever implemented (its follow-up task was never created; `mergeText` and the interval loop remained intact in code). After production use the Author reinstated the original stance:

- **3-way merge stays.** Conflicts merge as in upstream StackEdit; last-write-wins is withdrawn.
- **Interval auto-sync stays as shipped** (user-activity-gated, 60s floor). The event-driven regime is no longer planned; changing it again requires a new ADR.
- "No realtime backend" continues to hold.
