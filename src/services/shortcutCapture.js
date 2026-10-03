// Keyboard-shortcut capture helpers for the settings visual tab.
// comboFromEvent normalizes a keydown into mousetrap grammar (mod+shift+b …).

const MODIFIER_KEYS = new Set(['Control', 'Shift', 'Alt', 'Meta']);

const comboFromEvent = (e) => {
  if (!e || MODIFIER_KEYS.has(e.key)) {
    return null;
  }
  let key = (e.key || '').toLowerCase();
  if (key === ' ') {
    key = 'space';
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
  parts.push(key);
  return parts.join('+');
};

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
};
