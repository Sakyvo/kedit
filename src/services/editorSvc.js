import mitt from 'mitt';
import DiffMatchPatch from 'diff-match-patch';
import markdownItPandocRenderer from 'markdown-it-pandoc-renderer';
import MD5 from 'crypto-js/md5';
import cledit from './editor/cledit';
import pagedown from '../libs/pagedown';
import htmlSanitizer from '../libs/htmlSanitizer';
import markdownConversionSvc, { createInsideFences } from './markdownConversionSvc';
import markdownGrammarSvc from './markdownGrammarSvc';
import sectionUtils from './editor/sectionUtils';
import extensionSvc from './extensionSvc';
import editorSvcDiscussions from './editor/editorSvcDiscussions';
import editorSvcUtils from './editor/editorSvcUtils';
import {
  getPrismLanguageVariants,
  onPrismLanguageLoaded,
  safeHighlight,
} from './prismSvc';
import utils from './utils';
import store from '../store';
import syncSvc from './syncSvc';
import constants from '../data/constants';
import localDbSvc from './localDbSvc';
import {
  shouldApplyNaturalSize,
  shouldRecordNaturalSize,
  dimensionsForPreset,
  parseDeclaredImgSize,
} from './editor/imgSizeGuard';
import { createLayoutRemeasure } from './editor/layoutRemeasure';
import { applyRememberedCap, fitImgWrapper, fitAllImgWrappers } from './editor/imgLineFit';
import { isSegmentedLoadingEnabled } from './editor/segmentedLoading';
import { createDocModel } from './editor/segmentedDocModel.js';
import { windowedDiff } from './editor/windowedDiff.js';
import { mergeMutationDeltas } from './editor/mutationDeltas.js';
import { applyTocOutlineDepths } from './editor/tocDepth.js';
import { extractHeadings, mapHeadingsToSections, computeSectionStarts } from './editor/headingsScan.js';
import { computeTocEntries, tocEntryKey, planTocPatch } from './editor/tocModel.js';
import { hasReferenceDefinitions } from './editor/referenceDefs.js';
import {
  estimateBlockHeight,
  computeSectionHeights,
  computeSectionOffsets,
  computeVisibleRange,
  planWindowChange,
} from './editor/previewWindow.js';

const allowDebounce = (action, wait) => {
  let timeoutId;
  return (doDebounce = false, ...params) => {
    clearTimeout(timeoutId);
    if (doDebounce) {
      timeoutId = setTimeout(() => action(...params), wait);
    } else {
      action(...params);
    }
  };
};

const diffMatchPatch = new DiffMatchPatch();
let instantPreview = true;
let tokens;
const regexSpecialChars = /[\\^$.*+?()[\]{}|]/g;
const escapeRegex = value => value.replace(regexSpecialChars, '\\$&');

class SectionDesc {
  constructor(section, previewElt, tocElt, html) {
    this.section = section;
    this.editorElt = section.elt;
    this.previewElt = previewElt;
    this.tocElt = tocElt;
    this.html = html;
  }
}

