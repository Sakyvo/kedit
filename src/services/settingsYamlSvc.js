// Line-surgery read/write over the custom settings yaml text.
// The yaml string in data/settings is the single source of truth (see ADR 0009):
// visual UI and the syncExclude projection both write through this service so
// comments, unknown keys and user formatting round-trip untouched.
//
// Limitations (accepted): a ` #` sequence inside a quoted scalar value may be
// mistaken for a trailing comment; same-indent `- item` style is tolerated for
// reading but writing always uses indented dash style.

import yaml from 'js-yaml';

const INDENT = '  ';

const parseKeyLine = (line) => {
  const im = /^([ \t]*)/.exec(line);
  const rest = line.slice(im[1].length);
  if (!rest || rest[0] === '#' || rest === '---' || rest === '...' || rest.startsWith('--- ')) {
    return null;
  }
  if (rest === '-' || rest.startsWith('- ')) {
    return null;
  }
  let km;
  if (rest[0] === "'") {
    km = /^('(?:[^']|'')*')[ \t]*:(?:[ \t]+(.*))?$/.exec(rest);
  } else if (rest[0] === '"') {
    km = /^("(?:[^"\\]|\\.)*")[ \t]*:(?:[ \t]+(.*))?$/.exec(rest);
  } else {
    km = /^([^:#]+?)[ \t]*:(?:[ \t]+(.*))?$/.exec(rest);
  }
  if (!km) {
    return null;
  }
  const rawKey = km[1];
  const key = rest[0] === "'" ? rawKey.slice(1, -1).replace(/''/g, "'")
    : rest[0] === '"' ? rawKey.slice(1, -1)
      : rawKey;
  const value = km[2] === undefined ? '' : km[2].replace(/[ \t]+$/, '');
  return { indent: im[1].length, rawKey, key, value };
};

const lineIndentOf = raw => raw.length - raw.trimStart().length;
const isCommentLine = raw => raw.trimStart().startsWith('#');

const splitLines = (text) => {
  let t = `${text || ''}`;
  if (t && !t.endsWith('\n')) {
    t += '\n';
  }
  return t.split('\n');
};

// Physical end (exclusive) of the block owned by the key line at `idx`.
const blockEnd = (lines, idx) => {
  const { indent } = parseKeyLine(lines[idx]);
  let last = idx;
  for (let i = idx + 1; i < lines.length; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) {
      continue;
    }
    const ind = lineIndentOf(raw);
    if (ind <= indent && (isCommentLine(raw) || parseKeyLine(raw))) {
      break;
    }
    last = i;
  }
  return last + 1;
};

// Direct mapping children inside (from, to) whose indent is deeper than parentIndent.
const directChildren = (lines, from, to, parentIndent) => {
  const out = [];
  let childIndent = -1;
  for (let i = from; i < to; i += 1) {
    const raw = lines[i];
    if (!raw.trim()) {
      continue;
    }
    const ind = lineIndentOf(raw);
    const pl = parseKeyLine(raw);
    if (ind <= parentIndent && (isCommentLine(raw) || pl)) {
      break;
    }
    if (!pl) {
      continue;
    }
    if (childIndent === -1) {
      childIndent = ind;
    }
    if (ind === childIndent) {
      out.push({ idx: i, indent: ind, key: pl.key, rawKey: pl.rawKey, value: pl.value });
    }
  }
  return out;
};

// Locate a key path. found = matched nodes in order. If incomplete, insert
// context for the first missing segment is provided.
const locate = (lines, path) => {
  let from = 0;
  let to = lines.length;
  let parentIndent = -1;
  const found = [];
  for (let s = 0; s < path.length; s += 1) {
    const children = directChildren(lines, from, to, parentIndent);
    const node = children.find(c => c.key === path[s]);
    if (!node) {
      const lastFound = found[found.length - 1];
      const insertPos = lastFound ? blockEnd(lines, lastFound.idx)
        : lastIndexBeforeTrailingBlanks(lines);
      const insertIndent = children.length ? children[0].indent : parentIndent + 2;
      return { found, complete: false, insertPos, insertIndent };
    }
    found.push(node);
    from = node.idx + 1;
    to = blockEnd(lines, node.idx);
    parentIndent = node.indent;
  }
  return { found, complete: true };
};

const lastIndexBeforeTrailingBlanks = (lines) => {
  // lines always ends with '' because text ends with \n; insert before the
  // trailing blank run so appended content stays at file end without gaps.
  let i = lines.length - 1;
  while (i > 0 && !lines[i - 1].trim()) {
    i -= 1;
  }
  return i;
};

const pad = n => INDENT.repeat(n / 2);

