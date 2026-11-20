// Real settings UI: full-width YAML workspaces, draft lifecycle and scrolling.
// Run after npm run build: node test/browser/settings-yaml.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { preview } from 'vite';
import { withBrowser, navigate, waitFor, stubPath } from './cdp.mjs';

const defaults = await readFile(new URL('../../src/data/defaults/defaultSettings.yml', import.meta.url), 'utf8');
const fixture = `# ${'长注释 abc '.repeat(80)}\n${Array.from({ length: 90 }, (_, i) => `# row ${i}`).join('\n')}\nfontSizeFactor: 1\n`;
const failures = [];
const check = (name, valid, details) => { if (!valid) failures.push(`${name}: ${JSON.stringify(details, (key, value) => key === 'text' ? value.slice(0, 80) : value)}`); };
const frame = 'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));';
const server = await preview({ preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} }, logLevel: 'error' });
const port = server.httpServer.address().port;
try {
  await withBrowser(async (cdp) => {
    await stubPath(cdp, '/conf', '{}');
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const viewport = new EventTarget();
      Object.defineProperties(viewport, {
        height: {get: () => window.keyboardHeight || window.innerHeight},
        offsetTop: {get: () => window.keyboardTop || 0},
      });
      Object.defineProperty(window, 'visualViewport', {value: viewport, configurable: true});
      window.setKeyboard = (height, top = 0) => {
        window.keyboardHeight = height;
        window.keyboardTop = top;
        viewport.dispatchEvent(new Event('resize'));
      };
      Object.defineProperty(navigator, 'clipboard', {value: {
        writeText: async text => { window.copiedText = text; },
      }});
    ` });
    const open = async () => {
      await cdp.evaluate("window.testStore.dispatch('modal/open', 'settings'); return true;");
      await waitFor(cdp, 'document.querySelector(".modal__inner-1--settings")');
    };
    const tab = async (index) => {
      await cdp.evaluate(`document.querySelectorAll('.modal .tabs__tab a')[${index}].click();`);
      await cdp.evaluate(frame);
    };
    const measure = () => cdp.evaluate(`
      const panel = document.querySelector('.modal__inner-2');
      const content = document.querySelector('.modal__content');
      const page = document.querySelector('.modal [role=tabpanel]');
      const field = page.querySelector('.form-entry__field');
      const editor = field.querySelector('.code-editor');
      const label = page.querySelector('.form-entry__label');
      const bar = document.querySelector('.modal__button-bar');
      const rect = e => { const r = e.getBoundingClientRect(); return {left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height}; };
      return { panel:rect(panel), content:rect(content), field:rect(field), editor:rect(editor), label:rect(label), bar:rect(bar),
        panelOverflow:panel.scrollHeight-panel.clientHeight, fieldOverflow:field.scrollHeight-field.clientHeight,
        horizontalOverflow: Math.max(field.scrollWidth-field.clientWidth, editor.scrollWidth-editor.clientWidth),
        text:editor.textContent, editable:editor.isContentEditable };
    `);
    for (const [width, height] of [[320, 640], [390, 844], [590, 900], [601, 900], [1280, 900], [1280, 500]]) {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await navigate(cdp, `http://localhost:${port}/`);
      await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', { timeout: 60000 });
      await cdp.evaluate(`
        window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
        await window.testStore.dispatch('data/patchLayoutSettings', {welcomeTourFinished:true});
        await window.testStore.dispatch('data/setSettings', ${JSON.stringify(fixture)});
      `);
      await open();
      for (const index of [1, 2]) {
        await tab(index);
        const m = await measure();
        check(`${width}/${index} label above code`, m.label.bottom <= m.field.top + 1, m);
        check(`${width}/${index} full content width`, Math.abs(m.field.width - m.content.width) < 2, m);
        check(`${width}/${index} fills remaining height`, m.field.height > m.panel.height * 0.6 && m.bar.top - m.field.bottom >= -1 && m.bar.top - m.field.bottom < 24, m);
        check(`${width}/${index} only code area scrolls`, m.panelOverflow <= 1 && m.fieldOverflow > 0, m);
        check(`${width}/${index} soft wrap without horizontal overflow`, m.horizontalOverflow <= 1, m);
        check(`${width}/${index} read-only state`, m.editable === (index === 1), m.editable);
        check(`${width}/${index} text unchanged by wrapping`, m.text === (index === 1 ? fixture : defaults), m.text.slice(0, 100));
      }
      await cdp.evaluate("document.querySelector('.modal__button-bar .button').click();");
    }
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('PASS settings YAML geometry: 320/390/590/601/1280, short desktop, both tabs, labels/top, fill, wrap, readonly');

    const selectAll = async () => {
      await cdp.evaluate(`
        const editor = document.querySelector('.modal .code-editor');
        editor.focus();
        const range = document.createRange(); range.selectNodeContents(editor);
        const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      `);
      await cdp.send('Input.dispatchKeyEvent', {type:'keyDown', key:'a', code:'KeyA', windowsVirtualKeyCode:65, modifiers:2});
      await cdp.send('Input.dispatchKeyEvent', {type:'keyUp', key:'a', code:'KeyA', windowsVirtualKeyCode:65, modifiers:2});
      await cdp.evaluate(frame);
    };
    const type = async text => {
      await selectAll();
      await cdp.send('Input.insertText', {text: text.replace(/\n$/, '')});
      await cdp.evaluate(frame);
    };
    await cdp.send('Emulation.setDeviceMetricsOverride', {width:390, height:844, deviceScaleFactor:1, mobile:false});
    await cdp.evaluate('window.setKeyboard(844);');
    await open();
    await tab(1);
    await type('fontSizeFactor: [');
    await waitFor(cdp, 'document.querySelector(".modal__error--settings")?.textContent.length > 0');
    assert.equal(await cdp.evaluate("return document.querySelector('.button--resolve').disabled;"), true);
    const invalid = await measure();
    check('error leaves editor and buttons visible', invalid.field.height > 100 && invalid.bar.bottom <= 844, invalid);
    const draft = '# keep comment\nfontSizeFactor: 1\n';
    await type(draft);
    await waitFor(cdp, '!document.querySelector(".modal__error--settings")');
    const short = await measure();
    assert.ok(short.field.height > 600, 'short YAML also fills the workspace');
    assert.ok(Math.abs(short.editor.height - (short.field.height - 2)) < 2, 'blank editor area remains clickable');
    await tab(0); await tab(2);
    assert.equal((await measure()).text, defaults);
    await cdp.evaluate("document.querySelector('.settings-modal__copy-default').click();");
    await waitFor(cdp, 'window.copiedText');
    assert.equal(await cdp.evaluate('return window.copiedText;'), defaults);
    // Read-only preview supports selection but cannot be replaced by typing.
    await type('SHOULD NOT EDIT');
    assert.equal((await measure()).text, defaults);
    await tab(1);
    assert.equal((await measure()).text, draft);
    assert.equal(await cdp.evaluate("return window.testStore.getters['data/settings'];"), fixture);
    await cdp.evaluate("document.querySelector('.modal__button-bar .button').click();");
    await waitFor(cdp, '!document.querySelector(".modal")');
    assert.equal(await cdp.evaluate("return window.testStore.getters['data/settings'];"), fixture);

    await open(); await tab(1);
    // Paste via the browser clipboard event, not by calling component methods.
    await selectAll();
    await cdp.evaluate(`
      const data = new DataTransfer(); data.setData('text/plain', ${JSON.stringify(draft.trimEnd())});
      document.querySelector('.modal .code-editor').dispatchEvent(new ClipboardEvent('paste', {clipboardData:data, bubbles:true, cancelable:true}));
    `);
    await cdp.evaluate(frame);
    assert.equal((await measure()).text, draft);
    await cdp.evaluate("document.querySelector('.button--resolve').click();");
    await waitFor(cdp, '!document.querySelector(".modal")');
    assert.equal(await cdp.evaluate("return window.testStore.getters['data/settings'];"), draft);
    console.log('PASS YAML draft: edit, invalid/repair, tab switching, readonly/select/copy, cancel, paste and confirm');

    await open(); await tab(1); await type(fixture);
    // A collapsed caret at the end must be visible both before and after a keyboard resize.
    await cdp.send('Input.dispatchKeyEvent', {type:'keyDown', key:'End', code:'End', windowsVirtualKeyCode:35, modifiers:2});
    await cdp.send('Input.dispatchKeyEvent', {type:'keyUp', key:'End', code:'End', windowsVirtualKeyCode:35, modifiers:2});
    const caretVisible = `(() => {
      const field = document.querySelector('.settings-modal__yaml-scroll').getBoundingClientRect();
      const selection = window.getSelection();
      if (!selection.rangeCount) return false;
      const caret = selection.getRangeAt(0).getBoundingClientRect();
      return caret.height > 0 && caret.top >= field.top && caret.bottom <= field.bottom;
    })()`;
    await waitFor(cdp, caretVisible, {label:'caret follows typing to end'});
    await cdp.evaluate('window.setKeyboard(380, 100);');
    await cdp.evaluate(frame);
    const keyboard = await measure();
    check('keyboard resizes YAML region, not its content', keyboard.panel.height === 380 && keyboard.panel.top === 100 && keyboard.field.height > 100 && keyboard.field.height < 300 && keyboard.bar.bottom <= 480, keyboard);
    await waitFor(cdp, caretVisible, {label:'caret remains visible after keyboard shrink', timeout:3000});
    await cdp.evaluate('window.setKeyboard(844);');
    await cdp.evaluate(frame);
    check('keyboard dismissal restores code space', (await measure()).field.height > 600, await measure());
    await cdp.evaluate("document.querySelector('.modal__button-bar .button').click();");
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('PASS YAML keyboard: reduced viewport, top offset, visible caret and footer, restored height');
  });
} finally {
  await server.close();
}
