<template>
  <div class="editor-container">
    <div ref="editorRoot" class="editor" ondrop="return false;">
      <pre class="editor__inner markdown-highlighting" :style="{padding: styles.editorPadding, paddingLeft: `calc(${styles.editorGutterWidth}px + max(${styles.editorPadding.split(' ')[1]}, calc(var(--editor-line-number-space, 4em) + 6px)))`}" :class="{monospaced: computedSettings.editor.monospacedFontOnly, 'img-text-above': computedSettings.editor.inlineImageOrder === 'text-above'}"></pre>
      <div class="gutter" :style="{left: styles.editorGutterLeft + 'px'}">
        <comment-list v-if="styles.editorGutterWidth"></comment-list>
      </div>
      <div class="editor__discussion-action" :style="{right: styles.editorPadding.split(' ')[1]}">
        <editor-new-discussion-button v-if="!isCurrentTemp"></editor-new-discussion-button>
      </div>
    </div>
    <custom-scrollbar v-if="scrollerElt" :target="scrollerElt"></custom-scrollbar>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import DiffMatchPatch from 'diff-match-patch';
import CommentList from './gutters/CommentList';
import EditorNewDiscussionButton from './gutters/EditorNewDiscussionButton';
import CustomScrollbar from './common/CustomScrollbar';
import store from '../store';
import editorSvc from '../services/editorSvc';
import imageSvc from '../services/imageSvc';
import { tryRestoreCopiedImage } from '../services/clipboardSvc';
import utils from '../services/utils';

