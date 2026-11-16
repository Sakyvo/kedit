// Minimal CSS rule reader for the "shipped stylesheet" seam: tests assert on
// declarations of the compiled SCSS, not on how the SCSS is organised.
export function parseRules(css) {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let index = 0;
  while (index < source.length) {
    const open = source.indexOf('{', index);
    if (open === -1) break;
    const prelude = source.slice(index, open).trim();
    let depth = 1;
    let cursor = open + 1;
    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1;
      else if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }
    const body = source.slice(open + 1, cursor - 1);
    if (!prelude.startsWith('@')) {
      rules.push({ selectors: prelude.split(',').map(s => s.trim()), body });
    }
    index = cursor;
  }
  return rules;
}

export function declarations(body) {
  const result = Object.create(null);
  body.split(';').forEach((chunk) => {
    const [rawProp, ...rest] = chunk.split(':');
    if (!rest.length) return;
    const prop = rawProp.trim();
    if (!prop) return;
    result[prop] = rest.join(':').trim();
  });
  return result;
}

// Last matching declaration wins, so later rules override earlier ones — the
// same cascade order the browser applies inside one stylesheet.
export function declarationFor(rules, selector, prop) {
  let value;
  rules.forEach((rule) => {
    if (!rule.selectors.includes(selector)) return;
    const decls = declarations(rule.body);
    if (decls[prop] !== undefined) value = decls[prop];
  });
  return value;
}

export function selectorsMentioning(rules, needle) {
  return rules
    .filter(rule => rule.selectors.some(selector => selector.includes(needle)))
    .map(rule => rule.selectors.join(', '));
}