const fmtKey = (key) => {
  if (!key || /[:#]/.test(key) || key.trim() !== key || /^[-!&*?%@`|[\]{},>"']/.test(key)) {
    return `'${key.replace(/'/g, "''")}'`;
  }
  return key;
};

const scalarText = value => yaml.dump(value, { lineWidth: -1 }).trim();

const renderBlock = (value, indent) => yaml.dump(value, { lineWidth: -1 })
  .trimEnd()
  .split('\n')
  .map(l => pad(indent) + l);

const renderSubtree = (segments, value, indent) => {
  const [head, ...rest] = segments;
  if (!rest.length) {
    if (value !== null && typeof value === 'object') {
      return [`${pad(indent)}${fmtKey(head)}:`, ...renderBlock(value, indent + 2)];
    }
    return [`${pad(indent)}${fmtKey(head)}: ${scalarText(value)}`];
  }
  return [`${pad(indent)}${fmtKey(head)}:`, ...renderSubtree(rest, value, indent + 2)];
};

const get = (text, path) => {
  let cur = yaml.load(`${text || ''}`) || {};
  for (let i = 0; i < path.length; i += 1) {
    if (cur === null || typeof cur !== 'object') {
      return undefined;
    }
    cur = cur[path[i]];
  }
  return cur;
};

const set = (text, path, value) => {
  const lines = splitLines(text);
  if (!lines.some(l => l.trim())) {
    return `${renderSubtree(path, value, 0).join('\n')}\n`;
  }
  const loc = locate(lines, path);
  if (!loc.complete) {
    lines.splice(loc.insertPos, 0, ...renderSubtree(path.slice(loc.found.length), value, Math.max(loc.insertIndent, 0)));
    return lines.join('\n');
  }
  const node = loc.found[loc.found.length - 1];
  const ind = node.indent;
  if (value !== null && typeof value === 'object') {
    // Replace the whole subtree; the key line keeps no trailing comment.
    const end = blockEnd(lines, node.idx);
    lines.splice(node.idx, end - node.idx,
      `${pad(ind)}${node.rawKey}:`,
      ...renderBlock(value, ind + 2));
    return lines.join('\n');
  }
  // Scalar: keep trailing comment when present.
  const commentMatch = /\s+#.*$/.exec(node.value);
  const comment = commentMatch ? commentMatch[0] : '';
  lines[node.idx] = `${pad(ind)}${node.rawKey}: ${scalarText(value)}${comment}`;
  return lines.join('\n');
};

const hasContent = (lines, idx) => {
  const end = blockEnd(lines, idx);
  for (let i = idx + 1; i < end; i += 1) {
    if (lines[i].trim() && !isCommentLine(lines[i])) {
      return true;
    }
  }
  return false;
};

const removePath = (lines, path) => {
  let out = lines;
  const loc = locate(out, path);
  if (!loc.complete) {
    return out;
  }
  const node = loc.found[loc.found.length - 1];
  out.splice(node.idx, blockEnd(out, node.idx) - node.idx);
  // Drop ancestors that became empty (deepest first). Ancestor indices are
  // stable: they sit above the removed block.
  for (let d = loc.found.length - 2; d >= 0; d -= 1) {
    const anc = loc.found[d];
    if (!hasContent(out, anc.idx)) {
      out.splice(anc.idx, 1);
    } else {
      break;
    }
  }
  return out;
};

const remove = (text, paths) => {
  const lines = splitLines(text);
  const norm = (paths || []).map(p => (Array.isArray(p) ? p : [p]));
  norm.sort((a, b) => b.length - a.length);
  let out = lines;
  norm.forEach((path) => {
    out = removePath(out, path);
  });
  return out.join('\n').replace(/\n{3,}/g, '\n\n');
};

// Overlay local values of locally-excluded keys onto the remote text.
// `syncExclude` itself is always added to the exclusions (never synced).
const applyRemote = (localText, remoteText, excluded) => {
  const norm = (excluded || []).map(p => (Array.isArray(p) ? p : [p]));
  if (!norm.some(p => p.length === 1 && p[0] === 'syncExclude')) {
    norm.push(['syncExclude']);
  }
  let out = `${remoteText || ''}`;
  if (out && !out.endsWith('\n')) {
    out += '\n';
  }
  norm.forEach((path) => {
    const localValue = get(localText, path);
    if (localValue !== undefined) {
      out = set(out, path, localValue);
    }
  });
  return out;
};

// Deep-merge a custom settings object over the defaults object.
// Same semantics as store/data.js computedSettings historically had: only keys
// present in the defaults are picked up from custom; `shortcuts` merges per-key;
// type mismatches keep the default. `base` is NOT mutated.
const mergeInto = (base, custom) => {
  const baseType = Object.prototype.toString.call(base);
  const customType = Object.prototype.toString.call(custom);
  if (baseType !== customType) {
    return base;
  }
  if (baseType !== '[object Object]') {
    return custom;
  }
  Object.keys(base).forEach((key) => {
    if (custom[key] === undefined) {
      return;
    }
    if (key === 'shortcuts') {
      base[key] = Object.assign(base[key], custom[key]);
    } else {
      base[key] = mergeInto(base[key], custom[key]);
    }
  });
  return base;
};

const mergeSettings = (base, customText) => {
  const custom = yaml.load(`${customText || ''}`) || {};
  return mergeInto(JSON.parse(JSON.stringify(base)), custom);
};

export default {
  get,
  set,
  remove,
  applyRemote,
  mergeSettings,
};
