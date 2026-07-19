/**
 * Classify beforeinput events that must go through the editor insert path
 * so newlines survive IME clipboard paste (e.g. Baidu IME click-paste).
 */

const PASTE_INPUT_TYPES = new Set([
  'insertFromPaste',
  'insertFromPasteAsPlainText',
]);

export function shouldInterceptBeforeInput(inputType, data) {
  if (!inputType) {
    return false;
  }
  if (PASTE_INPUT_TYPES.has(inputType)) {
    return true;
  }
  // IME / synthetic paste often arrives as insertText with embedded newlines
  if (inputType === 'insertText' && typeof data === 'string' && data.indexOf('\n') !== -1) {
    return true;
  }
  return false;
}

/**
 * Normalize clipboard-ish payload to plain text with Unix newlines.
 */
export function normalizeInsertText(data) {
  if (data == null) {
    return '';
  }
  return String(data).replace(/\r\n?/g, '\n');
}

/**
 * Decide text to insert from a beforeinput event-like object.
 * Prefer data; if empty and paste-like, caller may still preventDefault.
 */
export function textFromBeforeInput(inputType, data) {
  if (!shouldInterceptBeforeInput(inputType, data)) {
    return null;
  }
  return normalizeInsertText(data);
}
