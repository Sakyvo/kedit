<template>
  <nav class="navigation-bar" :class="{'navigation-bar--editor': styles.showEditor && !revisionContent, 'navigation-bar--light': light}">
    <!-- Explorer -->
    <div class="navigation-bar__inner navigation-bar__inner--left navigation-bar__inner--button">
      <button class="navigation-bar__button navigation-bar__button--close button" v-if="light" @click="close()" v-title="'关闭KEDIT'"><icon-check-circle></icon-check-circle></button>
      <button class="navigation-bar__button navigation-bar__button--explorer-toggler button" v-else tour-step-anchor="explorer" @click="toggleExplorer()" v-title="'切换资源管理器'"><icon-folder></icon-folder></button>
    </div>
    <!-- Side bar: Toc sits left of sidebar toggle (desktop: short mouse path) -->
    <div class="navigation-bar__inner navigation-bar__inner--right navigation-bar__inner--button">
      <button class="navigation-bar__button navigation-bar__button--toc button" v-if="!light" @click="toggleToc" v-title="'目录'"><icon-toc></icon-toc></button>
      <button class="navigation-bar__button navigation-bar__button--sync-quick button" :class="'navigation-bar__button--' + syncStatus" v-title="'立即同步'" tour-step-anchor="theme" :disabled="syncDisabled" @click="requestSync"><icon-sync></icon-sync></button>
      <a class="navigation-bar__button navigation-bar__button--kedit button" v-if="light" href="app" target="_blank" v-title="'打开KEDIT'"><icon-provider provider-id="kedit"></icon-provider></a>
      <button class="navigation-bar__button navigation-bar__button--kedit button" v-else tour-step-anchor="menu" @click="toggleSideBar()" v-title="'切换侧边栏'"><icon-provider provider-id="kedit"></icon-provider></button>
    </div>
    <div class="navigation-bar__inner navigation-bar__inner--right navigation-bar__inner--title flex flex--row">
      <!-- Offline only (queue spinner removed — blue sync icon already spins) -->
      <div class="navigation-bar__offline" v-if="offline" v-title="'离线'">
        <icon-sync-off></icon-sync-off>
      </div>
      <!-- Sync/Publish -->
      <div class="flex flex--row" :class="{'navigation-bar__hidden': styles.hideLocations}">
        <a class="navigation-bar__button navigation-bar__button--location button" :class="{'navigation-bar__button--blink': location.id === currentLocation.id}" v-for="location in syncLocations" :key="location.id" :href="location.url" target="_blank" v-title="'同步位置'"><icon-provider :provider-id="location.providerId"></icon-provider></a>
        <a class="navigation-bar__button navigation-bar__button--location button" :class="{'navigation-bar__button--blink': location.id === currentLocation.id}" v-for="location in publishLocations" :key="location.id" :href="location.url" target="_blank" v-title="'发布位置'"><icon-provider :provider-id="location.providerId"></icon-provider></a>
        <button class="navigation-bar__button navigation-bar__button--publish button" :disabled="!publishLocations.length || isPublishRequested || offline" @click="requestPublish" v-title="'立即发布'"><icon-upload></icon-upload></button>
      </div>
      <!-- Revision -->
      <div class="flex flex--row" v-if="revisionContent">
        <button class="navigation-bar__button navigation-bar__button--revision navigation-bar__button--restore button" @click="restoreRevision">恢复</button>
        <button class="navigation-bar__button navigation-bar__button--revision button" @click="setRevisionContent()" v-title="'关闭修订'"><icon-close></icon-close></button>
      </div>
    </div>
    <div class="navigation-bar__inner navigation-bar__inner--edit-pagedownButtons">
      <button class="navigation-bar__button button" @click="undo" v-title="'回退'" :disabled="!canUndo"><icon-undo></icon-undo></button>
      <button class="navigation-bar__button button" @click="redo" v-title="'重做'" :disabled="!canRedo"><icon-redo></icon-redo></button>
      <div v-for="button in pagedownButtons" :key="button.method">
        <button
          class="navigation-bar__button button"
          v-if="button.method"
          @click="pagedownClick(button.method)"
          v-title="button.titleWithShortcut"
          :disabled="button.method === 'deleteSelection' && !hasEditorSelection"
        >
          <component :is="button.iconClass"></component>
        </button>
        <div class="navigation-bar__spacer" v-else></div>
      </div>
    </div>
  </nav>
</template>

<script>
import { mapState, mapMutations, mapGetters, mapActions } from 'vuex';
import editorSvc from '../services/editorSvc';
import syncSvc from '../services/syncSvc';
import publishSvc from '../services/publishSvc';
import tempFileSvc from '../services/tempFileSvc';
import githubHelper from '../services/providers/helpers/githubHelper';
import pagedownButtons from '../data/pagedownButtons';
import store from '../store';

// According to mousetrap
const mod = /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'Meta' : 'Ctrl';

