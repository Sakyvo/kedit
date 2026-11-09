<template>
  <div class="app" :class="classes" :style="breakGapVars" @keydown.esc="close">
    <layout v-if="ready"></layout>
    <modal></modal>
    <notification></notification>
    <context-menu></context-menu>
  </div>
</template>

<script>
import '../styles';
import '../styles/markdownHighlighting.scss';
import '../styles/app.scss';
import Layout from './Layout';
import Modal from './Modal';
import Notification from './Notification';
import ContextMenu from './ContextMenu';
import syncSvc from '../services/syncSvc';
import networkSvc from '../services/networkSvc';
import tempFileSvc from '../services/tempFileSvc';
import editorSvc from '../services/editorSvc';
import store from '../store';
//import './common/vueGlobals';
import utils from '../services/utils';
import providerRegistry from '../services/providers/common/providerRegistry';

const themeClasses = {
  light: ['app--light'],
  dark: ['app--dark'],
};

export default {
  emits: ['ready'],
  components: {
    Layout,
    Modal,
    Notification,
    ContextMenu,
  },
  data: () => ({
    ready: false,
  }),
  computed: {
    classes() {
      const result = themeClasses[store.getters['data/computedSettings'].colorTheme];
      return Array.isArray(result) ? result : themeClasses.light;
    },
    // Break-gap offsets flow one way into CSS custom properties here, then the
    // editor/preview styles consume them (ADR 0015). Set once on the app root so
    // the two surfaces cannot disagree.
    breakGapVars() {
      const { softWrapOffset, hardBreakOffset } = store.getters['data/computedSettings'];
      return {
        '--kedit-soft-wrap-offset': `${softWrapOffset}px`,
        '--kedit-hard-break-offset': `${hardBreakOffset}px`,
      };
    },
  },
  methods: {
    close() {
      tempFileSvc.close();
    },
    // 通过路径查看文件 支持相对路径
    viewFileByPath(path) {
      // 如果是md结尾
      if (!path) {
        return;
      }
      const currDirNode = store.getters['explorer/selectedNodeFolder'];
      if (path.slice(-3) === '.md') {
        const rootNode = store.getters['explorer/rootNode'];
        const node = utils.findNodeByPath(rootNode, currDirNode, path);
        if (!node) {
          return;
        }
        store.commit('explorer/setSelectedId', node.item.id);
        // Prevent from freezing the UI while loading the file
        setTimeout(() => {
          store.commit('file/setCurrentId', node.item.id);
        }, 10);
      } else {
        const workspace = store.getters['workspace/currentWorkspace'];
        const provider = providerRegistry.providersById[workspace.providerId];
        if (provider == null) {
          return;
        }
        const absolutePath = utils.getAbsoluteFilePath(currDirNode, path);
        const url = provider.getFilePathUrl(absolutePath);
        if (url) {
          window.open(url, '_blank');
        }
      }
    },
  },
  mounted() {
    // Touch devices only: body is position: fixed so the window has no scroll
    // range and browser "scroll to top/bottom" gestures are no-ops. Give the
    // window a 2px range (html.app--touch, see app.scss), park the position in
    // the middle and proxy reaching either end to the active scroller.
    if (!('ontouchstart' in window)) {
      return;
    }
    document.documentElement.classList.add('app--touch');
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      if (y > 0 && y < 2) {
        // Parked position (also where our own re-park lands)
        return;
      }
      const scroller = store.getters['layout/styles'].showEditor
        ? editorSvc.editorElt && editorSvc.editorElt.parentNode
        : editorSvc.previewElt && editorSvc.previewElt.parentNode;
      if (scroller) {
        scroller.scrollTop = y <= 0 ? 0 : scroller.scrollHeight;
      }
      window.scrollTo(0, 1); // Re-park
    }, { passive: true });
    window.scrollTo(0, 1);
  },
  async created() {
    window.viewFileByPath = this.viewFileByPath;
    try {
      await syncSvc.init();
      // Network listeners/config are useful after local state is ready, but are
      // not a prerequisite for opening the Author's local Document.
      networkSvc.init().catch((err) => {
        console.error(err); // eslint-disable-line no-console
        store.dispatch('notification/error', err);
      });
      // store 编辑主题
      const editTheme = localStorage.getItem('theme/currEditTheme');
      store.dispatch('theme/setEditTheme', editTheme || 'default');
      // store 预览主题
      const previewTheme = localStorage.getItem('theme/currPreviewTheme');
      store.dispatch('theme/setPreviewTheme', previewTheme || 'default');
      this.ready = true;
      tempFileSvc.setReady();
      await this.$nextTick();
      document.getElementById('startup')?.remove();
      this.$emit('ready');
    } catch (err) {
      if (err && err.message === 'RELOAD') {
        window.location.reload();
      } else if (err && err.message !== 'RELOAD') {
        console.error(err); // eslint-disable-line no-console
        store.dispatch('notification/error', err);
      }
    }
  },
};
</script>
