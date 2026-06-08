# GitHub private repo as single source of truth; tuned interval auto-sync (no realtime backend)

KEDIT keeps the Author's **GitHub private repository as the single source of truth** for Documents and reuses StackEdit's interval auto-sync and 3-way merge. There is **no** realtime / CRDT backend. The only change over StackEdit is a **shorter sync interval** plus a guaranteed sync-on-open — the Author asked for "slightly more frequent than StackEdit," not true real-time.

## Context

Sync is a hard requirement, but the realistic usage is **one Author across devices used at different times**, not concurrent multi-device editing. A realtime backend (WebSocket/CRDT, Firebase/Supabase) would buy sub-second propagation and conflict-free concurrent editing, but adds a server, cost, and a **second source of truth** that collides with the "mounted on a GitHub private repo" model — overkill for one person. StackEdit already auto-syncs on an interval (~60s default) with built-in 3-way merge.

## Consequences

- **Sync is event-driven (revised — see Revision below)**: pull on open + on tab focus/visibility-visible; push debounced ~5s after edits settle, force-flushed best-effort on `visibilitychange`→hidden; a ~30s interval is only a fallback heartbeat. No idle-foreground realtime (would need a backend — rejected).
- **Conflicts resolve last-write-wins, not merged (revised)**: StackEdit's 3-way merge (`diffUtils.mergeText`) is dropped; the later push wins wholesale. Safety net = the private repo's git history (each Sync is a commit → overwrites recoverable) + StackEdit's in-app revision History UI (kept). Pull-on-open/focus makes real divergence rare.
- Documents are kept as pure `.md` (StackEdit discussions/comments disabled) so the private repo stays portable.

## Revision — 2026-06-04

Supersedes this ADR's original "reuses StackEdit's interval auto-sync and **3-way merge**" stance, from the editor-grilling session:

- **3-way merge → last-write-wins.** Recovery via git history + the kept revision History UI. Author chose simplicity; single-author divergence is rare and recoverable.
- **Interval polling → event-driven sync**: pull on open/focus; ~5s-debounced push + best-effort `visibilitychange`→hidden flush; ~30s heartbeat fallback. `minAutoSyncEvery` (`src/services/syncSvc.js`:22, currently 60s) is lowered accordingly.
- **"No realtime backend" still holds**: propagation is "latest on focus," not instant while a device idles in the foreground.
