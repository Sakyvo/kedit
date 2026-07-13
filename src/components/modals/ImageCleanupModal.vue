<template>
  <modal-inner class="modal__inner-1--image-cleanup" aria-label="图片引用检测">
    <div class="modal__content">
      <div class="modal__image">
        <icon-file-image></icon-file-image>
      </div>
      <p>扫描所有文档，列出未被任何文档引用的仓库图片。</p>
      <p v-if="scanning">正在扫描文档引用…</p>
      <template v-else>
        <p v-if="!entries.length">未发现未引用图片。</p>
        <template v-else>
          <div class="image-cleanup__select-all form-entry__checkbox">
            <label>
              <input type="checkbox" :checked="allSelected" @change="toggleAll">
              全选（共 {{entries.length}} 张）
            </label>
          </div>
          <div class="image-cleanup__list">
            <label class="image-cleanup__entry flex flex--row flex--align-center" v-for="entry in entries" :key="entry.path">
              <input type="checkbox" v-model="entry.selected">
              <span class="image-cleanup__thumbnail flex flex--column flex--center">
                <img v-if="entry.dataUrl" :src="entry.dataUrl">
                <span v-else class="image-cleanup__placeholder">无预览</span>
              </span>
              <span class="image-cleanup__info">
                <span class="image-cleanup__path">{{entry.path}}</span>
                <span class="image-cleanup__age">{{ageLabel(entry)}}</span>
              </span>
            </label>
          </div>
        </template>
      </template>
      <details class="image-cleanup__log" v-if="log.length">
        <summary>最近清理记录（{{log.length}}）</summary>
        <div class="image-cleanup__log-entry" v-for="(item, idx) in log" :key="idx">
          <span class="image-cleanup__log-time">{{formatTime(item.ts)}}</span>
          <span class="image-cleanup__log-path">{{item.path}}</span>
        </div>
      </details>
    </div>
    <div class="modal__button-bar">
      <button class="button" @click="config.reject()">关闭</button>
      <button class="button button--resolve" :disabled="!selectedCount || deleting" @click="removeSelected">
        {{deleting ? '删除中…' : `删除所选 (${selectedCount})`}}
      </button>
    </div>
  </modal-inner>
</template>

<script>
import modalTemplate from './common/modalTemplate';
import imgCleanupSvc from '../../services/imgCleanupSvc';
import workspaceImageSvc from '../../services/workspaceImageSvc';
import utils from '../../services/utils';
import store from '../../store';

export default modalTemplate({
  data: () => ({
    scanning: true,
    deleting: false,
    entries: [],
  }),
  computed: {
    selectedCount() {
      return this.entries.filter(entry => entry.selected).length;
    },
    allSelected() {
      return this.entries.length > 0 && this.entries.every(entry => entry.selected);
    },
    log() {
      return store.getters['data/imgCleanup'].log || [];
    },
  },
  methods: {
    ageLabel(entry) {
      if (!entry.since) {
        return '刚发现';
      }
      const days = Math.floor((Date.now() - entry.since) / (24 * 60 * 60 * 1000));
      return days < 1 ? '零引用不足 1 天' : `零引用 ${days} 天`;
    },
    formatTime(ts) {
      return new Date(ts).toLocaleString();
    },
    toggleAll() {
      const selected = !this.allSelected;
      this.entries.forEach((entry) => {
        entry.selected = selected;
      });
    },
    async scan() {
      try {
        const unreferenced = await imgCleanupSvc.scanUnreferenced();
        this.entries = unreferenced.map(entry => ({
          ...entry,
          selected: false,
          dataUrl: '',
        }));
      } catch (err) {
        console.error(err); // eslint-disable-line no-console
        store.dispatch('notification/error', err);
      } finally {
        this.scanning = false;
      }
      // Thumbnails from the local img store; missing ones keep the placeholder
      await utils.awaitSequence(this.entries, async (entry) => {
        try {
          entry.dataUrl = await workspaceImageSvc
            .getDataUrl(imgCleanupSvc.getAbsolutePath(entry.path), true);
        } catch (err) {
          // Keep the placeholder
        }
      });
    },
    async removeSelected() {
      const selected = this.entries.filter(entry => entry.selected);
      if (!selected.length || this.deleting) {
        return;
      }
      try {
        await store.dispatch('modal/open', {
          type: 'imageCleanupDeletion',
          count: selected.length,
        });
      } catch (e) {
        return; // Cancel
      }
      this.deleting = true;
      try {
        const { removedPaths, failedPaths } = await imgCleanupSvc.deleteImgs(selected);
        const removedSet = new Set(removedPaths);
        this.entries = this.entries.filter(entry => !removedSet.has(entry.path));
        if (removedPaths.length) {
          store.dispatch('notification/info', `已删除 ${removedPaths.length} 张未引用图片。`);
        }
        if (failedPaths.length) {
          store.dispatch('notification/error', `${failedPaths.length} 张图片删除失败，请稍后重试。`);
        }
      } finally {
        this.deleting = false;
      }
    },
  },
  created() {
    this.scan();
  },
});
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.image-cleanup__select-all {
  margin: 0.5em 0 0.25em;
}

.image-cleanup__list {
  max-height: 320px;
  overflow: auto;
  border: 1px solid $hr-color;
  border-radius: $border-radius-base;
}

.image-cleanup__entry {
  padding: 0.4em 0.6em;
  cursor: pointer;

  &:hover {
    background-color: rgba(0, 0, 0, 0.05);
  }

  input {
    flex: none;
    margin-right: 0.6em;
  }
}

.image-cleanup__thumbnail {
  flex: none;
  width: 48px;
  height: 48px;
  margin-right: 0.75em;
  border-radius: $border-radius-base;
  background-color: rgba(0, 0, 0, 0.05);
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.image-cleanup__placeholder {
  font-size: 0.7em;
  opacity: 0.5;
  text-align: center;
}

.image-cleanup__info {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.image-cleanup__path {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  word-break: break-all;
}

.image-cleanup__age {
  font-size: 0.75em;
  opacity: 0.6;
}

.image-cleanup__log {
  margin-top: 1em;

  summary {
    cursor: pointer;
    font-size: 0.9em;
    opacity: 0.75;
  }
}

.image-cleanup__log-entry {
  font-size: 0.8em;
  opacity: 0.75;
  padding: 0.15em 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.image-cleanup__log-time {
  margin-right: 0.5em;
  opacity: 0.75;
}
</style>
