const BEGIN = 'kedit-folder-paste-begin';
const END = 'kedit-folder-paste-end';
const TIMEOUT = 4000;

export function folderPathsText(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 256) return null;
  if (!paths.every(path => typeof path === 'string' && path.length <= 32767
    && /^(?:[a-z]:\\|\\\\[^\\]+\\[^\\]+)/i.test(path)
    && !/[\x00-\x1f"<>|?*]/.test(path))) return null;
  const text = paths.join('\n');
  return text.length <= 131072 ? text : null;
}

// The extension initiates this handshake only from a trusted paste. Page events
// cannot request native clipboard reads; replies only apply to a live transaction.
export function installFolderPaste(editor, { getDocumentId, watchDocument, notify }) {
  const elt = editor.$contentElt;
  const doc = elt.ownerDocument;
  const win = doc.defaultView;
  let pending;
  let timer;
  const clear = () => {
    pending = null;
    win.clearTimeout(timer);
  };
  const cancel = () => { if (pending) clear(); };
  const begin = (event) => {
    if (event.target !== elt || typeof event.detail !== 'string'
      || !/^[a-z0-9-]{1,80}$/i.test(event.detail) || !elt.isContentEditable) return;
    event.preventDefault();
    clear();
    if (editor.selectionMgr.columnSelectionLocked) {
      notify('请退出列选择后再粘贴文件夹路径');
      return;
    }
    editor.selectionMgr.saveSelectionState();
    pending = {
      id: event.detail,
      documentId: getDocumentId(),
      text: editor.getContent(),
      start: editor.selectionMgr.selectionStart,
      end: editor.selectionMgr.selectionEnd,
    };
    timer = win.setTimeout(() => {
      clear();
      notify('文件夹路径读取超时，请检查本机辅助程序后重试');
    }, TIMEOUT);
  };
  const end = (event) => {
    if (event.target !== elt || typeof event.detail !== 'string' || event.detail.length > 1048576) return;
    let reply;
    try { reply = JSON.parse(event.detail); } catch { return; }
    if (!pending || !reply || reply.version !== 1 || reply.requestId !== pending.id) return;
    const saved = pending;
    clear();
    editor.selectionMgr.saveSelectionState();
    if (!elt.isConnected || !elt.isContentEditable || doc.activeElement !== elt
      || getDocumentId() !== saved.documentId || editor.getContent() !== saved.text
      || editor.selectionMgr.selectionStart !== saved.start
      || editor.selectionMgr.selectionEnd !== saved.end) return;
    if (reply.status === 'empty' || reply.status === 'not-folders') return;
    const text = reply.status === 'ok' ? folderPathsText(reply.paths) : null;
    if (!text) {
      notify('未能读取文件夹路径，请确认已安装 KEDIT 本机辅助程序，然后重新复制文件夹');
      return;
    }
    editor.undoMgr.setCurrentMode('single');
    editor.replace(saved.start, saved.end, text);
    editor.adjustCursorPosition();
  };
  elt.addEventListener(BEGIN, begin);
  elt.addEventListener(END, end);
  elt.addEventListener('input', cancel);
  elt.addEventListener('keydown', cancel);
  elt.addEventListener('pointerdown', cancel);
  elt.addEventListener('blur', cancel);
  editor.on('contentChanged', cancel);
  const stopWatchingDocument = watchDocument(cancel);
  const dispose = () => {
    clear();
    stopWatchingDocument();
    elt.removeEventListener(BEGIN, begin);
    elt.removeEventListener(END, end);
    elt.removeEventListener('input', cancel);
    elt.removeEventListener('keydown', cancel);
    elt.removeEventListener('pointerdown', cancel);
    elt.removeEventListener('blur', cancel);
    editor.off('contentChanged', cancel);
  };
  editor.on('destroy', dispose);
  return dispose;
}
