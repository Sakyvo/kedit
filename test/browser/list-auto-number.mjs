// Run after npm run build. Uses the real production editor in isolated headless Chrome.
import assert from 'node:assert/strict';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, stubPath } from './cdp.mjs';

const server = await startPreview({
  preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} },
  logLevel: 'error',
});

try {
  await withBrowser(async (cdp) => {
    await stubPath(cdp, '/conf', '{}');
    await navigate(cdp, `http://localhost:${server.httpServer.address().port}/`);
    await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".editor__inner")?.isContentEditable', {
      timeout: 60000, label: 'production editor boot',
    });
    await cdp.evaluate(`
      window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
      await testStore.dispatch('data/patchLayoutSettings', {
        welcomeTourFinished: true, showEditor: true, showSidePreview: false,
        showExplorer: false, showSideBar: false,
      });
      return true;
    `);

    let nextId = 0;
    const setText = async (marked) => {
      const text = marked.replace('|', '');
      const offset = marked.indexOf('|');
      const id = `list-number-fixture-${nextId++}`;
      await cdp.evaluate(`
        testStore.commit('content/setItem', {
          id: ${JSON.stringify(`${id}/content`)}, text: ${JSON.stringify(text)},
          properties: '', discussions: {}, comments: {},
        });
        testStore.commit('file/setItem', { id: ${JSON.stringify(id)}, name: 'List numbering fixture', parentId: null });
        testStore.commit('file/setCurrentId', ${JSON.stringify(id)});
        return true;
      `);
      await waitFor(cdp, `__editorSvc.clEditor.getContent() === ${JSON.stringify(text)}`, { label: 'fixture applied' });
      await cdp.evaluate(`
        __editorSvc.clEditor.focus();
        __editorSvc.clEditor.setSelection(${offset}, ${offset});
        return true;
      `);
    };
    const key = async (name, code, modifiers = 0) => {
      const params = { key: name, code: name, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code, modifiers };
      await cdp.send('Input.dispatchKeyEvent', { ...params, type: 'keyDown' });
      await cdp.send('Input.dispatchKeyEvent', { ...params, type: 'keyUp' });
    };
    const expectText = async (marked, label) => {
      const text = marked.replace('|', '');
      const offset = marked.indexOf('|');
      await waitFor(cdp, `__editorSvc.clEditor.getContent() === ${JSON.stringify(text)}`, { label });
      const state = await cdp.evaluate(`return {
        text: __editorSvc.clEditor.getContent(),
        start: __editorSvc.clEditor.selectionMgr.selectionStart,
        end: __editorSvc.clEditor.selectionMgr.selectionEnd,
      };`);
      assert.deepEqual(state, { text, start: offset, end: offset }, label);
      console.log(`PASS ${label}`);
    };

    const original = '内容A\n\n1. A\n2. B\n3. C\n\n内容B\n1. D|\n';
    const continued = '内容A\n\n1. A\n2. B\n3. C\n\n内容B\n1. D\n2. |\n';
    await setText(original);
    await key('Enter', 13);
    await expectText(continued, 'blank-separated paragraph stays at 1 then 2');
    await waitFor(cdp, '__editorSvc.clEditor.undoMgr.canUndo()', { label: 'undo available' });
    await cdp.evaluate('__editorSvc.clEditor.undoMgr.undo();');
    await expectText(original, 'one undo restores the full source and caret');
    await cdp.evaluate('__editorSvc.clEditor.undoMgr.redo();');
    await expectText(continued, 'redo restores the independent continuation');

    for (const blank of ['', '   ', '\t', ' \t ']) {
      await setText(`1. A\n9. B\n${blank}\n7. C|\n`);
      await key('Enter', 13);
      await expectText(`1. A\n9. B\n${blank}\n7. C\n8. |\n`, `blank ${JSON.stringify(blank)} preserves start 7`);
    }

    await setText('1. A\n9. B\n\n|1. C\n2. D\n\n7. E\n20. F\n');
    await key('Tab', 9);
    await expectText('1. A\n9. B\n\n\t|1. C\n2. D\n\n7. E\n20. F\n', 'Tab does not cross blank lines');
    await key('Tab', 9, 8);
    await expectText('1. A\n9. B\n\n|1. C\n2. D\n\n7. E\n20. F\n', 'Shift+Tab does not cross blank lines');

    await setText('1. A|\n2. B\n\n7. C\n20. D\n');
    await key('Enter', 13);
    await expectText('1. A\n2. |\n3. B\n\n7. C\n20. D\n', 'only the active paragraph renumbers');

    await setText('内容A\n\n1. \n2. \n3. \n\n内容B\n1. |\n');
    await key('Enter', 13);
    await expectText('内容A\n\n1. \n2. \n3. \n\n内容B\n1. \n2. |\n', 'empty-item example also restarts independently');

    for (const boundary of ['---', '***', '___', '## Heading']) {
      await setText(`1. A\n9. B\n${boundary}\n1. C|\n`);
      await key('Enter', 13);
      await expectText(`1. A\n9. B\n${boundary}\n1. C\n2. |\n`, `${boundary} remains a boundary`);
    }
  });
} finally {
  await new Promise(resolve => server.httpServer.close(resolve));
}
