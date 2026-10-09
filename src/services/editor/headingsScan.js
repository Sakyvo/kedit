// 独立标题行扫描（批次 010/ADR-0012，卡 015）：TOC 数据源与预览渲染解耦。
// 纯行扫描：ATX 标题、代码围栏、frontmatter、缩进代码；不依赖 markdown-it，
// 因此不依赖预览是否已渲染/可见。
//
// 语义对齐（与 markdownExtension/frontmatterRule + markdown-it ATX 规则）：
// - 围栏由 ``` 或 ~~~ 开启，闭合必须是同字符且长度不短于开启者；围栏内一律不算标题
// - frontmatter 仅当第 0 行恰为 `---` 且其后存在恰为 `---`/`...` 的行
// - 标题：行首最多 3 空格 + 1..6 个 `#` + 空白或行尾；收尾 `#` 序列（前有空白）剥离
// - 4 空格缩进（围栏外）视为代码块，不算标题

const ATX_RE = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?[ \t]*$/;
const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*/;
const FRONTMATTER_MARKER_RE = /^-{3}[ \t]*$/;
const FRONTMATTER_CLOSER_RE = /^(?:-{3}|\.{3})[ \t]*$/;

const stripClosingSequence = (raw) => {
  // markdown-it: 收尾序列必须由空白引导，否则属于标题文本
  const m = /[ \t]+#+[ \t]*$/.exec(raw);
  return m ? raw.slice(0, m.index).trimEnd() : raw.trimEnd();
};

/**
 * 提取 ATX 标题（文档序）。
 * @param {String} text
 * @returns {Array<{level:number,text:string,start:number,end:number}>}
 *   start/end 为该行（不含行尾换行）的字符区间。
 */
export function extractHeadings(text) {
  const headings = [];
  if (!text) {
    return headings;
  }
  const lines = text.split('\n');
  // frontmatter：仅第 0 行起
  let firstLine = 0;
  if (lines.length > 1 && FRONTMATTER_MARKER_RE.test(lines[0])) {
    for (let i = 1; i < lines.length; i += 1) {
      if (FRONTMATTER_CLOSER_RE.test(lines[i])) {
        firstLine = i + 1;
        break;
      }
    }
  }
  let offset = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const lineStart = offset;
    offset += line.length + 1;
    if (i < firstLine) {
      continue;
    }
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      // 跳过整个围栏（含闭合行）
      const marker = fenceMatch[1];
      const markerChar = marker.charCodeAt(0);
      i += 1;
      for (; i < lines.length; i += 1) {
        offset += lines[i].length + 1;
        const candidate = FENCE_RE.exec(lines[i]);
        if (candidate
          && candidate[1].charCodeAt(0) === markerChar
          && candidate[1].length >= marker.length
          && lines[i].trim().length === candidate[1].length) {
          break;
        }
      }
      continue;
    }
    if (/^ {4}/.test(line)) {
      continue; // 缩进代码块
    }
    const atx = ATX_RE.exec(line);
    if (atx) {
      headings.push({
        level: atx[1].length,
        text: stripClosingSequence(atx[2] === undefined ? '' : atx[2]),
        start: lineStart,
        end: lineStart + line.length,
      });
    }
  }
  return headings;
}

const sectionStarts = (sections) => {
  const starts = new Array(sections.length);
  let offset = 0;
  for (let i = 0; i < sections.length; i += 1) {
    const s = sections[i];
    starts[i] = typeof s.start === 'number' ? s.start : offset;
    offset = typeof s.end === 'number' ? s.end : starts[i] + (s.text ? s.text.length : 0);
  }
  return starts;
};

/** 段起始偏移（cledit 段只有 text 时按文本长度累加）。 */
export function computeSectionStarts(sections) {
  return sectionStarts(sections || []);
}

/**
 * 把标题映射到包含它的 section 索引（二者均为文档序，故单调推进，O(n + m)）。
 * @returns {Array<{level,text,start,end,sectionIndex}>}
 */
export function mapHeadingsToSections(headings, sections) {
  if (!sections || !sections.length) {
    return headings.map(h => ({ ...h, sectionIndex: -1 }));
  }
  const starts = sectionStarts(sections);
  const result = [];
  let sIdx = 0;
  for (const heading of headings) {
    while (sIdx + 1 < sections.length && starts[sIdx + 1] <= heading.start) {
      sIdx += 1;
    }
    result.push({ ...heading, sectionIndex: sIdx });
  }
  return result;
}