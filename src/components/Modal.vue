<template>
  <div ref="root" class="modal" v-if="config" @keydown.esc.stop="onEscape" @keydown.tab="onTab" @focusin="onFocusInOut" @focusout="onFocusInOut">
    <!-- <div class="modal__sponsor-banner" v-if="!isSponsor">
      StackEdit is <a class="not-tabbable" target="_blank" href="https://github.com/mafgwo/stackedit/">open source</a>, please consider
      <a class="not-tabbable" href="javascript:void(0)" @click="sponsor">sponsoring</a> for just $5.
    </div> -->
    <component v-if="currentModalComponent" :is="currentModalComponent"></component>
    <modal-inner v-else aria-label="Dialog">
      <div class="modal__content" v-html="simpleModal.contentHtml(config)"></div>
      <div class="modal__button-bar">
        <button class="button" v-if="simpleModal.rejectText" @click="config.reject()">{{simpleModal.rejectText}}</button>
        <button class="button button--resolve" v-if="simpleModal.resolveText" @click="config.resolve()">{{simpleModal.resolveText}}</button>
        <button v-for="(item, idx) in (simpleModal.resolveArray || [])" class="button button--resolve"  @click="config.resolve(item.value)">{{item.text}}</button>
      </div>
    </modal-inner>
  </div>
</template>

<script>
import { mapGetters } from 'vuex';
import simpleModals from '../data/simpleModals';
import editorSvc from '../services/editorSvc';
import syncSvc from '../services/syncSvc';
import giteeHelper from '../services/providers/helpers/giteeHelper';
import store from '../store';

import ModalInner from './modals/common/ModalInner';
import FilePropertiesModal from './modals/FilePropertiesModal';
import SettingsModal from './modals/SettingsModal';
import TemplatesModal from './modals/TemplatesModal';
import AboutModal from './modals/AboutModal';
import HtmlExportModal from './modals/HtmlExportModal';
import PdfExportModal from './modals/PdfExportModal';
import PandocExportModal from './modals/PandocExportModal';
import LinkModal from './modals/LinkModal';
import ImageModal from './modals/ImageModal';
import SyncManagementModal from './modals/SyncManagementModal';
import PublishManagementModal from './modals/PublishManagementModal';
import WorkspaceManagementModal from './modals/WorkspaceManagementModal';
import AccountManagementModal from './modals/AccountManagementModal';
import SponsorModal from './modals/SponsorModal';
import CommitMessageModal from './modals/CommitMessageModal';
import WorkspaceImgPathModal from './modals/WorkspaceImgPathModal';
import WorkspaceBackupExportModal from './modals/WorkspaceBackupExportModal';
import ImageCleanupModal from './modals/ImageCleanupModal';
import ChatGptModal from './modals/ChatGptModal';
import ChatGptConfigModal from './modals/ChatGptConfigModal';
import FolderPickerModal from './modals/FolderPickerModal';
import ForceSyncFromRemoteModal from './modals/ForceSyncFromRemoteModal';

