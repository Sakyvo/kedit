// Keyboard-shortcut capture helpers for the settings visual tab.
// comboFromEvent normalizes a keydown into mousetrap grammar (mod+shift+b …).
// Bare keys: only non-editing keys (esc, f1–f12, arrows are NOT bare — a bare
// arrow would hijack caret movement) may bind without modifiers.

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);
const BARE_KEYS = new Set(['Escape', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12']);

const keyName = (key) => {
  let k = `${key}`.toLowerCase();
  if (k === ' ') k = 'space';
  if (k === 'escape') k = 'esc';
  k = k.replace(/^arrow(up|down|left|right)$/, '$1');
  return k;
};

const comboFromEvent = (e) => {
  if (!e || MODIFIER_KEYS.has(e.key)) {
    return null;
  }
  const hasMod = !!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey);
  if (!hasMod && !BARE_KEYS.has(e.key)) {
    return null;
  }
  const parts = [];
  if (e.ctrlKey || e.metaKey) {
    parts.push('mod');
  }
  if (e.altKey) {
    parts.push('alt');
  }
  if (e.shiftKey) {
    parts.push('shift');
  }
  parts.push(keyName(e.key));
  return parts.join('+');
};

const DISPLAY_PART = {
  ctrl: 'Ctrl', meta: 'Cmd', mod: 'mod', alt: 'Alt', shift: 'Shift',
  esc: 'Esc', space: 'Space', delete: 'Del', up: '↑', down: '↓', left: '←', right: '→',
};

const displayCombo = (combo, isMac) => combo
  .split('+')
  .map((part) => {
    if (part === 'mod') {
      return isMac ? 'Cmd' : 'Ctrl';
    }
    if (DISPLAY_PART[part]) {
      return DISPLAY_PART[part];
    }
    return /^f\d+$/.test(part) ? part.toUpperCase() : `${part[0] ? part[0].toUpperCase() : ''}${part.slice(1)}`;
  })
  .join('+');

// combo -> bound method (expand form has { method, params }; owner = method name)
const comboOwner = (shortcuts, combo) => {
  const hit = (shortcuts || {})[combo];
  return hit === undefined ? undefined : hit.method || hit;
};

// method -> currently bound combo
const comboOfMethod = (shortcuts, method) => {
  const entry = Object.entries(shortcuts || {})
    .find(([, v]) => (v && v.method ? v.method : v) === method);
  return entry ? entry[0] : '';
};

export default {
  comboFromEvent,
  comboOwner,
  comboOfMethod,
  displayCombo,
};
