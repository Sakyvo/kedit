<template>
  <modal-inner class="modal__inner-1--image-cleanup" aria-label="图片引用检测">
    <div class="modal__content image-cleanup">
      <h2 class="modal__title">图片引用检测</h2>
      <p class="image-cleanup__intro">扫描文档引用，管理未引用的仓库图片。</p>
      <template v-if="confirmCount">
        <div class="image-cleanup__confirmation">
          <p>确定永久删除所选的 {{confirmCount}} 张未引用图片？</p>
          <p>仓库图片和本地缓存将一并删除，此操作不可撤销。</p>
        </div>
      </template>
      <template v-else>
        <div class="image-cleanup__policy">
          <form-entry label="自动清理" :inline="true">
            <template v-slot:field>
              <input type="checkbox" v-model="draftEnabled" :disabled="saving" @change="policyEdited">
            </template>
          </form-entry>
          <div class="image-cleanup__duration">
            <label for="image-cleanup-days">连续未引用</label>
            <input id="image-cleanup-days" class="textfield" type="number" min="1" step="1" inputmode="numeric"
              v-model="draftDays" :disabled="saving || !draftEnabled" :aria-invalid="!!policyError"
              aria-describedby="image-cleanup-policy-hint" @input="policyEdited">
            <span>天</span>
            <button class="button" :disabled="!policyDirty || !!policyError || saving" @click="savePolicy">
              {{saving ? '保存中…' : '保存设置'}}
            </button>
          </div>
          <p id="image-cleanup-policy-hint" class="image-cleanup__hint">
            设置随设备同步。按已累计时间判断，到期后在下轮同步永久删除；关闭后仍保留计时和手动删除。
          </p>
          <p v-if="policyDirty" class="image-cleanup__hint">修改尚未保存；下方状态按已保存设置显示。</p>
          <p v-if="policyError || saveError" class="modal__error" role="alert">{{policyError || saveError}}</p>
          <p v-else-if="saved" class="image-cleanup__hint" role="status">设置已保存。</p>
        </div>
        <div class="image-cleanup__toolbar">
          <label class="form-entry__checkbox">
            <input type="checkbox" :checked="allSelected" :indeterminate="selectedCount > 0 && !allSelected"
              :disabled="scanning || !entries.length" @change="toggleAll">
            全选
          </label>
          <span>未引用 {{entries.length}} 张 · 已选 {{selectedCount}} 张</span>
          <button class="button" :disabled="scanning || deleting" @click="scan">重新扫描</button>
        </div>
        <div class="image-cleanup__list" ref="listEl" :aria-busy="scanning">
          <p v-if="scanning" class="image-cleanup__empty" role="status">正在扫描文档引用…</p>
          <div v-else-if="scanError" class="image-cleanup__empty" role="alert">
            <p>扫描失败，尚未取得引用结果。</p>
            <button class="button" @click="scan">重试</button>
          </div>
          <p v-else-if="!entries.length" class="image-cleanup__empty">未发现未引用图片。</p>
          <label v-else class="image-cleanup__entry" v-for="entry in entries" :key="entry.path"
            :data-path="entry.path" ref="entryEls">
            <input type="checkbox" v-model="entry.selected" :aria-label="`选择 ${entry.path}`">
            <span class="image-cleanup__thumbnail">
              <img v-if="entry.dataUrl" :src="entry.dataUrl" alt="">
              <span v-else class="image-cleanup__placeholder">无预览</span>
            </span>
            <span class="image-cleanup__info" v-title="entry.path">
              <span class="image-cleanup__name">{{entry.path.split('/').pop()}}</span>
              <span class="image-cleanup__age">
                {{entryStates[entry.path].ageLabel}}<template v-if="entryStates[entry.path].cleanupLabel"> · {{entryStates[entry.path].cleanupLabel}}</template>
              </span>
              <span class="image-cleanup__path">{{entry.path}}</span>
            </span>
          </label>
        </div>
        <details class="image-cleanup__log" v-if="log.length">
          <summary tabindex="0">最近清理记录（{{log.length}}）</summary>
          <div class="image-cleanup__log-scroll">
            <div class="image-cleanup__log-entry" v-for="(item, idx) in log" :key="idx">
              <span class="image-cleanup__log-time">{{formatTime(item.ts)}}</span>
              <span class="image-cleanup__log-path" v-title="item.path">{{item.path}}</span>
            </div>
          </div>
        </details>
      </template>
    </div>
    <div class="modal__button-bar" v-if="confirmCount">
      <button class="button" :disabled="deleting" @click="cancelRemove">取消</button>
      <button class="button button--resolve" :disabled="deleting" @click="confirmRemove">
        {{deleting ? '删除中…' : '确认删除'}}
      </button>
    </div>
    <div class="modal__button-bar" v-else>
      <button class="button" @click="config.reject()">关闭</button>
      <button class="button button--resolve" :disabled="!selectedCount || deleting || scanning" @click="removeSelected">
        {{deleting ? '删除中…' : `删除所选（${selectedCount}）`}}
      </button>
    </div>
  </modal-inner>
</template>