// Providers
import GooglePhotoModal from './modals/providers/GooglePhotoModal';
import GoogleDriveAccountModal from './modals/providers/GoogleDriveAccountModal';
import GoogleDriveSaveModal from './modals/providers/GoogleDriveSaveModal';
import GoogleDriveWorkspaceModal from './modals/providers/GoogleDriveWorkspaceModal';
import GoogleDrivePublishModal from './modals/providers/GoogleDrivePublishModal';
import DropboxAccountModal from './modals/providers/DropboxAccountModal';
import DropboxSaveModal from './modals/providers/DropboxSaveModal';
import DropboxPublishModal from './modals/providers/DropboxPublishModal';
import GithubAccountModal from './modals/providers/GithubAccountModal';
import GithubOpenModal from './modals/providers/GithubOpenModal';
import GithubSaveModal from './modals/providers/GithubSaveModal';
import GithubWorkspaceModal from './modals/providers/GithubWorkspaceModal';
import GithubPublishModal from './modals/providers/GithubPublishModal';
import PdirPublishModal from './modals/providers/PdirPublishModal';
import GithubImgStorageModal from './modals/providers/GithubImgStorageModal';
import GistSyncModal from './modals/providers/GistSyncModal';
import GistPublishModal from './modals/providers/GistPublishModal';
import GiteeAccountModal from './modals/providers/GiteeAccountModal';
import GiteeOpenModal from './modals/providers/GiteeOpenModal';
import GiteeSaveModal from './modals/providers/GiteeSaveModal';
import GiteeWorkspaceModal from './modals/providers/GiteeWorkspaceModal';
import GiteePublishModal from './modals/providers/GiteePublishModal';
import GiteeGistSyncModal from './modals/providers/GiteeGistSyncModal';
import GiteeGistPublishModal from './modals/providers/GiteeGistPublishModal';
import GitcodeAccountModal from './modals/providers/GitcodeAccountModal';
import GitcodeOpenModal from './modals/providers/GitcodeOpenModal';
import GitcodeSaveModal from './modals/providers/GitcodeSaveModal';
import GitcodeWorkspaceModal from './modals/providers/GitcodeWorkspaceModal';
import GitcodePublishModal from './modals/providers/GitcodePublishModal';
import GitlabAccountModal from './modals/providers/GitlabAccountModal';
import GitlabOpenModal from './modals/providers/GitlabOpenModal';
import GitlabPublishModal from './modals/providers/GitlabPublishModal';
import GitlabSaveModal from './modals/providers/GitlabSaveModal';
import GitlabWorkspaceModal from './modals/providers/GitlabWorkspaceModal';
import GiteaAccountModal from './modals/providers/GiteaAccountModal';
import GiteaOpenModal from './modals/providers/GiteaOpenModal';
import GiteaPublishModal from './modals/providers/GiteaPublishModal';
import GiteaSaveModal from './modals/providers/GiteaSaveModal';
import GiteaWorkspaceModal from './modals/providers/GiteaWorkspaceModal';
import GiteaImgStorageModal from './modals/providers/GiteaImgStorageModal';
import WordpressPublishModal from './modals/providers/WordpressPublishModal';
import BloggerPublishModal from './modals/providers/BloggerPublishModal';
import BloggerPagePublishModal from './modals/providers/BloggerPagePublishModal';
import ZendeskAccountModal from './modals/providers/ZendeskAccountModal';
import ZendeskPublishModal from './modals/providers/ZendeskPublishModal';
import CouchdbWorkspaceModal from './modals/providers/CouchdbWorkspaceModal';
import CouchdbCredentialsModal from './modals/providers/CouchdbCredentialsModal';
import SmmsAccountModal from './modals/providers/SmmsAccountModal';
import CustomAccountModal from './modals/providers/CustomAccountModal';
import GithubPatModal from './modals/providers/GithubPatModal';

const getTabbables = container => container.querySelectorAll('a[href], button, .textfield, input[type=checkbox]')
  // Filter enabled and visible element
  .cl_filter(el => !el.disabled && el.offsetParent !== null && !el.classList.contains('not-tabbable'));

