/**
 * Layout-change remeasure orchestration (batch #008).
 * Flush the current scroll position into contentState synchronously — before the
 * DOM rewraps — so the post-measure restore lands on the position the user is
 * actually at (a TOC/anchor jump within the 100ms debounce window included),
 * not a stale debounced snapshot.
 */
export function createLayoutRemeasure({
  saveContentState,
  measure,
  requestFrame,
  cancelFrame,
}) {
  let frameId;
  return () => {
    saveContentState();
    cancelFrame(frameId);
    frameId = requestFrame(measure);
  };
}

export default createLayoutRemeasure;
