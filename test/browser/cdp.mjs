// Minimal Chrome DevTools Protocol client: launches a hidden headless Chrome
// with an isolated temporary profile and drives it over the WebSocket the
// browser itself reports. No puppeteer, no window, no user profile.
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const waitForPort = async (profileDir) => {
  const portFile = join(profileDir, 'DevToolsActivePort');
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const [port] = (await readFile(portFile, 'utf8')).split('\n');
      if (port) return Number(port);
    } catch (error) {
      // not written yet
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Chrome did not expose a debugging port (${portFile})`);
};

class Cdp {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
        return;
      }
      (this.listeners.get(message.method) || []).forEach(listener => listener(message.params));
    });
  }

  send(method, params = {}) {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  once(event) {
    return new Promise((resolve) => {
      const list = this.listeners.get(event) || [];
      const listener = (params) => {
        this.listeners.set(event, (this.listeners.get(event) || []).filter(item => item !== listener));
        resolve(params);
      };
      this.listeners.set(event, [...list, listener]);
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression: `(async () => { ${expression} })()`,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      const description = result.exceptionDetails.exception?.description
        || result.exceptionDetails.text;
      throw new Error(description);
    }
    return result.result.value;
  }
}

export async function withBrowser(run) {
  const profileDir = await mkdtemp(join(tmpdir(), 'kedit-cdp-'));
  const child = spawn(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--mute-audio',
    `--user-data-dir=${profileDir}`,
    '--remote-debugging-port=0',
    'about:blank',
  ], { stdio: 'ignore' });

  let socket;
  try {
    const port = await waitForPort(profileDir);
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    const page = targets.find(target => target.type === 'page');
    if (!page) throw new Error('no page target');
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const cdp = new Cdp(socket);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    return await run(cdp);
  } finally {
    try {
      socket?.close();
    } catch (error) {
      // already closed
    }
    child.kill();
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (child.exitCode !== null) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5 }).catch(() => {});
  }
}

export async function navigate(cdp, url) {
  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await loaded;
}

export async function waitFor(cdp, expression, { timeout = 30000, label = expression } = {}) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (await cdp.evaluate(`return !!(${expression});`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for ${label}`);
}

export async function screenshot(cdp, path, clip) {
  const { data } = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    ...(clip ? { clip: { ...clip, scale: 1 } } : {}),
  });
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path, Buffer.from(data, 'base64'));
}

// Answer one URL path with a fixed body, everything else passes through. The
// app fetches /conf at boot; a fresh profile has no such file.
export async function stubPath(cdp, pathname, body) {
  await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `*${pathname}*`, requestStage: 'Request' }] });
  cdp.listeners.set('Fetch.requestPaused', [(params) => {
    const path = new URL(params.request.url).pathname;
    if (path === pathname) {
      cdp.send('Fetch.fulfillRequest', {
        requestId: params.requestId,
        responseCode: 200,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(body).toString('base64'),
      });
      return;
    }
    cdp.send('Fetch.continueRequest', { requestId: params.requestId });
  }]);
}
