(() => {
  window.addEventListener('paste', async (event) => {
    if (!event.isTrusted || window !== window.top) return;
    const editor = event.target.closest?.('.editor__inner[contenteditable="true"]');
    if (!editor || document.activeElement !== editor) return;
    const clip = event.clipboardData;
    if (!clip) return;
    // Text, HTML and images keep the existing KEDIT pipeline and priority.
    if (clip.getData('text/plain') || clip.getData('text/html')
      || Array.from(clip.items || []).some(item => item.type.startsWith('image/'))
      || Array.from(clip.files || []).some(file => file.type.startsWith('image/'))) return;
    const requestId = crypto.randomUUID();
    const begin = new CustomEvent('kedit-folder-paste-begin', {
      detail: requestId, cancelable: true,
    });
    editor.dispatchEvent(begin);
    if (!begin.defaultPrevented) return; // Older KEDIT, or a different editable.
    event.preventDefault();
    event.stopImmediatePropagation();
    let reply;
    try {
      reply = await chrome.runtime.sendMessage({
        version: 1, action: 'readFolders', requestId,
        names: Array.from(clip.files || []).map(file => file.name),
      });
    } catch {
      reply = { version: 1, requestId, status: 'unavailable' };
    }
    editor.dispatchEvent(new CustomEvent('kedit-folder-paste-end', {
      detail: JSON.stringify(reply),
    }));
  }, true);
})();
