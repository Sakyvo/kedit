/**
 * Pure helpers for selection-copy image detection (ADR 0008).
 * No store/DOM imports — node-testable via test/unit/harness/clipboardCopy.harness.mjs.
 *
 * Contract: copy/cut writes text/plain only. A selection that trims to exactly
 * one workspace-local image reference is upgraded to an image-only clipboard
 * by clipboardSvc; pasting that same image back restores the reference text.
 */

const IMG_REF_RE = /!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g;
const FENCE_RE = /^(```|~~~)/;

const isLocalUri = uri => /^\/imgs\//.test(uri);

/**
 * All markdown image refs in selection order, fence-aware (same semantics as
 * pdirPublishUtils.listPrivateImgRefs). Returns [{alt, uri, local, start, end}].
 */
export function listImgRefSpans(text) {
  const spans = [];
  let inFence = false;
  let offset = 0;
  `${text}`.split('\n').forEach((line) => {
    if (FENCE_RE.test(line)) {
      inFence = !inFence;
    } else if (!inFence) {
      IMG_REF_RE.lastIndex = 0;
      let match = IMG_REF_RE.exec(line);
      while (match) {
        spans.push({
          alt: match[1],
          uri: match[2],
          local: isLocalUri(match[2]),
          start: offset + match.index,
          end: offset + match.index + match[0].length,
        });
        match = IMG_REF_RE.exec(line);
      }
    }
    offset += line.length + 1;
  });
  return spans;
}

/**
 * {alt, uri, refText} when the trimmed selection is exactly one
 * workspace-local image reference — the shape that gets an image-only
 * clipboard (ADR 0008). refText is the trimmed selection verbatim.
 */
export function singleLocalImageRef(text) {
  const trimmed = `${text}`.trim();
  const match = /^!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)$/.exec(trimmed);
  if (!match || !isLocalUri(match[2])) {
    return null;
  }
  return { alt: match[1], uri: match[2], refText: trimmed };
}

/**
 * Decide whether a selection copy should additionally carry the np420 bridge
 * payload (custom clipboard format `web application/x-notepad420-paste`).
 * Bridge triggers when the selection contains at least one workspace-local
 * `/imgs/...` reference and is NOT the single-local-image case (that path is
 * owned by upgradeCopiedSelection writing image/png). Returns
 * { shouldBridge, refs: [{alt, uri, refText}] } in occurrence order.
 */
export function bridgeRefsFor(text) {
  if (singleLocalImageRef(text)) {
    return { shouldBridge: false, refs: [] };
  }
  const refs = listImgRefSpans(text)
    .filter(s => s.local)
    .map(s => ({ alt: s.alt, uri: s.uri, refText: text.slice(s.start, s.end) }));
  return { shouldBridge: refs.length > 0, refs };
}

/**
 * Compose the np420 bridge payload. `images`: [{ uri, mime, dataBase64 }],
 * one entry per bridgeRef in occurrence order (duplicated URIs duplicated).
 * `text` must equal the text/plain clipboard content byte-for-byte.
 */
export function buildBridgePayload(text, images) {
  return JSON.stringify({ v: 1, text, images });
}