<script>
import modalTemplate from './common/modalTemplate';
import imgCleanupSvc from '../../services/imgCleanupSvc';
import workspaceImageSvc from '../../services/workspaceImageSvc';
import store from '../../store';
import syncSvc from '../../services/syncSvc';
import {
  shouldFetchRemoteThumb,
  markInFlight,
  clearInFlight,
} from '../../services/imgThumbLazy';

export default modalTemplate({
  data: () => ({
    scanning: true,
    deleting: false,
    entries: [],
    confirmCount: 0,
    pendingRemove: null,
    draftEnabled: true,
    draftDays: '',
    policyDirty: false,
    saving: false,
    saved: false,
    saveError: '',
    scanError: false,
    now: Date.now(),
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
    settings() {
      return store.getters['data/settings'];
    },
    draftPolicy() {
      return { enabled: this.draftEnabled, days: Number(this.draftDays) };
    },
    policyError() {
      return imgCleanupSvc.validatePolicy(this.draftPolicy);
    },
    entryStates() {
      const policy = imgCleanupSvc.getPolicy();
      return Object.fromEntries(this.entries.map(entry => [entry.path, imgCleanupSvc.describeEntry(entry, this.now, policy)]));
    },
  },
  watch: {
    settings() {
      if (!this.policyDirty) this.loadPolicy();
    },
  },
  methods: {
    loadPolicy() {
      const policy = imgCleanupSvc.getPolicy();
      this.draftEnabled = policy?.enabled === true;
      this.draftDays = policy?.days ?? '';
    },
    policyEdited() {
      this.policyDirty = true;
      this.saved = false;
      this.saveError = '';
    },
    async savePolicy() {
      if (this.policyError || this.saving) return;
      this.saving = true;
      this.saveError = '';
      try {
        await imgCleanupSvc.savePolicy(this.draftPolicy);
        this.policyDirty = false;
        this.saved = true;
        this.now = Date.now();
      } catch (err) {
        this.saveError = `设置未保存：${err.message}`;
      } finally {
        this.saving = false;
      }
    },
    cancelRemove() {
      this.confirmCount = 0;
      this.pendingRemove = null;
      this.$nextTick(() => this.setupLazyThumbs());
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
    async loadThumb(entry) {
      if (!entry || entry.dataUrl || this._thumbInFlight.has(entry.path)) {
        return;
      }
      if (!shouldFetchRemoteThumb({
        dataUrl: entry.dataUrl,
        path: entry.path,
        visible: true,
        inFlight: this._thumbInFlight.has(entry.path),
      })) {
        return;
      }
      markInFlight(this._thumbInFlight, entry.path);
      const abs = imgCleanupSvc.getAbsolutePath(entry.path);
      try {
        let dataUrl = await workspaceImageSvc.getDataUrl(abs, true);
        if (!dataUrl) {
          // Lazy remote: pull into local IndexedDB via existing syncImg path, then re-read
          try {
            await syncSvc.syncImg(abs);
          } catch (e) {
            // offline / missing — keep placeholder
          }
          dataUrl = await workspaceImageSvc.getDataUrl(abs, true);
        }
        if (dataUrl) {
          entry.dataUrl = dataUrl;
        }
      } catch (err) {
        // Keep 无预览
      } finally {
        clearInFlight(this._thumbInFlight, entry.path);
      }
    },
    setupLazyThumbs() {
      this.teardownLazyThumbs();
      const root = this.$refs.listEl;
      if (!root || typeof IntersectionObserver === 'undefined') {
        // Fallback: load first batch only
        this.entries.slice(0, 8).forEach(entry => this.loadThumb(entry));
        return;
      }
      this._thumbObserver = new IntersectionObserver((records) => {
        records.forEach((record) => {
          if (!record.isIntersecting) {
            return;
          }
          const path = record.target.getAttribute('data-path');
          const entry = this.entries.find(e => e.path === path);
          if (entry) {
            this.loadThumb(entry);
          }
        });
      }, { root, rootMargin: '48px', threshold: 0.01 });
      this.$nextTick(() => {
        const els = this.$refs.entryEls;
        const list = Array.isArray(els) ? els : (els ? [els] : []);
        list.forEach((el) => {
          if (el) {
            this._thumbObserver.observe(el);
          }
        });
      });
    },
    teardownLazyThumbs() {
      if (this._thumbObserver) {
        this._thumbObserver.disconnect();
        this._thumbObserver = null;
      }
    },
    async scan() {
      this.scanning = true;
      this.scanError = false;
      this.now = Date.now();
      this.teardownLazyThumbs();
      try {
        const unreferenced = await imgCleanupSvc.scanUnreferenced();
        this.entries = unreferenced.map(entry => ({
          ...entry,
          selected: false,
          dataUrl: '',
        }));
      } catch (err) {
        this.entries = [];
        this.scanError = true;
        store.dispatch('notification/error', err);
      } finally {
        this.scanning = false;
      }
      // Local cache first (no remote); missing stay placeholder until visible
      await Promise.all(this.entries.map(async (entry) => {
        try {
          entry.dataUrl = await workspaceImageSvc
            .getDataUrl(imgCleanupSvc.getAbsolutePath(entry.path), true);
        } catch (err) {
          // placeholder
        }
      }));
      this.$nextTick(() => this.setupLazyThumbs());
    },
    removeSelected() {
      const selected = this.entries.filter(entry => entry.selected);
      if (!selected.length || this.deleting) {
        return;
      }
      // Keep confirm in-modal so this instance stays mounted and can refresh UI
      this.pendingRemove = selected.map(entry => ({
        path: entry.path,
        sha: entry.sha,
      }));
      this.teardownLazyThumbs();
      this.confirmCount = selected.length;
    },
    async confirmRemove() {
      const selected = this.pendingRemove;
      if (!selected || !selected.length || this.deleting) {
        return;
      }
      this.deleting = true;
      try {
        const { removedPaths, failedPaths } = await imgCleanupSvc.deleteImgs(selected);
        this.pendingRemove = null;
        this.confirmCount = 0;
        // Drop removed rows immediately, then re-scan inventory for truth
        if (removedPaths.length) {
          const removedSet = new Set(removedPaths);
          this.entries = this.entries.filter(entry => !removedSet.has(entry.path));
          store.dispatch('notification/info', `已删除 ${removedPaths.length} 张未引用图片。`);
        }
        if (failedPaths.length) {
          store.dispatch('notification/error', `${failedPaths.length} 张图片删除失败，请稍后重试。`);
        }
        // Re-sync list from git inventory + local clock (survives partial failure)
        this.scanning = true;
        await this.scan();
      } finally {
        this.deleting = false;
      }
    },
  },
  created() {
    this._thumbInFlight = new Set();
    this.loadPolicy();
    this.scan();
  },
  beforeUnmount() {
    this.teardownLazyThumbs();
  },
});
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.modal__inner-1--image-cleanup {
  .modal__inner-2 {
    overflow-y: hidden;
  }

  .modal__content {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-height: 0;
  }

  .modal__title {
    flex: none;
    margin: 0 32px 4px 0;
    font-weight: 500;
  }

  .modal__button-bar .button--resolve:disabled {
    color: inherit;
    opacity: 0.55;
  }

  .button:focus-visible,
  summary:focus-visible {
    outline: 2px solid $link-color;
    outline-offset: 2px;
  }
}

.image-cleanup__intro {
  flex: none;
  font-size: 14px;
  margin: 0 0 8px;
}

.image-cleanup__policy {
  flex: 0 1 auto;
  min-height: 0;
  max-height: 45%;
  overflow: auto;
  border-bottom: 1px solid $hr-color;
  padding-bottom: 8px;

  .form-entry {
    margin: 0 0 4px;
  }

  .modal__error {
    font-size: 14px;
    margin: 4px 0 0;
  }
}

.image-cleanup__duration {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;

  .textfield {
    width: 76px;
    min-width: 0;
    height: 34px;
    font-size: 16px;
  }

  .button {
    margin-left: auto;
    font-size: 14px;
  }
}

.image-cleanup__hint {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.5;
}

.image-cleanup__toolbar {
  display: flex;
  flex: none;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  padding: 6px 0;
  font-size: 14px;

  label {
    white-space: nowrap;
  }

  .button {
    margin-left: auto;
    padding: 4px;
    font-size: 14px;
  }
}

.image-cleanup__list {
  flex: 1 1 0;
  min-height: 56px;
  overflow: auto;
  overscroll-behavior: contain;
  border-block: 1px solid $hr-color;
}

.image-cleanup__empty {
  padding: 12px 4px;
  font-size: 14px;
}

.image-cleanup__entry {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 2px;
  border-bottom: 1px solid $hr-color;
  cursor: pointer;

  &:last-child {
    border-bottom: 0;
  }

  &:hover,
  &:focus-within {
    background-color: $code-bg;

    .app--dark & {
      background-color: rgba(255, 255, 255, 0.06);
    }
  }

  input {
    flex: none;
    margin: 0 2px;
  }
}

.image-cleanup__thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 48px;
  height: 48px;
  border-radius: $border-radius-base;
  background-color: $code-bg;
  overflow: hidden;

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
}

.image-cleanup__placeholder {
  font-size: 12px;
  text-align: center;
}

.image-cleanup__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.5;
}

.image-cleanup__name {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 15px;
}

.image-cleanup__age,
.image-cleanup__path {
  font-size: 13px;
}

.image-cleanup__path {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.image-cleanup__log {
  flex: 0 1 auto;
  max-height: 25%;
  min-height: 24px;
  margin: 8px 0;
  overflow: auto;

  summary {
    cursor: pointer;
    font-size: 14px;
  }
}

.image-cleanup__log-scroll {
  padding: 4px 0;
}

.image-cleanup__log-entry {
  display: flex;
  flex-direction: column;
  font-size: 13px;
  padding: 4px 0;
  line-height: 1.5;
}

.image-cleanup__log-path {
  overflow-wrap: anywhere;
}

.image-cleanup__confirmation {
  min-height: 0;
  overflow: auto;
}
</style>
