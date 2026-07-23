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
  cursor: pointer;
  font-size: 17px;
  padding: 8px 4px 24px;
  white-space: nowrap;
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

  .cl-toc-section:hover {
    color: $link-color;
  }

  .cl-toc-section {
    h1 {
      margin: 0.75rem 0;
      font-size: 1.12em;
      font-weight: 600;
    }

    h2 {
      margin: 0.4rem 0;
      margin-left: 2px;
      font-size: 1.06em;
      font-weight: 600;
    }

    h3 {
      margin: 0.28rem 0;
      margin-left: 6px;
      font-size: 1.02em;
    }

    h4 {
      margin: 0.2rem 0;
      margin-left: 10px;
      font-size: 1em;
    }

    h5 {
      margin: 0.12rem 0;
      margin-left: 14px;
      font-size: 0.98em;
    }

    h6 {
      margin: 0.08rem 0;
      margin-left: 18px;
      font-size: 0.96em; /* was tiny via cascade; keep near base */
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
