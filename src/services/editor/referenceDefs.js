// 引用式链接定义检测（卡 014）：文档含 `[text]: url` 定义时，预览必须回退全量
// 转换路径 —— 引用定义可在任意段被引用，分段渲染会丢失跨段解析上下文。
//
// 语义对齐 markdown-it 的 reference 规则与项目 frontmatter/fence 约定：
// - 定义行：行首最多 3 空格 + `[label]:` （label 非空、不跨行）
// - 围栏内（``` / ~~~）不算；frontmatter 区不算
// - 缩进 4 空格属代码块，不算
// - `[label]:` 后可为空（下一行缩进续行仍算定义存在）

const FENCE_RE = /^ {0,3}(`{3,}|~{3,})[ \t]*/;
const FRONTMATTER_MARKER_RE = /^-{3}[ \t]*$/;
const FRONTMATTER_CLOSER_RE = /^(?:-{3}|\.{3})[ \t]*$/;
const REF_DEF_RE = /^ {0,3}\[([^\]]+)\]:[ \t]*(.*)$/;

/**
 * 文档是否包含引用式链接定义。
 * @param {String} text
 * @returns {Boolean}
 */
export function hasReferenceDefinitions(text) {
  if (!text) {
    return false;
  }
  const lines = text.split('\n');
  let firstLine = 0;
  if (lines.length > 1 && FRONTMATTER_MARKER_RE.test(lines[0])) {
    for (let i = 1; i < lines.length; i += 1) {
      if (FRONTMATTER_CLOSER_RE.test(lines[i])) {
        firstLine = i + 1;
        break;
      }
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = FENCE_RE.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const markerChar = marker.charCodeAt(0);
      i += 1;
      for (; i < lines.length; i += 1) {
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
    if (i < firstLine) {
      continue;
    }
    if (/^ {4}/.test(line)) {
      continue;
    }
    if (REF_DEF_RE.test(line)) {
      return true;
    }
  }
  return false;
}