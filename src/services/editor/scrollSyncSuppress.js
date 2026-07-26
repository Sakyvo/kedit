/**
 * scrollSync suppressor for TOC jumps (batch-6 #013).
 * Opens a short window during which scrollSync treats its own catch-up scroll
 * events as self-induced and skips them, so the TOC jump lands instantly on
 * both panes without animation.
 */
const DEFAULT_DURATION = 200;

export function createScrollSyncSuppressor() {
  let until = 0;
  return {
    suppress(duration = DEFAULT_DURATION) {
      until = Date.now() + duration;
    },
    isSuppressed() {
      return Date.now() < until;
    },
  };
}

export default createScrollSyncSuppressor;
