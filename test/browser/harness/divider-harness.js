// Browser harness for the divider tiers and the preview wrap rule. It mounts the
// real renderer (markdown-it + markdownExtension) and the real editor
// highlighting path (Prism + markdownGrammarSvc) with the real stylesheets, so a
// headless check observes exactly what the app ships.
import '../../../src/styles/index';
// Global app sheet: the app imports it too (App.vue).
import '../../../src/styles/app.scss';
// The app imports this from App.vue; the harness needs it for the editor tiers.
import '../../../src/styles/markdownHighlighting.scss';
import MarkdownIt from 'markdown-it';
import '../../../src/extensions/markdownExtension';
import extensionSvc from '../../../src/services/extensionSvc';
import grammarSvc from '../../../src/services/markdownGrammarSvc';
import { safeHighlight } from '../../../src/services/prismSvc';

const converter = new MarkdownIt('zero');
converter.core.ruler.enable([], true);
converter.block.ruler.enable([], true);
converter.inline.ruler.enable([], true);
const options = {
  html: true,
  breaks: true,
  linkify: false,
  typographer: false,
  fence: true,
  table: true,
  deflist: true,
  footnote: true,
  abbr: true,
  mark: true,
  sub: true,
  sup: true,
  tasklist: true,
  imgsize: true,
};
extensionSvc.initConverter(converter, options);
['code', 'fence', 'blockquote', 'hr', 'list', 'reference', 'heading', 'html_block',
  'table', 'paragraph'].forEach(rule => converter.block.ruler.enable([rule], true));
['text', 'newline', 'escape', 'backticks', 'strikethrough', 'emphasis', 'link',
  'image', 'autolink', 'html_inline', 'entity'].forEach(rule => converter.inline.ruler.enable([rule], true));
converter.block.ruler.enable(['lheading'], false);

const grammars = grammarSvc.makeGrammars({ ...options, insideFences: {} });

const themeStyles = Object.create(null);

const loadThemeScript = name => new Promise((resolve, reject) => {
  if (themeStyles[name]) {
    resolve();
    return;
  }
  const script = document.createElement('script');
  script.src = `/static/themes/${name}.js`;
  script.onload = () => {
    const init = window[`init_${name.replace(/-/g, '_')}`];
    if (init) init();
    themeStyles[name] = true;
    resolve();
  };
  script.onerror = () => reject(new Error(`cannot load ${name}`));
  document.head.appendChild(script);
});

const previewClasses = [];
window.harness = {
  // Render markdown through the shipped converter and return the HTML.
  render: (markdown) => {
    const html = converter.render(markdown);
    document.getElementById('preview').innerHTML = html;
    return html;
  },
  // Highlight one source line through the shipped editor path.
  highlight: (line) => {
    const html = safeHighlight(line, grammars.main, 'markdown');
    document.getElementById('editor').innerHTML = html;
    return html;
  },
  setTheme: async ({ preview, edit, dark }) => {
    const previewElt = document.getElementById('preview');
    previewClasses.forEach(name => previewElt.classList.remove(`preview-theme--${name}`));
    previewClasses.length = 0;
    if (preview) {
      await loadThemeScript(preview);
      previewElt.classList.add(`preview-theme--${preview}`);
      previewClasses.push(preview.replace('preview-theme-', ''));
    }
    document.body.classList.toggle('app--dark', !!dark);
    const editorElt = document.getElementById('editor');
    editorElt.className = 'editor__inner markdown-highlighting';
    if (edit) {
      await loadThemeScript(edit);
      editorElt.classList.add(`edit-theme--${edit.replace('edit-theme-', '')}`);
    }
  },
  addCustomTheme: (css) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  },
  reset: () => {
    document.getElementById('preview').innerHTML = '';
    document.getElementById('editor').innerHTML = '';
  },
};

window.harnessReady = true;
