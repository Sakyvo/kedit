import test from 'node:test';
import assert from 'node:assert/strict';
import { folderPathsText, installFolderPaste } from '../../src/services/editor/folderPaste.js';

class Element extends EventTarget {
  isContentEditable = true;
  isConnected = true;
  ownerDocument = { defaultView: {
    setTimeout: fn => { this.timeout = fn; return 1; },
    clearTimeout: () => { this.timeout = null; },
  } };
}
function fixture() {
  const elt = new Element();
  elt.ownerDocument.activeElement = elt;
  const hooks = new Map();
  let documentId = 'one';
  let watcher;
  let text = 'hello world\n';
  const notifications = [];
  const edits = [];
  const modes = [];
  const editor = {
    $contentElt: elt,
    on: (name, fn) => hooks.set(name, fn),
    off: name => hooks.delete(name),
    getContent: () => text,
    selectionMgr: { selectionStart: 6, selectionEnd: 11, saveSelectionState() {} },
    undoMgr: { setCurrentMode: mode => modes.push(mode) },
    replace: (start, end, replacement) => {
      edits.push({ start, end, replacement });
      text = text.slice(0, start) + replacement + text.slice(end);
    },
    adjustCursorPosition() {},
  };
  const dispose = installFolderPaste(editor, {
    getDocumentId: () => documentId,
    watchDocument: fn => { watcher = fn; return () => { watcher = null; }; },
    notify: message => notifications.push(message),
  });
  const dispatch = (type, detail) => {
    const event = new Event(type, { cancelable: true });
    event.detail = detail;
    elt.dispatchEvent(event);
    return event.defaultPrevented;
  };
  return {
    elt, editor, edits, modes, notifications, dispose, hooks,
    begin: (id = 'request-1') => dispatch('kedit-folder-paste-begin', id),
    reply: (reply = {}) => dispatch('kedit-folder-paste-end', JSON.stringify({
      version: 1, requestId: 'request-1', status: 'ok', paths: ['C:\\资料\\one'], ...reply,
    })),
    document: id => { documentId = id; watcher?.(); },
    change: () => { text += 'x'; hooks.get('contentChanged')?.(); },
  };
}

test('formats full Windows/UNC paths without quotes or escaping', () => {
  assert.equal(folderPathsText(['C:\\资料\\a b', '\\\\server\\share\\目录']), 'C:\\资料\\a b\n\\\\server\\share\\目录');
  assert.equal(folderPathsText(['D:\\']), 'D:\\');
  for (const paths of [null, [], ['relative'], ['"C:\\one"'], ['C:\\a\nb'], ['C:\\a', 2], ['\\fake'], ['C:\\a*'], Array(257).fill('C:\\a'), ['C:\\' + 'a'.repeat(32767)]]) {
    assert.equal(folderPathsText(paths), null);
  }
});

test('replaces the saved selection once with one undo group', () => {
  const f = fixture();
  assert.equal(f.begin(), true);
  f.reply();
  f.reply();
  assert.deepEqual(f.edits, [{ start: 6, end: 11, replacement: 'C:\\资料\\one' }]);
  assert.deepEqual(f.modes, ['single']);
  assert.deepEqual(f.notifications, []);
});

test('ignores replies without a matching live transaction', () => {
  const f = fixture();
  f.reply();
  f.begin();
  f.reply({ requestId: 'wrong' });
  f.reply({ version: 2 });
  assert.equal(f.edits.length, 0);
  f.reply();
  assert.equal(f.edits.length, 1);
});

for (const action of ['keydown', 'input', 'pointerdown', 'blur', 'edit', 'switch', 'selection', 'detach', 'readonly', 'destroy']) {
  test(`stale paste is discarded after ${action}`, () => {
    const f = fixture();
    f.begin();
    if (action === 'edit') f.change();
    else if (action === 'switch') { f.document('two'); f.document('one'); }
    else if (action === 'selection') f.editor.selectionMgr.selectionStart = 0;
    else if (action === 'detach') f.elt.isConnected = false;
    else if (action === 'readonly') f.elt.isContentEditable = false;
    else if (action === 'destroy') f.hooks.get('destroy')();
    else f.elt.dispatchEvent(new Event(action));
    f.reply();
    assert.equal(f.edits.length, 0);
  });
}

test('new paste supersedes the previous paste', () => {
  const f = fixture();
  f.begin(); f.begin('request-2'); f.reply();
  assert.equal(f.edits.length, 0);
  f.reply({ requestId: 'request-2' });
  assert.equal(f.edits.length, 1);
});

test('timeout/failure/invalid paths inform author without modifying document', () => {
  for (const status of ['unavailable', 'busy', 'changed', 'ok']) {
    const f = fixture(); f.begin(); f.reply({ status, paths: ['bad'] });
    assert.equal(f.edits.length, 0);
    assert.equal(f.notifications.length, 1);
  }
  const f = fixture(); f.begin(); f.elt.timeout(); f.reply();
  assert.equal(f.edits.length, 0);
  assert.equal(f.notifications.length, 1);
});

test('empty clipboard and non-folder selection leave the document untouched', () => {
  for (const status of ['empty', 'not-folders']) {
    const f = fixture(); f.begin(); f.reply({ status });
    assert.equal(f.edits.length, 0);
    assert.equal(f.notifications.length, 0);
  }
});

test('column selection is rejected explicitly; disposal removes listeners', () => {
  const f = fixture();
  f.editor.selectionMgr.columnSelectionLocked = true;
  assert.equal(f.begin(), true);
  f.reply();
  assert.equal(f.notifications.length, 1);
  assert.equal(f.edits.length, 0);
  f.dispose();
  assert.equal(f.begin(), false);
});
