/**
 * Classify beforeinput events that must go through the editor insert path
 * so newlines survive IME clipboard paste (e.g. Baidu IME click-paste).
 *
 * Browser paste often sets data=null and puts the payload on dataTransfer.
 * Only preventDefault when a non-empty insert string is obtained.
 */

const PASTE_INPUT_TYPES = new Set([
  'insertFromPaste',
  'insertFromPasteAsPlainText',
]);

export function isPasteLikeInputType(inputType) {
  return !!inputType && PASTE_INPUT_TYPES.has(inputType);
}

/**
 * Candidate types: paste-like, or insertText that already carries newlines in data.
 * Does not mean we will preventDefault — only after a non-empty string is resolved.
 */
export function shouldInterceptBeforeInput(inputType, data) {
  if (!inputType) {
    return false;
  }
  if (PASTE_INPUT_TYPES.has(inputType)) {
    return true;
  }
  if (inputType === 'insertText' && typeof data === 'string' && data.indexOf('\n') !== -1) {
    return true;
  }
  return false;
}

export function normalizeInsertText(data) {
  if (data == null) {
    return '';
  }
  return String(data).replace(/\r\n?/g, '\n');
}

function textFromDataTransfer(dataTransfer) {
  if (!dataTransfer || typeof dataTransfer.getData !== 'function') {
    return '';
  }
  try {
    return dataTransfer.getData('text/plain')
      || dataTransfer.getData('Text')
      || '';
  } catch (e) {
    return '';
  }
}

/**
 * Resolve plain text to insert from a beforeinput event-like object.
 * @returns {string|null} non-empty normalized text, or null if do not intercept
 */
export function textFromBeforeInput(inputType, data, dataTransfer) {
  if (!shouldInterceptBeforeInput(inputType, data)) {
    return null;
  }
  let raw = '';
  if (typeof data === 'string' && data.length > 0) {
    raw = data;
  } else {
    raw = textFromDataTransfer(dataTransfer);
  }
  const text = normalizeInsertText(raw);
  // Empty: do not claim the event (avoid preventDefault no-op)
  if (!text) {
    return null;
  }
  return text;
}
