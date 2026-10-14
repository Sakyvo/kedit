<template>
  <modal-inner class="modal__inner-1--force-sync-remote" aria-label="强制从远端覆盖">
    <div class="modal__content">
      <div class="modal__image modal__image--danger">
        <icon-alert></icon-alert>
      </div>
      <p class="force-sync-remote__warning">
        这将在本地<b>永久删除当前工作区的所有文档、文件夹及同步缓存</b>，然后从远端仓库重新拉取一遍。本地未推送的修改、未同步的草稿、回收站内容都将丢失，且<b>无法恢复</b>。
      </p>
      <p class="force-sync-remote__kept">
        会保留：GitHub 登录授权、所有设置、工作区登记、主题和其他模态配置。远端仓库本身<b>不会被修改</b>。
      </p>
      <form-entry label="请输入当前工作区名以确认" :error="confirmationError">
        <template v-slot:field>
          <input
            class="textfield"
            type="text"
            :placeholder="workspaceName"
            v-model="confirmationInput"
            :disabled="confirming"
            @input="confirmationError = null"
          >
        </template>
        <div class="modal__info">当前工作区：<b>{{workspaceName}}</b></div>
      </form-entry>
    </div>
    <div class="modal__button-bar">
      <button class="button" :disabled="confirming" @click="config.reject()">取消</button>
      <button
        class="button button--resolve button--danger"
        :disabled="confirming || !matched"
        @click="confirm"
      >{{confirming ? '正在清理…' : '强制从远端覆盖'}}</button>
    </div>
  </modal-inner>
</template>

<script>
import { mapGetters } from 'vuex';
import ModalInner from './common/ModalInner';
import FormEntry from './common/FormEntry';
import IconAlert from '../../icons/Alert';

export default {
  components: {
    ModalInner,
    FormEntry,
    IconAlert,
  },
  data: () => ({
    confirmationInput: '',
    confirmationError: null,
    confirming: false,
  }),
  computed: {
    ...mapGetters('workspace', ['currentWorkspace']),
    workspaceName() {
      return (this.currentWorkspace && this.currentWorkspace.name) || '';
    },
    matched() {
      return this.confirmationInput.trim() === this.workspaceName.trim();
    },
  },
  methods: {
    async confirm() {
      if (!this.matched || this.confirming) return;
      this.confirming = true;
      this.confirmationError = null;
      try {
        localStorage.setItem('forceSyncFromRemote', '1');
        window.location.reload();
        // reload 不再回来；若失败则提示
        setTimeout(() => {
          this.confirmationError = '未能开始清理，请检查浏览器存储权限';
          this.confirming = false;
        }, 4000);
      } catch (e) {
        this.confirmationError = (e && e.message) || '清理失败';
        this.confirming = false;
      }
    },
  },
  created() {
    if (!this.workspaceName) {
      // 没有当前工作区，直接拒绝
      this.config.reject();
    }
  },
  watch: {
    confirmationInput() {
      if (this.confirmationError) this.confirmationError = null;
    },
  },
};
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.modal__inner-1.modal__inner-1--force-sync-remote {
  max-width: 520px;
  border-top: 4px solid $error-color;
}

.modal__image--danger {
  color: $error-color;
}

.force-sync-remote__warning {
  color: $error-color;
  font-weight: 600;
}

.force-sync-remote__kept {
  color: #666;
  font-size: 0.9rem;

  .app--dark & {
    color: #a8a8b3;
  }
}

.modal__button-bar .button--danger,
.button--resolve.button--danger {
  background-color: $error-color;

  &:hover:not([disabled]),
  &:focus:not([disabled]) {
    background-color: darken($error-color, 8%);
  }
}
</style>
