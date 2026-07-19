/**
 * Decisions for image-cleanup modal thumbnail loading (batch-5 #006).
 */

export function shouldFetchRemoteThumb({ dataUrl, path, visible, inFlight }) {
  if (!path || dataUrl) {
    return false;
  }
  if (!visible) {
    return false;
  }
  if (inFlight) {
    return false;
  }
  return true;
}

export function markInFlight(set, path) {
  if (!path || !set) {
    return set;
  }
  const next = set instanceof Set ? set : new Set(set);
  next.add(path);
  return next;
}

export function clearInFlight(set, path) {
  if (!set || !path) {
    return set;
  }
  const next = set instanceof Set ? new Set(set) : new Set(set || []);
  next.delete(path);
  return next;
}