const pathUrlMap = Object.create(null);
const pathUrlRefCountMap = Object.create(null);
const localImageSrcAttr = 'data-ws-src';
const localImagePathAttr = 'data-ws-path';
const imgUriAttr = 'data-img-uri';
const localImageSrcMatcher = /(<img\b[^>]*?)\ssrc=(['"])([^'"]+)\2/ig;

const isWorkspaceLocalUri = uri => !!uri && !/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(uri);

const replaceLocalImageSrc = html => html.replace(localImageSrcMatcher, (match, before, quote, uri) => {
  if (!isWorkspaceLocalUri(uri)) {
    return match;
  }
  return `${before} ${localImageSrcAttr}=${quote}${uri}${quote}`;
});

const getAbsoluteWorkspaceImgPath = uri => utils.getAbsoluteFilePath(
  store.getters['explorer/selectedNodeFolder'],
  uri,
);

const cacheImgUrl = (absoluteImgPath, url) => {
  pathUrlMap[absoluteImgPath] = url;
  return url;
};

const releaseImgUrl = (absoluteImgPath) => {
  if (!pathUrlMap[absoluteImgPath]) {
    return;
  }
  const nextRefCount = (pathUrlRefCountMap[absoluteImgPath] || 0) - 1;
  if (nextRefCount > 0) {
    pathUrlRefCountMap[absoluteImgPath] = nextRefCount;
    return;
  }
  URL.revokeObjectURL(pathUrlMap[absoluteImgPath]);
  delete pathUrlMap[absoluteImgPath];
  delete pathUrlRefCountMap[absoluteImgPath];
};

const releaseAllImgUrls = () => {
  Object.keys(pathUrlMap).forEach((absoluteImgPath) => {
    URL.revokeObjectURL(pathUrlMap[absoluteImgPath]);
    delete pathUrlMap[absoluteImgPath];
    delete pathUrlRefCountMap[absoluteImgPath];
  });
};

const increaseImgPathCount = (counterMap, absoluteImgPath) => {
  counterMap[absoluteImgPath] = (counterMap[absoluteImgPath] || 0) + 1;
};

const syncActiveImgPathCounts = (activeCountMap, nextCountMap) => {
  Object.keys({
    ...activeCountMap,
    ...nextCountMap,
  }).forEach((absoluteImgPath) => {
    const countDiff = (nextCountMap[absoluteImgPath] || 0) - (activeCountMap[absoluteImgPath] || 0);
    if (countDiff > 0) {
      pathUrlRefCountMap[absoluteImgPath] = (pathUrlRefCountMap[absoluteImgPath] || 0) + countDiff;
      return;
    }
    for (let i = 0; i < -countDiff; i += 1) {
      releaseImgUrl(absoluteImgPath);
    }
  });
  return nextCountMap;
};

const countActiveWorkspaceImages = (rootElt) => {
  const counts = Object.create(null);
  if (!rootElt) {
    return counts;
  }
  Array.prototype.slice.call(rootElt.querySelectorAll(`img[${localImagePathAttr}]`))
    .forEach((imgElt) => {
      increaseImgPathCount(counts, imgElt.getAttribute(localImagePathAttr));
    });
  return counts;
};

const getImgUrl = async (uri) => {
  if (uri.indexOf('http://') !== 0 && uri.indexOf('https://') !== 0) {
    const absoluteImgPath = getAbsoluteWorkspaceImgPath(uri);
    const cachedUrl = pathUrlMap[absoluteImgPath];
    if (cachedUrl) {
      return cachedUrl;
    }
    const md5Id = MD5(absoluteImgPath).toString();
    let imgItem = await localDbSvc.getImgItem(md5Id);
    if (!imgItem) {
      try {
        await syncSvc.syncImg(absoluteImgPath);
      } catch (err) {
        return '';
      }
      imgItem = await localDbSvc.getImgItem(md5Id);
    }
    if (imgItem) {
      // imgItem 如果不存在 则加载 TODO
      const imgFile = utils.base64ToBlob(imgItem.content, uri);
      const url = URL.createObjectURL(imgFile);
      return cacheImgUrl(absoluteImgPath, url);
    }
    return '';
  }
  return uri;
};

// Use a mitt() instance as an event bus
const editorSvc = Object.assign(mitt() , editorSvcDiscussions, editorSvcUtils, {
  // Elements
  editorElt: null,
  previewElt: null,
  tocElt: null,
  // Other objects
  clEditor: null,
  pagedownEditor: null,
  options: null,
  prismGrammars: null,
  converter: null,
  parsingCtx: null,
  conversionCtx: null,
  previewCtx: {
    sectionDescList: [],
  },
  previewCtxMeasured: null,
  previewPaused: false,
  // 预览窗口（卡 014）：当前已挂载真实 HTML 的段区间 + 高度缓存。
  previewWindowRange: null,
  previewHeightCache: null,
  previewInitialCharBudget: 60000,
  // 编辑器侧渐进高亮（卡 013/014）：一次 pass 内高亮字符预算；超出先纯文本占位。
  highlightInitialCharBudget: 150000,
  highlightCharsUsed: 0,
  // 打点（卡 014 验收取证）：预览转换 / 预览刷新 / 尺寸测量的调用次数。
  // 预览隐藏时这三项必须不增长。
  perfCounters: { convert: 0, refreshPreview: 0, measurePreview: 0 },
  previewCtxWithDiffs: null,
  sectionList: null,
  selectionRange: null,
  previewSelectionRange: null,
  previewSelectionStartOffset: null,
  // 长文档分段加载总闸（ADR-0012）：ON=分段管线（后续卡切入），OFF=旧全量管线。
  // 本卡（011）内 ON 行为与现状一致；标志位 + 开关变化日志供查证。
  segmentedLoadingEnabled: true,
  activePreviewImgPathCounts: Object.create(null),
  activeEditorImgPathCounts: Object.create(null),

  /**
   * W5: force-drop a deleted workspace image from the blob URL cache so it
   * is not served again; still-rendered occurrences show as broken images.
   */
  releaseImgCache(absoluteImgPath) {
    if (pathUrlMap[absoluteImgPath]) {
      URL.revokeObjectURL(pathUrlMap[absoluteImgPath]);
      delete pathUrlMap[absoluteImgPath];
      delete pathUrlRefCountMap[absoluteImgPath];
    }
  },

  /**
   * Initialize the Prism grammar with the options
   */
  initPrism() {
    const options = {
      ...this.options,
      insideFences: createInsideFences(),
    };
    this.prismGrammars = markdownGrammarSvc.makeGrammars(options);
  },

  /**
   * Initialize the markdown-it converter with the options
   */
  initConverter() {
    this.converter = markdownConversionSvc.createConverter(this.options, true);
    this.sectionParseCache = null; // 转换器变更 → 旧解析结果失效
  },

  /**
   * Initialize the cledit editor with markdown-it section parser and Prism highlighter
   */
  initClEditor() {
    this.previewCtxMeasured = null;
    editorSvc.emit('previewCtxMeasured', null);
    this.previewCtxWithDiffs = null;
    editorSvc.emit('previewCtxWithDiffs', null);
    // 上下文重置：编辑器重建后 parsingCtx/conversionCtx 的 sectionList 与预览
    // 上下文都指向旧文档，下一次 convert 会误报“未变”而产生错位配对。
    this.parsingCtx = null;
    this.conversionCtx = null;
    this.previewCtx = { sectionDescList: [] };
    this.tocKeys = null;
    this.previewWindowRange = null;
    this.previewHeightCache = null;
    this.highlightCharsUsed = 0;
    this.deferredHighlightCount = 0;
    this.deferredHighlightFilling = false;
    this.sectionOffsetsList = null;
    this.sectionOffsetsCache = null;
    this.sectionParseCache = null;
    this.tocElt.innerHTML = '';
    this.previewElt.innerHTML = '';
    const segmented = isSegmentedLoadingEnabled(
      store.getters['data/computedSettings'],
    ) && this.segmentedLoadingEnabled !== false;
    this.segmentedPipeline = segmented;
    if (segmented) {
      this.docModel = this.docModel || createDocModel();
    }
    const options = {
      sectionHighlighter: (section) => {
        return safeHighlight(
          section.text,
          this.prismGrammars[section.data],
          section.data,
        );
      },
      // 卡 013/014：编辑器侧渐进高亮——初始化与批量重建时，预算外的段先以
      // 纯文本占位（textContent 逐字等同），停笔后分批补上 Prism 着色。
      // 不变式不破：段 DOM 文本始终 == 模型切片（哨兵/全选/查找不受影响）。
      deferSectionHighlight: section => this.shouldDeferHighlight(section),
      onHighlighted: () => {
        // pass 结束：重置预算计数（下次击键从零算起）并安排补齐
        this.highlightCharsUsed = 0;
        this.scheduleDeferredHighlightFill();
      },
      // 卡 012/015 事实修正：廉价分段器与 markdown-it 的块边界不等价
      // （样本 9546 vs 10801，index 0 即分歧：标题/列表/hr 可无空行打断段落）。
      // 编辑器与预览共用同一 section 源（markdown-it）才能保持 1:1 配对；
      // 模型只负责文本事实（delta/窗口 diff/全选/TOC 数据源）。
      sectionParser: (text) => {
        // 记忆化（卡 013）：cledit 的解析 pass 可能对同一文本连续调用多次
        // （refreshedSections / 补齐循环 / undo 探查），markdown-it 全量重解在
        // 810k 上是 ~10ms × N。同一文本（=== 比较，内容不变时引用稳定）直接
        // 复用上次结果。这是纯优化：结果与重解完全一致。
        if (this.sectionParseCache && this.sectionParseCache.text === text) {
          return this.sectionParseCache.sections;
        }
        const parsingCtx = markdownConversionSvc.parseSections(this.converter, text);
        this.parsingCtx = parsingCtx;
        this.sectionParseCache = { text, sections: parsingCtx.sections };
        return parsingCtx.sections;
      },
      ...(segmented ? this.buildSegmentedHooks() : {}),
      getCursorFocusRatio: () => {
        if (store.getters['data/layoutSettings'].focusMode) {
          return 1;
        }
        return 0.15;
      },
    };
    this.initClEditorInternal(options);
    this.restoreScrollPosition();
  },

  /**
   * 预览是否可见（卡 014）：隐藏面板即零预览工作。设备无关。
   */
  isPreviewVisible() {
    const styles = store.getters['layout/styles'];
    return !!(styles && styles.showPreview);
  },

  /**
   * 含引用式链接定义的文档回退全量转换路径（卡 014）：分段渲染会丢跨段
   * 引用解析上下文。判定源为模型文本；OFF 管线不需要。
   */
  needsFullConvertFallback() {
    return hasReferenceDefinitions(this.docModel ? this.docModel.text : '');
  },

  /**
   * 预览刷新入口（卡 014）：仅分段管线有效——不可见即不刷新；OFF 管线恒为
   * 可刷新（旧行为）。返回 true 表示调用方应按旧流程继续。
   */
  refreshPreviewIfVisible() {
    if (!this.segmentedPipeline) {
      return true;
    }
    return this.isPreviewVisible();
  },

  /**
   * 段索引是否落在当前预览窗口内（卡 014）。尚未建立窗口时 = 首屏窗口。
   * 含引用定义、或非分段管线时恒为 true（全量路径）。
   */
  isSectionInPreviewWindow(index) {
    if (!this.segmentedPipeline || this.needsFullConvertFallback()) {
      return true;
    }
    const range = this.previewWindowRange;
    if (!range) {
      return true; // 首次刷新：按字符预算决定（见 sectionEndsInitialPreviewWindow）
    }
    return index >= range.from && index < range.to;
  },

  /**
   * 首次刷新的挂载上限：按字符预算在前几个段处截止（首屏可用即返回，
   * 其余交给 applyPreviewWindow 按滚动按需挂载）。
   */
  sectionEndsInitialPreviewWindow(sections) {
    const budget = this.previewInitialCharBudget || 60000;
    let chars = 0;
    for (let i = 0; i < sections.length; i += 1) {
      chars += (sections[i] && sections[i].text ? sections[i].text.length : 0);
      if (chars >= budget) {
        return i + 1;
      }
    }
    return sections.length;
  },

  /**
   * 预览暂停/恢复（卡 014）：不可见期间置脏；重新可见时补跑一次全量
   * convert + refreshPreview，使预览正确收敛。
   */
  resumePreviewIfPaused() {
    if (!this.segmentedPipeline || !this.previewPaused) {
      return;
    }
    this.previewPaused = false;
    this.convert();
    this.refreshPreview();
    this.measureSectionDimensions(false, true, true);
  },

  /**
   * 预览按需分段渲染（卡 014）：可见窗口内的段挂真实 HTML，窗口外的段换成
   * 轻量占位（估算高度），保持 previewElt.children[i] ↔ sectionDescList[i]
   * 1:1（测量 / 滚动同步 / TOC 锚定均依赖此对齐）。
   *
   * 实测高度回填进 previewHeightCache；缓存随文档重建而清空。
   */
  applyPreviewWindow() {
    // 卡 014：全量回退路径（含引用定义）不换窗，所有段始终保持挂载。
    if (this.needsFullConvertFallback()) {
      this.previewWindowRange = null;
      return;
    }
    const descs = this.previewCtx && this.previewCtx.sectionDescList;
    const scroller = this.previewElt && this.previewElt.parentNode;
    if (!descs || !descs.length || !scroller) {
      return;
    }
    const cache = this.previewHeightCache || (this.previewHeightCache = { measured: {}, estimated: {} });
    const sections = descs.map(d => ({ text: (d.section && d.section.text) || '' }));
    const opts = {
      avgCharPx: 8,
      lineHeight: 24,
      viewportWidth: Math.max(200, this.previewElt.clientWidth || 800),
    };
    // 未测量的段用估算；已测量的用实测值
    const heights = computeSectionHeights(sections, cache.measured, opts);
    const starts = computeSectionOffsets(heights);
    const range = computeVisibleRange(
      heights,
      starts,
      scroller.scrollTop || 0,
      scroller.clientHeight || 600,
      1200,
    );
    const plan = planWindowChange(this.previewWindowRange, range, descs.length);
    if (!plan.mount.length && !plan.unmount.length) {
      this.previewWindowRange = range;
      return;
    }
    const placeholderH = i => heights[i];
    const mountOne = (i) => {
      const desc = descs[i];
      const elt = desc.previewElt;
      if (!elt || elt.dataset.previewMounted === '1') {
        return;
      }
      elt.innerHTML = replaceLocalImageSrc(
        htmlSanitizer.sanitizeHtml(this.conversionCtx.htmlSectionList[i]),
      );
      elt.dataset.previewMounted = '1';
      elt.style.minHeight = '';
      extensionSvc.sectionPreview(elt, this.options, true);
      if (elt.offsetHeight > 0) {
        cache.measured[i] = elt.offsetHeight;
      }
    };
    const unmountOne = (i) => {
      const desc = descs[i];
      const elt = desc.previewElt;
      if (!elt || elt.dataset.previewMounted !== '1') {
        return;
      }
      if (elt.offsetHeight > 0) {
        cache.measured[i] = elt.offsetHeight;
      }
      elt.innerHTML = '';
      elt.dataset.previewMounted = '0';
      elt.style.minHeight = `${placeholderH(i)}px`;
    };
    // 先卸载后挂载（保持滚动条量级稳定）
    for (const r of plan.unmount) {
      for (let i = r.from; i < r.to; i += 1) {
        unmountOne(i);
      }
    }
    for (const r of plan.mount) {
      for (let i = r.from; i < r.to; i += 1) {
        mountOne(i);
      }
    }
    this.previewWindowRange = range;
  },

  /** 滚动 / 尺寸变化时的预览窗口重算（节流）。 */
  schedulePreviewWindow: allowDebounce(function schedulePreviewWindow() {
    if (editorSvc.previewPaused || !editorSvc.segmentedPipeline) {
      return;
    }
    editorSvc.applyPreviewWindow();
  }, 100),

  /**
   * 增量高亮预算（卡 013/014）：一次解析/重建 pass 内，字符数超出预算的段先以
   * 纯文本占位（textContent 逐字等同），停笔后分批补 Prism 着色。
   * 预算在每次 pass 结束（highlighted 事件）重置，因此击键只影响少数段 → 立即高亮。
   * OFF 管线恒为 false（发布版行为）。
   */
  shouldDeferHighlight(section) {
    if (!this.segmentedPipeline) {
      return false;
    }
    // 补齐轮内不做预算限制，否则被推迟的段会被反复重建而不收敛。
    if (this.deferredHighlightFilling) {
      return false;
    }
    if (this.highlightCharsUsed >= this.highlightInitialCharBudget) {
      this.deferredHighlightCount += 1;
      return true;
    }
    this.highlightCharsUsed += (section && section.text ? section.text.length : 0);
    return false;
  },

  /**
   * 分批补齐被延迟的高亮（空闲切批）。用 cledit 既有的
   * refreshHighlightedSections（保持 undo/选区语义），每批 PORTION 段。
   */
  scheduleDeferredHighlightFill() {
    if (!this.segmentedPipeline || !this.clEditor) {
      return;
    }
    if (this.deferredHighlightTimer || !this.deferredHighlightCount) {
      return; // 幂等排程；无待办时不扫 DOM
    }
    const fill = () => {
      this.deferredHighlightTimer = null;
      const elts = this.editorElt.querySelectorAll('.cledit-section[data-highlight-deferred="1"]');
      if (!elts.length) {
        this.deferredHighlightCount = 0;
        return;
      }
      // 按「字符预算」分批：段落长度差异极大（一个 fence 段可上万字），
      // 按段数分批会让单批成本波动数十倍（实测最长帧 647ms）。改为累计
      // 字符达到 FILL_CHAR_BUDGET 即切断，使每批工作量恒定。
      const FILL_CHAR_BUDGET = 60000;
      const targets = new Set();
      let chars = 0;
      for (let i = 0; i < elts.length; i += 1) {
        const section = elts[i].section;
        if (!section) {
          continue;
        }
        targets.add(section);
        chars += (section.text ? section.text.length : 0);
        if (chars >= FILL_CHAR_BUDGET) {
          break;
        }
      }
      if (!targets.size) {
        this.deferredHighlightCount = 0;
        return;
      }
      // 补齐轮：不做预算限制，确保这批段真正完成着色
      this.deferredHighlightFilling = true;
      try {
        this.clEditor.refreshHighlightedSections(section => targets.has(section));
      } finally {
        this.deferredHighlightFilling = false;
      }
      this.deferredHighlightCount = this.editorElt
        .querySelectorAll('.cledit-section[data-highlight-deferred="1"]').length;
      this.scheduleDeferredHighlightFill();
    };
    const schedule = window.requestIdleCallback || (cb => setTimeout(cb, 60));
    this.deferredHighlightTimer = true;
    schedule(fill, { timeout: 500 });
  },

  /**
   * 扫描驱动 TOC（卡 015）：从模型文本行扫描重建目录 DOM，与预览渲染解耦。
   * 条目与 sectionList 索引对齐（无标题段占位），锚点 = section 索引。
   * 中段 splice：击键只重建局部条目，尾部条目对象与 DOM 保持复用。
   */
  rebuildTocFromScan(sectionsArg) {
    if (!this.docModel || !this.tocElt) {
      return;
    }
    // TOC 槽位来自编辑器自己的 sectionList（markdown-it 划分），保证
    // tocElt.children[i] ↔ sectionList[i] ↔ preview 1:1 对齐；标题内容由
    // 行扫描（自由文本，与 markdown-it 划分解耦）按偏移映射进来。
    const sections = sectionsArg || this.sectionList;
    if (!sections || !sections.length) {
      return;
    }
    const text = this.docModel.text;
    const starts = computeSectionStarts(sections);
    const headings = mapHeadingsToSections(extractHeadings(text), sections.map((s, i) => ({
      start: starts[i],
      end: starts[i] + (s.text ? s.text.length : 0),
    })));
    const entries = computeTocEntries(sections, headings);
    const keys = entries.map(e => tocEntryKey(e));
    const ops = planTocPatch(this.tocKeys || [], keys);
    if (!ops.length) {
      return;
    }
    for (const op of ops) {
      for (let i = 0; i < op.removeCount; i += 1) {
        const elt = this.tocElt.children[op.index];
        if (elt) {
          this.tocElt.removeChild(elt);
        }
      }
      const anchor = this.tocElt.children[op.index] || null;
      for (let i = 0; i < op.keys.length; i += 1) {
        const entry = this.tocEntriesFromKey(op.keys[i]);
        this.tocElt.insertBefore(this.createTocEntryElt(entry), anchor);
      }
    }
    this.tocKeys = keys;
    this.tocElt.classList[
      this.tocElt.querySelector('.cl-toc-section *') ? 'remove' : 'add'
    ]('toc-tab--empty');
    applyTocOutlineDepths(this.tocElt);
    this.measureSectionDimensions(false, false, true);
  },

  /** 条目键 → {level,text}（键 = `${level}\u0000${text}`）。 */
  tocEntriesFromKey(key) {
    const sep = key.indexOf('\u0000');
    return { level: Number(key.slice(0, sep)), text: key.slice(sep + 1) };
  },

  /** 新建一个 TOC 条目 DOM（标题内容走 inline 渲染，占位为空 div）。 */
  createTocEntryElt(entry) {
    const sectionTocElt = document.createElement('div');
    sectionTocElt.className = 'cl-toc-section';
    if (entry.level) {
      const headingElt = document.createElement(`h${entry.level}`);
      headingElt.innerHTML = this.renderTocHeadingHtml(entry.text);
      sectionTocElt.appendChild(headingElt);
    }
    return sectionTocElt;
  },

  /** 标题行内渲染（模型文本 → 安全 HTML）。 */
  renderTocHeadingHtml(raw) {
    const md = this.converter;
    if (md && typeof md.renderInline === 'function') {
      try {
        return htmlSanitizer.sanitizeHtml(md.renderInline(raw || ''));
      } catch (err) {
        // 回退纯文本
      }
    }
    return htmlSanitizer.sanitizeHtml(
      String(raw || '').replace(/&/g, '&amp;').replace(/</g, '&lt;'),
    );
  },

  /**
   * 分段管线钩子（ADR-0012）：模型供文本、mutations 推 delta、窗口化 diff。
   * 任一推导失败 → 安全网全量重建（正确性优先）。
   */
  buildSegmentedHooks() {
    const svc = this;
    return {
      getModelText: () => svc.docModel.text,
      onInitContent: (text) => {
        svc.docModel.setFullText(text);
      },
      applyMutations: (mutations) => {
        try {
          const descs = svc.normalizeMutations(mutations);
          const deltas = mergeMutationDeltas(descs);
          if (!deltas) {
            return false;
          }
          for (const d of deltas) {
            svc.docModel.applyDelta(d);
          }
          return svc.verifyModelAgainstDom(deltas);
        } catch (err) {
          return false;
        }
      },
      rebuildFromDom: () => {
        // 安全网：从 DOM 全量重建模型（推导失败时，正确但慢）
        const domText = svc.editorElt.textContent
          .replace(/\r[\n\u0085]?|[\u2424\u2028\u0085]/g, '\n');
        svc.docModel.setFullText(domText);
      },
      computeDiffs: (oldText, newText) => windowedDiff(oldText, newText),
    };
  },

  /**
   * 局部自检（卡 012/015）：只读被改段（O(段)），比对模型切片与 DOM 文本。
   * 段起点在编辑前后不变，故可用编辑前的段偏移读 DOM 的编辑后文本。
   * 失败 → false → 调用方走 rebuildFromDom 安全网（正确但慢）。
   */
  verifyModelAgainstDom(deltas) {
    const list = this.sectionList;
    const text = this.docModel.text;
    if (!list || !list.length || !deltas || !deltas.length) {
      return true;
    }
    const offsets = this.getSectionOffsets();
    const elts = this.editorElt.children;
    let first = Infinity;
    for (const d of deltas) {
      if (d.start < first) first = d.start;
    }
    let lo = 0;
    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (offsets[i] <= first) {
        lo = i;
        break;
      }
    }
    const elt = elts[lo];
    if (!elt) {
      return false;
    }
    const domText = elt.textContent;
    return text.slice(offsets[lo], offsets[lo] + domText.length) === domText;
  },

  /**
   * MutationRecord[] → 归一化描述（DOM 薄壳：偏移定位）。
   * 无法定位的形态返回含未知类型项，由 mergeMutationDeltas 判定安全网。
   */
  normalizeMutations(mutations) {
    const descs = [];
    for (const m of mutations) {
      if (m.type === 'characterData') {
        const offset = this.getDomTextOffset(m.target);
        if (offset == null) {
          descs.push({ type: 'unknown' });
          continue;
        }
        descs.push({
          type: 'text',
          offset,
          oldValue: m.oldValue || '',
          value: m.target.nodeValue || '',
        });
      } else if (m.type === 'childList') {
        const anchorNode = m.previousSibling || m.target.previousSibling;
        let offset = null;
        if (anchorNode) {
          offset = this.getDomTextOffset(anchorNode);
          if (offset != null) offset += anchorNode.textContent.length;
        } else {
          const parentOffset = this.getDomTextOffset(m.target);
          if (parentOffset != null) offset = parentOffset;
        }
        if (offset == null) {
          descs.push({ type: 'unknown' });
          continue;
        }
        const removedText = Array.from(m.removedNodes)
          .map(n => n.textContent).join('');
        const addedText = Array.from(m.addedNodes)
          .map(n => n.textContent).join('');
        descs.push({ type: 'list', offset, removedText, addedText });
      } else {
        descs.push({ type: 'unknown' });
      }
    }
    return descs;
  },

  /**
   * sectionList（cledit 当前段列表）的累积起始偏移。缓存于列表身份。
   */
  getSectionOffsets() {
    if (this.sectionOffsetsList === this.sectionList && this.sectionOffsetsCache) {
      return this.sectionOffsetsCache;
    }
    const list = this.sectionList || [];
    const offsets = new Array(list.length);
    let offset = 0;
    for (let i = 0; i < list.length; i += 1) {
      offsets[i] = offset;
      offset += list[i] && list[i].text ? list[i].text.length : 0;
    }
    this.sectionOffsetsList = this.sectionList;
    this.sectionOffsetsCache = offsets;
    return offsets;
  },

  /**
   * 节点在编辑器域内的文本偏移：先定位其所属 section（cledit 段对象），
   * 再加段内相对文本偏移。不做全文 DOM 读。
   */
  getDomTextOffset(node) {
    let elt = node.nodeType === 3 ? node.parentNode : node;
    while (elt && elt !== this.editorElt) {
      if (elt.classList && elt.classList.contains('cledit-section')) {
        const index = Array.prototype.indexOf.call(this.editorElt.children, elt);
        if (index < 0) {
          return null;
        }
        // 段内相对偏移：该元素内位于 node 之前的文本量
        let rel = 0;
        const walker = document.createTreeWalker(elt, window.NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (walker.currentNode === node) {
            break;
          }
          rel += walker.currentNode.textContent.length;
        }
        return this.getSectionOffsets()[index] + rel;
      }
      elt = elt.parentNode;
    }
    return node === this.editorElt ? 0 : null;
  },

  /**
   * Finish the conversion initiated by the section parser
   */
  convert() {
    if (!this.parsingCtx || !this.parsingCtx.markdownState) {
      return; // 编辑器尚未完成首次 section 解析（init 早期事件）；无正文可转换
    }
    this.perfCounters.convert += 1;
    this.conversionCtx = markdownConversionSvc.convert(this.parsingCtx, this.conversionCtx);
    this.emit('conversionCtx', this.conversionCtx);
    ({ tokens } = this.parsingCtx.markdownState);
  },

  /**
   * Refresh the preview with the result of `convert()`
   */
  async refreshPreview() {
    if (!this.conversionCtx || !this.previewCtx) {
      return;
    }
    this.perfCounters.refreshPreview += 1;
    // 卡 014：首次（或重开文档后）确立初始窗口 —— 按字符预算取前几段，
    // 其余为占位；后续滚动由 applyPreviewWindow 按需换窗。
    if (this.segmentedPipeline && !this.needsFullConvertFallback() && !this.previewWindowRange) {
      this.previewWindowRange = {
        from: 0,
        to: this.sectionEndsInitialPreviewWindow(this.conversionCtx.sectionList || []),
      };
    }
    const nextPreviewImgPathCounts = Object.create(null);
    const sectionDescList = [];
    let sectionPreviewElt;
    let sectionTocElt;
    let sectionIdx = 0;
    let sectionDescIdx = 0;
    let insertBeforePreviewElt = this.previewElt.firstChild;
    let insertBeforeTocElt = this.tocElt.firstChild;
    let previewHtml = '';
    let loadingImages = [];
    // 卡 015：分段管线 ON 时 TOC 由扫描驱动（rebuildTocFromScan），此处只读
    // 已存在的条目做锚点，不写入、不删。
    const tocDrivenByScan = !!this.segmentedPipeline;
    for (const item of this.conversionCtx.htmlSectionDiff) {
      for (let i = 0; i < item[1].length; i += 1) {
        const section = this.conversionCtx.sectionList[sectionIdx];
        if (item[0] === 0) {
          let sectionDesc = this.previewCtx.sectionDescList[sectionDescIdx];
          sectionDescIdx += 1;
          if (!sectionDesc) {
            // 防御：上下文不同步时跳过该项（正常路径下 initClEditor 会重置
            // parsingCtx/conversionCtx，不会出现）
            sectionIdx += 1;
            continue;
          }
          if (sectionDesc.editorElt !== section.elt) {
            // Force textToPreviewDiffs computation
            sectionDesc = new SectionDesc(
              section,
              sectionDesc.previewElt,
              sectionDesc.tocElt,
              sectionDesc.html,
            );
          }
          sectionDescList.push(sectionDesc);
          previewHtml += sectionDesc.html;
          sectionIdx += 1;
          insertBeforePreviewElt = insertBeforePreviewElt.nextSibling;
          if (!tocDrivenByScan) {
            insertBeforeTocElt = insertBeforeTocElt.nextSibling;
          }
        } else if (item[0] === -1) {
          sectionDescIdx += 1;
          sectionPreviewElt = insertBeforePreviewElt;
          insertBeforePreviewElt = insertBeforePreviewElt.nextSibling;
          this.previewElt.removeChild(sectionPreviewElt);
          if (!tocDrivenByScan) {
            sectionTocElt = insertBeforeTocElt;
            insertBeforeTocElt = insertBeforeTocElt.nextSibling;
            this.tocElt.removeChild(sectionTocElt);
          }
        } else if (item[0] === 1) {
          sectionIdx += 1;
          const mountIndex = sectionIdx - 1;
          // 卡 014：窗口外的段不落 HTML，只占位（保持 children[i] 对齐）
          const inWindow = this.isSectionInPreviewWindow(mountIndex);
          const html = inWindow ? replaceLocalImageSrc(
            htmlSanitizer.sanitizeHtml(this.conversionCtx.htmlSectionList[mountIndex]),
          ) : '';

          // Create preview section element
          sectionPreviewElt = document.createElement('div');
          sectionPreviewElt.className = 'cl-preview-section';
          sectionPreviewElt.innerHTML = html;
          sectionPreviewElt.dataset.previewMounted = inWindow ? '1' : '0';
          if (!inWindow) {
            sectionPreviewElt.style.minHeight = `${estimateBlockHeight((section && section.text) || '', {
              avgCharPx: 8,
              lineHeight: 24,
              viewportWidth: Math.max(200, this.previewElt.clientWidth || 800),
            })}px`;
          }
          if (insertBeforePreviewElt) {
            this.previewElt.insertBefore(sectionPreviewElt, insertBeforePreviewElt);
          } else {
            this.previewElt.appendChild(sectionPreviewElt);
          }
          if (inWindow) {
            await extensionSvc.sectionPreview(sectionPreviewElt, this.options, true);
          }
          const imgs = inWindow
            ? Array.prototype.slice.call(sectionPreviewElt.getElementsByTagName('img')).map((imgElt) => {
              const workspaceSrcAttr = imgElt.attributes[localImageSrcAttr];
              if (workspaceSrcAttr) {
                const uri = decodeURIComponent(workspaceSrcAttr.nodeValue);
                imgElt.removeAttribute(localImageSrcAttr);
                return { imgElt, uri };
              }
              return { imgElt };
            })
            : [];
          loadingImages = [
            ...loadingImages,
            ...imgs,
          ];

          Array.prototype.slice.call(sectionPreviewElt.getElementsByTagName('a')).forEach((aElt) => {
            const url = aElt.attributes && aElt.attributes.href && aElt.attributes.href.nodeValue;
            if (!url || url.indexOf('http://') >= 0 || url.indexOf('https://') >= 0 || url.indexOf('#') >= 0) {
              return;
            }
            aElt.href = 'javascript:void(0);'; // eslint-disable-line no-script-url
            aElt.setAttribute('onclick', `window.viewFileByPath('${utils.decodeUrlPath(url)}')`);
          });

          // Create TOC section element
          // 卡 015：分段管线 ON 时 TOC 由扫描驱动（rebuildTocFromScan，与
          // sectionList 等长对齐），此处只取锚点不写入；OFF 保留旧行为。
          if (tocDrivenByScan) {
            sectionTocElt = this.tocElt.children[sectionIdx - 1];
          } else {
            sectionTocElt = document.createElement('div');
            sectionTocElt.className = 'cl-toc-section';
            const headingElt = sectionPreviewElt.querySelector('h1, h2, h3, h4, h5, h6');
            if (headingElt) {
              const clonedElt = headingElt.cloneNode(true);
              clonedElt.removeAttribute('id');
              sectionTocElt.appendChild(clonedElt);
              // Outline depth is recomputed for the WHOLE TOC after the diff loop
              // (applyTocOutlineDepths): a heading's indent depends on the whole
              // document prefix, which incremental section rendering cannot see.
              const contentElt = document.createElement('span');
              contentElt.className = 'content';
              while (headingElt.firstChild) {
                contentElt.appendChild(headingElt.firstChild);
              }
              const prefixElt = document.createElement('span');
              prefixElt.className = 'prefix';
              headingElt.insertBefore(prefixElt, headingElt.firstChild);
              headingElt.appendChild(contentElt);
              const suffixElt = document.createElement('span');
              suffixElt.className = 'suffix';
              headingElt.appendChild(suffixElt);
            }
            if (insertBeforeTocElt) {
              this.tocElt.insertBefore(sectionTocElt, insertBeforeTocElt);
            } else {
              this.tocElt.appendChild(sectionTocElt);
            }
          }

          previewHtml += html;
          sectionDescList.push(new SectionDesc(section, sectionPreviewElt, sectionTocElt, html));
        }
      }
    };

    if (!tocDrivenByScan) {
      this.tocElt.classList[
        this.tocElt.querySelector('.cl-toc-section *') ? 'remove' : 'add'
      ]('toc-tab--empty');
      // Whole-TOC depth pass over the final document order (batch-A #039 fix):
      // unchanged sections kept stale dataset values and fresh ones never saw
      // their ancestors, so any `#` level edit left sticky misalignment.
      applyTocOutlineDepths(this.tocElt);
    }

    this.previewCtx = {
      markdown: this.conversionCtx.text,
      html: previewHtml.replace(/^\s+|\s+$/g, ''),
      text: this.previewElt.textContent,
      sectionDescList,
    };
    this.emit('previewCtx', this.previewCtx);
    this.makeTextToPreviewDiffs();

    // Wait for images to load
    const loadedPromises = loadingImages.map(it => new Promise((resolve) => {
      if (!it.imgElt.src && it.uri) {
        getImgUrl(it.uri).then((newUrl) => {
          if (newUrl) {
            it.imgElt.src = newUrl;
            it.imgElt.setAttribute(localImagePathAttr, getAbsoluteWorkspaceImgPath(it.uri));
          }
          resolve();
        }, () => resolve());
        return;
      }
      if (!it.imgElt.src) {
        resolve();
        return;
      }
      const img = new window.Image();
      img.onload = resolve;
      img.onerror = resolve;
      img.src = it.imgElt.src;
    }));
    await Promise.all(loadedPromises);
    this.activePreviewImgPathCounts = syncActiveImgPathCounts(
      this.activePreviewImgPathCounts,
      countActiveWorkspaceImages(this.previewElt),
    );

    // Debounce if sections have already been measured
    this.measureSectionDimensions(!!this.previewCtxMeasured);
    // 卡 014：刷新后按当前滚动位置校正窗口（可见时才做）
    if (this.segmentedPipeline && !this.previewPaused) {
      this.applyPreviewWindow();
    }
  },

  /**
   * Measure the height of each section in editor, preview and toc.
   */
  measureSectionDimensions: allowDebounce((restoreScrollPosition = false, force = false, isPreviewMeasure = false) => {
    if (isPreviewMeasure && editorSvc.previewPaused) {
      return; // 卡 014：预览隐藏时不做预览侧测量
    }
    if (isPreviewMeasure) {
      editorSvc.perfCounters.measurePreview += 1;
    }
    if (force || editorSvc.previewCtx !== editorSvc.previewCtxMeasured) {
      sectionUtils.measureSectionDimensions(editorSvc);
      editorSvc.previewCtxMeasured = editorSvc.previewCtx;
      if (restoreScrollPosition) {
        editorSvc.restoreScrollPosition();
      }
      editorSvc.emit('previewCtxMeasured', editorSvc.previewCtxMeasured);
    }
  }, 500),

  /**
   * Compute the diffs between editor's markdown and preview's html
   * asynchronously unless there is only one section to compute.
   */
  makeTextToPreviewDiffs() {
    if (editorSvc.previewCtx !== editorSvc.previewCtxWithDiffs) {
      const makeOne = () => {
        let hasOne = false;
        const hasMore = editorSvc.previewCtx.sectionDescList
          .some((sectionDesc) => {
            if (!sectionDesc.textToPreviewDiffs) {
              if (hasOne) {
                return true;
              }
              if (!sectionDesc.previewText) {
                sectionDesc.previewText = sectionDesc.previewElt.textContent;
              }
              sectionDesc.textToPreviewDiffs = diffMatchPatch.diff_main(
                sectionDesc.section.text,
                sectionDesc.previewText,
              );
              hasOne = true;
            }
            return false;
          });
        if (hasMore) {
          setTimeout(() => makeOne(), 10);
        } else {
          editorSvc.previewCtxWithDiffs = editorSvc.previewCtx;
          editorSvc.emit('previewCtxWithDiffs', editorSvc.previewCtxWithDiffs);
        }
      };
      makeOne();
    }
  },

  /**
   * Save editor selection/scroll state into the store.
   */
  saveContentState: (() => {
    const timeoutIdsByFileId = Object.create(null);
    const saveSnapshot = (snapshot) => {
      if (!snapshot.fileId) {
        return;
      }
      const id = `${snapshot.fileId}/contentState`;
      const patch = {
        id,
        selectionStart: snapshot.selectionStart,
        selectionEnd: snapshot.selectionEnd,
        scrollPosition: snapshot.scrollPosition,
      };
      if (store.state.contentState.itemsById[id]) {
        store.commit('contentState/patchItem', patch);
      }
    };
    const makeSnapshot = () => {
      const fileId = store.getters['file/current'].id;
      const id = `${fileId}/contentState`;
      const currentState = store.state.contentState.itemsById[id] ||
        store.getters['contentState/current'];
      return {
        fileId,
        selectionStart: editorSvc.clEditor.selectionMgr.selectionStart,
        selectionEnd: editorSvc.clEditor.selectionMgr.selectionEnd,
        scrollPosition: editorSvc.getScrollPosition() || currentState.scrollPosition,
      };
    };
    return (doDebounce = false) => {
      const snapshot = makeSnapshot();
      const { fileId } = snapshot;
      clearTimeout(timeoutIdsByFileId[fileId]);
      if (doDebounce) {
        timeoutIdsByFileId[fileId] = setTimeout(() => {
          delete timeoutIdsByFileId[fileId];
          saveSnapshot(snapshot);
        }, 100);
      } else {
        saveSnapshot(snapshot);
      }
    };
  })(),

  /**
   * Report selection from the preview to the editor.
   */
  saveSelection: allowDebounce(() => {
    const selection = window.getSelection();
    let range = selection.rangeCount && selection.getRangeAt(0);
    if (range) {
      if (
        /* eslint-disable no-bitwise */
        !(editorSvc.previewElt.compareDocumentPosition(range.startContainer) &
          window.Node.DOCUMENT_POSITION_CONTAINED_BY) ||
        !(editorSvc.previewElt.compareDocumentPosition(range.endContainer) &
          window.Node.DOCUMENT_POSITION_CONTAINED_BY)
        /* eslint-enable no-bitwise */
      ) {
        range = null;
      }
    }
    if (editorSvc.previewSelectionRange !== range) {
      let previewSelectionStartOffset;
      let previewSelectionEndOffset;
      if (range) {
        const startRange = document.createRange();
        startRange.setStart(editorSvc.previewElt, 0);
        startRange.setEnd(range.startContainer, range.startOffset);
        previewSelectionStartOffset = `${startRange}`.length;
        previewSelectionEndOffset = previewSelectionStartOffset + `${range}`.length;
        const editorStartOffset = editorSvc.getEditorOffset(previewSelectionStartOffset);
        const editorEndOffset = editorSvc.getEditorOffset(previewSelectionEndOffset);
        if (editorStartOffset != null && editorEndOffset != null) {
          editorSvc.clEditor.selectionMgr.setSelectionStartEnd(
            editorStartOffset,
            editorEndOffset,
          );
        }
      }
      editorSvc.previewSelectionRange = range;
      editorSvc.emit('previewSelectionRange', editorSvc.previewSelectionRange);
    }
  }, 50),

  /**
   * Returns the pandoc AST generated from the file tokens and the converter options
   */
  getPandocAst() {
    return tokens && markdownItPandocRenderer(tokens, this.converter.options);
  },

  /**
   * Pass the elements to the store and initialize the editor.
   */
  init(editorElt, previewElt, tocElt) {
    this.editorElt = editorElt;
    this.previewElt = previewElt;
    this.tocElt = tocElt;
    // 开发调试柄（非生产边界职责；仅在 dev 桥控制测试用）
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      window.__editorSvc = this;
    }

    this.createClEditor(editorElt);

    this.clEditor.on('contentChanged', (content, diffs, sectionList) => {
      this.parsingCtx = {
        ...(this.parsingCtx || {}),
        sectionList,
      };
      // 扫描驱动 TOC（卡 015）：文档初始化与每次内容变更后从文本重建目录，
      // 不依赖 convert/refreshPreview（预览是否渲染、是否可见都无所谓）。
      // 注意：不在此处写 this.sectionList——onEditorChanged 依赖它与
      // newSectionList 的差异来触发 refreshPreview，抢先赋值会让预览永不刷新。
      if (this.segmentedPipeline) {
        this.rebuildTocFromScan(sectionList);
      }
    });
    if (this.segmentedPipeline) {
      this.clEditor.on('highlighted', () => {
        // 段级重高亮后 sectionList 可能换新（对象身份），重链 TOC 条目的锚点
        this.rebuildTocFromScan();
      });
    }
    this.clEditor.on('highlightedSectionsRefreshed', (sectionList) => {
      this.parsingCtx = {
        ...(this.parsingCtx || {}),
        sectionList,
      };
      this.sectionList = sectionList;
      if (this.segmentedPipeline) {
        this.rebuildTocFromScan();
      }
      if (this.previewCtx?.sectionDescList?.length) {
        this.previewCtx.sectionDescList.forEach((sectionDesc, index) => {
          const section = sectionList[index];
          if (section) {
            sectionDesc.section = section;
            sectionDesc.editorElt = section.elt;
          }
        });
        this.measureSectionDimensions(false, false, true);
      }
    });

    // 分段管线对账哨兵 + 打点（ADR-0012）：模型文本 ↔ DOM 文本，节流 2s。
    // 只比长度与首尾采样（不做全文 DOM 读，避免把刚移除的 O(全文) 请回来）。
    let lastReconcileAt = 0;
    this.clEditor.on('highlighted', () => {
      if (!this.segmentedPipeline || !this.docModel) {
        return;
      }
      const now = Date.now();
      if (now - lastReconcileAt < 2000) {
        return;
      }
      lastReconcileAt = now;
      const domText = this.editorElt.textContent;
      const modelText = this.docModel.text;
      if (domText.length !== modelText.length) {
        throw new Error(`docModel 哨兵：长度不一致 DOM=${domText.length} model=${modelText.length}`);
      }
      const sample = 200;
      if (domText.slice(0, sample) !== modelText.slice(0, sample)
        || domText.slice(-sample) !== modelText.slice(-sample)) {
        throw new Error('docModel 哨兵：首尾采样不一致');
      }
    });
    this.clEditor.undoMgr.on('undoStateChange', () => {
      const canUndo = this.clEditor.undoMgr.canUndo();
      if (canUndo !== store.state.layout.canUndo) {
        store.commit('layout/setCanUndo', canUndo);
      }
      const canRedo = this.clEditor.undoMgr.canRedo();
      if (canRedo !== store.state.layout.canRedo) {
        store.commit('layout/setCanRedo', canRedo);
      }
    });
    this.pagedownEditor = pagedown({
      input: Object.create(this.clEditor),
    });
    this.pagedownEditor.run();
    this.pagedownEditor.hooks.set('insertLinkDialog', (callback) => {
      // Closing the dialog (X button / Escape) rejects the modal promise:
      // call the pagedown callback so editor focus/selection is restored
      store.dispatch('modal/open', {
        type: 'link',
        callback,
      }).catch(() => callback(null));
      return true;
    });
    this.pagedownEditor.hooks.set('insertImageDialog', (callback) => {
      store.dispatch('modal/open', {
        type: 'image',
        callback,
      }).catch(() => callback(null));
      return true;
    });
    this.pagedownEditor.hooks.set('insertChatGptDialog', (callback, editorContext = {}) => {
      store.dispatch('modal/open', {
        type: 'chatGpt',
        callback,
        editorContext,
      });
      return true;
    });
    this.pagedownEditor.hooks.set('insertImageUploading', (callback) => {
      callback(store.getters['img/currImgId']);
      return true;
    });
    this.editorElt.parentNode.addEventListener('scroll', () => this.saveContentState(true));
    this.previewElt.parentNode.addEventListener('scroll', () => this.saveContentState(true));
    // 卡 014：预览滚动 → 按需换窗（仅可见时；节流）
    this.previewElt.parentNode.addEventListener('scroll', () => this.schedulePreviewWindow());

    // 预览面板可见性（卡 014）：隐藏时预览一律不工作；重新可见时补跑一次。
    // Note：必须无条件注册——此刻 segmentedPipeline 尚未求值（initClEditor 在
    // 内容 watcher 里才跑），在外层门控会永不注册。管线判定放回调内。
    store.watch(
      () => this.isPreviewVisible(),
      (visible) => {
        if (!this.segmentedPipeline) {
          return;
        }
        if (visible) {
          this.resumePreviewIfPaused();
        } else {
          this.previewPaused = true;
        }
      },
      { immediate: true },
    );

    // 击键活跃期跳过全量 convert/refreshPreview(ADR-0012 降频行为,R1-Q3
    // 批准):输入停顿 200ms 后补跑一次;打开文件首次仍即时(instantPreview)。
    // 卡 014:分段管线下预览隐藏时整个刷新链不启动(不 convert/不建 DOM/不测量)。
    // 注意:OFF 旧管线必须照常刷新——可见性短路只属于分段管线。
    const refreshPreview = allowDebounce(async () => {
      if (this.segmentedPipeline && !this.isPreviewVisible()) {
        this.previewPaused = true;
        return;
      }
      this.previewPaused = false;
      if (instantPreview) {
        this.convert();
        await this.refreshPreview();
        this.measureSectionDimensions(false, true, true);
      } else {
        setTimeout(() => {
          this.convert();
          this.refreshPreview();
        }, 10);
      }
      instantPreview = false;
    }, 200);

    let newSectionList;
    let newSelectionRange;
    const onEditorChanged = allowDebounce(() => {
      if (this.sectionList !== newSectionList) {
        this.sectionList = newSectionList;
        this.emit('sectionList', this.sectionList);
        refreshPreview(!instantPreview);
      }
      if (this.selectionRange !== newSelectionRange) {
        this.selectionRange = newSelectionRange;
        this.emit('selectionRange', this.selectionRange);
      }
      this.saveContentState();
    }, 10);

    this.clEditor.selectionMgr.on('selectionChanged', (start, end, selectionRange) => {
      newSelectionRange = selectionRange;
      onEditorChanged(!instantPreview);
    });

    /* -----------------------------
     * Inline images
     */

    const imgCache = Object.create(null);
    const updateActiveEditorImgPaths = (nextEditorImgPathCounts) => {
      this.activeEditorImgPathCounts = syncActiveImgPathCounts(
        this.activeEditorImgPathCounts,
        nextEditorImgPathCounts || countActiveWorkspaceImages(this.editorElt),
      );
    };

    // Key the cache by the markdown URI as well: workspace-local images are
    // cached before their async src resolves and distinct ones must not collide
    const hashImgElt = imgElt => `${imgElt.getAttribute(imgUriAttr)}:${imgElt.src}:${imgElt.width || -1}:${imgElt.height || -1}`;

    const addToImgCache = (imgElt) => {
      const hash = hashImgElt(imgElt);
      let entries = imgCache[hash];
      if (!entries) {
        entries = [];
        imgCache[hash] = entries;
      }
      entries.push(imgElt);
    };

    const getFromImgCache = (imgEltsToCache) => {
      const hash = hashImgElt(imgEltsToCache);
      const entries = imgCache[hash];
      if (!entries) {
        return null;
      }
      let imgElt;
      return entries
        .some((entry) => {
          if (this.editorElt.contains(entry)) {
            return false;
          }
          imgElt = entry;
          return true;
        }) && imgElt;
    };

    const triggerImgCacheGc = cledit.Utils.debounce(() => {
      Object.entries(imgCache).forEach(([src, entries]) => {
        // Filter entries that are not attached to the DOM
        const filteredEntries = entries.filter(imgElt => this.editorElt.contains(imgElt));
        if (filteredEntries.length) {
          imgCache[src] = filteredEntries;
        } else {
          delete imgCache[src];
        }
      });
    }, 100);

    // Batch line-fit requests (one per animation frame) and re-measure section
    // dimensions when an inline max-width actually changed, since shrinking an
    // image card onto the marker line shortens the section height.
    const pendingImgFits = new Set();
    let imgFitFrame = 0;
    const flushImgLineFit = () => {
      imgFitFrame = 0;
      if (!pendingImgFits.size) {
        return;
      }
      const targets = Array.from(pendingImgFits);
      pendingImgFits.clear();
      let changed = false;
      targets.forEach((target) => {
        if (!this.editorElt.contains(target)) {
          return;
        }
        const wrappers = target.classList && target.classList.contains('img-wrapper')
          ? [target]
          : Array.prototype.filter.call(
            target.getElementsByClassName('img-wrapper'), () => true,
          );
        wrappers.forEach((wrapper) => {
          if (fitImgWrapper(wrapper)) {
            changed = true;
          }
        });
      });
      if (changed) {
        this.measureSectionDimensions(true);
      }
    };
    const scheduleImgLineFit = (target) => {
      pendingImgFits.add(target);
      if (!imgFitFrame) {
        imgFitFrame = window.requestAnimationFrame(flushImgLineFit);
      }
    };

    let imgEltsToCache = [];
    // Natural size per markdown URI, recorded on load and preset on creation
    // so re-rendered images keep their box (no 0->H collapse/expand jump)
    const uriNaturalDimensionMap = Object.create(null);
    if (store.getters['data/computedSettings'].editor.inlineImages) {
      this.clEditor.highlighter.on('sectionHighlighted', (section) => {
        const loadImgs = [];
        section.elt.getElementsByClassName('token img').cl_each((imgTokenElt) => {
          const srcElt = imgTokenElt.querySelector('.token.cl-src');
          if (srcElt) {
            // Create an img element before the .img.token and wrap both elements
            // into a .token.img-wrapper
            const imgElt = document.createElement('img');
            imgElt.style.display = 'none';
            const uri = srcElt.textContent;
            if (!/^unsafe/.test(htmlSanitizer.sanitizeUri(uri, true))) {
              imgElt.onload = () => {
                // Ignore stale onload if src/uri no longer match this element
                if (!shouldRecordNaturalSize({
                  eventSrc: imgElt.src,
                  imgSrc: imgElt.src,
                  mapUri: uri,
                  imgUri: imgElt.getAttribute(imgUriAttr) || uri,
                  naturalWidth: imgElt.naturalWidth,
                  naturalHeight: imgElt.naturalHeight,
                })) {
                  return;
                }
                imgElt.style.display = '';
                if (imgElt.naturalWidth && imgElt.naturalHeight) {
                  uriNaturalDimensionMap[uri] = {
                    width: imgElt.naturalWidth,
                    height: imgElt.naturalHeight,
                  };
                }
                // Image size just resolved (or src changed): re-fit the
                // wrapper to the current inline room.
                if (imgElt.parentNode && imgElt.parentNode.classList.contains('img-wrapper')) {
                  scheduleImgLineFit(imgElt.parentNode);
                }
              };
              if (isWorkspaceLocalUri(uri)) {
                // Resolve the blob src synchronously when already cached, so
                // the element re-enters the imgCache reuse pool (non-empty src)
                const absoluteImgPath = getAbsoluteWorkspaceImgPath(decodeURIComponent(uri));
                const cachedUrl = pathUrlMap[absoluteImgPath];
                if (cachedUrl) {
                  imgElt.src = cachedUrl;
                  imgElt.setAttribute(localImagePathAttr, absoluteImgPath);
                } else {
                  loadImgs.push({ imgElt, uri: decodeURIComponent(uri) });
                }
              } else {
                imgElt.src = uri;
              }
              // Take img size into account. The declared `=WxH` comes from the
              // markdown token text, not from imgElt.width/height: those report
              // the natural size as soon as src is set (cached local image),
              // which would wrongly look like an explicit size below.
              const sizeElt = imgTokenElt.querySelector('.token.cl-size');
              const declaredSize = parseDeclaredImgSize(sizeElt && sizeElt.textContent);
              if (declaredSize) {
                if (declaredSize.width) {
                  imgElt.width = declaredSize.width;
                }
                if (declaredSize.height) {
                  imgElt.height = declaredSize.height;
                }
              }
              // Preset known natural width only when uri identity matches;
              // height left to CSS height:auto to avoid stretch from stale cache
              const naturalDimension = uriNaturalDimensionMap[uri];
              if (shouldApplyNaturalSize({
                mapUri: uri,
                imgUri: uri,
                hasExplicitWidth: !!(declaredSize && declaredSize.width),
                hasExplicitHeight: !!(declaredSize && declaredSize.height),
                naturalWidth: naturalDimension && naturalDimension.width,
                naturalHeight: naturalDimension && naturalDimension.height,
              })) {
                const dims = dimensionsForPreset(naturalDimension, { stretchSafe: true });
                if (dims) {
                  imgElt.width = dims.width;
                  if (dims.height != null) {
                    imgElt.height = dims.height;
                  }
                  imgElt.style.display = '';
                }
              }
              imgElt.setAttribute(imgUriAttr, uri);
              imgEltsToCache.push(imgElt);
            }
            const imgTokenWrapper = document.createElement('span');
            imgTokenWrapper.className = 'token img-wrapper';
            imgTokenElt.parentNode.insertBefore(imgTokenWrapper, imgTokenElt);
            imgTokenWrapper.appendChild(imgElt);
            imgTokenWrapper.appendChild(imgTokenElt);
            // Carry the last computed inline cap so the rebuilt card is
            // already narrow on its first frame (no typing-time jump).
            applyRememberedCap(imgTokenWrapper);
          }
        });
        if (loadImgs.length) {
          // Wait for images to load
          const nextEditorImgPathCounts = Object.create(null);
          const loadWorkspaceImg = loadImgs.map(it => new Promise((resolve) => {
            getImgUrl(it.uri).then((newUrl) => {
              if (newUrl) {
                it.imgElt.src = newUrl;
                it.imgElt.setAttribute(localImagePathAttr, getAbsoluteWorkspaceImgPath(it.uri));
              }
              resolve();
            }, () => resolve());
          }));
          Promise.all(loadWorkspaceImg)
            .then(() => updateActiveEditorImgPaths())
            .catch(() => updateActiveEditorImgPaths());
        } else {
          updateActiveEditorImgPaths();
        }
      });
    }
    this.clEditor.highlighter.on('highlighted', () => {
      imgEltsToCache.forEach((imgElt) => {
        if (!imgElt.getAttribute('src')) {
          // Workspace-local images get their src asynchronously; an element
          // with an empty src must be neither reused nor cached
          return;
        }
        const cachedImgElt = getFromImgCache(imgElt);
        if (cachedImgElt) {
          // Found a previously loaded image that has just been released
          imgElt.parentNode.replaceChild(cachedImgElt, imgElt);
        } else {
          addToImgCache(imgElt);
        }
        // (Re)fit the wrapper to the current inline room — both freshly
        // created images and cache-reused ones land here. The wrapper is
        // recreated each sectionHighlight, so it starts with no inline
        // max-width; fitImgWrapper caps it to the rest-of-line room.
        const wrapper = (cachedImgElt || imgElt).parentNode;
        if (wrapper && wrapper.classList.contains('img-wrapper')) {
          scheduleImgLineFit(wrapper);
        }
      });
      imgEltsToCache = [];
      // Eject released images from cache
      triggerImgCacheGc();
      updateActiveEditorImgPaths();
    });

    this.clEditor.on('contentChanged', (content, diffs, sectionList) => {
      newSectionList = sectionList;
      onEditorChanged(!instantPreview);
    });

    const loadedPrismLanguages = new Set();
    const refreshEditorHighlighterForPrism = cledit.Utils.debounce(() => {
      this.initPrism();
      if (this.clEditor) {
        const fencePattern = new RegExp(
          `^(?:\`\`\`|~~~)(?:${Array.from(loadedPrismLanguages)
            .flatMap(getPrismLanguageVariants)
            .map(escapeRegex)
            .join('|')})(?:\\W|$)`,
          'im',
        );
        loadedPrismLanguages.clear();
        this.clEditor.refreshHighlightedSections(section => fencePattern.test(section.text));
      }
    }, 25);
    const offPrismLanguageLoaded = onPrismLanguageLoaded((language) => {
      loadedPrismLanguages.add(language);
      refreshEditorHighlighterForPrism();
    });
    this.clEditor.on('destroy', offPrismLanguageLoaded);

    // clEditorSvc.setPreviewElt(element[0].querySelector('.preview__inner-2'))
    // var previewElt = element[0].querySelector('.preview')
    // clEditorSvc.isPreviewTop = previewElt.scrollTop < 10
    // previewElt.addEventListener('scroll', function () {
    //   var isPreviewTop = previewElt.scrollTop < 10
    //   if (isPreviewTop !== clEditorSvc.isPreviewTop) {
    //     clEditorSvc.isPreviewTop = isPreviewTop
    //     scope.$apply()
    //   }
    // })

    // Watch file content changes
    let lastContentId = null;
    let lastProperties;
    store.watch(
      () => store.getters['content/currentChangeTrigger'],
      () => {
        const content = store.getters['content/current'];
        // Track ID changes
        let initClEditor = false;
        if (content.id !== lastContentId) {
          instantPreview = true;
          lastContentId = content.id;
          initClEditor = true;
        }
        // Track properties changes
        if (content.properties !== lastProperties) {
          lastProperties = content.properties;
          const options = extensionSvc.getOptions(store.getters['content/currentProperties']);
          if (utils.serializeObject(options) !== utils.serializeObject(this.options)) {
            this.options = options;
            this.initPrism();
            this.initConverter();
            initClEditor = true;
          }
        }
        if (initClEditor) {
          this.initClEditor();
        }
        // Apply potential text and discussion changes
        this.applyContent();
      }, {
        immediate: true,
      },
    );

    // Disable editor if hidden or if no content is loaded
    store.watch(
      () => store.getters['content/isCurrentEditable'],
      editable => this.clEditor.toggleEditable(!!editable), {
        immediate: true,
      },
    );

    store.watch(
      () => utils.serializeObject(store.getters['layout/styles']),
      createLayoutRemeasure({
        // Flush the live scroll position before the DOM rewraps, so the
        // post-measure restore doesn't roll back to a stale debounced snapshot.
        saveContentState: () => this.saveContentState(),
        // Re-fit inline images to the new pane/font width BEFORE measuring
        // section offsets — a card shrinking onto its marker line changes the
        // section height, so the restore must land on the post-fit layout.
        measure: () => {
          fitAllImgWrappers(this.editorElt);
          this.measureSectionDimensions(false, true, true);
        },
        requestFrame: cb => window.requestAnimationFrame(cb),
        cancelFrame: id => window.cancelAnimationFrame(id),
      }),
    );

    this.initHighlighters();
    window.addEventListener('beforeunload', releaseAllImgUrls, { once: true });

    // 分段加载总闸：跟随设置实时更新，仅在开关翻转时打日志（重启后 OFF 可证）
    store.watch(
      () => store.getters['data/computedSettings'],
      (settings) => {
        const enabled = isSegmentedLoadingEnabled(settings);
        if (enabled !== this.segmentedLoadingEnabled) {
          this.segmentedLoadingEnabled = enabled;
          console.info(`[kedit] 长文档分段加载：${enabled ? '开' : '关'}`);
        }
      },
      { immediate: true },
    );

    this.emit('inited');
  },
});

export default editorSvc;
