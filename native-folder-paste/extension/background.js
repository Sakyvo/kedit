const HOST = 'cc.cd.kedit.folder_paste';
const ORIGIN = 'https://kedit.cc.cd';
// A paste is abandoned after this long, counted from the page trigger.
const WAIT = 4000;
// The host must announce readiness within this, or the connection is dropped.
const READY_TIMEOUT = 3000;
const RETRY_DELAYS = [250, 1000, 4000];
const MAX_ATTEMPTS = 4;

const pages = new Set();
const pending = new Map();
let host = null;
let retryTimer = 0;
let failures = 0;

// Content-script senders do not always expose sender.origin (Chromium forks
// differ), so the page identity is derived from the sender URL instead.
function isKeditPage(sender) {
  if (!sender || sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab) return false;
  if (sender.origin && sender.origin !== ORIGIN) return false;
  const url = typeof sender.url === 'string' ? sender.url : sender.tab.url;
  return typeof url === 'string' && (url === `${ORIGIN}/` || url.startsWith(`${ORIGIN}/`));
}

function isReadFolders(request) {
  return request?.version === 1 && request.action === 'readFolders'
    && typeof request.requestId === 'string' && /^[a-z0-9-]{1,80}$/i.test(request.requestId)
    && Array.isArray(request.names) && request.names.length <= 256
    && request.names.every(name => typeof name === 'string' && name.length <= 32767);
}

function closeHost() {
  if (!host) return;
  const current = host;
  host = null;
  clearTimeout(current.timer);
  try { current.port.disconnect(); } catch { /* already gone */ }
}

function failAll() {
  for (const [requestId, entry] of pending) {
    clearTimeout(entry.timer);
    entry.respond({ version: 1, requestId, status: 'unavailable' });
  }
  pending.clear();
}

function settle(message) {
  if (!message || message.version !== 1) return;
  const entry = pending.get(message.requestId);
  if (!entry) return;
  pending.delete(message.requestId);
  clearTimeout(entry.timer);
  entry.respond(message);
}

// Requests are queued until the host proves it is ready; the host process is
// never assumed live because connectNative returned a port.
function flush() {
  if (!host || !host.ready) return;
  for (const [requestId, entry] of pending) {
    if (entry.sent) continue;
    entry.sent = true;
    try {
      host.port.postMessage({ version: 1, action: 'readFolders', requestId, names: entry.names });
    } catch { /* the disconnect handler settles it */ }
  }
}

function scheduleRetry() {
  if (retryTimer || !pages.size || failures >= MAX_ATTEMPTS) return;
  const delay = RETRY_DELAYS[Math.min(failures - 1, RETRY_DELAYS.length - 1)] || RETRY_DELAYS[0];
  retryTimer = setTimeout(() => {
    retryTimer = 0;
    openHost();
  }, delay);
}

function openHost() {
  if (host || !pages.size) return;
  let port;
  try {
    port = chrome.runtime.connectNative(HOST);
  } catch {
    failures += 1;
    scheduleRetry();
    return;
  }
  const current = { port, ready: false, timer: 0 };
  host = current;
  current.timer = setTimeout(() => {
    if (host !== current || current.ready) return;
    failures += 1;
    closeHost();
    scheduleRetry();
  }, READY_TIMEOUT);
  port.onMessage.addListener(message => {
    if (host !== current) return;
    if (message?.version === 1 && message.type === 'ready') {
      current.ready = true;
      failures = 0;
      clearTimeout(current.timer);
      flush();
      return;
    }
    settle(message);
  });
  port.onDisconnect.addListener(() => {
    // Reading lastError marks it handled; a killed host reports here.
    void chrome.runtime.lastError;
    if (host !== current) return;
    if (!current.ready) failures += 1;
    closeHost();
    // In-flight work fails; it is never replayed, because the paste already
    // happened and the clipboard may have moved on.
    failAll();
    scheduleRetry();
  });
}

function readFolders(request, respond) {
  const { requestId } = request;
  if (pending.has(requestId)) {
    respond({ version: 1, requestId, status: 'unavailable' });
    return true;
  }
  const timer = setTimeout(() => {
    if (!pending.has(requestId)) return;
    pending.delete(requestId);
    respond({ version: 1, requestId, status: 'unavailable' });
  }, WAIT);
  pending.set(requestId, { respond, names: request.names, sent: false, timer });
  if (!host) openHost();
  flush();
  return true;
}

function releaseHost() {
  if (retryTimer) {
    clearTimeout(retryTimer);
    retryTimer = 0;
  }
  failures = 0;
  closeHost();
  failAll();
}

// One host process per browser profile: every KEDIT page shares it, and the
// last page to leave shuts it down.
chrome.runtime.onConnect.addListener(port => {
  if (port.name !== 'kedit-page' || !isKeditPage(port.sender)) return;
  pages.add(port);
  port.onDisconnect.addListener(() => {
    void chrome.runtime.lastError;
    pages.delete(port);
    if (!pages.size) releaseHost();
  });
  openHost();
});

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (!isKeditPage(sender) || !isReadFolders(request)) return false;
  return readFolders(request, respond);
});