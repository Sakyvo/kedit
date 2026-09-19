/**
 * Pure helpers for the marked copy/paste contract (ADR 0007).
 * No store/DOM imports — node-testable via test/unit/harness/clipboardCopy.harness.mjs.
 *
 * Contract: a self copy writes text/html prefixed with
 * `<!--kedit:copy:<base64(markdown)>-->`; pasting back into KEDIT detects the
 * marker and restores the original markdown instead of re-uploading images.
 */

const MARKER_RE = /<!--kedit:copy:([A-Za-z0-9+/=]+)-->/;
const IMG_REF_RE = /!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)/g;
const FENCE_RE = /^(```|~~~)/;

const encodeBase64 = (str) => {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
};

const decodeBase64 = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
};

const escapeHtml = str => `${str}`
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const isLocalUri = uri => /^\/imgs\//.test(uri);

/** Marker comment carrying the original markdown, base64 so `-->` can never break it. */
export function encodeMarkerPayload(markdown) {
  return `<!--kedit:copy:${encodeBase64(markdown)}-->`;
}

/** Original markdown from a marked html, or null when the html is not a self copy. */
export function decodeMarkedHtml(html) {
  const match = MARKER_RE.exec(`${html || ''}`);
  if (!match) {
    return null;
  }
  try {
    return decodeBase64(match[1]);
  } catch (e) {
    return null;
  }
}

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
 * {alt, uri} when the trimmed selection is exactly one workspace-local image
 * reference — the shape that gets an image-only clipboard (ADR 0007).
 */
export function singleLocalImageRef(text) {
  const trimmed = `${text}`.trim();
  const match = /^!\[([^\]]*)\]\(\s*([^)\s]+)\s*\)$/.exec(trimmed);
  if (!match || !isLocalUri(match[2])) {
    return null;
  }
  return { alt: match[1], uri: match[2] };
}

/**
 * Marked html projection of a selection: text escaped with <br> newlines,
 * local images inlined as data URLs (original bytes), remote images kept as-is.
 * dataUrlByUri: {uri: dataUrl}; a local uri without an entry keeps its path src.
 */
export function buildCopyHtml(text, dataUrlByUri = {}) {
  const spans = listImgRefSpans(text);
  let html = encodeMarkerPayload(text);
  let cursor = 0;
  spans.forEach((span) => {
    html += escapeHtml(text.slice(cursor, span.start)).replace(/\n/g, '<br>');
    const src = span.local ? (dataUrlByUri[span.uri] || span.uri) : span.uri;
    html += `<img src="${escapeHtml(src)}" alt="${escapeHtml(span.alt)}"`
      + ` data-kedit-uri="${encodeURIComponent(span.uri)}">`;
    cursor = span.end;
  });
  html += escapeHtml(text.slice(cursor)).replace(/\n/g, '<br>');
  return html;
}

/**
 * Pick the data URL to recover an unresolvable ref from: exact uri match
 * first, then the index-th uri-less entry (order fallback).
 */
export function pickRecoveryDataUrl(dataUrls, uri, index) {
  const byUri = dataUrls.find(item => item.uri === uri);
  if (byUri) {
    return byUri;
  }
  return dataUrls.filter(item => item.uri == null)[index] || null;
}

/**
 * Ordered data URLs from a marked html, for cross-workspace recovery.
 * Returns [{dataUrl, uri|null}] — uri from the data-kedit-uri attr when present.
 */
export function extractDataUrls(html) {
  const urls = [];
  const imgRe = /<img\b[^>]*>/g;
  let match = imgRe.exec(`${html || ''}`);
  while (match) {
    const tag = match[0];
    const srcMatch = /\bsrc="(data:[^"]+)"/.exec(tag);
    if (srcMatch) {
      const uriMatch = /\bdata-kedit-uri="([^"]*)"/.exec(tag);
      let uri = null;
      if (uriMatch) {
        try {
          uri = decodeURIComponent(uriMatch[1]);
        } catch (e) {
          uri = null;
        }
      }
      urls.push({ dataUrl: srcMatch[1], uri });
    }
    match = imgRe.exec(html);
  }
  return urls;
}
