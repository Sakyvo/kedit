<template>
  <div class="toc">
    <div class="toc__mask" :style="{top: maskY + 'px', height: maskHeight + 'px'}"></div>
    <div class="toc__inner"></div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import editorSvc from '../services/editorSvc';
import store from '../store';
import {
  findSectionIndexByTocElt,
  computeTocJumpTargets,
} from '../services/editor/tocJump';
import { tocJumpSuppressor } from '../services/optional/scrollSync';

export default {
  data: () => ({
    maskY: 0,
    maskHeight: 0,
  }),
  computed: {
    ...mapGetters('layout', [
      'styles',
    ]),
  },
  mounted() {
    const tocElt = this.$el.querySelector('.toc__inner');

    // TOC click: re-resolve live section DOM each time (cached editorElt detaches after re-highlight)
    tocElt.addEventListener('click', (e) => {
      e.preventDefault();
      const sectionElt = e.target.closest('.cl-toc-section');
      if (!sectionElt) {
        return;
      }
      const sectionDescList = editorSvc.previewCtx.sectionDescList || [];
      const index = findSectionIndexByTocElt(sectionDescList, sectionElt);
      if (index < 0) {
        return;
      }
      const sectionDesc = sectionDescList[index];
      // Teleport both panes directly (no scrollSync catch-up animation)
      const targets = computeTocJumpTargets({
        showEditor: this.styles.showEditor,
        showSidePreview: this.styles.showSidePreview,
        sectionDesc,
        sectionList: editorSvc.sectionList || (editorSvc.parsingCtx && editorSvc.parsingCtx.sectionList),
        index,
        editorScroller: editorSvc.editorElt && editorSvc.editorElt.parentNode,
        previewRoot: editorSvc.previewElt,
        previewScroller: editorSvc.previewElt && editorSvc.previewElt.parentNode,
      });
      if (targets.editor == null && targets.preview == null) {
        return;
      }
      // Suppress scrollSync's catch-up animation so the preview teleports too.
      tocJumpSuppressor.suppress();
      if (targets.editor != null) {
        editorSvc.editorElt.parentNode.scrollTop = targets.editor;
      }
      if (targets.preview != null) {
        editorSvc.previewElt.parentNode.scrollTop = targets.preview;
      }
      // With auto-jump enabled, close the side bar once the jump happened
      if (store.getters['data/layoutSettings'].tocAutoJump) {
        store.dispatch('data/toggleSideBar', false);
      }
    });

    // Snap the mask to the current section's entry on scroll
    const updateMaskY = () => {
      const scrollPosition = editorSvc.getScrollPosition();
      if (scrollPosition) {
        const sectionDesc = editorSvc.previewCtxMeasured.sectionDescList[scrollPosition.sectionIdx];
        if (sectionDesc && sectionDesc.tocElt) {
          this.maskY = sectionDesc.tocElt.offsetTop;
          this.maskHeight = sectionDesc.tocElt.offsetHeight;
        }
      }
    };

    this.$nextTick(() => {
      editorSvc.editorElt.parentNode.addEventListener('scroll', () => {
        if (this.styles.showEditor) {
          updateMaskY();
        }
      });
      editorSvc.previewElt.parentNode.addEventListener('scroll', () => {
        if (!this.styles.showEditor) {
          updateMaskY();
        }
      });
    });
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.toc__inner {
  position: relative;
  color: rgba(0, 0, 0, 0.67);
  font-size: 17px;
  // Larger horizontal inset from panel edges (not vertical title gaps)
  padding: 10px 20px 28px 22px;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.4;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  .app--dark & {
    color: rgba(255, 255, 255, 0.67);
  }

  * {
    font-weight: inherit;
  }

  // Only real heading entries are interactive; the gaps between them
  // (margin collapse escaping the .cl-toc-section wrapper) are dead space
  // and must not show a pointer or accept clicks.
  .cl-toc-section {
    cursor: pointer;

    &:hover {
      color: $link-color;
    }

    // Vertical gaps become padding so the whole inter-heading strip is
    // part of the nearest heading's hitbox (margin would collapse out of
    // the wrapper and leave an unclickable band). Halved to compensate
    // for the loss of collapse so the visual rhythm is preserved.
    h1 {
      margin: 0;
      padding: 0.95rem 0 0.45rem;
      margin-left: 0;
      font-size: 1.12em;
      font-weight: 600;
    }

    h2 {
      margin: 0;
      padding: 0.7rem 0 0.35rem;
      margin-left: 1em;
      font-size: 1.06em;
      font-weight: 600;
    }

    h3 {
      margin: 0;
      padding: 0.48rem 0 0.28rem;
      margin-left: 2em;
      font-size: 1.02em;
    }

    h4 {
      margin: 0;
      padding: 0.36rem 0 0.22rem;
      margin-left: 3em;
      font-size: 1em;
    }

    h5 {
      margin: 0;
      padding: 0.28rem 0 0.16rem;
      margin-left: 4em;
      font-size: 0.98em;
    }

    h6 {
      margin: 0;
      padding: 0.22rem 0 0.12rem;
      margin-left: 5em;
      font-size: 0.96em;
    }
  }
}

.toc__mask {
  position: absolute;
  left: 0;
  width: 100%;
  background-color: rgba(255, 255, 255, 0.2);
  pointer-events: none;

  .app--dark & {
    color: rgba(0, 0, 0, 0.2);
  }
}
</style>
