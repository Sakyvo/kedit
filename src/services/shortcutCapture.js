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

// combo -> bound method (expand form has { method, params }; owner = method name).
// null/false 值 = 用户显式删除（custom yaml 写 null 盖过 defaults 的默认绑定）。
const comboOwner = (shortcuts, combo) => {
  const hit = (shortcuts || {})[combo];
  if (hit === undefined || hit === null || hit === false) {
    return undefined;
  }
  return hit.method || hit;
};

// method -> currently bound combo. merged shortcuts 可能为一个 method 挂多个
// 组合键（defaults 残留 + custom 覆盖）；取最后一个（mergeInto 的
// Object.assign 里 custom 键在后，即用户最新绑定）。
const comboOfMethod = (shortcuts, method) => {
  const entries = Object.entries(shortcuts || {})
    .filter(([, v]) => {
      if (v === null || v === false) {
        return false;
      }
      return (v && v.method ? v.method : v) === method;
    });
  const entry = entries[entries.length - 1];
  return entry ? entry[0] : '';
};

export default {
  comboFromEvent,
  comboOwner,
  comboOfMethod,
  displayCombo,
};
