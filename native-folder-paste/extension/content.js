(() => {
  // Lets the user verify injection from DevTools: document.documentElement.dataset.keditFolderPaste
  document.documentElement.dataset.keditFolderPaste = '1';

  // A channel to the service worker marks this page as alive and prewarms the
  // native host. It carries no clipboard data and asks for no read.
  const RETRY_DELAYS = [250, 1000, 4000];
  const STABLE_AFTER = 4000;
  let channel = null;
  let retryTimer = 0;
  let stableTimer = 0;
  let retries = 0;
  const clearTimers = () => {
    clearTimeout(retryTimer);
    clearTimeout(stableTimer);
    retryTimer = 0;
    stableTimer = 0;
  };
  const disconnect = () => {
    clearTimers();
    const current = channel;
    channel = null;
    if (!current) return;
    try { current.disconnect(); } catch { /* already closed */ }
  };
  const schedule = () => {
    if (retryTimer) return;
    const delay = RETRY_DELAYS[Math.min(retries, RETRY_DELAYS.length - 1)];
    retries += 1;
    retryTimer = setTimeout(() => {
      retryTimer = 0;
      connect();
    }, delay);
  };
  const connect = () => {
    if (channel) return;
    let current;
    try {
      current = chrome.runtime.connect({ name: 'kedit-page' });
    } catch {
      schedule();
      return;
    }
    channel = current;
    // Backoff only resets once a channel has proven stable, so a worker that
    // keeps dying cannot be restarted in a tight loop.
    stableTimer = setTimeout(() => { retries = 0; }, STABLE_AFTER);
    current.onDisconnect.addListener(() => {
      void chrome.runtime.lastError;
      if (channel !== current) return;
      channel = null;
      clearTimeout(stableTimer);
      stableTimer = 0;
      schedule();
    });
  };

  const insertPlainText = (editor, text) => {
    // No focus() here: the reply may only be applied to the editor that still
    // owns the caret, never by stealing focus back from somewhere else.
    if (document.activeElement !== editor) return false;
    // execCommand keeps the editor's own input pipeline (beforeinput/input) alive,
    // so cledit's model stays in sync.
    return document.execCommand('insertText', false, text);
  };

  // Same rules as the page bridge, so the stale-bundle fallback cannot insert a
  // path the page would have rejected.
  const PATH_SHAPE = /^(?:[a-z]:\\|\\\\[^\\]+\\[^\\]+)/i;
  const pathsText = paths => {
    if (!Array.isArray(paths) || !paths.length || paths.length > 256) return null;
    if (!paths.every(path => typeof path === 'string' && path.length <= 32767
      && PATH_SHAPE.test(path) && !/[\x00-\x1f"<>|?*]/.test(path))) return null;
    const text = paths.join('\n');
    return text.length <= 131072 ? text : null;
  };

  if (window === window.top) {
    connect();
    window.addEventListener('pagehide', event => {
      if (!event.persisted) disconnect();
      else clearTimers();
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) connect();
    });
  }

  window.addEventListener('paste', async (event) => {
    if (!event.isTrusted || window !== window.top) return;
    const editor = event.target.closest?.('.editor__inner[contenteditable="true"]');
    if (!editor || document.activeElement !== editor) return;
    const clip = event.clipboardData;
    if (!clip) return;
    const items = Array.from(clip.items || []);
    const files = Array.from(clip.files || []);
    const fileEntries = items.filter(item => item.kind === 'file');
    const nonImage = fileEntries.some(item => !item.type.startsWith('image/'))
      || files.some(file => !file.type.startsWith('image/'));
    // A purely image clipboard keeps KEDIT's upload pipeline. As soon as any
    // non-image entry is selected too, the whole selection becomes paths, so a
    // mixed paste never inserts only part of what the author copied.
    const hasImage = fileEntries.some(item => item.type.startsWith('image/'))
      || files.some(file => file.type.startsWith('image/'));
    if (hasImage && !nonImage) return;
    const text = clip.getData('text/plain');
    const html = clip.getData('text/html');
    const types = Array.from(clip.types || []);
    const hasFiles = files.length > 0 || types.includes('Files')
      || items.some(item => item.kind === 'file');
    // Ordinary text/HTML paste has priority unless the clipboard also holds files.
    if (!hasFiles && (text || html)) return;
    const requestId = crypto.randomUUID();
    const begin = new CustomEvent('kedit-folder-paste-begin', {
      detail: requestId, cancelable: true,
    });
    editor.dispatchEvent(begin);
    const pageHandlesFolders = begin.defaultPrevented;
    event.preventDefault();
    event.stopImmediatePropagation();
    // The fallback owns its own transaction: the reply may only land while the
    // same editor still holds the same content and focus.
    const snapshot = pageHandlesFolders ? null : { text: editor.textContent };
    let cancelled = false;
    let cancelWatcher = () => {};
    let deadline = 0;
    if (snapshot) {
      const handler = () => { cancelled = true; };
      const stop = () => {
        ['input', 'keydown', 'pointerdown', 'blur'].forEach(name => {
          editor.removeEventListener(name, handler, true);
        });
        clearTimeout(deadline);
      };
      cancelWatcher = stop;
      ['input', 'keydown', 'pointerdown', 'blur'].forEach(name => {
        editor.addEventListener(name, handler, true);
      });
      deadline = setTimeout(() => { cancelled = true; stop(); }, 4000);
    }
    let reply;
    try {
      reply = await chrome.runtime.sendMessage({
        version: 1, action: 'readFolders', requestId,
        names: (files.length ? files : fileEntries).map(entry => entry.name || ''),
      });
    } catch {
      reply = { version: 1, requestId, status: 'unavailable' };
    }
    cancelWatcher();
    if (pageHandlesFolders) {
      editor.dispatchEvent(new CustomEvent('kedit-folder-paste-end', {
        detail: JSON.stringify(reply),
      }));
      return;
    }
    // The page bundle predates the folder handshake (for example a stale PWA
    // cache), so fall back to inserting the paths here.
    if (cancelled || !editor.isConnected) return;
    if (editor.textContent !== snapshot.text) return;
    if (reply?.status !== 'ok') return;
    const pathsValue = pathsText(reply.paths);
    if (pathsValue) insertPlainText(editor, pathsValue);
  }, true);
})();