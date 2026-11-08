const HOST = 'cc.cd.kedit.folder_paste';
const ORIGIN = 'https://kedit.cc.cd';

chrome.runtime.onMessage.addListener((request, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0
    || sender.origin !== ORIGIN || !sender.tab
    || !sender.url?.startsWith(`${ORIGIN}/`)
    || request?.version !== 1 || request.action !== 'readFolders'
    || typeof request.requestId !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(request.requestId)
    || !Array.isArray(request.names) || request.names.length > 256
    || !request.names.every(name => typeof name === 'string' && name.length <= 32767)) return false;
  const { requestId } = request;
  chrome.runtime.sendNativeMessage(HOST, request, (reply) => {
    const failed = chrome.runtime.lastError || reply?.version !== 1 || reply.requestId !== requestId;
    respond(failed ? { version: 1, requestId, status: 'unavailable' } : reply);
  });
  return true;
});
