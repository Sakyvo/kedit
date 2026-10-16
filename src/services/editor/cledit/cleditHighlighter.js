import cledit from './cleditCore';

// 延迟高亮时把纯文本转义为安全 HTML（textContent 与原文逐字相等）。
const escapeTextToHtml = value => String(value == null ? '' : value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const styleElts = [];

function createStyleSheet(document) {
  const styleElt = document.createElement('style');
  styleElt.type = 'text/css';
  // display:inline is required for cledit layout; also pin *em* styles here so
  // edit-theme scripts (injected later) cannot leave emphasis unstyled/invisible.
  styleElt.innerHTML = [
    '.cledit-section * { display: inline; }',
    '.cledit-section .token.em, .cledit-section .token.cn-em, .cledit-section .em, .cledit-section .cn-em, .cledit-section .cl-em-text { font-style: italic !important; font-synthesis: style !important; color: #6b5b95 !important; }',
    '.app--dark .cledit-section .token.em, .app--dark .cledit-section .token.cn-em, .app--dark .cledit-section .em, .app--dark .cledit-section .cn-em, .app--dark .cledit-section .cl-em-text { color: #b8a9e0 !important; }',
    '.cledit-section .token.em .cl, .cledit-section .token.cn-em .cl, .cledit-section .em .cl, .cledit-section .cn-em .cl { font-style: normal !important; color: rgba(0,0,0,0.28) !important; }',
    '.app--dark .cledit-section .token.em .cl, .app--dark .cledit-section .token.cn-em .cl, .app--dark .cledit-section .em .cl, .app--dark .cledit-section .cn-em .cl { color: rgba(255,255,255,0.28) !important; }',
  ].join('\n');
  document.head.appendChild(styleElt);
  styleElts.push(styleElt);
}

function Highlighter(editor) {
  cledit.Utils.createEventHooks(this);

  if (!styleElts.cl_some(styleElt => document.head.contains(styleElt))) {
    createStyleSheet(document);
  }

  const contentElt = editor.$contentElt;
  this.isComposing = 0;

  let sectionList = [];
  let insertBeforeSection;
  const useBr = cledit.Utils.isWebkit;
  const trailingNodeTag = 'div';
  const hiddenLfInnerHtml = '<br><span class="hd-lf" style="display: none">\n</span>';

  const lfHtml = `<span class="lf">${useBr ? hiddenLfInnerHtml : '\n'}</span>`;

  this.fixContent = (modifiedSections, removedSections, noContentFix) => {
    modifiedSections.cl_each((section) => {
      section.forceHighlighting = true;
      if (!noContentFix) {
        if (useBr) {
          section.elt.getElementsByClassName('hd-lf')
            .cl_each(lfElt => lfElt.parentNode.removeChild(lfElt));
          section.elt.getElementsByTagName('br')
            .cl_each(brElt => brElt.parentNode.replaceChild(document.createTextNode('\n'), brElt));
        }
        if (section.elt.textContent.slice(-1) !== '\n') {
          section.elt.appendChild(document.createTextNode('\n'));
        }
      }
    });
  };

  this.addTrailingNode = () => {
    this.trailingNode = document.createElement(trailingNodeTag);
    contentElt.appendChild(this.trailingNode);
  };

  const highlight = (section) => {
    // 渐进高亮（卡 013/014）：预算外的段先以「纯文本（已转义）」占位——
    // textContent 与真实文本逐字相等（哨兵/选区/查找全部不受影响），
    // 仅暂时没有 Prism 着色；由 refreshHighlightedSections 分批补上。
    const deferred = editor.options.deferSectionHighlight
      && editor.options.deferSectionHighlight(section);
    const html = deferred
      ? escapeTextToHtml(section.text || '').replace(/\n/g, lfHtml)
      : editor.options.sectionHighlighter(section).replace(/\n/g, lfHtml);
    const sectionElt = document.createElement('div');
    sectionElt.className = 'cledit-section';
    sectionElt.innerHTML = html;
    section.setElement(sectionElt);
    if (deferred) {
      sectionElt.dataset.highlightDeferred = '1';
    }
    this.$trigger('sectionHighlighted', section);
  };


  // 批 048：简化分片构建 —— 打开超长文档时,isInit 只同步渲染首片(≥1 段),
  // 其余段 pendingInitChunk 标记;rAF 逐片补齐(每片预算 ~40ms),期间主线程
  // 频繁交还 → 侧栏/工具栏始终可交互。加载完成前编辑区被进度条覆盖,不投喂输入。
  // OFF(无 chunkedInit 选项)路径与旧行为完全一致。
  this.initFillQueue = null;
  this.initFillActive = false;

  const buildOne = (section) => {
    if (!section.pendingInitChunk) {
      return;
    }
    highlight(section);
    section.pendingInitChunk = false;
    // 挂到 trailingNode 之前(保持文档序)
    contentElt.insertBefore(section.elt, this.trailingNode);
  };

  this.scheduleInitFill = () => {
    if (!this.initFillActive) {
      return;
    }
    window.requestAnimationFrame(() => {
      if (!this.initFillActive) {
        return;
      }
      editor.watcher.noWatch(() => {
        const tStart = performance.now();
        const budget = (editor.options.chunkedInit && editor.options.chunkedInit.sliceBudgetMs) || 40;
        const queue = this.initFillQueue;
        while (queue.length && (performance.now() - tStart < budget)) {
          buildOne(queue.shift());
        }
      });
      const total = this.initFillTotal;
      const done = total - this.initFillQueue.length;
      if (editor.options.onInitFillProgress) {
        editor.options.onInitFillProgress(done, total);
      }
      if (!this.initFillQueue.length) {
        const opts = editor.options;
        this.initFillActive = false;
        this.initFillQueue = null;
        this.$trigger('highlighted');
        if (opts.onHighlighted) {
          opts.onHighlighted();
        }
        if (opts.onInitChunksDone) {
          opts.onInitChunksDone();
        }
        return;
      }
      this.scheduleInitFill();
    });
  };

  /** 放弃进行中的分片(切文档/重建时调用)。 */
  this.cancelInitFill = () => {
    this.initFillActive = false;
    this.initFillQueue = null;
    // 已建段保留,pending 段退回"未挂载"状态(下次 isInit 会整体重建)
  };

  class Section {
    constructor(text) {
      this.text = text.text === undefined ? text : text.text;
      this.data = text.data;
    }
    setElement(elt) {
      this.elt = elt;
      elt.section = this;
    }
  }

  this.parseSections = (content, isInit) => {
    if (this.isComposing && !this.cancelComposition) {
      return sectionList;
    }

    this.cancelComposition = false;
    const newSectionList = (editor.options.sectionParser
      ? editor.options.sectionParser(content)
      : [content])
      .cl_map(sectionText => new Section(sectionText));

    let modifiedSections = [];
    let sectionsToRemove = [];
    insertBeforeSection = undefined;

    if (isInit) {
      // Render everything if isInit
      sectionsToRemove = sectionList;
      sectionList = newSectionList;
      modifiedSections = newSectionList;
    } else {
      // Find modified section starting from top
      let leftIndex = sectionList.length;
      sectionList.cl_some((section, index) => {
        const newSection = newSectionList[index];
        if (index >= newSectionList.length ||
          section.forceHighlighting ||
          // Check text modification
          section.text !== newSection.text ||
          // 批 048:补齐中(未挂载)的段,文本相同即视为未改
          (!section.pendingInitChunk && (
            // Check that section has not been detached or moved
            section.elt.parentNode !== contentElt ||
            // Check also the content since nodes can be injected in sections via copy/paste
            section.elt.textContent !== newSection.text
          ))
        ) {
          leftIndex = index;
          return true;
        }
        return false;
      });

      // Find modified section starting from bottom
      let rightIndex = -sectionList.length;
      sectionList.slice().reverse().cl_some((section, index) => {
        const newSection = newSectionList[newSectionList.length - index - 1];
        if (index >= newSectionList.length ||
          section.forceHighlighting ||
          // Check modified
          section.text !== newSection.text ||
          // 批 048:补齐中(未挂载)的段,文本相同即视为未改
          (!section.pendingInitChunk && (
            // Check that section has not been detached or moved
            section.elt.parentNode !== contentElt ||
            // Check also the content since nodes can be injected in sections via copy/paste
            section.elt.textContent !== newSection.text
          ))
        ) {
          rightIndex = -index;
          return true;
        }
        return false;
      });

      if (leftIndex - rightIndex > sectionList.length) {
        // Prevent overlap
        rightIndex = leftIndex - sectionList.length;
      }

      const leftSections = sectionList.slice(0, leftIndex);
      modifiedSections = newSectionList.slice(leftIndex, newSectionList.length + rightIndex);
      const rightSections = sectionList.slice(sectionList.length + rightIndex, sectionList.length);
      [insertBeforeSection] = rightSections;
      sectionsToRemove = sectionList.slice(leftIndex, sectionList.length + rightIndex);
      sectionList = leftSections.concat(modifiedSections).concat(rightSections);
    }


    const newSectionEltList = document.createDocumentFragment();
    let chunkedFillQueue = null;
    if (isInit && editor.options.chunkedInit) {
      // 批 048/049：分片构建 —— 首片按预算取前若干段同步渲染,其余 pending。
      // 需要首片 ≥1 段:init 返回后 contentChanged 事件会立即触发,调用方要读
      // sectionList/DOM 的"已就绪"状态。
      const chunkOpts = editor.options.chunkedInit;
      const firstBudget = chunkOpts.firstSliceBudgetMs || 40;
      let firstCount = 0;
      let firstCost = 0;
      const samples = modifiedSections.length;
      while (firstCount < samples && firstCount < (chunkOpts.firstMaxSections || 1)) {
        const sec = modifiedSections[firstCount];
        // 与估算器同类:按字符粗估单个段的成本
        const len = (sec.text || '').length;
        firstCost += 0.02 + len * 0.0008;
        if (firstCount > 0 && firstCost > firstBudget) {
          break;
        }
        firstCount += 1;
      }
      if (firstCount === 0) {
        firstCount = Math.min(1, samples);
      }
      for (let i = 0; i < modifiedSections.length; i += 1) {
        const sec = modifiedSections[i];
        sec.forceHighlighting = false;
        if (i < firstCount) {
          highlight(sec);
          newSectionEltList.appendChild(sec.elt);
        } else {
          sec.pendingInitChunk = true;
        }
      }
      chunkedFillQueue = modifiedSections.slice(firstCount);
    } else {
      modifiedSections.cl_each((section) => {
        section.forceHighlighting = false;
        highlight(section);
        newSectionEltList.appendChild(section.elt);
      });
    }
    editor.watcher.noWatch(() => {
      if (isInit) {
        contentElt.innerHTML = '';
        contentElt.appendChild(newSectionEltList);
        this.addTrailingNode();
        if (chunkedFillQueue && chunkedFillQueue.length) {
          this.initFillQueue = chunkedFillQueue;
          this.initFillTotal = chunkedFillQueue.length;
          this.initFillActive = true;
          if (editor.options.onInitFillProgress) {
            editor.options.onInitFillProgress(0, chunkedFillQueue.length);
          }
          this.scheduleInitFill();
        }
        return;
      }

      // Remove outdated sections
      sectionsToRemove.cl_each((section) => {
        // section may be already removed（或补齐中尚未挂载）
        if (section.elt && section.elt.parentNode === contentElt) {
          contentElt.removeChild(section.elt);
        }
        // To detect sections that come back with built-in undo
        section.elt.section = undefined;
      });

      if (insertBeforeSection !== undefined) {
        contentElt.insertBefore(newSectionEltList, insertBeforeSection.elt);
      } else {
        contentElt.appendChild(newSectionEltList);
      }

      // Remove unauthorized nodes (text nodes outside of sections or
      // duplicated sections via copy/paste)
      let childNode = contentElt.firstChild;
      while (childNode) {
        const nextNode = childNode.nextSibling;
        if (!childNode.section) {
          contentElt.removeChild(childNode);
        }
        childNode = nextNode;
      }
      this.addTrailingNode();
      this.$trigger('highlighted');
      if (editor.options.onHighlighted) {
        editor.options.onHighlighted();
      }

      if (editor.selectionMgr.hasFocus()) {
        editor.selectionMgr.restoreSelection();
        editor.selectionMgr.updateCursorCoordinates();
      }
    });

    return sectionList;
  };

  this.highlightSections = (predicate) => {
    const modifiedSections = sectionList.filter(predicate);
    if (!modifiedSections.length) {
      return sectionList;
    }
    modifiedSections.forEach((section) => {
      section.forceHighlighting = true;
    });
    return this.parseSections(editor.getContent());
  };
}

cledit.Highlighter = Highlighter;
