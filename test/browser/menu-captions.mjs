// Headless verification that the two redundant captions are gone and nothing
// else in the menus was trimmed with them: 强制从远端覆盖 loses its explanatory
// line, the 动态加载 setting loses its parenthetical, and every neighbouring
// caption (menu entries and settings labels) stays exactly as it was.
//
// Run after `npm run build`: node test/browser/menu-captions.mjs
import { mkdir } from 'node:fs/promises';
import { preview as startPreview } from 'vite';
import { withBrowser, navigate, waitFor, screenshot, stubPath } from './cdp.mjs';

const EVIDENCE = '.target/validation/menu-captions';

// Captions that must survive the trim untouched (sampled across both surfaces).
const KEPT_MENU_CAPTIONS = [
  '管理对您的外部账号的访问。',
  '为您的导出配置 Handlebars 模板。',
  '调整应用程序和键盘快捷键。',
];
const KEPT_SETTING_LABELS = ['动态加载阈值（字符）', '显示行号', '图片显示', '主题', '字号倍数'];

const failures = [];
const check = (label, actual, expected) => {
  if (actual !== expected) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
};
const expectTrue = (label, value, detail) => {
  if (!value) failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
};

// Every menu entry as {title, caption} — the caption is the entry's own direct
// <span> inside .menu-entry__text; count badges are .menu-entry__label. The
// --info rows in .side-bar__info are status strips, not menu entries.
const readMenu = `(() => {
  return [...document.querySelectorAll('.side-bar .menu-entry:not(.menu-entry--info)')]
    .map((entry) => {
    const text = entry.querySelector('.menu-entry__text');
    if (!text) return { caption: null, title: null };
    const captionNode = [...text.children].find(elt => elt.tagName === 'SPAN') || null;
    const clone = text.cloneNode(true);
    clone.querySelectorAll('span, .menu-entry__label').forEach(node => node.remove());
    const squash = value => value.replace(/\\s+/g, ' ').trim();
    return {
      caption: captionNode ? squash(captionNode.textContent) : null,
      title: squash(clone.textContent),
    };
  });
})()`;

// Settings rows come in two shapes: label-above/control-below (.form-entry__label)
// and single-row toggles (.form-entry__inline-label). Both carry the default hint.
const readSettings = `(() => {
  const squash = value => value.replace(/\\s+/g, ' ').trim();
  const rows = [];
  document.querySelectorAll('.modal__inner-2 .form-entry').forEach((entry) => {
    const infoNode = entry.querySelector('.form-entry__label-info');
    const info = infoNode ? squash(infoNode.textContent) : null;
    const label = entry.querySelector(':scope > .form-entry__label');
    const inline = entry.querySelector('.form-entry__inline-label');
    const source = label || inline;
    if (!source) return;
    const clone = source.cloneNode(true);
    clone.querySelectorAll('.form-entry__label-info, input, select, textarea')
      .forEach(node => node.remove());
    rows.push({ label: squash(clone.textContent), info });
  });
  return rows;
})()`;

const server = await startPreview({
  preview: { host: '127.0.0.1', port: 0, open: false, proxy: {} },
  logLevel: 'error',
});
const port = server.httpServer.address().port;
await mkdir(EVIDENCE, { recursive: true });

const observed = {};

try {
  await withBrowser(async (cdp) => {
    cdp.listeners.set('Runtime.exceptionThrown', [(params) => {
      const text = params.exceptionDetails.exception?.description || params.exceptionDetails.text;
      failures.push(`page exception: ${text}`);
    }]);
    await stubPath(cdp, '/conf', '{}');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390, height: 844, deviceScaleFactor: 1, mobile: false,
    });
    await navigate(cdp, `http://localhost:${port}/`);
    await waitFor(cdp, 'window.__editorSvc?.clEditor && document.querySelector(".layout")', {
      timeout: 60000, label: 'application boot',
    });
    await cdp.evaluate(`
      window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
      await window.testStore.dispatch('data/patchLayoutSettings', {
        welcomeTourFinished: true, showSideBar: true, sideBarPanel: 'menu',
      });
      return true;
    `);
    await waitFor(cdp, 'document.querySelectorAll(".side-bar .menu-entry").length > 5', {
      timeout: 20000, label: 'main menu rendered',
    });
    observed.menu = await cdp.evaluate(`return ${readMenu};`);
    await screenshot(cdp, `${EVIDENCE}/main-menu.png`);
    await cdp.evaluate(`
      const panel = document.querySelector('.side-bar__panel--menu');
      panel.scrollTop = panel.scrollHeight;
      return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));
    `);
    await screenshot(cdp, `${EVIDENCE}/main-menu-bottom.png`);

    await cdp.evaluate("window.testStore.dispatch('modal/open', 'settings'); return true;");
    await waitFor(cdp, 'document.querySelector(".modal__inner-2 .form-entry__label")', {
      timeout: 20000, label: 'settings modal open',
    });
    await cdp.evaluate(
      'return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))));',
    );
    observed.settings = await cdp.evaluate(`return ${readSettings};`);
    await screenshot(cdp, `${EVIDENCE}/settings-visual.png`);
    await cdp.evaluate("window.testStore.commit('modal/setStack', []); return true;");
  });
} finally {
  await server.close();
}

const forceSync = observed.menu?.find(entry => entry.title === '强制从远端覆盖');
const dynamicLoading = observed.settings?.find(entry => entry.label === '动态加载'
  || entry.label.startsWith('动态加载'));

// 1. The two captions under change are gone.
expectTrue('强制从远端覆盖 entry exists', !!forceSync, JSON.stringify(observed.menu));
check('强制从远端覆盖 has no caption', forceSync?.caption, null);
expectTrue('动态加载 setting exists', !!dynamicLoading, JSON.stringify(observed.settings));
check('动态加载 label is trimmed', dynamicLoading?.label, '动态加载');
check('动态加载 keeps its default hint', dynamicLoading?.info, '— 默认：开');

// 2. Neighbouring captions are untouched.
for (const caption of KEPT_MENU_CAPTIONS) {
  expectTrue(`menu caption kept: ${caption}`,
    observed.menu?.some(entry => entry.caption === caption),
    JSON.stringify(observed.menu?.map(entry => entry.caption)));
}
for (const label of KEPT_SETTING_LABELS) {
  expectTrue(`settings label kept: ${label}`,
    observed.settings?.some(entry => entry.label === label),
    JSON.stringify(observed.settings?.map(entry => entry.label)));
}

// 3. Exactly the known entries sit without a caption — nothing else was swept.
const captionless = (observed.menu || []).filter(entry => !entry.caption).map(entry => entry.title);
check('caption-less entries are exactly the intended set',
  captionless.join(' | '),
  '目录 | Markdown 帮助 | 导入/导出 | 打印 | 文档空间备份 | 强制从远端覆盖 | 重置应用程序 | 关于 KEDIT');

// 4. The settings surface still renders the whole field list.
expectTrue('settings surface rendered', (observed.settings?.length || 0) > 20,
  JSON.stringify(observed.settings?.length));

if (failures.length) {
  console.error(`FAIL ${failures.length}`);
  failures.forEach(line => console.error(` - ${line}`));
  console.error(`measured: ${JSON.stringify(observed, null, 1)}`);
  process.exit(1);
}
console.log(`PASS menu captions: 2 captions trimmed, neighbours intact (evidence: ${EVIDENCE})`);