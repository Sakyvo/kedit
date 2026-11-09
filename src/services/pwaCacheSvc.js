// Bridges the first visit gap: assets fetched before the service worker
// controlled this page would otherwise never reach the runtime cache.
const STATIC_ASSET = /\/static\/.*\.(?:js|css|woff2?|png|svg)$/;
const MESSAGE = 'CACHE_URLS';

let activeWorker;
let waitingForActivation = false;

const fetchedStaticAssets = () => [...new Set(performance.getEntriesByType('resource')
  .map(entry => new URL(entry.name))
  .filter(url => url.origin === window.location.origin && STATIC_ASSET.test(url.pathname))
  .map(url => url.pathname))];

const post = worker => {
  const urls = fetchedStaticAssets();
  if (!urls.length) return false;
  worker.postMessage({ type: MESSAGE, payload: { urlsToCache: urls } });
  return true;
};

// Only assets this page actually used are handed over; the worker applies its
// own same-origin static route, so other URLs stay untouched. Called again by
// each lazy renderer so a chunk fetched before activation is not lost.
const cacheFetchedStaticAssets = () => {
  if (!('serviceWorker' in navigator) || navigator.serviceWorker.controller) return false;
  if (activeWorker) return post(activeWorker);
  if (!waitingForActivation) {
    waitingForActivation = true;
    navigator.serviceWorker.ready.then((registration) => {
      activeWorker = registration.active;
      if (activeWorker) post(activeWorker);
    }).catch(() => {
      waitingForActivation = false;
    });
  }
  return false;
};

export default { cacheFetchedStaticAssets };