const getShortcut = (method) => {
  let result = '';
  Object.entries(store.getters['data/computedSettings'].shortcuts).some(([keys, shortcut]) => {
    if (`${shortcut.method || shortcut}` === method) {
      result = keys.split('+').map(key => key.toLowerCase()).map((key) => {
        if (key === 'mod') {
          return mod;
        }
        // Capitalize
        return key && `${key[0].toUpperCase()}${key.slice(1)}`;
      }).join('+');
    }
    return result;
  });
  return result && ` – ${result}`;
};

export default {
  data: () => ({
    selectionTick: 0,
  }),
  computed: {
    ...mapState([
      'light',
      'offline',
    ]),
    ...mapState('queue', [
      'isSyncRequested',
      'isPublishRequested',
      'currentLocation',
    ]),
    ...mapState('layout', [
      'canUndo',
      'canRedo',
    ]),
    ...mapState('content', [
      'revisionContent',
    ]),
    ...mapGetters('layout', [
      'styles',
    ]),
    ...mapGetters('workspace', [
      'loginToken',
    ]),
    ...mapGetters('syncLocation', {
      syncLocations: 'current',
    }),
    ...mapGetters('publishLocation', {
      publishLocations: 'current',
    }),
    pagedownButtons() {
      const buttonShowObj = store.getters['data/computedSettings'].editor.headButtons;
      return pagedownButtons.filter(it => buttonShowObj[it.method] !== false).map(button => ({
        ...button,
        titleWithShortcut: `${button.title}${getShortcut(button.method)}`,
        iconClass: `icon-${button.icon}`,
      }));
    },
    hasEditorSelection() {
      // Reactive via selection tick; also read live selection when available
      void this.selectionTick;
      const cl = editorSvc.clEditor;
      if (!cl || !cl.selectionMgr) {
        return false;
      }
      const { selectionStart, selectionEnd } = cl.selectionMgr;
      return selectionStart !== selectionEnd;
    },
    isSyncPossible() {
      return store.getters['workspace/syncToken'] ||
        store.getters['syncLocation/current'].length;
    },
    syncDisabled() {
      // Logged out: keep the button clickable (opens the sign-in prompt)
      return this.loginToken
        ? (!this.isSyncPossible || this.isSyncRequested || this.offline)
        : this.offline;
    },
    syncStatus() {
      if (this.isSyncRequested) {
        return 'syncing';
      }
      // Same predicate as syncSvc: the current file is in sync iff its
      // content hash matches its syncData hash (no wall-clock heuristics)
      const fileId = store.getters['file/current'].id;
      const contentId = `${fileId}/content`;
      const content = fileId && store.state.content.itemsById[contentId];
      if (!content) {
        // No document opened or content not loaded yet
        return 'synced';
      }
      const syncData = store.getters['data/syncDataByItemId'][contentId];
      return syncData && syncData.hash === content.hash ? 'synced' : 'unsynced';
    },
  },
  methods: {
    ...mapMutations('content', [
      'setRevisionContent',
    ]),
    ...mapActions('content', [
      'restoreRevision',
    ]),
    ...mapActions('data', [
      'toggleExplorer',
      'toggleSideBar',
    ]),
    undo() {
      return editorSvc.clEditor.undoMgr.undo();
    },
    redo() {
      return editorSvc.clEditor.undoMgr.redo();
    },
    async requestSync() {
      if (!this.loginToken) {
        try {
          await store.dispatch('modal/open', 'signInForSync');
          // Same GitHub PAT sign-in flow as MainMenu
          const { accessToken } = await store.dispatch('modal/open', { type: 'githubPat' });
          await githubHelper.signinWithToken(accessToken);
          await syncSvc.afterSignIn();
          syncSvc.requestSync();
        } catch (e) {
          // Cancel
        }
        return;
      }
      if (this.isSyncPossible && !this.isSyncRequested) {
        syncSvc.requestSync();
      }
    },
    requestPublish() {
      if (this.publishLocations.length && !this.isPublishRequested) {
        publishSvc.requestPublish();
      }
    },
    switchTheme() {
      store.dispatch('data/switchThemeSetting');
    },
    toggleToc() {
      const onToc = store.getters['data/layoutSettings'].sideBarPanel === 'toc';
      if (this.styles.showSideBar && onToc) {
        this.toggleSideBar(false);
      } else {
        this.toggleSideBar(true);
        store.dispatch('data/setSideBarPanel', 'toc');
      }
    },
    pagedownClick(name) {
      if (store.getters['content/isCurrentEditable']) {
        editorSvc.pagedownEditor.uiManager.doClick(name);
      }
    },
    close() {
      tempFileSvc.close();
    },
  },
  created() {
    // Document title lives in the browser tab, not in the navigation bar
    this.$watch(
      () => store.getters['file/current'].name,
      (name) => {
        document.title = name ? `${name} - KEDIT` : 'KEDIT';
      },
      { immediate: true },
    );
  },
  mounted() {
    const bump = () => {
      this.selectionTick += 1;
    };
    document.addEventListener('selectionchange', bump);
    this._selectionBump = bump;
    // Also refresh when editor selection API updates cursor coords
    this._selectionInterval = setInterval(bump, 400);
  },
  beforeUnmount() {
    if (this._selectionBump) {
      document.removeEventListener('selectionchange', this._selectionBump);
    }
    if (this._selectionInterval) {
      clearInterval(this._selectionInterval);
    }
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.navigation-bar {
  position: absolute;
  width: 100%;
  height: 100%;
  padding-top: 4px;
  overflow: hidden;
}

.navigation-bar__hidden {
  display: none;
}

.navigation-bar__inner--left {
  float: left;

  &.navigation-bar__inner--button {
    margin-right: 12px;
  }
}

.navigation-bar__inner--right {
  float: right;

  /* prevent from seeing wrapped pagedownButtons */
  margin-bottom: 20px;
}

.navigation-bar__inner--button {
  margin: 0 4px;
}

.navigation-bar__inner--edit-pagedownButtons {
  margin-left: 15px;
  /* single horizontal row: buttons scroll instead of wrapping + being clipped */
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none; /* hide scrollbar, keep scroll (Firefox) */

  &::-webkit-scrollbar {
    display: none; /* hide scrollbar, keep scroll (WebKit) */
  }

  > * {
    flex: 0 0 auto;
  }

  .navigation-bar__button,
  .navigation-bar__spacer {
    float: none;
  }
}

.navigation-bar__inner--title * {
  flex: none;
}

.navigation-bar__button,
.navigation-bar__spacer {
  height: 36px;
  padding: 0 4px;

  /* prevent from seeing wrapped pagedownButtons */
  margin-bottom: 20px;
}

.navigation-bar__button {
  width: 34px;
  padding: 0 7px;
  transition: opacity 0.25s;

  .navigation-bar__inner--button & {
    padding: 0 4px;
    width: 38px;

    &.navigation-bar__button--sync-quick {
      width: 34px;
      padding: 0 7px;
      opacity: 0.85;

      &:active,
      &:focus,
      &:hover {
        opacity: 1;
      }
    }

    &.navigation-bar__button--kedit {
      opacity: 0.85;

      &:active,
      &:focus,
      &:hover {
        opacity: 1;
      }
    }
  }
}

.navigation-bar__button--revision {
  width: 38px;

  &:first-child {
    margin-left: 10px;
  }

  &:last-child {
    margin-right: 10px;
  }
}

.navigation-bar__button--restore {
  width: auto;
}

.navigation-bar__button {
  display: inline-block;
  color: $navbar-color;
  background-color: transparent;
}

.navigation-bar__button--publish {
  padding: 0 6px;
  margin: 0 5px;
}

/* Sync state: unsynced red, synced green, syncing spins the icon */
.navigation-bar__button--unsynced:not([disabled]) {
  &,
  &:active,
  &:focus,
  &:hover {
    color: $error-color;
  }
}

.navigation-bar__button--synced:not([disabled]) {
  &,
  &:active,
  &:focus,
  &:hover {
    color: #5cb85c;
  }
}

.navigation-bar__button--syncing .icon {
  animation: spin 1.5s linear infinite;
}

.navigation-bar__button[disabled] {
  &,
  &:active,
  &:focus,
  &:hover {
    color: $navbar-color;
  }
}

/* Syncing state stays blue even while disabled */
.navigation-bar__button--syncing,
.navigation-bar__button--syncing[disabled] {
  &,
  &:active,
  &:focus,
  &:hover {
    color: #4a90e2;
  }
}

.navigation-bar__button {
  &:active,
  &:focus,
  &:hover {
    color: $navbar-hover-color;
    background-color: $navbar-hover-background;
  }
}

.navigation-bar__button--location {
  width: 20px;
  height: 20px;
  border-radius: 10px;
  padding: 2px;
  margin: 8px 2px 0;
  opacity: 0.5;
  background-color: rgba(255, 255, 255, 0.2);

  &:active,
  &:focus,
  &:hover {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.2);
  }

  .icon-provider--pdir {
    transform: translateX(-1px);
  }
}

.navigation-bar__button--blink {
  animation: blink 1s linear infinite;
}

.navigation-bar__inner--edit-pagedownButtons {
  display: none;

  .navigation-bar--editor & {
    display: flex;
  }
}

.navigation-bar__button {
  display: none;

  .navigation-bar__inner--button &,
  .navigation-bar--editor & {
    display: inline-block;
  }
}

.navigation-bar__button--revision {
  display: inline-block;
}

.navigation-bar__button--close {
  color: lighten($link-color, 15%);

  &:active,
  &:focus,
  &:hover {
    color: lighten($link-color, 25%);
  }
}

.navigation-bar__offline {
  width: 24px;
  margin: 7px 0 0 8px;

  .icon {
    width: 24px;
    height: 24px;
    color: transparentize($error-color, 0.5);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes blink {
  50% {
    opacity: 1;
  }
}
</style>