export default {
  components: {
    ModalInner,
    FilePropertiesModal,
    SettingsModal,
    TemplatesModal,
    AboutModal,
    HtmlExportModal,
    PdfExportModal,
    PandocExportModal,
    LinkModal,
    ImageModal,
    SyncManagementModal,
    PublishManagementModal,
    WorkspaceManagementModal,
    AccountManagementModal,
    SponsorModal,
    CommitMessageModal,
    WorkspaceImgPathModal,
    WorkspaceBackupExportModal,
    ImageCleanupModal,
    ChatGptModal,
    ChatGptConfigModal,
    FolderPickerModal,
    // Providers
    GooglePhotoModal,
    GoogleDriveAccountModal,
    GoogleDriveSaveModal,
    GoogleDriveWorkspaceModal,
    GoogleDrivePublishModal,
    DropboxAccountModal,
    DropboxSaveModal,
    DropboxPublishModal,
    GithubAccountModal,
    GithubOpenModal,
    GithubSaveModal,
    GithubWorkspaceModal,
    GithubPublishModal,
    PdirPublishModal,
    GithubImgStorageModal,
    GistSyncModal,
    GistPublishModal,
    GiteeAccountModal,
    GiteeOpenModal,
    GiteeSaveModal,
    GiteeWorkspaceModal,
    GiteePublishModal,
    GiteeGistSyncModal,
    GiteeGistPublishModal,
    GitcodeAccountModal,
    GitcodeOpenModal,
    GitcodeSaveModal,
    GitcodeWorkspaceModal,
    GitcodePublishModal,
    GitlabAccountModal,
    GitlabOpenModal,
    GitlabPublishModal,
    GitlabSaveModal,
    GitlabWorkspaceModal,
    GiteaAccountModal,
    GiteaOpenModal,
    GiteaPublishModal,
    GiteaSaveModal,
    GiteaWorkspaceModal,
    GiteaImgStorageModal,
    ForceSyncFromRemoteModal,
    WordpressPublishModal,
    BloggerPublishModal,
    BloggerPagePublishModal,
    ZendeskAccountModal,
    ZendeskPublishModal,
    CouchdbWorkspaceModal,
    CouchdbCredentialsModal,
    SmmsAccountModal,
    CustomAccountModal,
    GithubPatModal,
  },
  computed: {
    ...mapGetters([
      'isSponsor',
    ]),
    ...mapGetters('modal', [
      'config',
    ]),
    currentModalComponent() {
      if (this.config.type) {
        let componentName = this.config.type[0].toUpperCase();
        componentName += this.config.type.slice(1);
        componentName += 'Modal';
        if (this.$options.components[componentName]) {
          return componentName;
        }
      }
      return null;
    },
    simpleModal() {
      return simpleModals[this.config.type] || {};
    },
  },
  methods: {
    async sponsor() {
      try {
        if (!store.getters['workspace/sponsorToken']) {
          // User has to sign in
          await store.dispatch('modal/open', 'signInForSponsorship');
          await giteeHelper.signin();
          await syncSvc.afterSignIn();
          syncSvc.requestSync();
        }
        if (!store.getters.isSponsor) {
          await store.dispatch('modal/open', 'sponsor');
        }
      } catch (e) { /* cancel */ }
    },
    onEscape() {
      this.config.reject();
      editorSvc.clEditor.focus();
    },
    onTab(evt) {
      const tabbables = getTabbables(this.$refs.root);
      const firstTabbable = tabbables[0];
      const lastTabbable = tabbables[tabbables.length - 1];
      if (evt.shiftKey && firstTabbable === evt.target) {
        evt.preventDefault();
        lastTabbable.focus();
      } else if (!evt.shiftKey && lastTabbable === evt.target) {
        evt.preventDefault();
        firstTabbable.focus();
      }
    },
    onFocusInOut(evt) {
      const { parentNode } = evt.target;
      if (parentNode && parentNode.parentNode) {
        // Focus effect
        if (parentNode.classList.contains('form-entry__field')
          && parentNode.parentNode.classList.contains('form-entry')) {
          parentNode.parentNode.classList.toggle(
            'form-entry--focused',
            evt.type === 'focusin',
          );
        }
      }
    },
  },
  mounted() {
    this.$watch(
      () => this.config,
      (isOpen) => {
        if (isOpen) {
          this.$nextTick(() => {
            const tabbables = getTabbables(this.$refs.root);
            if (tabbables[0]) {
              tabbables[0].focus();
            }
          })
        }
      },
      { immediate: true },
    );
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.modal {
  position: absolute;
  z-index: 100;
  width: 100%;
  height: 100%;
  background-color: rgba(160, 160, 160, 0.5);
  // 模态本身不滚动——滚动容器一律是 inner-2（已 max-height 受限于视口）。
  // 否则鼠标落在 tabs/暗背景上滚轮会让整个模态在窗口里上下飘（用户反馈）。
  overflow: hidden;

  p {
    line-height: 1.5;
  }
}

.modal__sponsor-banner {
  position: fixed;
  z-index: 1;
  width: 100%;
  color: darken($error-color, 10%);
  background-color: transparentize(lighten($error-color, 33%), 0.075);
  font-size: 0.9em;
  line-height: 1.33;
  text-align: center;
  padding: 0.25em 1em;
}

.modal__inner-1 {
  margin: 0 auto;
  width: 100%;
  min-width: 320px;
  max-width: 480px;
}

.modal__inner-2 {
  margin: 16px 10px 32px;
  background-color: #f8f8f8;
  padding: 20px 20px 14px;
  border-radius: $border-radius-base;
  position: relative;
  // 面板尺寸锁定（批 113）：高度恒等于视口上限，不再由内容决定——切 tab、换
  // 弹窗、内容多少都不改变面板大小，短内容的留白是有意为之。长内容仍由
  // .modal__inner-2 自身滚动。
  // 视口高度取可视视口（软键盘弹出时它会缩小，窗口高度不变），变量由 App.vue
  // 发布在 .app 上；无该变量时退化为 100vh。
  height: calc(var(--kedit-visual-viewport-height, 100vh) - 60px);
  // 列布局 + 子项 flex:none：内容保持自身高度（不会被压扁，靠面板滚动），
  // 按钮栏用 margin-top:auto 钉到面板底部（内容短时也不悬在内容下方）。
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  // 各 tab 内容高度不一（可视化 tab 长→出滚动条，yaml编辑 短→无），滚动条沟槽
  // 出现/消失会让内容宽度变 8px 上下横移（035 右偏根治）：恒预留沟槽。
  scrollbar-gutter: stable;

  > * {
    flex: none;
  }

  .app--dark & {
    background-color: #383c4a;
  }
}

.modal__content > :first-child,
.modal__content > .modal__image:first-child + * {
  margin-top: 0;
}

.modal__image {
  float: left;
  width: 60px;
  height: 60px;
  margin: 1.5em 1.2em 0.5em 0;

  & + *::after {
    content: '';
    display: block;
    clear: both;
  }
}

.modal__title {
  font-weight: bold;
  font-size: 1.5rem;
  line-height: 1.4;
  margin-top: 1rem;
}

.modal__sub-title {
  opacity: 0.6;
  font-size: 0.75rem;
  margin-bottom: 1.5rem;
}

.modal__error {
  color: #de2c00;
}

.modal__info {
  background-color: $info-bg;
  border-radius: $border-radius-base;
  margin: 1.2em 0;
  padding: 0.75em 1.25em;
  font-size: 0.95em;
  line-height: 1.6;

  pre {
    line-height: 1.5;
  }
}

.modal__info--multiline {
  padding-top: 0.1em;
  padding-bottom: 0.1em;
}

.modal__button-bar {
  margin: 0.5rem -20px -14px;
  // 内容短时把按钮栏推到面板底部；内容长时它跟在内容后，并由下面两条吸底。
  margin-top: auto;
  padding: 10px 20px 10px;
  display: flex;
  flex-direction: row;
  justify-content: flex-end;
  align-items: center;
  position: sticky;
  // 与其 negative margin 配对：吸到容器边框（scrollport 底 - 填充 14px 仍是背景）
  bottom: -14px;
  background-color: #f8f8f8;
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  z-index: 1;

  .app--dark & {
    background-color: #383c4a;
  }

  // 取消/确认并排时同高同字号（StackEdit 主按钮的 -2px 负 margin + 大 padding
  // 会让两颗按钮上下错位，033 任务统一）
  .button {
    margin: 0;
    font-size: 16px;

    & + .button {
      margin-left: 8px;
    }
  }

  .button--resolve {
    margin: 0 0 0 8px;
    padding: 8px 16px;
    font-size: 16px;
  }
}

// 头部（标题 / 标签页）吸顶，不受内容滚动影响。注意标题/tabs 可能被包裹在
// .modal__content 里，不能用子选择器。sticky 受包含块约束，最多钉到
// .modal__content 顶边（容器 padding-top 下方 20px）；滚动内容会从上方
// padding 带透出，故用负向上盖板（box-shadow）铺满该带，两侧同样延展。
// 铁律：盖板高度必须恒等于 .modal__inner-2 的 padding-top，改内距必须同步改这里。
.modal__inner-2 .modal__title,
.modal__inner-2 .tabs {
  position: sticky;
  top: 0;
  background-color: #f8f8f8;
  z-index: 1;
  box-shadow: 0 -20px 0 0 #f8f8f8;

  .app--dark & {
    background-color: #383c4a;
    box-shadow: 0 -20px 0 0 #383c4a;
  }
}

.modal__inner-2 .tabs {
  margin: 0 -20px;
  padding: 0 20px;
}

.form-entry {
  margin: 0.5em 0;
}

.form-entry__label {
  display: block;
  font-size: 0.9rem;
  color: #808080;

  .app--dark & {
    color: #a8a8b3;
  }

  .form-entry--focused & {
    color: darken($link-color, 10%);
  }

  .form-entry--error & {
    color: darken($error-color, 10%);
  }
}

// 单行 toggle 变体：☑ 左 + 解释右，无灰框（仅 settings 可视化 tab 使用）
.form-entry--inline {
  margin: 0.3em 0;

  .form-entry__inline-label {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.95rem;
    cursor: pointer;
    padding: 4px 2px;
    border-radius: $border-radius-base;

    &:hover {
      background-color: rgba(0, 0, 0, 0.03);

      .app--dark & {
        background-color: rgba(255, 255, 255, 0.05);
      }
    }

    input[type=checkbox] {
      margin: 0;
      flex: 0 0 auto;
    }

    .form-entry__label-info {
      color: #808080;

      .app--dark & {
        color: #a8a8b3;
      }
    }
  }
}

.form-entry__label-info {
  font-size: 0.75rem;
}

.form-entry__field {
  border: 1px solid #b0b0b0;
  border-radius: $border-radius-base;
  position: relative;
  overflow: hidden;

  .app--dark & {
    border-color: #5a5f70;
  }

  .form-entry--focused & {
    border-color: $link-color;
    box-shadow: 0 0 0 2.5px transparentize($link-color, 0.67);
  }

  .form-entry--error & {
    border-color: $error-color;
    box-shadow: 0 0 0 2.5px transparentize($error-color, 0.67);
  }
}

.form-entry__actions {
  text-align: right;
  margin: 0.25em;
}

.form-entry__button {
  width: 38px;
  height: 38px;
  padding: 6px;
  display: inline-block;
  background-color: transparent;
  opacity: 0.75;

  &:active,
  &:focus,
  &:hover {
    opacity: 1;
    background-color: rgba(0, 0, 0, 0.1);

    .app--dark & {
      background-color: rgba(255, 255, 255, 0.12);
    }
  }
}

.form-entry__radio,
.form-entry__checkbox {
  margin: 0.25em 1em;

  input {
    margin-right: 0.25em;
  }
}

// 自定义下拉（SettingsSelect）所在 form-entry：field 放行溢出（弹出列表要
// 超出 field 边界，默认 overflow: hidden 会把列表裁成「点开但不可见」）
.form-entry--has-select .form-entry__field {
  overflow: visible;
}

.form-entry__info {
  font-size: 0.75em;
  opacity: 0.67;
  line-height: 1.4;
  margin: 0.25em 0;
}

.tabs {
  border-bottom: 1px solid $hr-color;
  margin: 1em 0 2em;

  &::after {
    content: '';
    display: block;
    clear: both;
  }
}

.tabs__tab {
  width: 50%;
  float: left;
  text-align: center;
  line-height: 1.4;
  font-weight: 400;
  font-size: 1.1em;
}

.tabs__tab > a {
  width: 100%;
  text-decoration: none;
  padding: 0.67em 0.33em;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  border-top-left-radius: $border-radius-base;
  border-top-right-radius: $border-radius-base;
  color: $link-color;

  .app--dark & {
    color: lighten($link-color, 22%);
  }

  &:hover,
  &:focus {
    background-color: rgba(0, 0, 0, 0.05);

    .app--dark & {
      background-color: rgba(255, 255, 255, 0.07);
    }
  }
}

.tabs__tab--active > a {
  border-bottom: 2px solid $link-color;
  color: inherit;
}

// 移动端（≤600px）：弹窗与视口四边完全嵌合——去掉外边距与圆角、占满可用高度，
// 内距 20px → 12px，粘顶盖板的偏移与按钮栏的负 margin 必须同步跟着内距走。
// 字号整体降一档，但按钮与输入框保持原尺寸（触控目标不缩）。
@media (max-width: 600px) {
  .modal .modal__inner-1 {
    max-width: none;
    min-width: 0;
  }

  .modal__inner-2 {
    margin: 0;
    padding: 12px;
    // 锁高在移动端同样生效：面板等于可视视口高，短内容不再缩成半截；
    // 面板上沿跟随可视视口偏移，键盘把可视区向下平移时面板不被甩到屏外。
    height: var(--kedit-visual-viewport-height, 100vh);
    max-height: none;
    top: var(--kedit-visual-viewport-top, 0);
    border-radius: 0;
  }

  .modal__inner-2 .modal__title,
  .modal__inner-2 .tabs {
    box-shadow: 0 -12px 0 0 #f8f8f8;

    .app--dark & {
      box-shadow: 0 -12px 0 0 #383c4a;
    }
  }

  .modal__inner-2 .tabs {
    margin: 0 -12px;
    padding: 0 12px;
  }

  .modal__button-bar {
    margin: 0.5rem -12px -12px;
    // 简写会覆掉基础规则的 margin-top:auto，这里必须重申一次，否则移动端
    // 短内容时按钮栏又悬在内容下方。
    margin-top: auto;
    padding: 10px 12px;
    bottom: -12px;
  }

  .modal__title {
    font-size: 20px;
  }

  .tabs__tab {
    font-size: 1em;
  }

  .form-entry__label {
    font-size: 0.8rem;
  }
}
</style>
