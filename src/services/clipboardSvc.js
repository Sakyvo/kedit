/**
 * Clipboard orchestration for selection copy (ADR 0008).
 *
 * Copy/cut writes text/plain synchronously (cleditCore). This module adds the
 * one exception: a selection that is exactly one workspace-local image
 * reference is upgraded to an image-only clipboard (image/png, no text), so
 * pebrel / chat apps / social textboxes receive the image itself. The copied
 * image's pixel fingerprint is kept in memory; pasting that same image back
 * restores its reference text instead of re-uploading a duplicate file.
 */
import MD5 from 'crypto-js/md5';
import localDbSvc from './localDbSvc';
import workspaceImageSvc from './workspaceImageSvc';
import { getImageMime } from './imageTypeUtils';
import { singleLocalImageRef } from './clipboardCopy';

// In-memory record of the last single-image copy: {refText, fingerprint}.
let lastCopiedImage = null;

const base64ToPngBlob = async (base64, mime) => {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  if (mime === 'image/png') {
    return blob;
  }
  // ClipboardItem image support is png-only; transcode pixel-losslessly.
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

const SAMPLE_COUNT = 64;

const decodePixels = async (blob) => {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
};

/**
 * Cheap pixel fingerprint: dimensions + 64 evenly sampled pixels. Survives
 * lossless re-encode (Chrome re-encodes clipboard PNGs); tolerant of nothing
 * else — a changed image is a different image.
 */
const fingerprint = (imageData) => {
  const { width, height, data } = imageData;
  const total = width * height;
  const stride = Math.max(1, Math.floor(total / SAMPLE_COUNT));
  const samples = [];
  for (let p = 0; p < total; p += stride) {
    const i = p * 4;
    samples.push(data[i], data[i + 1], data[i + 2], data[i + 3]);
  }
  return { width, height, samples };
};

const fingerprintMatches = (a, b) => a.width === b.width && a.height === b.height
  && a.samples.length === b.samples.length
  && a.samples.every((value, i) => value === b.samples[i]);

/**
 * Fire-and-forget upgrade of a copy/cut: when the selection is exactly one
 * workspace-local image reference, overwrite the clipboard with the image
 * itself (image/png, no text/plain). Failure leaves the text/plain fallback.
 */
export async function upgradeCopiedSelection(text) {
  lastCopiedImage = null;
  try {
    if (!text || typeof navigator === 'undefined' || !navigator.clipboard
      || typeof ClipboardItem === 'undefined') {
      return;
    }
    const single = singleLocalImageRef(text);
    if (!single) {
      return;
    }
    const absolutePath = workspaceImageSvc.getAbsolutePath(single.uri);
    const imgItem = await localDbSvc.getImgItem(MD5(absolutePath).toString());
    if (!imgItem || !imgItem.content) {
      return;
    }
    const png = await base64ToPngBlob(imgItem.content, getImageMime(absolutePath));
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
    // Remember what we wrote so a paste of this exact image restores the ref.
    lastCopiedImage = { refText: single.refText, fingerprint: fingerprint(await decodePixels(png)) };
  } catch (e) {
    // Async upgrade is best-effort; the sync text/plain write already stands.
    lastCopiedImage = null;
  }
}

/**
 * If the pasted file is byte-for-byte the image from our own single-image
 * copy (pixel-identical after decode), return the reference text to insert.
 * Otherwise null — caller falls through to the normal upload path.
 */
export async function tryRestoreCopiedImage(file) {
  if (!lastCopiedImage || !file) {
    return null;
  }
  try {
    const pasted = fingerprint(await decodePixels(file));
    return fingerprintMatches(pasted, lastCopiedImage.fingerprint)
      ? lastCopiedImage.refText
      : null;
  } catch (e) {
    return null;
  }
}
