// Top-bar button ordering/visibility resolution shared by NavigationBar and the
// visual settings tab. Order model (ADR 0009): `editor.headButtonOrder` is a
// plain string list; buttons absent from it append in the built-in array order.
// Visibility stays in `editor.headButtons.<method> !== false` (orthogonal).
// The spacer sits after the last visible button of the media/code group.

import pagedownButtons from '../data/pagedownButtons.js';

const MEDIA_GROUP = ['image', 'codeblock', 'inlinecode'];

const builtinOrder = () => pagedownButtons.map(b => b.method).filter(Boolean);

// -> string[] of methods in display order (no spacer marker)
const resolveOrder = (editorSettings, buttons) => {
  const real = (buttons || pagedownButtons).map(b => b.method).filter(Boolean);
  const order = (editorSettings && editorSettings.headButtonOrder) || [];
  const seen = new Set();
  const head = [];
  order.forEach((method) => {
    if (real.includes(method) && !seen.has(method)) {
      seen.add(method);
      head.push(method);
    }
  });
  return head.concat(real.filter(m => !seen.has(m)));
};

// Insert the spacer after the last media-group button; none visible -> no spacer.
const applySpacer = (methods) => {
  let idx = -1;
  methods.forEach((m, i) => {
    if (MEDIA_GROUP.includes(m)) {
      idx = i;
    }
  });
  if (idx === -1) {
    return methods;
  }
  const out = methods.slice();
  out.splice(idx + 1, 0, null);
  return out;
};

const move = (methods, method, dir) => {
  const out = methods.slice();
  const from = out.indexOf(method);
  const to = from + dir;
  if (from === -1 || to < 0 || to >= out.length) {
    return out;
  }
  out.splice(from, 1);
  out.splice(to, 0, method);
  return out;
};

// Full render list for NavigationBar / visuals: visible only, spacer inserted.
const resolveVisibleList = (editorSettings, buttons) => {
  const real = (buttons || pagedownButtons).filter(b => b.method);
  const byMethod = Object.create(null);
  real.forEach(b => { byMethod[b.method] = b; });
  const show = (editorSettings && editorSettings.headButtons) || {};
  const ordered = resolveOrder(editorSettings, buttons)
    .filter(m => show[m] !== false);
  return applySpacer(ordered).map(m => (m === null ? {} : byMethod[m]));
};

export default {
  mediaGroup: MEDIA_GROUP,
  builtinOrder,
  resolveOrder,
  applySpacer,
  move,
  resolveVisibleList,
};
