import markdownItMath from './libs/markdownItMath';
import extensionSvc from '../services/extensionSvc';
import pwaCacheSvc from '../services/pwaCacheSvc';

let katexPromise;
const pendingRenders = new WeakMap();
const loadKatex = () => {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.css')])
      .then(([module]) => {
        pwaCacheSvc.cacheFetchedStaticAssets();
        return module.default;
      })
      .catch((error) => {
        katexPromise = null;
        throw error;
      });
  }
  return katexPromise;
};

extensionSvc.onGetOptions((options, properties) => {
  options.math = properties.extensions.katex.enabled;
});

extensionSvc.onInitConverter(2, (markdown, options) => {
  if (options.math) {
    markdown.use(markdownItMath);
    markdown.renderer.rules.inline_math = (tokens, idx) =>
      `<span class="katex--inline">${markdown.utils.escapeHtml(tokens[idx].content)}</span>`;
    markdown.renderer.rules.display_math = (tokens, idx) =>
      `<span class="katex--display">${markdown.utils.escapeHtml(tokens[idx].content)}</span>`;
  }
});

extensionSvc.onSectionPreview((elt) => Promise.all(
  Array.from(elt.querySelectorAll('.katex--inline, .katex--display')).map((formula) => {
    if (formula.highlighted) return undefined;
    if (pendingRenders.has(formula)) return pendingRenders.get(formula);
    const source = formula.textContent;
    const isCurrent = () => formula.isConnected && formula.textContent === source;
    const rendering = loadKatex().then((katex) => {
      if (!isCurrent()) return;
      const html = katex.renderToString(source, { displayMode: formula.classList.contains('katex--display') });
      formula.innerHTML = html;
      formula.highlighted = true;
      formula.removeAttribute('title');
      formula.classList.remove('katex-error');
    }).catch((error) => {
      if (!isCurrent()) return;
      formula.classList.add('katex-error');
      formula.title = `公式渲染失败：${error.message}`;
    }).finally(() => pendingRenders.delete(formula));
    pendingRenders.set(formula, rendering);
    return rendering;
  }),
));
