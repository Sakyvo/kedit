import extensionSvc from '../services/extensionSvc';
import utils from '../services/utils';
import pwaCacheSvc from '../services/pwaCacheSvc';

const baseConfig = {
  startOnLoad: false,
  look: 'classic',
  securityLevel: 'strict',
  deterministicIds: false,
  suppressErrorRendering: true,
  fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  flowchart: {
    htmlLabels: false,
    curve: 'linear',
  },
  sequence: {
    diagramMarginX: 50,
    diagramMarginY: 10,
    actorMargin: 50,
    width: 150,
    height: 65,
    boxMargin: 10,
    boxTextMargin: 5,
    noteMargin: 10,
    messageMargin: 35,
    mirrorActors: true,
    bottomMarginAdj: 1,
    useMaxWidth: true,
  },
  gantt: {
    titleTopMargin: 25,
    barHeight: 20,
    barGap: 4,
    topPadding: 50,
    leftPadding: 75,
    gridLineStartPadding: 35,
    fontSize: 11,
    fontFamily: '"Open-Sans", "sans-serif"',
    numberSectionStyles: 4,
    axisFormat: '%Y-%m-%d',
  },
};

let currentTheme;
let mermaidPromise;
let renderQueue = Promise.resolve();
const pendingRenders = new WeakMap();

const loadMermaid = () => {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((module) => {
      pwaCacheSvc.cacheFetchedStaticAssets();
      return module.default;
    }).catch((error) => {
      mermaidPromise = null;
      throw error;
    });
  }
  return mermaidPromise;
};

const getTheme = (elt) => {
  if (elt.closest('.app--dark')) {
    return 'dark';
  }
  return 'default';
};

const ensureConfig = (mermaid, theme) => {
  if (currentTheme === theme) {
    return;
  }
  mermaid.initialize({
    ...baseConfig,
    theme,
  });
  currentTheme = theme;
};

const escapeHtml = (value = '') => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const render = (elt) => {
  const code = elt.querySelector('.prism.language-mermaid');
  const source = (code ? code.textContent : elt.dataset.mermaidSource || '').trim();
  if (!source || !elt.isConnected) return Promise.resolve();
  const theme = getTheme(elt);
  const pending = pendingRenders.get(elt);
  if (pending && pending.source === source && pending.theme === theme) return pending.promise;
  const job = { source, theme };
  const isCurrent = () => elt.isConnected && pendingRenders.get(elt) === job
    && (!code || (elt.contains(code) && code.textContent.trim() === source));
  job.promise = renderQueue.then(async () => {
    try {
      const mermaid = await loadMermaid();
      if (!isCurrent()) return;
      ensureConfig(mermaid, theme);
      const { svg } = await mermaid.render(`mermaid-svg-${utils.uid()}`, source);
      if (!isCurrent()) return;
      elt.dataset.mermaidSource = source;
      elt.innerHTML = svg;
      elt.classList.add('mermaid-diagram');
      elt.classList.remove('mermaid-error');
    } catch (error) {
      if (!isCurrent()) return;
      elt.dataset.mermaidSource = source;
      elt.classList.remove('mermaid-diagram');
      elt.classList.add('mermaid-error');
      elt.innerHTML = `<div class="mermaid-error__title">Mermaid 渲染失败</div>
        <pre class="mermaid-error__message">${escapeHtml(error.message || 'Unknown Mermaid error')}</pre>
        <code>${escapeHtml(source)}</code>`;
    } finally {
      if (pendingRenders.get(elt) === job) pendingRenders.delete(elt);
    }
  });
  pendingRenders.set(elt, job);
  renderQueue = job.promise;
  return job.promise;
};

extensionSvc.onGetOptions((options, properties) => {
  options.mermaid = properties.extensions.mermaid.enabled;
});

extensionSvc.onSectionPreview((elt, options) => {
  if (!options.mermaid) return;
  const diagrams = Array.from(elt.querySelectorAll('.prism.language-mermaid'));
  // 返回 Promise.all 以等待所有图表渲染完成
  return Promise.all(
    diagrams.map(diagramElt => render(diagramElt.parentNode))
  );
});

export const rerenderMermaidDiagrams = elt => Promise.all(
  Array.from(elt.querySelectorAll('[data-mermaid-source]'))
    .map(diagramElt => render(diagramElt))
);
