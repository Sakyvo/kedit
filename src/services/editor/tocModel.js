// TOC 条目模型（卡 015）：扫描结果 → 与 sectionList 索引对齐的条目 + 增量补丁计划。
// 纯函数，无 DOM；DOM 侧只消费补丁计划（见 editorSvc.applyTocPatch）。
//
// 计划用「公共前后缀 + 中段 splice」而非逐项 diff：条目键只表达内容（不含索引），
// 因此编辑只让局部中段变化，DOM 侧一次 splice 即完成，尾部索引平移天然跟随。
// （含索引的键会让顶部插入导致尾部全量重建——O(n)/击键，已否决。）

/**
 * 每个 section 一个条目（无标题 level=0 占位），保持 children[i]↔sectionList[i] 对齐。
 * @param {Array<{text:string}>} sections 文档序 sections（需与 cledit sectionList 等长同序）
 * @param {Array<{level,text,sectionIndex}>} headings mapHeadingsToSections 输出
 */
export function computeTocEntries(sections, headings) {
  const entries = new Array(sections.length);
  for (let i = 0; i < sections.length; i += 1) {
    entries[i] = { level: 0, text: '' };
  }
  for (const h of headings) {
    if (h.sectionIndex >= 0 && h.sectionIndex < entries.length) {
      entries[h.sectionIndex] = { level: h.level, text: h.text };
    }
  }
  return entries;
}

/** 条目内容键（不含索引：位置由 splice 表达）。 */
export function tocEntryKey(entry) {
  return `${entry.level}\u0000${entry.text}`;
}

/**
 * 旧键序列 → 新键序列的最小补丁计划（单一 splice）。
 * @returns {Array<{type:'splice', index:number, removeCount:number, keys:Array<String>}>}
 */
export function planTocPatch(oldKeys, newKeys) {
  const maxCommon = Math.min(oldKeys.length, newKeys.length);
  let prefix = 0;
  while (prefix < maxCommon && oldKeys[prefix] === newKeys[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < maxCommon - prefix
    && oldKeys[oldKeys.length - 1 - suffix] === newKeys[newKeys.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const removeCount = oldKeys.length - prefix - suffix;
  const keys = newKeys.slice(prefix, newKeys.length - suffix);
  if (!removeCount && !keys.length) {
    return [];
  }
  return [{ type: 'splice', index: prefix, removeCount, keys }];
}