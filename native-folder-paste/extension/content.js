(() => {
  // Lets the user verify injection from DevTools: document.documentElement.dataset.keditFolderPaste
  document.documentElement.dataset.keditFolderPaste = '1';
  const insertPlainText = (editor, text) => {
    editor.focus();
    // execCommand keeps the editor's own input pipeline (beforeinput/input) alive,
    // so cledit's model stays in sync.
    return document.execCommand('insertText', false, text);
  };
  window.addEventListener('paste', async (event) => {
    if (!event.isTrusted || window !== window.top) return;
    const editor = event.target.closest?.('.editor__inner[contenteditable="true"]');
    if (!editor || document.activeElement !== editor) return;
    const clip = event.clipboardData;
    if (!clip) return;
    const items = Array.from(clip.items || []);
    const files = Array.from(clip.files || []);
    // Images keep KEDIT's existing upload pipeline.
    if (items.some(item => item.type.startsWith('image/'))
      || files.some(file => file.type.startsWith('image/'))) return;
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
    let reply;
    try {
      reply = await chrome.runtime.sendMessage({
        version: 1, action: 'readFolders', requestId,
        names: files.map(file => file.name),
      });
    } catch {
      reply = { version: 1, requestId, status: 'unavailable' };
    }
    if (pageHandlesFolders) {
      editor.dispatchEvent(new CustomEvent('kedit-folder-paste-end', {
        detail: JSON.stringify(reply),
      }));
      return;
    }
    // The page bundle predates the folder handshake (for example a stale PWA
    // cache), so fall back to inserting the paths here.
    if (reply?.status === 'ok' && Array.isArray(reply.paths) && reply.paths.length) {
      insertPlainText(editor, reply.paths.join('\n'));
    }
  }, true);
})();
