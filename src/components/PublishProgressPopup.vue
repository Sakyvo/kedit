<template>
  <div class="publish-progress" v-if="visible">
    <button class="publish-progress__pill button" v-if="minimized" @click="restore" v-title="'展开发布进度'">
      <span class="publish-progress__spinner" v-if="isBusy"></span>
      <span v-if="error">⚠ 发布失败</span>
      <span v-else-if="isFinished">✓ 发布完成</span>
      <span v-else>发布中{{ imageProgress.total ? ` ${imageProgress.done}/${imageProgress.total}` : '…' }}</span>
    </button>
    <div class="publish-progress__card" v-else>
      <div class="publish-progress__header flex flex--row flex--align-center">
        <span class="publish-progress__spinner" v-if="isBusy"></span>
        <span class="publish-progress__title">{{ title }}</span>
        <button class="publish-progress__button button" @click="minimize" v-title="'最小化'">—</button>
        <button class="publish-progress__button button" @click="close" v-title="'关闭'"><icon-close></icon-close></button>
      </div>
      <div class="publish-progress__steps">
        <div class="publish-progress__step" v-for="step in steps" :key="step.key" :class="'publish-progress__step--' + step.status">
          <span class="publish-progress__status">
            <span class="publish-progress__spinner" v-if="step.status === 'running'"></span>
            <template v-else>{{ statusIcon(step.status) }}</template>
          </span>
          <span class="publish-progress__label">{{ step.label }}</span>
          <span class="publish-progress__detail" v-if="step.detail">{{ step.detail }}</span>
        </div>
      </div>
      <div class="publish-progress__error" v-if="error">{{ error }}</div>
    </div>
  </div>
</template>

<script>
import { mapState, mapGetters } from 'vuex';
import store from '../store';

const statusIcons = {
  pending: '·',
  done: '✓',
  error: '✗',
};

export default {
  computed: {
    ...mapState('publishProgress', [
      'visible',
      'minimized',
      'title',
      'steps',
      'error',
    ]),
    ...mapGetters('publishProgress', [
      'imageProgress',
      'isFinished',
    ]),
    isBusy() {
      return !this.error && !this.isFinished;
    },
  },
  watch: {
    isFinished(finished) {
      clearTimeout(this.autoCloseTimeoutId);
      if (finished) {
        this.autoCloseTimeoutId = setTimeout(() => {
          store.commit('publishProgress/close');
        }, 4000);
      }
    },
  },
  methods: {
    statusIcon(status) {
      return statusIcons[status] || '·';
    },
    minimize() {
      store.commit('publishProgress/toggleMinimized', true);
    },
    restore() {
      store.commit('publishProgress/toggleMinimized', false);
    },
    close() {
      clearTimeout(this.autoCloseTimeoutId);
      store.commit('publishProgress/close');
    },
  },
  beforeUnmount() {
    clearTimeout(this.autoCloseTimeoutId);
  },
};
</script>

<style lang="scss">
@import '../styles/variables.scss';

.publish-progress {
  position: fixed;
  right: 16px;
  bottom: 16px;
  /* Overlay ladder: PublishProgressPopup 50 (< .modal 100 / .notification 200) */
  z-index: 50;
  font-size: 13px;
}

.publish-progress__card {
  width: 300px;
  border-radius: $border-radius-base;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  overflow: hidden;

  .app--dark & {
    background-color: #3c4049;
    color: rgba(255, 255, 255, 0.87);
  }
}

.publish-progress__header {
  padding: 8px 10px;
  gap: 6px;
  background-color: rgba(0, 0, 0, 0.05);

  .app--dark & {
    background-color: rgba(255, 255, 255, 0.05);
  }
}

.publish-progress__title {
  flex: 1;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.publish-progress__button {
  width: 24px;
  height: 24px;
  padding: 4px;
  flex: none;

  .icon {
    display: block;
    width: 16px;
    height: 16px;
  }
}

.publish-progress__steps {
  max-height: 220px;
  overflow-y: auto;
  padding: 6px 0;
}

.publish-progress__step {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 3px 12px;
  opacity: 0.6;

  &--running,
  &--error {
    opacity: 1;
  }

  &--done {
    opacity: 0.85;
  }
}

.publish-progress__status {
  flex: none;
  width: 16px;
  text-align: center;

  .publish-progress__step--done & {
    color: #4caf50;
  }

  .publish-progress__step--error & {
    color: #f44336;
  }
}

.publish-progress__label {
  flex: none;
}

.publish-progress__detail {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.7;
}

.publish-progress__error {
  padding: 8px 12px;
  color: #f44336;
  border-top: 1px solid rgba(0, 0, 0, 0.08);

  .app--dark & {
    border-top-color: rgba(255, 255, 255, 0.08);
  }
}

.publish-progress__pill {
  display: flex;
  align-items: center;
  gap: 6px;
  height: auto;
  padding: 6px 14px;
  border-radius: 8px;
  background-color: #fff;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
  font-size: 13px;

  .app--dark & {
    background-color: #3c4049;
    color: rgba(255, 255, 255, 0.87);
  }
}

.publish-progress__spinner {
  flex: none;
  width: 12px;
  height: 12px;
  border: 2px solid rgba(0, 0, 0, 0.15);
  border-top-color: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  animation: publish-progress-spin 0.8s linear infinite;

  .app--dark & {
    border-color: rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.8);
  }
}

@keyframes publish-progress-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
