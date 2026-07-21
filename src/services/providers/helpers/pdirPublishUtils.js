/**
 * Pure helpers for publishing a Document into a pdir Module (batch-6 #009).
 * pdir is a single-source site: content/main.md, Modules are `### N.N.` ranges.
 */
import SHA1 from 'crypto-js/sha1.js';
import encBase64 from 'crypto-js/enc-base64.js';
import encLatin1 from 'crypto-js/enc-latin1.js';

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
 * Headings of level <= 3 (outside fences) would break pdir's Part/Module
 * structure — pdir-bound Documents must start at ####.
 */
export function findForbiddenHeadings(text) {
  return scanHeadings(text).filter(h => h.level <= 3);
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