export default {
  components: {
    CommentList,
    EditorNewDiscussionButton,
    CustomScrollbar,
  },
  data: () => ({
    scrollerElt: null,
  }),
  computed: {
    ...mapGetters('file', [
      'isCurrentTemp',
    ]),
    ...mapGetters('layout', [
      'styles',
    ]),
    ...mapGetters('data', [
      'computedSettings',
    ]),
  },
  methods: {
    openZoomedImage(imgElt) {
      const src = imgElt.currentSrc || imgElt.src;
      if (!src) {
        return;
      }
      this.$emit('open-image', {
        src,
        alt: imgElt.alt || '',
      });
    },
    findZoomableImage(elt, editorElt) {
      // Only the rendered image itself zooms, not the whole .img-wrapper
      // (which also contains the raw markdown text)
      while (elt && elt !== editorElt) {
        if (elt.tagName === 'IMG' && editorElt.contains(elt)) {
          return elt;
        }
        elt = elt.parentNode;
      }
      return null;
    },
    // Replace the upload placeholder without creating a new undo state:
    // patches join the same undo batch as the placeholder insertion,
    // so one Ctrl+Z returns to the pre-insert state.
    replacePlaceholder(search, replacement) {
      const { clEditor } = editorSvc;
      const oldContent = clEditor.getContent();
      const newContent = oldContent.replace(search, replacement);
      if (newContent === oldContent) {
        return;
      }
      const offset = clEditor.setContent(newContent, true);
      const diffs = new DiffMatchPatch().diff_main(oldContent, newContent);
      clEditor.undoMgr.addDiffs(oldContent, newContent, diffs);
      // false: do not center-scroll when image placeholder resolves (tall img
      // would pin viewport / poison later Ctrl+Z toward the bottom).
      clEditor.selectionMgr.setSelectionStartEnd(offset.end, offset.end);
      clEditor.selectionMgr.updateCursorCoordinates(false);
    },
    // Collect every image File from a paste/drop payload (DataTransferItemList with
    // getAsFile(), or a raw FileList). Order = selection order on Windows/Chrome.
    collectImageFiles(items) {
      if (!items || items.length === 0) {
        return [];
      }
      const files = [];
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i];
        if (!item || !item.type || item.type.indexOf('image') !== 0) {
          continue;
        }
        const file = typeof item.getAsFile === 'function' ? item.getAsFile() : item;
        if (file && file.type && file.type.indexOf('image/') === 0) {
          files.push(file);
        }
      }
      return files;
    },
    async processUpload(items) {
      const files = this.collectImageFiles(items);
      if (files.length === 0) {
        return;
      }
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const imgId = utils.uid();
        store.dispatch('img/setCurrImgId', imgId);
        editorSvc.pagedownEditor.uiManager.doClick('imageUploading');
        try {
          const { url, error } = await imageSvc.updateImg(file);
          // 存在错误
          if (error) {
            this.replacePlaceholder(`[图片上传中...(image-${imgId})]`, `[图片上传失败...(image-${imgId})]`);
            store.dispatch('notification/error', error);
            continue;
          }
          this.replacePlaceholder(`[图片上传中...(image-${imgId})]`, `![输入图片说明](${url})`);
        } catch (err) {
          console.error(err); // eslint-disable-line no-console
          this.replacePlaceholder(`[图片上传中...(image-${imgId})]`, `[图片上传失败...(image-${imgId})]`);
          store.dispatch('notification/error', err);
        }
      }
    },
  },
  beforeUnmount() {
    if (editorSvc.editorElt?.parentNode === this.$refs.editorRoot) {
      editorSvc.lineNumbers?.dispose();
      editorSvc.lineNumbers = null;
    }
  },
  mounted() {
    // Overlay scrollbar target (the .editor element is the scroller)
    this.scrollerElt = this.$refs.editorRoot;
    // 当前选择的图片存储图床
    const currImgStorageStr = localStorage.getItem('img/checkedStorage');
    if (currImgStorageStr) {
      store.commit('img/changeCheckedStorage', JSON.parse(currImgStorageStr));
    }
    // 当前本地图片路径配置
    const workspaceImgPath = localStorage.getItem('img/workspaceImgPath');
    if (workspaceImgPath) {
      store.commit('img/setWorkspaceImgPath', JSON.parse(workspaceImgPath));
    }
    const editorElt = this.$refs.editorRoot.querySelector('.editor__inner');
    const onDiscussionEvt = cb => (evt) => {
      let elt = evt.target;
      while (elt && elt !== editorElt) {
        if (elt.discussionId) {
          cb(elt.discussionId);
          return;
        }
        elt = elt.parentNode;
      }
    };

    const classToggler = toggle => (discussionId) => {
      editorElt.getElementsByClassName(`discussion-editor-highlighting--${discussionId}`)
        .cl_each(elt => elt.classList.toggle('discussion-editor-highlighting--hover', toggle));
      document.getElementsByClassName(`comment--discussion-${discussionId}`)
        .cl_each(elt => elt.classList.toggle('comment--hover', toggle));
    };

    editorElt.addEventListener('mouseover', onDiscussionEvt(classToggler(true)));
    editorElt.addEventListener('mouseout', onDiscussionEvt(classToggler(false)));
    editorElt.addEventListener('click', (evt) => {
      const imgElt = this.findZoomableImage(evt.target, editorElt);
      if (imgElt) {
        evt.preventDefault();
        evt.stopPropagation();
        this.openZoomedImage(imgElt);
      }
    });
    editorElt.addEventListener('click', onDiscussionEvt((discussionId) => {
      store.commit('discussion/setCurrentDiscussionId', discussionId);
    }));

    editorElt.addEventListener('drop', (event) => {
      const dt = event.dataTransfer;
      if (!dt) {
        return;
      }
      // Same dual-payload issue as paste: file image + HTML/text
      let hasImage = false;
      if (dt.items) {
        for (let i = 0; i < dt.items.length; i += 1) {
          if (dt.items[i].type && dt.items[i].type.indexOf('image') !== -1) {
            hasImage = true;
            break;
          }
        }
      }
      if (!hasImage && dt.files) {
        for (let i = 0; i < dt.files.length; i += 1) {
          if (dt.files[i].type && dt.files[i].type.indexOf('image') !== -1) {
            hasImage = true;
            break;
          }
        }
      }
      if (hasImage) {
        event.preventDefault();
        event.stopPropagation();
        this.processUpload(dt.items || dt.files);
      }
    });
    // Capture so we run before cledit bubble paste; image paste must not turndown HTML.
    editorElt.addEventListener('paste', (event) => {
      const clip = event.clipboardData || window.clipboardData;
      if (!clip) {
        return;
      }
      let hasImage = false;
      if (clip.items) {
        for (let i = 0; i < clip.items.length; i += 1) {
          if (clip.items[i].type && clip.items[i].type.indexOf('image') !== -1) {
            hasImage = true;
            break;
          }
        }
      }
      if (!hasImage && clip.files) {
        for (let i = 0; i < clip.files.length; i += 1) {
          if (clip.files[i].type && clip.files[i].type.indexOf('image') !== -1) {
            hasImage = true;
            break;
          }
        }
      }
      if (!hasImage) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      // Windows/Chrome exposes clipboard file items in reverse selection order;
      // reverse so the document order matches the selection order.
      const items = Array.prototype.slice.call(clip.items || clip.files || []).reverse();
      // Self single-image copy (ADR 0008): a textless clipboard holding exactly
      // one image that pixel-matches the image we just copied restores its
      // reference text instead of re-uploading a duplicate file.
      const types = clip.types || [];
      const textless = !types.includes('text/plain') && !types.includes('text/html');
      if (textless) {
        const files = this.collectImageFiles(items);
        if (files.length === 1) {
          tryRestoreCopiedImage(files[0]).then((refText) => {
            if (refText) {
              const { clEditor } = editorSvc;
              clEditor.replace(clEditor.selectionMgr.selectionStart, clEditor.selectionMgr.selectionEnd, refText);
              clEditor.adjustCursorPosition();
            } else {
              this.processUpload(items);
            }
          });
          return;
        }
      }
      this.processUpload(items);
    }, true);

    this.$watch(
      () => store.state.discussion.currentDiscussionId,
      (discussionId, oldDiscussionId) => {
        if (oldDiscussionId) {
          editorElt.querySelectorAll(`.discussion-editor-highlighting--${oldDiscussionId}`)
            .cl_each(elt => elt.classList.remove('discussion-editor-highlighting--selected'));
        }
        if (discussionId) {
          editorElt.querySelectorAll(`.discussion-editor-highlighting--${discussionId}`)
            .cl_each(elt => elt.classList.add('discussion-editor-highlighting--selected'));
        }
      },
    );
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.editor-container {
  overflow: hidden;
  position: absolute;
  width: 100%;
  height: 100%;
}

.editor {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: auto;
  /* the overlay CustomScrollbar replaces the native bar (this container only) */
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}

.editor__discussion-action {
  position: absolute;
  top: 0;
  width: 0;
}

.editor__line-numbers {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: calc(4ch + 4px);
  background: rgba(0, 0, 0, 0.06);
  font-family: $font-family-monospace;
  font-size: $font-size-monospace;
  font-variant-numeric: tabular-nums;
  color: $editor-color-light-blockquote;
  pointer-events: none;
  user-select: none;

  .app--dark & {
    color: $editor-color-dark-blockquote;
    background: rgba(255, 255, 255, 0.06);
  }
}

.editor__line-number {
  position: absolute;
  right: 2px;
  width: max-content;
  text-align: right;
  white-space: nowrap;
}

.editor__inner {
  margin: 0;
  font-family: $font-family-main;
  font-variant-ligatures: no-common-ligatures;
  white-space: pre-wrap;
  word-break: break-word;
  word-wrap: break-word;

  * {
    line-height: calc(#{$line-height-base} * 1em + var(--kedit-soft-wrap-offset, -2px));
  }

  // 软/硬换行区分：每个 \n 渲染为 .lf（cleditHighlighter 的 lfHtml）。
  // 两个偏移量来自设置（ADR 0015），默认 -2 / +3 时内联为 28.06 / 33.06px。
  // line-height 的增量在基线上下各一半，vertical-align 取增量的一半反向
  // （软 - 硬 的一半）把上侧撑高抵消掉，使差额全落在换行处下方而不上提上一行。
  .lf {
    line-height: calc(#{$line-height-base} * 1em + var(--kedit-hard-break-offset, 3px));
    vertical-align: calc(
      (var(--kedit-soft-wrap-offset, -2px) - var(--kedit-hard-break-offset, 3px)) / 2
    );
  }

  // 代码块行高为 $line-height-title（markdownHighlighting.scss），不含软换行偏移，
  // 所以 .lf 相对上下文的增量只有硬换行偏移，偏移取它的一半。
  // 标题不可能包含硬换行，无需处理。
  .pre .lf {
    line-height: calc(#{$line-height-title} * 1em + var(--kedit-hard-break-offset, 3px));
    vertical-align: calc(-1 * var(--kedit-hard-break-offset, 3px) / 2);
  }

  .cledit-section {
    font-family: inherit;
  }

  .hide {
    display: none;
  }

  .img-wrapper img {
    cursor: zoom-in;
  }

  &.monospaced {
    font-family: $font-family-monospace !important;
    font-size: $font-size-monospace !important;

    * {
      font-size: inherit !important;
    }
  }
}
</style>
