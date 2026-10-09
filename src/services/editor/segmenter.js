// 廉价块级分段器（ADR-0012）：行扫描切 section，fence 内不切，空行切。
// 契约：输入文本必须以 \n 结尾（与 cledit getTextContent 惯例一致）。
// data 是容器类型的廉价推断（list/quote/table/deflist/main），仅用于 Prism
// 语法选择；与 markdown-it token 推断在罕见嵌套下可能错配，接受（ADR-0012）。

const FENCE_RE = /^ {0,3}(```|~~~)/;
const LIST_RE = /^ {0,3}(?:[-*+] |\d{1,9}[.)] )/;
const QUOTE_RE = /^ {0,3}>/;
const TABLE_RE = /^ {0,3}\|/;
const DEFLINE_RE = /^ {0,3}:(?= |$)/;

const inferData = (lines) => {
  const first = lines[0] || '';
  if (QUOTE_RE.test(first)) return 'quote';
  if (LIST_RE.test(first)) return 'list';
  if (TABLE_RE.test(first)) return 'table';
  if (lines.length > 1 && DEFLINE_RE.test(lines[1] || '')) return 'deflist';
  return 'main';
};

/**
 * 把全文切成块级 sections。
 * @param {String} text 以 \n 结尾的全文。
 * @returns {Array<{start:number,end:number,text:string,data:string,fenceAfter:boolean}>}
 *   start/end 为字符偏移（end 不含；text 含末尾 \n）。fenceAfter = 该段结束时
 *   是否处于未闭合 fence 内（除最后一段外每为 false；fence 未闭时最后一段吞并
 *   到文末且 fenceAfter=true）。对象为新建，无身份复用语义（复用由 docModel 负责）。
 */
export function computeSections(text, opts = {}) {
  if (text.length === 0) {
    return [];
  }
  if (text.charCodeAt(text.length - 1) !== 10) {
    throw new Error('segmenter: text must end with \\n');
  }
  // 前导空行（文件头）：「空行归前段」在此无前段可归，但必须被覆盖——
  // 不变式 sections 拼接 === 全文（markdown-it parseSections 也把文件头
  // 空行归入首段）。故先把这段前缀取下，算完再并回首段。
  const leadMatch = /^(?:[ \t]*\n)+/.exec(text);
  const lead = leadMatch ? leadMatch[0] : '';
  const leadLines = lead ? (lead.match(/\n/g) || []).length : 0;
  const sections = [];
  const lines = text.split('\n');
  lines.pop(); // 末尾 \n 产生的空项
  let start = -1; // 当前段起始字符偏移
  let buf = []; // 当前段行
  let offset = lead.length; // 当前行起始偏移
  let insideFence = !!opts.insideFence;

  const flush = (endOffset) => {
    if (start >= 0) {
      sections.push({
        start,
        end: endOffset,
        text: text.slice(start, endOffset),
        data: inferData(buf),
        fenceAfter: insideFence,
      });
      start = -1;
      buf = [];
    }
  };

  for (let i = leadLines; i < lines.length; i += 1) {
    const line = lines[i];
    const isBlank = line.trim() === '';
    if (insideFence) {
      // fence 内：一切行（含空行）归当前段
      if (start < 0) start = offset;
      buf.push(line);
      if (FENCE_RE.test(line)) {
        insideFence = false;
      }
    } else if (isBlank) {
      // 空行归前段（与旧 parseSections 语义一致：空行跟随前一个块）。
      // 不立即 flush——待下一个非空行到来时以其偏移为界。无当前段时丢弃
      // （并空 / 文件头）。文件尾部空行由末尾 flush 兜底。
      if (start >= 0) {
        buf.push(line);
      }
    } else {
      // 非空行：若前面已积累空行且存在当前段，先以前段收尾（含尾随空行）
      if (start >= 0 && buf.some(prev => prev.trim() === '')) {
        flush(offset);
      }
      if (start < 0) start = offset;
      buf.push(line);
      if (FENCE_RE.test(line)) {
        insideFence = true;
      }
    }
    offset += line.length + 1;
  }
  // 末段:含尾部空行(flush 到文本末尾)
  flush(text.length);
  // 前导空行并回首段（无正文时整篇自成一段）
  if (lead) {
    if (sections.length) {
      sections[0].start = 0;
      sections[0].text = text.slice(0, sections[0].end);
    } else {
      sections.push({
        start: 0,
        end: text.length,
        text,
        data: 'main',
        fenceAfter: false,
      });
    }
  }
  return sections;
}

/**
 * 把块级 sections 聚合为 ~targetChars 的 segments（调度/缓存单位）。
 * 落刀只取 section 边界；超长单 section 独立成段（不硬切）。
 * @returns {Array<{start:number,end:number}>} section 索引区间 [start, end)
 */
export function aggregateSegments(sections, targetChars = 20000) {
  const segments = [];
  let segStart = 0;
  let segChars = 0;
  for (let i = 0; i < sections.length; i += 1) {
    const len = sections[i].text.length;
    if (segStart < i && segChars + len > targetChars) {
      segments.push({ start: segStart, end: i });
      segStart = i;
      segChars = 0;
    }
    segChars += len;
  }
  if (segStart < sections.length) {
    segments.push({ start: segStart, end: sections.length });
  }
  return segments;
}
