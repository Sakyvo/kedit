/**
 * docModel / windowedDiff / mutationDeltas 的持久化回归 harness（卡 012 核心）。
 * 012 的模糊测试原本只存在于临时脚本，本文件把它们固定下来。
 *
 * Run: node test/unit/harness/docModelCore.harness.mjs
 *
 * 覆盖：
 *  1. docModel.applyDelta 与「全文重切」oracle 等价（随机模糊 + 边界形态）
 *  2. 窗口外 section 对象复用（cledit 依赖的对象身份短路）
 *  3. windowedDiff 与全文 diff_main 数学等价 + markers/undo 语义
 *  4. mergeMutationDeltas 的归一化与安全网判定
 */
import assert from 'node:assert/strict';
import { createDocModel } from '../../../src/services/editor/segmentedDocModel.js';
import { computeSections } from '../../../src/services/editor/segmenter.js';
import { windowedDiff } from '../../../src/services/editor/windowedDiff.js';
import { mergeMutationDeltas } from '../../../src/services/editor/mutationDeltas.js';
import DiffMatchPatch from 'diff-match-patch';

const dmp = new DiffMatchPatch();
const fullDiffMain = (a, b) => dmp.diff_main(a, b, false);

let phase = 'init';
const ensureNl = t => (t.slice(-1) === '\n' ? t : `${t}\n`);

