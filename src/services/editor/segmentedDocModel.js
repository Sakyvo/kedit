// docModel（ADR-0012）：编辑器域的全文文本模型 = 唯一事实源。
// 域内文本恒为 LF 归一（与 cledit getTextContent 同规则），恒以 \n 结尾。
// sections 为块级切分（segmenter），applyDelta 只重切受影响窗口，
// 窗口外 section 对象复用（cledit 靠对象身份与 text 相等跳过重高亮）。
// fence 是唯一的跨段全局状态：窗口重切若以未闭合 fence 结束，则 fence 吞并
// 后续一切段落，后缀复用整体作废（正确性优先）。
import { computeSections } from './segmenter.js';

const normalize = text => text.replace(/\r[\n\u0085]?|[\u2424\u2028\u0085]/g, '\n');

export function createDocModel() {
  const model = {
    text: '',
    sections: [],

    setFullText(rawText) {
      let t = normalize(String(rawText == null ? '' : rawText));
      if (t && t.slice(-1) !== '\n') {
        t += '\n';
      }
      model.text = t;
      model.sections = computeSections(t);
    },

    /**
     * 应用一次文本变更并局部重切。
     * @param {Number} delta.start 旧文本中的起始偏移
     * @param {String} delta.removedText 被删除的旧文本（须与旧文本切片一致）
     * @param {String} delta.insertedText 插入的新文本
     */
    applyDelta({ start, removedText, insertedText }) {
      const old = model.text;
      const ins = normalize(insertedText || '');
      if (old.slice(start, start + removedText.length) !== removedText) {
        throw new Error('docModel: removedText 与旧文本不一致');
      }
      const end = start + removedText.length;
      let newText = old.slice(0, start) + ins + old.slice(end);
      if (newText && newText.slice(-1) !== '\n') {
        // 域不变量：非空文本恒以 \n 结尾（cledit getTextContent 同规则）
        newText += '\n';
      }
      const sections = model.sections;
      if (!sections.length) {
        model.text = newText;
        model.sections = computeSections(newText);
        return;
      }
      // 定位受影响窗口：首个 end > start 的段 i0；末个 start <= end 的段 i1。
      // i1 用 <=（而非 <）：删除终点落在段首（吃掉分隔空行）时后一段可能与
      // 窗口合并，必须一并纳入重切（正确性优先，多切一段无害）。
      let i0 = sections.length - 1;
      for (let i = 0; i < sections.length; i += 1) {
        if (sections[i].end > start) { i0 = i; break; }
      }
      let i1 = 0;
      for (let i = sections.length - 1; i >= 0; i -= 1) {
        if (sections[i].start <= end) { i1 = i; break; }
      }
      if (i1 < i0) i1 = i0; // 纯插入进空隙时仍至少重切一段
      // 窗口起点：若窗口的首行是空行，说明它属于「前一段尾随空行」的延续
      // （空行归前段），必须把前一段整体拉进窗口，否则空行会被重切成窗口
      // 首段的前导空行，与全文重切归属不一致。窗口首行非空时直接取
      // i0.start，保持前缀复用面。
      let winFromIdx = i0;
      if (i0 > 0 && /^[ \t]*\n/.test(newText.slice(sections[i0].start))) {
        winFromIdx = i0 - 1;
      }
      const winStart = sections[winFromIdx].start;
      const shift = newText.length - old.length;
      // 窗口右界：后缀首段整体纳入重切（不复用）——插入文本不以空行结尾
      // 或删除吃掉分隔空行时，后缀首段会与窗口合并，复用即错。每次多切
      // 一段成本微秒级，正确性优先。
      let suffixReusedFrom = Math.min(i1 + 2, sections.length);      let suffixHead = sections[i1 + 1]
        ? sections[i1 + 1].end + shift
        : newText.length;
      let winNew = newText.slice(winStart, suffixHead);
      let winSections = computeSections(winNew);      if (winSections.length && winSections[winSections.length - 1].fenceAfter) {
        suffixReusedFrom = sections.length;
        suffixHead = newText.length;
        winNew = newText.slice(winStart);
        winSections = computeSections(winNew);
      }
      const next = sections.slice(0, winFromIdx);
      for (const s of winSections) {
        next.push({
          ...s,
          start: s.start + winStart,
          end: s.end + winStart,
        });
      }
      for (let i = suffixReusedFrom; i < sections.length; i += 1) {
        const s = sections[i];
        // 后缀段：text 不变，偏移平移，对象复用
        s.start += shift;
        s.end += shift;
        next.push(s);
      }
      model.text = newText;
      model.sections = next;
    },
  };
  return model;
}
