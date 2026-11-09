const HOST = 'cc.cd.kedit.folder_paste';
const ORIGIN = 'https://kedit.cc.cd';

// Content-script senders do not always expose sender.origin (Chromium forks
// differ), so the page identity is derived from the sender URL instead.
function isKeditPage(sender) {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab) return false;
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

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (!isKeditPage(sender) || !isReadFolders(request)) return false;
  const { requestId } = request;
  chrome.runtime.sendNativeMessage(HOST, request, (reply) => {
    const failed = chrome.runtime.lastError || reply?.version !== 1 || reply.requestId !== requestId;
    respond(failed ? { version: 1, requestId, status: 'unavailable' } : reply);
  });
  return true;
});
