import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const puppeteer = require(process.env.PUPPETEER_MODULE || 'puppeteer-core');
const root = resolve(process.argv[2] || 'dist');
const mode = process.argv[3] || 'probe';
const modes = ['probe', 'benchmark', 'shell', 'render', 'failure', 'switch', 'sw', 'update', 'routes', 'fonts', 'slow-init', 'init-error', 'css-failure', 'disabled', 'copy', 'preload', 'network-error'];
assert.ok(modes.includes(mode), `Unknown mode: ${mode}`);
const reportPath = process.argv[4];
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff': 'font/woff', '.woff2': 'font/woff2', '.png': 'image/png' };
const requests = [];
let servingRoot = mode === 'update' ? resolve(process.env.BASELINE_DIR || '.npm-cache/cold-start/comparison-source/dist') : root;
const server = createServer(async (req, res) => {
  let pathname = new URL(req.url, 'http://localhost').pathname;
  requests.push(pathname);
  if (pathname === '/app') {
    res.writeHead(301, { Location: '/app/' });
    res.end();
    return;
  }
  const routes = servingRoot === root
    ? { '/': 'index.html', '/app/': 'app/index.html', '/oauth2/callback': 'oauth2/callback/index.html' }
    : { '/': 'index.html', '/app/': 'index.html', '/oauth2/callback': 'static/oauth2/callback.html', '/share.html': 'static/landing/share.html', '/gistshare.html': 'static/landing/gistshare.html' };
  const filename = resolve(servingRoot, routes[pathname] || `.${pathname}`);
  if (!filename.startsWith(`${servingRoot}/`) && !filename.startsWith(`${servingRoot}\\`)) {
    res.writeHead(403).end();
    return;
  }
  try {
    const contents = await readFile(filename);
    const compress = /\.(js|css|html|svg)$/.test(filename);
    const body = compress ? gzipSync(contents) : contents;
    res.writeHead(200, {
      'Content-Type': types[extname(filename)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': /\.(html|webmanifest)$/.test(filename) || pathname === '/sw.js' ? 'no-cache' : 'public, max-age=31536000, immutable',
      ...(compress ? { 'Content-Encoding': 'gzip' } : {}),
    });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
  }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
    protocolTimeout: 20000,
    args: ['--disable-background-networking', '--no-first-run', '--disable-default-apps'],
  });
} catch (error) {
  await new Promise(done => server.close(done));
  throw error;
}
const report = { mode, root, measurement: 'input-state-subscription-v2', profiled: !!process.env.STARTUP_PROFILE, browser: await browser.version(), protocol: { downloadMbps: 4, uploadMbps: 1, latencyMs: 75, cpuRate: 2, viewport: '1280x800', document: '# Startup benchmark\n\nOrdinary Markdown without formulas or diagrams.\n' }, samples: [] };
const ready = async page => {
  await page.waitForFunction(() => document.querySelector('.editor__inner')?.isContentEditable, { timeout: 30000, polling: 20 }).catch(async error => {
    console.error('STARTUP', await page.evaluate(() => ({ url: location.href, body: document.body.innerText.slice(0, 1000) })), requests.slice(-10));
    throw error;
  });
  const skip = await page.$('.tour-step--welcome .button');
  if (skip) await skip.click();
};
const readState = page => page.evaluate(() => {
  const store = document.querySelector('[data-v-app]')?.__vue_app__?.config.globalProperties.$store;
  return { text: store?.getters['content/current']?.text, fileId: store?.state.file.currentId };
});
const edit = async (page, text, replace = false) => {
  await page.focus('.editor__inner');
  if (replace) {
    await page.keyboard.down('Control');
    await page.keyboard.press('KeyA');
    await page.keyboard.up('Control');
  }
  if (replace) await page.keyboard.sendCharacter(text);
  else await page.keyboard.type(text, { delay: 15 });
  await page.waitForFunction(expected => {
    const store = document.querySelector('[data-v-app]')?.__vue_app__?.config.globalProperties.$store;
    return store?.getters['content/current']?.text?.includes(expected);
  }, { timeout: 10000, polling: 10 }, text.trim()).catch(async error => {
    console.error('EDIT STATE', JSON.stringify(await readState(page)), 'EXPECTED', JSON.stringify(text));
    throw error;
  });
};
const measure = async (page, label, path = '/') => {
  await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
  await ready(page);
  await page.evaluate(() => {
    const editor = document.querySelector('.editor__inner');
    const store = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
    const before = store.getters['content/current'].text;
    editor.focus();
    window.inputProbeStartedAt = performance.now();
    editor.addEventListener('input', () => { window.inputEventAt = performance.now(); }, { once: true });
    const unsubscribe = store.subscribe(() => {
      if (store.getters['content/current'].text === before) return;
      window.editConfirmedAt = performance.now();
      window.confirmedEdit = store.getters['content/current'].text;
      unsubscribe();
    });
  });
  await page.keyboard.type('z', { delay: 15 });
  await page.waitForFunction(() => window.editConfirmedAt !== undefined && window.confirmedEdit.includes('z'), { timeout: 10000 });
  const sample = await page.evaluate(label => ({
    label,
    editableMs: Math.round(window.editConfirmedAt),
    diagnostic: {
      editorElementMs: window.editorElementAt,
      inputProbeMs: window.inputProbeStartedAt,
      inputEventMs: window.inputEventAt,
      hostReadbackMs: performance.now(),
      longTasks: window.startupLongTasks,
    },
    fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime,
    sw: !!navigator.serviceWorker.controller,
    resources: performance.getEntriesByType('resource').map(e => ({ url: new URL(e.name).pathname, start: Math.round(e.startTime), duration: Math.round(e.duration), encoded: e.encodedBodySize, transfer: e.transferSize, initiator: e.initiatorType })),
  }), label);
  report.samples.push(sample);
  return sample;
};
try {
  if (mode === 'benchmark') {
    for (let run = 1; run <= (process.env.STARTUP_PROFILE ? 1 : 3); run += 1) {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: 1280, height: 800 });
      await page.setBypassServiceWorker(true);
      await page.evaluateOnNewDocument(() => {
        // Page interception does not cover worker-owned precache requests.
        navigator.serviceWorker.register = () => Promise.reject(new Error('SW disabled for HTTP-cache benchmark'));
        window.startupLongTasks = [];
        new PerformanceObserver(list => {
          window.startupLongTasks.push(...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration })));
        }).observe({ type: 'longtask', buffered: true });
        const editorObserver = new MutationObserver(() => {
          if (!document.querySelector('.editor__inner')?.isContentEditable) return;
          window.editorElementAt = performance.now();
          editorObserver.disconnect();
        });
        editorObserver.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['contenteditable'] });
      });
      page.on('requestfailed', req => {
        if (req.url().startsWith(origin) && !req.url().endsWith('/sw.js')) console.error('REQUEST FAILED', req.url(), req.failure());
      });
      await page.setRequestInterception(true);
      page.on('request', req => req.url().endsWith('/sw.js') || !req.url().startsWith(origin) ? req.abort() : req.continue());
      const cdp = await page.createCDPSession();
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 75, downloadThroughput: 4 * 1024 * 1024 / 8, uploadThroughput: 1024 * 1024 / 8, connectionType: 'cellular4g' });
      await page.emulateCPUThrottling(2);
      if (process.env.STARTUP_PROFILE) console.log('PROFILE: cold visit');
      await measure(page, `first-${run}`);
      await edit(page, report.protocol.document, true);
      // Allow the existing debounced persistence to flush before navigation.
      await page.waitForFunction(async () => {
        const dbs = await indexedDB.databases();
        for (const { name } of dbs) {
          const db = await new Promise((resolve, reject) => { const req = indexedDB.open(name); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
          try {
            for (const table of db.objectStoreNames) {
              const rows = await new Promise((resolve, reject) => { const req = db.transaction(table).objectStore(table).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
              if (rows.some(row => row?.text?.includes('Ordinary Markdown without formulas'))) return true;
            }
          } finally { db.close(); }
        }
        return false;
      }, { timeout: 15000, polling: 100 });
      await cdp.send('Network.clearBrowserCache');
      if (process.env.STARTUP_PROFILE) console.log('PROFILE: persisted restart');
      await measure(page, `restart-${run}`);
      if (process.env.STARTUP_PROFILE) {
        console.log('PROFILE: starting CPU sampler');
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.start');
      }
      await measure(page, `http-warm-${run}`);
      if (process.env.STARTUP_PROFILE) {
        console.log('PROFILE: stopping CPU sampler');
        const { profile } = await cdp.send('Profiler.stop');
        const profilePath = `${process.env.STARTUP_PROFILE}-${run}.json`;
        await mkdir(resolve(profilePath, '..'), { recursive: true });
        await writeFile(profilePath, JSON.stringify(profile));
      }
      await context.close();
    }
  } else {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.evaluateOnNewDocument(allowServiceWorker => {
      const register = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = (...args) => {
        window.swRegistration = { time: performance.now(), layout: !!document.querySelector('.layout'), shell: !!document.getElementById('startup') };
        return allowServiceWorker ? register(...args) : Promise.reject(new Error('SW disabled for isolated functional test'));
      };
    }, ['sw', 'update'].includes(mode));
    await page.setViewport({ width: 1280, height: 800 });
    const errors = [];
    page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
    await page.setRequestInterception(true);
    const held = [];
    let holdRenderers = mode === 'switch' || mode === 'copy';
    const rendererUrl = url => /\/(mermaid\.core|katex)[.-]/.test(url);
    page.on('request', req => {
      if ((!['sw', 'update'].includes(mode) && req.url().endsWith('/sw.js')) || !req.url().startsWith(origin)
        || (mode === 'shell' && /\.(js|css)(\?|$)/.test(req.url()))
        || (mode === 'failure' && rendererUrl(req.url()))
        || (mode === 'css-failure' && /\/katex[.-].*\.css/.test(req.url()))
        || (mode === 'fonts' && /\.(woff2?|ttf)(\?|$)/.test(req.url()))) req.abort();
      else if (mode === 'preload' && /\/static\/index-[^/]+\.js$/.test(req.url())) held.push(req);
      else if (holdRenderers && rendererUrl(req.url())) held.push(req);
      else req.continue();
    });
    if (mode === 'network-error') {
      await page.evaluateOnNewDocument(() => {
        let first = true;
        Object.defineProperty(navigator, 'onLine', { get() {
          if (first) { first = false; throw new Error('Network initialization failed'); }
          return true;
        } });
      });
    }
    if (mode === 'slow-init' || mode === 'init-error') {
      await page.evaluateOnNewDocument(fail => {
        const open = indexedDB.open.bind(indexedDB);
        indexedDB.open = (...args) => {
          if (fail) throw new Error('Startup database unavailable');
          const request = open(...args);
          const dispatch = {};
          Object.defineProperty(request, 'onsuccess', {
            set(listener) {
              dispatch.success = event => { window.releaseStartup = () => listener.call(request, event); };
              request.addEventListener('success', dispatch.success, { once: true });
            },
          });
          return request;
        };
      }, mode === 'init-error');
    }
    if (mode === 'slow-init' || mode === 'init-error') {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      if (mode === 'slow-init') {
        await page.waitForFunction(() => typeof window.releaseStartup === 'function');
        assert.equal(await page.$eval('#startup', el => getComputedStyle(el).display !== 'none'), true);
        assert.equal(await page.$('.layout'), null);
        await page.evaluate(() => window.releaseStartup());
        await ready(page);
        assert.equal(await page.$('#startup'), null);
        await edit(page, 'after-init');
      } else {
        await page.waitForSelector('.notification__content');
        assert.ok(await page.$eval('.notification__content', el => el.textContent.includes('Startup database unavailable')));
        assert.ok(await page.$eval('.notification__content', el => {
          const r = el.getBoundingClientRect();
          return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
        }), 'Error notification is not hidden by the startup shell');
      }
      assert.deepEqual(errors, []);
      console.log(`PASS: ${mode}`);
    } else if (mode === 'network-error') {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.notification__content');
      assert.ok(await page.$eval('.notification__content', el => el.textContent.includes('Network initialization failed')));
      await ready(page);
      await edit(page, 'network-failure-still-editable');
      assert.deepEqual(errors, []);
      console.log('PASS: network init failure reports the error without blocking local editing');
    } else if (mode === 'preload') {
      const navigation = page.goto(origin, { waitUntil: 'domcontentloaded' });
      navigation.catch(() => {});
      await page.waitForSelector('#startup svg');
      await page.waitForFunction(() => performance.getEntriesByType('resource').some(entry => /\/main[.-].*\.js$/.test(entry.name)), { timeout: 5000 });
      assert.equal(await page.$('.layout'), null, 'Preloading must not execute the app');
      for (const req of held) await req.continue();
      await navigation;
      await ready(page);
      await edit(page, 'preload-edit');
      const mainRequests = requests.filter(url => /\/main[.-].*\.js$/.test(url));
      assert.equal(mainRequests.length, 1, 'Bootstrap reuses the preload');
      assert.equal(requests.some(rendererUrl), false);
      assert.deepEqual(errors, []);
      console.log('PASS: preload discovered before bootstrap, reused for real editing');
    } else if (mode === 'shell') {
      for (const path of ['/', '/app', '/app/']) {
        await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
        assert.ok(await page.$('#startup svg'), `${path}: inline SVG visible without JS/CSS`);
        assert.equal(await page.$eval('#startup', el => getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0), true);
      }
      console.log('PASS: inline startup shell without JS or CSS at all three entries');
    } else if (['render', 'failure', 'switch', 'sw', 'update', 'routes', 'fonts', 'css-failure', 'disabled', 'copy'].includes(mode)) {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await ready(page);
      assert.equal(await page.$('#startup'), null, 'Layout takes over the shell');
      await page.evaluate(() => {
        window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
        testStore.dispatch('data/patchLayoutSettings', { welcomeTourFinished: true, showEditor: true, showSidePreview: true });
      });
      const fixture = async (text, properties = '\n') => {
        const id = `cold-start-${Date.now()}`;
        await page.evaluate(({ text, properties, id }) => {
          window.testStore = document.querySelector('[data-v-app]').__vue_app__.config.globalProperties.$store;
          testStore.dispatch('data/patchLayoutSettings', { welcomeTourFinished: true, showEditor: true, showSidePreview: true });
          testStore.commit('content/setItem', { id: `${id}/content`, text, properties, discussions: {}, comments: {} });
          testStore.commit('file/setItem', { id, name: 'Cold start fixture', parentId: null });
          testStore.commit('file/setCurrentId', id);
        }, { text, properties, id });
        await page.waitForFunction(text => document.querySelector('.editor__inner')?.textContent === text, {}, text);
        return id;
      };
      const source = '# Render fixture\n\nInline $x^2$ and $y^2$.\n\n$$\\frac{1}{2}$$\n\n```mermaid\ngraph TD\nA[Alpha] --> B[Beta]\n```\n';
      if (mode === 'disabled') {
        await fixture(source, 'extensions:\n  mermaid:\n    enabled: false\n  katex:\n    enabled: false\n');
        await page.waitForSelector('.preview .language-mermaid');
        await page.waitForNetworkIdle({ idleTime: 300 });
        assert.equal(requests.some(rendererUrl), false);
        assert.equal(await page.$('.preview .katex'), null);
        await edit(page, 'extensions-disabled');
      } else if (mode === 'copy') {
        await page.evaluate(() => {
          navigator.clipboard.write = async items => {
            window.copiedHtml = await (await items[0].getType('text/html')).text();
          };
        });
        await fixture(source);
        await page.waitForSelector('.preview .katex--inline');
        await page.$eval('[title="复制富文本"] a', el => el.click());
        // Resolve the delayed network only after the copy action has started.
        holdRenderers = false;
        for (const req of held) await req.continue();
        await page.waitForFunction(() => typeof window.copiedHtml === 'string');
        const copied = await page.evaluate(() => window.copiedHtml);
        assert.ok(copied.includes('katex-mathml') && copied.includes('<svg'), 'Rich-text copy waits for formulas and diagrams');
      } else if (mode === 'fonts') {
        const text = '# Résumé 中文\n\nCafé naïve € → **Bold** *Italic* ***Both***\n\n```js\nconst n = 1;\n```\n';
        await fixture(text);
        await page.waitForSelector('.preview strong em, .preview em strong');
        await page.evaluate(() => document.fonts.ready);
        const checks = await page.$$eval('.preview p, .preview strong, .preview em, .preview code', elements => elements.map(el => ({
          text: el.textContent, width: el.getBoundingClientRect().width, visibility: getComputedStyle(el).visibility,
          family: getComputedStyle(el).fontFamily, weight: getComputedStyle(el).fontWeight, style: getComputedStyle(el).fontStyle,
        })));
        assert.ok(checks.every(check => check.width > 0 && check.visibility === 'visible'));
        assert.ok(checks.some(check => check.family.includes('Roboto Mono')));
        assert.ok(checks.some(check => Number(check.weight) >= 600));
        assert.ok(checks.some(check => check.style === 'italic'));
        await edit(page, 'font-fallback-edit');
        console.log(JSON.stringify(checks));
      } else if (mode === 'routes') {
        for (const path of ['/app', '/app/']) {
          await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded' });
          await ready(page);
          assert.equal(await page.$('#startup'), null);
          await edit(page, 'entry-path-check');
        }
        for (const path of ['/oauth2/callback', '/share.html', '/gistshare.html', '/static/landing/index.html']) {
          const response = await fetch(`${origin}${path}`);
          assert.equal(response.status, 200);
          assert.ok(!(await response.text()).includes('id="startup"'), `${path} must not fall back to the editor`);
        }
      } else if (mode === 'sw' || mode === 'update') {
        await page.waitForFunction(async () => {
          const registration = await navigator.serviceWorker.getRegistration();
          return registration?.active?.state === 'activated';
        }, { timeout: 120000 });
        const registration = await page.evaluate(() => window.swRegistration);
        console.log('Service worker installation complete', { registration, requests: requests.length });
        if (mode === 'sw') {
          assert.ok(registration.layout && !registration.shell, 'Precache starts after Layout takes over');
        }
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
        if (mode === 'update') {
          await edit(page, 'preserve-update-marker', true);
          servingRoot = root;
          const reloaded = page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 120000 });
          await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); });
          await reloaded;
          await ready(page);
          assert.ok((await readState(page)).text.includes('preserve-update-marker'), 'SW update saves the current edit');
          const entry = (await readFile(resolve(root, 'index.html'), 'utf8')).match(/<script[^>]+src="([^"]+\.js)"/)[1];
          assert.equal(await page.$eval('script[type=module][src]', script => new URL(script.src).pathname), entry);
          assert.equal(await page.evaluate(async () => !!(await navigator.serviceWorker.getRegistration()).waiting), false);
        }
        await fixture(source);
        await page.waitForSelector('.preview .mermaid-diagram svg', { timeout: 30000 });
        await page.waitForSelector('.preview .katex', { timeout: 30000 });
        await page.setOfflineMode(true);
        await page.reload({ waitUntil: 'domcontentloaded' });
        await ready(page);
        await fixture(source);
        await page.waitForSelector('.preview .mermaid-diagram svg', { timeout: 30000 });
        await page.waitForSelector('.preview .katex', { timeout: 30000 });
        await edit(page, 'offline-edit-check');
        assert.ok(await page.evaluate(() => !!navigator.serviceWorker.controller));
        await page.setOfflineMode(false);
      } else {
        assert.equal(requests.some(rendererUrl), false, 'Ordinary startup does not request renderers without SW');
        await fixture(source);
        if (mode === 'switch') {
          await page.waitForFunction(() => !!document.querySelector('.preview .katex--inline'));
          await fixture('# Replacement\n\nNo diagram or math here.\n');
          holdRenderers = false;
          for (const req of held) await req.continue();
          await page.waitForNetworkIdle({ idleTime: 300 });
          assert.equal(await page.$('.preview .mermaid-diagram, .preview .katex'), null, 'Late rendering must not leak into another Document');
          await fixture(source);
        }
        if (mode === 'failure' || mode === 'css-failure') {
          if (mode === 'failure') {
            await page.waitForSelector('.preview .mermaid-error');
            assert.ok(await page.$eval('.preview .mermaid-error', el => el.textContent.includes('Alpha')));
          }
          await page.waitForSelector('.preview .katex-error');
          assert.equal(await page.$eval('.preview .katex--inline', el => el.textContent), 'x^2');
        } else {
          await page.waitForSelector('.preview .mermaid-diagram svg', { timeout: 30000 });
          await page.waitForFunction(() => document.querySelectorAll('.preview .katex').length === 3, { timeout: 30000 });
          assert.equal((await readState(page)).text, source, 'Rendering never modifies Markdown');
          if (mode === 'render') {
            const oldSvg = await page.$eval('.preview .mermaid-diagram svg', el => el.id);
            await page.evaluate(() => testStore.dispatch('data/switchThemeSetting'));
            await page.waitForFunction(id => document.querySelector('.preview .mermaid-diagram svg')?.id !== id, {}, oldSvg);
            await page.waitForNetworkIdle({ idleTime: 300 });
            for (const asset of requests.filter(rendererUrl)) {
              assert.equal(requests.filter(url => url === asset).length, 1, `Renderer request reused: ${asset}`);
            }
          }
          await page.evaluate(() => { testStore.dispatch('modal/open', 'htmlExport').catch(() => {}); });
          await page.waitForFunction(() => {
            const html = document.querySelector('.button--copy')?.value || '';
            return html.includes('mermaid-diagram') && html.includes('katex');
          }, { timeout: 30000 }).catch(async error => {
            console.error('EXPORT', await page.evaluate(() => ({ html: document.querySelector('.button--copy')?.value, body: document.body.innerText.slice(-800) })), errors);
            throw error;
          });
          const exported = await page.$eval('.button--copy', button => button.value);
          assert.ok(exported.includes('<svg') && exported.includes('katex-mathml'), 'Export/HTML-copy pipeline contains final rendered content');
          await page.evaluate(() => testStore.getters['modal/config'].reject());
          if (mode === 'render') {
            const mixed = `${source}\n\`\`\`mermaid\nsequenceDiagram\nAlice->>Bob: Hello\n\`\`\`\n\n\`\`\`abc\nX:1\nT:Tune\nM:4/4\nK:C\nCDEF GABc|\n\`\`\`\n`;
            await fixture(mixed);
            await page.waitForFunction(() => document.querySelectorAll('.preview .mermaid-diagram svg').length === 2);
            await page.waitForSelector('.preview .abc-notation-block svg');
            await page.waitForFunction(() => document.querySelectorAll('.preview .katex').length === 3);
            assert.equal((await readState(page)).text, mixed);
          }
          await fixture('$\\badcommand$\n\n```mermaid\nnot a diagram\n```\n');
          await page.waitForSelector('.preview .mermaid-error');
          await page.waitForSelector('.preview .katex-error');
        }
        await edit(page, 'still-editable');
      }
      assert.deepEqual(errors, [], 'No uncaught page errors');
      console.log(`PASS: ${mode}`);
    } else {
      await page.goto(origin, { waitUntil: 'domcontentloaded' });
      await ready(page);
      console.log(JSON.stringify({ state: await readState(page), errors, body: await page.evaluate(() => document.body.innerText.slice(0, 700)), resources: requests }, null, 2));
    }
    await context.close();
  }
} finally {
  await browser.close();
  await new Promise(done => server.close(done));
  if (reportPath) {
    await mkdir(resolve(reportPath, '..'), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2));
  }
}
if (report.samples.length) console.log(JSON.stringify(report.samples.map(({ label, fcpMs, editableMs, sw }) => ({ label, fcpMs, editableMs, sw })), null, 2));
