/**
 * Pure helpers for publishing a Document into a pdir Module (batch-6 #009).
 * pdir is a single-source site: content/main.md, Modules are `### N.N.` ranges.
 */

export const PDIR_OWNER = 'Sakyvo';
export const PDIR_REPO = 'the-potpvp-directory';
export const PDIR_BRANCH = 'main';
export const PDIR_MAIN_FILE = 'content/main.md';
export const PDIR_SITE_URL = 'https://pdir.cc.cd/';
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

/**
 * pdir Modules = H3 headings; body runs to the next heading of level <= 3 or EOF.
 * Returns [{title, headingLine, bodyStart, bodyEnd}] (line numbers, bodyEnd exclusive).
 */
export function parsePdirModules(md) {
  const lines = `${md}`.split('\n');
  const headings = scanHeadings(md);
  return headings
    .map((heading, idx) => {
      if (heading.level !== 3) {
        return null;
      }
      const next = headings.slice(idx + 1).find(h => h.level <= 3);
      return {
        title: heading.title,
        headingLine: heading.line,
        bodyStart: heading.line + 1,
        bodyEnd: next ? next.line : lines.length,
      };
    })
    .filter(Boolean);
}

/**
 * Replace a Module's body, keeping its heading line. Returns null if not found.
 */
export function replaceModuleBody(md, moduleTitle, newBody) {
  const module = parsePdirModules(md).find(m => m.title === moduleTitle);
  if (!module) {
    return null;
  }
  const lines = `${md}`.split('\n');
  const before = lines.slice(0, module.headingLine + 1);
  const after = lines.slice(module.bodyEnd);
  const body = `${newBody}`.replace(/\s+$/, '').replace(/^\s+/, '');
  const result = [...before, '', body, ''];
  if (after.length) {
    return [...result, ...after].join('\n');
  }
  return `${result.join('\n').replace(/\s+$/, '')}\n`;
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
