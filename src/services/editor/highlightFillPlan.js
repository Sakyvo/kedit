// 渐进高亮补齐的批次规划(卡 013 / 验收项 A3「补齐不冻结输入」)。
//
// 旧规则是固定字符预算(60k 字符/批),在 810k 文档上实测每批阻塞主线程
// 344–375ms —— 远超 50ms 长任务阈值,补齐期间打字会被抢占。
//
// 新规则按「估算成本 + 墙上时钟预算」规划:每批短小,与文档构成无关
// (单个 fence 段可能上万字,按字符分会让批次成本波动数十倍)。
//
// 纯函数,无 DOM;DOM 侧只消费返回的段数。

/** 每段的固定簿记开销(建元素、setElement、派发事件、后续选择器扫描)。 */
const BASE_COST_MS = 0.02;

/** 半角字符的基础着色成本(经验值,来自真实样本均匀抽样)。 */
const PER_CHAR_MS = 0.0008;

/** 代码围栏段的额外系数(带 Prism 语法,实测比同长文本段贵约 6.5 倍)。 */
const FENCED_FACTOR = 4;

const FENCE_RE = /`{3,}|~{3,}/;

/**
 * 估算一段的高亮成本(ms)。故意保守(偏大),使实际批次落在预算内。
 * @param {{text?:string, data?:string, fenceAfter?:boolean}} section
 * @returns {Number} ms
 */
export function estimateHighlightCost(section) {
  const text = (section && section.text) || '';
  const len = text.length;
  const fenced = section && (section.fenceAfter || FENCE_RE.test(text));
  return BASE_COST_MS + len * PER_CHAR_MS * (fenced ? FENCED_FACTOR : 1);
}

/**
 * 规划一批要补齐的段数:累计估算成本达到 budgetMs 即停,同时受 maxSections
 * 约束(小段极多时限制单次簿记量)。至少取一段,保证补齐能收敛。
 * @param {Array} sections 待补齐段(文档序)
 * @param {{budgetMs?:number, maxSections?:number}} opts
 * @returns {{count:number, estimatedMs:number}}
 */
export function planFillBatch(sections, opts = {}) {
  const budgetMs = opts.budgetMs === undefined ? 12 : opts.budgetMs;
  const maxSections = opts.maxSections === undefined ? 200 : opts.maxSections;
  if (!sections || !sections.length) {
    return { count: 0, estimatedMs: 0 };
  }
  let cost = 0;
  let count = 0;
  for (let i = 0; i < sections.length; i += 1) {
    if (count >= maxSections) {
      break;
    }
    const c = estimateHighlightCost(sections[i]);
    // 至少取一段(即使它单独就超预算),否则巨大段会永远排不出批次
    if (count > 0 && cost + c > budgetMs) {
      break;
    }
    cost += c;
    count += 1;
  }
  return { count, estimatedMs: cost };
}

// 注：不提供「批内墙上时钟守门」的辅助函数。`refreshHighlightedSections` 是批级
// API，无法批内中断，所以批次大小是控制阻塞的唯一手段；实测与估算的偏差由调用方
// (editorSvc 的 fillBatchBudgetMs 自适应)持续校正，再叠一层守门只会是死代码。
