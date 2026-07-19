/**
 * Identity guards for editor inline image size preset / onload (batch-5 #005).
 */

export function shouldApplyNaturalSize({
  mapUri,
  imgUri,
  hasExplicitWidth,
  hasExplicitHeight,
  naturalWidth,
  naturalHeight,
}) {
  if (!mapUri || !imgUri || mapUri !== imgUri) {
    return false;
  }
  if (hasExplicitWidth || hasExplicitHeight) {
    return false;
  }
  if (!naturalWidth || !naturalHeight) {
    return false;
  }
  return true;
}

export function shouldRecordNaturalSize({
  eventSrc,
  imgSrc,
  mapUri,
  imgUri,
  naturalWidth,
  naturalHeight,
}) {
  if (!imgUri) {
    return false;
  }
  if (mapUri != null && mapUri !== imgUri) {
    return false;
  }
  if (eventSrc != null && imgSrc != null && eventSrc !== imgSrc) {
    return false;
  }
  if (!naturalWidth || !naturalHeight) {
    return false;
  }
  return true;
}

/**
 * Dimensions to set on the element: width only (height via CSS auto) preferred
 * when stretch-safe mode is on; still returns both for attribute preset.
 */
export function dimensionsForPreset(natural, { stretchSafe = true } = {}) {
  if (!natural || !natural.width || !natural.height) {
    return null;
  }
  if (stretchSafe) {
    return { width: natural.width, height: null, useHeightAuto: true };
  }
  return { width: natural.width, height: natural.height, useHeightAuto: false };
}
