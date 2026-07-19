/**
 * Manual-sort drag gate (batch-5 #007).
 * Desktop: always drag when sort=manual (move toggle is non-gating).
 * Touch: still requires move-mode (manualSortEnabled).
 */

export function isTouchDevice(win = typeof window !== 'undefined' ? window : null) {
  if (!win) {
    return false;
  }
  return 'ontouchstart' in win;
}

/**
 * @param {{ sortBy: string, manualSortEnabled: boolean, noDrag?: boolean, isTouch?: boolean }} opts
 */
export function isExplorerNodeDraggable({
  sortBy,
  manualSortEnabled,
  noDrag = false,
  isTouch = false,
}) {
  if (noDrag) {
    return false;
  }
  if (sortBy !== 'manual') {
    // Non-manual: allow drag for move-into-folder (legacy behaviour)
    return true;
  }
  // Manual sort: desktop always; touch only with move mode on
  if (!isTouch) {
    return true;
  }
  return !!manualSortEnabled;
}

/** Desktop move toggle is placeholder only — click should not gate drag. */
export function shouldToggleManualSortOnClick(isTouch) {
  return !!isTouch;
}
