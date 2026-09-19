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