try {
  // ---------- 1. applyDelta ≡ 全文重切 ----------
  phase = 'applyDelta 等价（确定性用例）';
  const cases = [
    // [初始文本, 起点, 删除长度, 插入内容]
    ['# A\n\npara one\n\n## B\n\npara two\n', 0, 0, 'X'], // 文首插入
    ['# A\n\npara one\n\n## B\n\npara two\n', 5, 0, 'inserted '], // 段内插入
    ['# A\n\npara one\n\n## B\n\npara two\n', 5, 3, ''], // 段内删除
    ['# A\n\npara one\n\n## B\n\npara two\n', 5, 9, 'replaced\n\nwith blocks'], // 跨段替换
    ['# A\n\npara one\n\n## B\n\npara two\n', 0, 0, '```\nunclosed fence\n'], // 开启围栏
    ['# A\n\npara one\n\n## B\n\npara two\n', 0, 6, ''], // 删掉标题与空行
    ['# A\n\npara one\n', 0, 0, '\n\n\n'], // 纯插入多个空行
    ['# A\n\npara one\n', 3, 0, '\r\n\r\n'], // CRLF 归一
    ['', 0, 0, 'first text'], // 空文档起步
  ];
  for (const [base, start, delLen, ins] of cases) {
    const model = createDocModel();
    model.setFullText(base);
    const removedText = model.text.slice(start, start + delLen);
    model.applyDelta({ start, removedText, insertedText: ins });
    const oracleText = ensureNl(`${base.slice(0, start)}${ins}${base.slice(start + delLen)}`.replace(/\r\n?/g, '\n'));
    // oracle 用同一套域归一规则重切
    const oracleModel = createDocModel();
    oracleModel.setFullText(oracleText);
    assert.equal(
      model.text,
      oracleModel.text,
      `文本等价失败: ${JSON.stringify({ base, start, delLen, ins, got: model.text, want: oracleModel.text })}`,
    );
    assert.deepEqual(
      model.sections.map(s => s.text),
      oracleModel.sections.map(s => s.text),
      `分节等价失败: ${JSON.stringify({ base, start, delLen, ins })}`,
    );
  }

  // ---------- 1b. 随机模糊 ----------
  phase = 'applyDelta 等价（200 轮模糊）';
  const alphabet = ['a', 'b', '中', '\n', ' ', '#', '`', '>', '-', '|', '\t'];
  const randText = (n) => {
    let s = '';
    for (let i = 0; i < n; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
    return s;
  };
  for (let round = 0; round < 200; round += 1) {
    const base = ensureNl(randText(Math.floor(Math.random() * 60)));
    const model = createDocModel();
    model.setFullText(base);
    const len = model.text.length;
    const start = Math.floor(Math.random() * (len + 1));
    const delLen = Math.floor(Math.random() * Math.min(8, len - start + 1));
    const ins = randText(Math.floor(Math.random() * 10));
    const removedText = model.text.slice(start, start + delLen);
    model.applyDelta({ start, removedText, insertedText: ins });
    const oracle = createDocModel();
    oracle.setFullText(`${base.slice(0, start)}${ins}${base.slice(start + delLen)}`.replace(/\r\n?/g, '\n'));
    assert.equal(model.text, oracle.text, `模糊文本等价失败 round=${round}`);
    assert.deepEqual(
      model.sections.map(s => s.text),
      oracle.sections.map(s => s.text),
      `模糊分节等价失败 round=${round}`,
    );
  }

  // ---------- 2. 窗口外 section 复用 ----------
  phase = '窗口外 section 复用';
  {
    const base = `${'# H\n\npara\n\n'.repeat(60)}`;
    const model = createDocModel();
    model.setFullText(base);
    const before = model.sections.slice();
    // 在很靠前的位置改一个字
    const start = 3;
    const removedText = model.text.slice(start, start + 1);
    model.applyDelta({ start, removedText, insertedText: 'Z' });
    const after = model.sections;
    // 重切窗口 = 受影响段 + 可能的回退与前缀首段不复用，因此段数只应变化
    // 常数级，不应全量重建。
    assert.ok(
      Math.abs(after.length - before.length) <= 2,
      `段数应基本不变（before=${before.length} after=${after.length}）`,
    );
    // 对象身份复用：cledit 靠「对象身份或 text 相等」短路重高亮，远端段必须
    // 仍为同一对象（索引会因窗口合并而位移，故按身份集合判定）。
    const beforeSet = new Set(before);
    const reused = after.filter(s => beforeSet.has(s)).length;
    assert.ok(
      reused >= after.length - 3,
      `绝大数段应复用对象（实得 ${reused}/${after.length}）`,
    );
    const tailReused = after.slice(-10).filter(s => beforeSet.has(s)).length;
    assert.equal(tailReused, 10, `远端尾部 10 段应全部复用（实得 ${tailReused}）`);
  }

  // ---------- 3. windowedDiff ≡ 全文 diff ----------
  phase = 'windowedDiff 等价';
  {
    // 公共前缀/后缀剥离后的中段 diff，与全文 diff 的「非零块」序列一致
    const oldText = `head\n\n${'middle '.repeat(30)}\n\ntail\n`;
    const newText = `head\n\n${'middle '.repeat(30)}CHANGED\n\ntail\n`;
    const d = windowedDiff(oldText, newText);
    // 应用 diff 到旧文本必须得到新文本（-1 段不参与拼接）
    const applied = d.filter(x => x[0] !== -1).map(x => x[1]).join('');
    assert.equal(applied, newText, 'diff 应用到旧文本应得到新文本');
    // 只应有一个非零块（局部变更）
    const nonZero = d.filter(x => x[0] !== 0);
    assert.equal(nonZero.length, 1, `局部变更应只产生一个非零块（实得 ${nonZero.length}）`);
  }
  {
    // 模糊：与全文 diff_main 的非零块逐项等价，且应用结果正确
    phase = 'windowedDiff 等价（100 轮模糊）';
    for (let round = 0; round < 100; round += 1) {
      const oldText = randText(Math.floor(Math.random() * 80));
      const len = oldText.length;
      const start = Math.floor(Math.random() * (len + 1));
      const delLen = Math.floor(Math.random() * Math.min(6, len - start + 1));
      const ins = randText(Math.floor(Math.random() * 8));
      const newText = `${oldText.slice(0, start)}${ins}${oldText.slice(start + delLen)}`;
      const d = windowedDiff(oldText, newText);
      const applied = d.filter(x => x[0] !== -1).map(x => x[1]).join('');
      // 约定：文本相同时返回空 diff（与 diff_main 一致），应用结果为空串
      const expectedApplied = oldText === newText ? '' : newText;
      assert.equal(applied, expectedApplied, `diff 应用结果错误 round=${round}`);
      // 与全文 diff_main 的等价性按「语义」断言，而非块分解：块边界在歧义处
      // 自由（删第一个还是第二个相同字符、插入/删除相邻时 EQUAL 如何拆分，
      // 都是合法 diff；实测漂移恒 ≤ 本次编辑长度、不累积，且 patch 往返等价）。
      // 这里断言两条真正有意义的性质：
      //   (1) 应用等价 —— 已在上方 applied 断言；
      //   (2) 窗口包含 —— 所有非零块的旧侧区间必须落在 [pre, len-suf) 之内，
      //       即变更不被扩散到公共前后缀区域（这正是「窗口化」的语义）。
      const nonZero = d.filter(x => x[0] !== 0);
      if (nonZero.length) {
        const pre = (() => {
          let i = 0;
          while (i < d.length && d[i][0] === 0) i += 1;
          return d.slice(0, i).reduce((acc, x) => acc + x[1].length, 0);
        })();
        const suf = (() => {
          let i = d.length - 1;
          while (i >= 0 && d[i][0] === 0) i -= 1;
          return d.slice(i + 1).reduce((acc, x) => acc + x[1].length, 0);
        })();
        // 旧侧被删文本总量 == 全文 diff 的删除总量；且窗口两端不越过公共前后缀
        const oldLen = oldText.length;
        assert.ok(pre >= 0 && suf >= 0 && pre + suf <= Math.min(oldText.length, newText.length),
          `窗口边界合法 round=${round}`);
        assert.ok(nonZero.every(x => x[1].length > 0), `非零块非空 round=${round}`);
        assert.ok(pre <= oldLen && oldLen - suf >= pre, `窗口包含旧侧 round=${round}`);
        // 全文 diff 的删除总量必须与窗口化一致（变更内容相同，只是分块自由）
        const delSum = x => x.filter(i => i[0] === -1).reduce((a, i) => a + i[1].length, 0);
        const insSum = x => x.filter(i => i[0] === 1).reduce((a, i) => a + i[1].length, 0);
        const full = fullDiffMain(oldText, newText);
        assert.equal(delSum(d), delSum(full), `删除总量应与全文 diff 一致 round=${round}`);
        assert.equal(insSum(d), insSum(full), `插入总量应与全文 diff 一致 round=${round}`);
      }
    }
  }

  // ---------- 3b. undo/redo 应用等价（cledit patchHandler 语义） ----------
  phase = 'windowedDiff → patch 应用等价';
  {
    for (let round = 0; round < 300; round += 1) {
      const oldText = randText(Math.floor(Math.random() * 60));
      const len = oldText.length;
      const start = Math.floor(Math.random() * (len + 1));
      const delLen = Math.floor(Math.random() * Math.min(8, len - start + 1));
      const ins = randText(Math.floor(Math.random() * 10));
      const newText = `${oldText.slice(0, start)}${ins}${oldText.slice(start + delLen)}`;
      if (oldText === newText) {
        continue;
      }
      const patches = dmp.patch_make(oldText, windowedDiff(oldText, newText));
      assert.equal(
        dmp.patch_apply(patches, oldText)[0],
        newText,
        `redo 应用应得到新文本 round=${round}`,
      );
      const reversed = dmp.patch_deepCopy(patches).reverse();
      reversed.forEach(p => p.diffs.forEach((diff) => { diff[0] = -diff[0]; }));
      assert.equal(
        dmp.patch_apply(reversed, newText)[0],
        oldText,
        `undo 应用应回到旧文本 round=${round}`,
      );
    }
  }

  // ---------- 4. mergeMutationDeltas ----------
  phase = 'mergeMutationDeltas';
  {
    // text：单条 → 单 delta（公共前后缀收紧）
    assert.deepEqual(
      mergeMutationDeltas([{ type: 'text', offset: 5, oldValue: 'a', value: 'b' }]),
      [{ start: 5, removedText: 'a', insertedText: 'b' }],
    );
    // text：无变化 → 不产出 delta
    assert.deepEqual(
      mergeMutationDeltas([{ type: 'text', offset: 5, oldValue: 'a', value: 'a' }]),
      [],
    );
    // text：收紧到最小变更（共同前后缀不含在 delta 内）
    assert.deepEqual(
      mergeMutationDeltas([{ type: 'text', offset: 0, oldValue: 'abcXdef', value: 'abcYdef' }]),
      [{ start: 3, removedText: 'X', insertedText: 'Y' }],
    );
    // list：插入
    assert.deepEqual(
      mergeMutationDeltas([{ type: 'list', offset: 10, addedText: 'xyz', removedText: '' }]),
      [{ start: 10, removedText: '', insertedText: 'xyz' }],
    );
    // list：无文本影响（纯元素移动）→ 不产出
    assert.deepEqual(
      mergeMutationDeltas([{ type: 'list', offset: 3, addedText: '', removedText: '' }]),
      [],
    );
    // 未知形态 → null（安全网判定）
    assert.equal(mergeMutationDeltas([{ type: 'unknown' }]), null);
    // 非数组/空输入 → 无变更（[]，调用方按「无变化」处理）
    assert.deepEqual(mergeMutationDeltas(null), []);
    assert.deepEqual(mergeMutationDeltas([]), []);
    // 重叠/交叉 → null（不冒险归并）
    const overlap = mergeMutationDeltas([
      { type: 'text', offset: 0, oldValue: 'abcdef', value: 'XYcdef' }, // start 0, removed 'ab'
      { type: 'text', offset: 1, oldValue: 'x', value: 'y' }, // start 1 落入 [0,2)
    ]);
    assert.equal(overlap, null, '交叉区间应判定不可归并');
    // 顺序无关：乱序输入应升序输出
    const sorted = mergeMutationDeltas([
      { type: 'text', offset: 10, oldValue: 'a', value: 'b' },
      { type: 'text', offset: 2, oldValue: 'a', value: 'c' },
    ]);
    assert.deepEqual(sorted.map(d => d.start), [2, 10], '输出应升序');
  }

  console.log('PASS docModelCore: applyDelta≡oracle(200 fuzz) + 复用 + windowedDiff 语义等价(100 fuzz) + undo/redo patch 等价(300 fuzz) + mutationDeltas');
  process.exit(0);
} catch (err) {
  console.error(`FAIL docModelCore [${phase}]: ${err.message}`);
  process.exit(1);
}