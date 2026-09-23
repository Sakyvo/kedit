/**
 * Identity guards for editor inline image size preset / onload (batch-5 #005).
 */

/**
 * Parse the author's explicit `=WxH` size token from markdown (the `.cl-size`
 * token text, e.g. `=800x600`, `=800x`, `=x600`). Returns null when the
 * author declared no size.
 *
 * This must be read from the MARKDOWN TEXT, never from `imgElt.width` /
 * `imgElt.height`: those IDL properties report the natural size as soon as a
 * src is assigned, so for a cached workspace-local image (`src` set
 * synchronously from the blob cache) they look like an explicit size and the
 * natural-size preset below gets skipped — leaving `display: none` until the
 * async onload and collapsing the card for one frame (batch #017).
 */
export function parseDeclaredImgSize(sizeText) {
  if (!sizeText) {
    return null;
  }
  const match = sizeText.match(/=(\d*)x(\d*)/);
  if (!match) {
    return null;
  }
  const width = match[1] ? parseInt(match[1], 10) : 0;
  const height = match[2] ? parseInt(match[2], 10) : 0;
  if (!width && !height) {
    return null;
  }
  return { width, height };
}

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
