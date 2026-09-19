/**
 * Clipboard orchestration for the marked copy/paste contract (ADR 0007).
 * Pure string/html logic lives in clipboardCopy.js; this module owns the
 * store/IndexedDB/Clipboard API side effects.
 */
import MD5 from 'crypto-js/md5';
import localDbSvc from './localDbSvc';
import workspaceImageSvc from './workspaceImageSvc';
import imageSvc from './imageSvc';
import utils from './utils';
import { getImageMime } from './imageTypeUtils';
import {
  buildCopyHtml,
  decodeMarkedHtml,
  extractDataUrls,
  listImgRefSpans,
  pickRecoveryDataUrl,
  singleLocalImageRef,
} from './clipboardCopy';

const loadDataUrlByUri = async (uris) => {
  const dataUrlByUri = {};
  await Promise.all(uris.map(async (uri) => {
    const absolutePath = workspaceImageSvc.getAbsolutePath(uri);
    const imgItem = await localDbSvc.getImgItem(MD5(absolutePath).toString());
    if (imgItem && imgItem.content) {
      dataUrlByUri[uri] = `data:${getImageMime(absolutePath)};base64,${imgItem.content}`;
    }
  }));
  return dataUrlByUri;
};

const base64ToPngBlob = async (base64, mime) => {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  if (mime === 'image/png') {
    return blob;
  }
  // ClipboardItem only accepts image/png; transcode pixel-losslessly.
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((resolve, reject) => {
    canvas.toBlob(png => (png ? resolve(png) : reject(new Error('png transcode failed'))), 'image/png');
  });
};

/**
 * Fire-and-forget upgrade of a copy/cut: the copy event already wrote
 * text/plain synchronously; this replaces the clipboard with the full
 * representation set (ADR 0007). Any failure leaves the plain-text fallback.
 */
export async function upgradeCopiedSelection(text) {
  try {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard
      || typeof ClipboardItem === 'undefined') {
      return;
    }
    const localUris = listImgRefSpans(text).filter(span => span.local).map(span => span.uri);
    if (!localUris.length) {
      return;
    }
    const dataUrlByUri = await loadDataUrlByUri([...new Set(localUris)]);
    const html = buildCopyHtml(text, dataUrlByUri);
    const items = { 'text/html': new Blob([html], { type: 'text/html' }) };
    const single = singleLocalImageRef(text);
    if (single && dataUrlByUri[single.uri]) {
      // Image-only clipboard: no text/plain, so pebrel/chat apps take the image.
      const absolutePath = workspaceImageSvc.getAbsolutePath(single.uri);
      const imgItem = await localDbSvc.getImgItem(MD5(absolutePath).toString());
      items['image/png'] = await base64ToPngBlob(imgItem.content, getImageMime(absolutePath));
    } else {
      items['text/plain'] = new Blob([text], { type: 'text/plain' });
    }
    await navigator.clipboard.write([new ClipboardItem(items)]);
  } catch (e) {
    // Async upgrade is best-effort; the sync text/plain write already stands.
  }
}

/**
 * Marked-paste detection for a paste event's DataTransfer.
 * Returns {markdown, dataUrls} or null for foreign content.
 */
export function decodeClipboardPaste(clip) {
  if (!clip) {
    return null;
  }
  let html = '';
  try {
    html = clip.getData('text/html');
  } catch (e) {
    return null;
  }
  const markdown = decodeMarkedHtml(html);
  if (markdown == null) {
    return null;
  }
  return { markdown, dataUrls: extractDataUrls(html) };
}

const dataUrlToBlob = (dataUrl) => {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl);
  if (!match) {
    return null;
  }
  try {
    const bytes = Uint8Array.from(atob(match[2]), c => c.charCodeAt(0));
    return new Blob([bytes], { type: match[1] });
  } catch (e) {
    return null;
  }
};

/**
 * Resolve a marked paste into the markdown to insert. References that resolve
 * in the current workspace are kept untouched (no re-upload); unresolvable ones
 * are recovered from the clipboard's data URLs through the normal updateImg
 * path (ADR 0007). Unrecoverable refs stay as-is — never throws.
 */
export async function resolveMarkedMarkdown(marked) {
  let markdown = marked.markdown;
  const spans = listImgRefSpans(markdown).filter(span => span.local);
  // Reverse order: replacing a ref shifts the offsets of everything after it.
  for (let i = spans.length - 1; i >= 0; i -= 1) {
    const span = spans[i];
    const absolutePath = workspaceImageSvc.getAbsolutePath(span.uri);
    const existing = await localDbSvc.getImgItem(MD5(absolutePath).toString());
    if (existing && existing.content) {
      continue; // resolves locally — keep the reference, store nothing
    }
    const entry = pickRecoveryDataUrl(marked.dataUrls, span.uri, i);
    const blob = entry && dataUrlToBlob(entry.dataUrl);
    if (!blob) {
      continue; // bytes lost too — insert the reference as-is
    }
    try {
      const { url, error } = await imageSvc.updateImg(blob);
      if (error || !url) {
        continue;
      }
      markdown = markdown.slice(0, span.start) + `![${span.alt}](${url})` + markdown.slice(span.end);
    } catch (e) {
      // keep the original reference
    }
  }
  return markdown;
}
