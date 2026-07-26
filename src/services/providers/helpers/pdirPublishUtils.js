/** Pure helpers for publishing a Document into a pdir edit target. */
import SHA1 from 'crypto-js/sha1.js';
import encBase64 from 'crypto-js/enc-base64.js';
import encLatin1 from 'crypto-js/enc-latin1.js';

export const PDIR_OWNER = 'Sakyvo';
export const PDIR_REPO = 'the-potpvp-directory';
export const PDIR_BRANCH = 'main';
export const PDIR_MAIN_FILE = 'content/main.md';
export const PDIR_SITE_URL = 'https://pdir.cc.cd/';
export const PDIR_EDIT_BOUNDARY_TITLE = 'Part 3. Video';
export const UNNAMED_ALT = '输入图片说明';

export function findPdirToken(githubTokensBySub) {
  if (!githubTokensBySub) {
    return null;
  }
  return Object.values(githubTokensBySub).find(token => token && token.name === PDIR_OWNER)
    || null;
}

/**
 * Fence-aware ATX heading scan. Returns [{level, title, line}].
 */
export function scanHeadings(md) {
  const headings = [];
  let inFence = false;
  `${md}`.split('\n').forEach((lineText, line) => {
    if (/^(```|~~~)/.test(lineText)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const match = lineText.match(/^(#{1,6})\s+(.*?)\s*$/);
    if (match) {
      headings.push({ level: match[1].length, title: match[2], line });
    }
  });
  return headings;
}

function decodeCodePoint(code, radix) {
  const value = parseInt(code, radix);
  return value <= 0x10ffff ? String.fromCodePoint(value) : '\ufffd';
}

export function stripHeadingMarkup(text) {
  return `${text || ''}`
    .replace(/[*_`~]/g, ' ')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&#(\d+);/g, (match, code) => decodeCodePoint(code, 10))
    .replace(/&#x([\da-f]+);/gi, (match, code) => decodeCodePoint(code, 16))
    .replace(/&(amp|lt|gt|quot|apos);/g, (match, entity) => ({
      amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
    })[entity])
    .replace(/\s+/g, ' ')
    .trim();
}

function parsePdirDoc(md) {
  const lines = `${md || ''}`.replace(/\r\n/g, '\n').split('\n');
  const headings = [];
  let inCode = false;

  lines.forEach((lineText, line) => {
    if (/^```/.test(lineText.trim())) {
      inCode = !inCode;
    }
    if (inCode) {
      return;
    }
    const match = lineText.match(/^(#{2,6})\s+(.+)/);
    if (!match) {
      return;
    }
    const rawTitle = match[2].trim();
    headings.push({
      level: match[1].length,
      rawTitle,
      title: stripHeadingMarkup(rawTitle) || rawTitle,
      line,
    });
  });

  const h2s = headings.filter(heading => heading.level === 2);
  const sections = [];
  const addSection = (startLine, endLine, heading) => {
    const contentStartLine = heading ? heading.line + 1 : startLine;
    sections.push({
      title: heading ? heading.title : '序',
      rawTitle: heading ? heading.rawTitle : '序',
      startLine,
      endLine,
      hasHeading: !!heading,
      entries: headings.filter(item => (
        item.level > 2 && item.line >= contentStartLine && item.line < endLine
      )),
    });
  };

  if (h2s.length) {
    if (h2s[0].line > 0 && lines.slice(0, h2s[0].line).some(line => line.trim())) {
      addSection(0, h2s[0].line, null);
    }
    h2s.forEach((heading, idx) => {
      addSection(heading.line, h2s[idx + 1] ? h2s[idx + 1].line : lines.length, heading);
    });
  } else {
    addSection(0, lines.length, null);
  }

  return { lines, headings, sections };
}

function normalizeTargetKeyText(text) {
  return (stripHeadingMarkup(text) || 'module')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff.-]+/g, '')
    .slice(0, 80) || 'module';
}

function makeTargetKey(prefix, title, seen) {
  const base = `${prefix}-${normalizeTargetKeyText(title)}`;
  const count = (seen.get(base) || 0) + 1;
  seen.set(base, count);
  return count > 1 ? `${base}-${count}` : base;
}

/** Mirrors pdir admin's buildEditModules(). */
export function parsePdirTargets(md) {
  const doc = parsePdirDoc(md);
  const boundary = doc.sections.find(section => section.title === PDIR_EDIT_BOUNDARY_TITLE);
  const boundaryStart = boundary ? boundary.startLine : doc.lines.length;
  const seen = new Map();
  const targets = [{
    key: 'all-in-one',
    type: 'all',
    level: 0,
    label: 'ALL IN ONE',
    startLine: 0,
    endLine: doc.lines.length,
  }, {
    key: 'main',
    type: 'main',
    level: 1,
    label: 'main',
    startLine: 0,
    endLine: boundaryStart,
  }];

  doc.sections
    .filter(section => section.hasHeading && section.startLine < boundaryStart)
    .forEach((section) => {
      targets.push({
        key: makeTargetKey('h2', section.rawTitle || section.title, seen),
        type: 'h2',
        level: 1,
        label: section.title,
        startLine: section.startLine,
        endLine: section.endLine,
      });
    });

  if (!boundary) {
    return targets;
  }

  const candidates = [];
  doc.sections.forEach((section) => {
    if (section.startLine <= boundary.startLine) {
      return;
    }
    const firstH3 = section.entries.find(entry => entry.level === 3);
    candidates.push({
      key: makeTargetKey('h2', section.rawTitle || section.title, seen),
      type: 'h2',
      level: 1,
      label: section.title,
      startLine: section.startLine,
      endLine: firstH3 ? firstH3.line : section.endLine,
    });
  });

  const majorHeadings = doc.headings
    .filter(heading => heading.level === 2 || heading.level === 3)
    .sort((a, b) => a.line - b.line);
  doc.headings
    .filter(heading => heading.level === 3 && heading.line > boundary.startLine)
    .sort((a, b) => a.line - b.line)
    .forEach((heading) => {
      const next = majorHeadings.find(item => item.line > heading.line);
      candidates.push({
        key: makeTargetKey('h3', heading.rawTitle || heading.title, seen),
        type: 'h3',
        level: 2,
        label: heading.title,
        startLine: heading.line,
        endLine: next ? next.line : doc.lines.length,
      });
    });

  candidates.sort((a, b) => a.startLine - b.startLine || a.level - b.level);
  return targets.concat(candidates);
}

export function resolvePdirTarget(targets, location) {
  if (!location) {
    return null;
  }
  return targets.find(target => target.key === location.targetKey)
    || targets.find(target => (
      location.targetType && target.type === location.targetType && target.label === location.module
    ))
    || targets.find(target => target.type === 'h3' && target.label === location.module)
    || targets.find(target => target.label === location.module)
    || null;
}

export function replacePdirTarget(md, target, replacement) {
  if (!target) {
    return null;
  }
  const lines = `${md || ''}`.replace(/\r\n/g, '\n').split('\n');
  const nextLines = `${replacement || ''}`.replace(/\r\n/g, '\n').split('\n');
  lines.splice(target.startLine, Math.max(target.endLine - target.startLine, 0), ...nextLines);
  return lines.join('\n');
}

export function findReplacedPdirTarget(md, previousTarget) {
  const targets = parsePdirTargets(md);
  if (previousTarget.type === 'all' || previousTarget.type === 'main') {
    return targets.find(target => target.type === previousTarget.type) || null;
  }
  return targets.find(target => (
    target.type === previousTarget.type && target.startLine === previousTarget.startLine
  )) || null;
}

export function validatePdirTargetContent(text, target) {
  if (!target) {
    return '请选择 pdir 目标。';
  }
  const source = `${text || ''}`;
  const headings = scanHeadings(source);
  const h1 = headings.find(heading => heading.level === 1);
  if (h1) {
    return `第${h1.line + 1}行不能使用一级标题。`;
  }
  const boundaries = headings.filter(heading => (
    heading.level === 2 && stripHeadingMarkup(heading.title) === PDIR_EDIT_BOUNDARY_TITLE
  ));

  if (target.type === 'all') {
    return boundaries.length === 1
      ? ''
      : `ALL IN ONE 必须恰好包含一个「## ${PDIR_EDIT_BOUNDARY_TITLE}」边界。`;
  }
  if (target.type === 'main') {
    return boundaries.length
      ? `main 不能包含「## ${PDIR_EDIT_BOUNDARY_TITLE}」，该边界由 pdir 保留。`
      : '';
  }

  const rootLevel = target.type === 'h2' ? 2 : 3;
  const lines = source.split('\n');
  const firstLine = lines.findIndex(line => line.trim());
  const root = firstLine < 0
    ? null
    : lines[firstLine].match(new RegExp(`^#{${rootLevel}}\\s+(.+?)\\s*$`));
  if (!root) {
    return `目标「${target.label}」是 H${rootLevel} 整段，Document 首个非空行必须是 ${'#'.repeat(rootLevel)} 根标题。`;
  }
  if (rootLevel === 2 && stripHeadingMarkup(root[1]) === PDIR_EDIT_BOUNDARY_TITLE) {
    return `「${PDIR_EDIT_BOUNDARY_TITLE}」是 pdir 固定边界，不能用作此目标的新标题。`;
  }
  const violation = headings.find(heading => (
    heading.line !== firstLine && heading.level <= rootLevel
  ));
  return violation
    ? `第${violation.line + 1}行「${'#'.repeat(violation.level)} ${violation.title}」会越出当前 H${rootLevel} 整段。`
    : '';
}

/**
 * Strip a leading YAML front-matter block (--- ... --- / ...). Source stays intact;
 * this only shapes the publish projection.
 */
export function stripFrontMatter(text) {
  const lines = `${text}`.split('\n');
  if (!/^---\s*$/.test(lines[0] || '')) {
    return text;
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (/^(---|\.\.\.)\s*$/.test(lines[i])) {
      return lines.slice(i + 1).join('\n').replace(/^\s*\n/, '');
    }
  }
  return text;
}

/**
 * Markdown image refs pointing at KEDIT private images (/imgs/...), fence-aware.
 * Returns [{alt, uri}] in document order.
 */
export function listPrivateImgRefs(text) {
  const refs = [];
  let inFence = false;
  `${text}`.split('\n').forEach((lineText) => {
    if (/^(```|~~~)/.test(lineText)) {
      inFence = !inFence;
      return;
    }
    if (inFence) {
      return;
    }
    const re = /!\[([^\]]*)\]\(\s*(\/imgs\/[^)\s]+)\s*\)/g;
    let match = re.exec(lineText);
    while (match) {
      refs.push({ alt: match[1], uri: match[2] });
      match = re.exec(lineText);
    }
  });
  return refs;
}

/**
 * Sanitize an alt text into a repo-safe file base name. Empty result means
 * the alt is unusable — caller falls back to unnamed numbering.
 */
export function sanitizeImgName(alt) {
  return `${alt}`
    .replace(/[\\/:*?"<>|#()]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * git blob sha of a base64 payload: sha1("blob <len>\0" + bytes).
 * Comparable with GitHub tree/contents blob shas — no download needed.
 */
export function computeGitBlobShaFromBase64(base64) {
  const content = encBase64.parse(`${base64}`.replace(/\s/g, ''));
  const header = encLatin1.parse(`blob ${content.sigBytes}${String.fromCharCode(0)}`);
  return SHA1(header.concat(content)).toString();
}

const extOfUri = (uri) => {
  const match = `${uri}`.match(/(\.[a-z0-9]+)$/i);
  return match ? match[1].toLowerCase() : '.png';
};

const listRefNames = (text) => {
  const names = new Set();
  const re = /\/imgs\/([^)\s]+)/g;
  let match = re.exec(`${text}`);
  while (match) {
    names.add(match[1]);
    match = re.exec(text);
  }
  return names;
};

const maxNumberedIn = (names) => {
  let max = 0;
  names.forEach((name) => {
    const match = `${name}`.match(/^(\d+)\.[a-z0-9]+$/i);
    if (match) {
      max = Math.max(max, parseInt(match[1], 10));
    }
  });
  return max;
};

/**
 * Decide the pdir target file for every private image ref.
 * Named (alt ≠ UNNAMED_ALT): alt-based name; same content -> reuse, module-owned
 * -> overwrite, foreign -> "(1)" dodge. Unnamed: content-match against the
 * Module's numbered refs, else next global number. Named images never consume
 * numbers. Duplicate uris keep the first ref's target.
 */
export function planImageUploads({
  refs,
  moduleBody,
  mainMd,
  repoFiles,
  shaByUri,
}) {
  const repoByName = {};
  (repoFiles || []).forEach((file) => {
    repoByName[file.name] = file;
  });
  const moduleRefNames = listRefNames(moduleBody);
  let nextNumber = Math.max(
    maxNumberedIn(new Set(Object.keys(repoByName))),
    maxNumberedIn(listRefNames(mainMd)),
  ) + 1;

  const claimed = new Set();
  const entries = [];
  const replacementByUri = {};
  const stats = { upload: 0, reuse: 0, overwrite: 0 };

  const push = (entry) => {
    claimed.add(entry.targetName);
    entries.push(entry);
    replacementByUri[entry.uri] = `/imgs/${entry.targetName}`;
    stats[entry.action] += 1;
  };

  (refs || []).forEach(({ alt, uri }) => {
    if (replacementByUri[uri]) {
      return;
    }
    const localSha = shaByUri[uri];
    const ext = extOfUri(uri);
    const base = alt === UNNAMED_ALT ? '' : sanitizeImgName(alt);

    if (base) {
      for (let i = 0; ; i += 1) {
        const candidate = `${base}${i ? `(${i})` : ''}${ext}`;
        if (!claimed.has(candidate)) {
          const repoFile = repoByName[candidate];
          if (!repoFile) {
            push({ uri, alt, targetName: candidate, action: 'upload' });
            return;
          }
          if (repoFile.sha === localSha) {
            push({ uri, alt, targetName: candidate, action: 'reuse' });
            return;
          }
          if (moduleRefNames.has(candidate)) {
            push({
              uri, alt, targetName: candidate, action: 'overwrite', repoSha: repoFile.sha,
            });
            return;
          }
        }
      }
    }

    // Unnamed: reuse a module-owned numbered file with identical content
    const matched = [...moduleRefNames].find((name) => {
      const repoFile = repoByName[name];
      return repoFile && /^\d+\.[a-z0-9]+$/i.test(name) && repoFile.sha === localSha;
    });
    if (matched) {
      push({ uri, alt, targetName: matched, action: 'reuse' });
      return;
    }
    const targetName = `${nextNumber}${ext}`;
    nextNumber += 1;
    push({ uri, alt, targetName, action: 'upload' });
  });

  return { entries, replacementByUri, stats };
}

/**
 * Rewrite private image refs to their pdir targets (exact-uri substitution).
 */
export function rewriteImgRefs(text, replacementByUri) {
  let result = `${text}`;
  Object.entries(replacementByUri || {}).forEach(([uri, target]) => {
    result = result.split(`(${uri})`).join(`(${target})`);
  });
  return result;
}
