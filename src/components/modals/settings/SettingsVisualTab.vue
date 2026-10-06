<template>
  <div class="settings-visual">
    <div class="settings-visual__section" v-for="section in fieldSections" :key="section.title">
      <h3 class="settings-visual__section-title">{{ section.title }}</h3>
      <template v-if="section.type === 'buttonList'">
        <div
          v-for="button in orderedButtons"
          :key="button.method"
          class="settings-visual__button-row"
          :class="{
            'settings-visual__button-row--hidden': !button.visible,
            'settings-visual__button-row--drop-target': dragOverMethod === button.method,
          }"
          :draggable="!focusPath"
          @dragstart="dragMethod = button.method"
          @dragover.prevent="dragOverMethod = button.method"
          @dragleave="dragOverMethod === button.method && (dragOverMethod = null)"
          @drop.prevent="onButtonDrop(button.method); dragOverMethod = null"
          @dragend="dragMethod = null; dragOverMethod = null"
        >
          <span class="settings-visual__drag-handle" title="拖拽排序">≡</span>
          <input
            type="checkbox"
            class="settings-visual__enable"
            :title="button.visible ? '禁用' : '启用'"
            :checked="button.visible"
            @change="onButtonToggle(button.method, $event.target.checked)"
          >
          <span class="settings-visual__tile" @click="$event.currentTarget.previousElementSibling.click()">
            <component :is="'icon-' + button.icon" class="settings-visual__tile-icon"></component>
            <span class="settings-visual__tile-label">{{ button.title }}</span>
          </span>
          <input
            class="textfield settings-visual__shortcut"
            :class="{'settings-visual__shortcut--capturing': capturingMethod === button.method}"
            :value="shortcutLabel(button)"
            readonly
            placeholder="NONE"
            @focus="capturingMethod = button.method"
            @blur="capturingMethod = null"
            @keydown="onShortcutKey(button.method, $event)"
          >
        </div>
      </template>
      <template v-else>
      <form-entry v-for="field in section.fields" :key="fieldKey(field)" :label="field.label" :info="infoOf(field)">
        <template v-slot:field>
          <input
            v-if="field.type === 'toggle'"
            type="checkbox"
            :checked="valueOf(field) === true"
            @change="onToggle(field, $event.target.checked)"
          >
          <select
            v-else-if="field.type === 'select'"
            class="textfield"
            :value="valueOf(field)"
            @change="onSelect(field, $event.target.value)"
          >
            <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
          <template v-else-if="field.type === 'number'">
            <input
              class="textfield"
              type="number"
              :min="field.min"
              :max="field.max"
              :step="field.step"
              :value="inputValue(field)"
              :class="{'textfield--invalid': errorOf(field)}"
              @focus="focusPath = fieldKey(field)"
              @blur="focusPath = null; resyncFromDraft()"
              @input="onNumberInput(field, $event.target.value)"
            >
            <div class="form-entry__error" v-if="errorOf(field)">{{ errorOf(field) }}</div>
          </template>
          <input
            v-else-if="field.type === 'text'"
            class="textfield"
            type="text"
            :value="inputValue(field)"
            @focus="focusPath = fieldKey(field)"
            @blur="focusPath = null; resyncFromDraft()"
            @input="onTextInput(field, $event.target.value)"
          >
          <textarea
            v-else-if="field.type === 'textarea'"
            class="textfield settings-visual__textarea"
            rows="4"
            :value="inputValue(field)"
            @focus="focusPath = fieldKey(field)"
            @blur="focusPath = null; resyncFromDraft()"
            @input="onTextInput(field, $event.target.value)"
          ></textarea>
        </template>
      </form-entry>
      </template>
    </div>
    <div class="settings-visual__apply-hint">快捷键修改在点击「确认」后生效。</div>
    <div class="settings-visual__conflict-hint" v-if="conflictHint">
      「{{ conflictHint.combo }}」原属于「{{ conflictHint.fromTitle }}」，已被抢断。
    </div>
  </div>
</template>

<script>
import yaml from 'js-yaml';
import settingsYamlSvc from '../../../services/settingsYamlSvc';
import headButtonsSvc from '../../../services/headButtonsSvc';
import shortcutCapture from '../../../services/shortcutCapture';
import pagedownButtons from '../../../data/pagedownButtons';
import defaultSettings from '../../../data/defaults/defaultSettings.yml?raw';
import fieldSections from './settingsFields';
import FormEntry from '../common/FormEntry';

const parsedDefaults = yaml.load(defaultSettings);
const fieldKey = field => JSON.stringify(field.path);

export default {
  components: {
    FormEntry,
  },
  props: {
    draft: {
      type: String,
      required: true,
    },
  },
  data: () => ({
    fieldSections,
    rawInputs: {},
    focusPath: null,
    dragMethod: null,
    dragOverMethod: null,
    capturingMethod: null,
    conflictHint: null,
  }),
  computed: {
    merged() {
      return settingsYamlSvc.mergeSettings(parsedDefaults, this.draft);
    },
    orderedButtons() {
      const show = (this.merged.editor && this.merged.editor.headButtons) || {};
      const byMethod = Object.create(null);
      pagedownButtons.forEach((b) => {
        if (b.method) {
          byMethod[b.method] = b;
        }
      });
      return headButtonsSvc.resolveOrder(this.merged.editor || {})
        .map(method => ({ ...byMethod[method], visible: show[method] !== false }));
    },
  },
  watch: {
    draft() {
      // yaml tab 手改后切回：以文本为准重梳控件
      this.resyncFromDraft();
    },
  },
  created() {
    this.resyncFromDraft();
    this.$nextTick(() => this.notifyInvalid());
  },
  methods: {
    fieldKey,
    defaultOf(field) {
      let cur = parsedDefaults;
      for (let i = 0; i < field.path.length; i += 1) {
        cur = cur && cur[field.path[i]];
      }
      return cur;
    },
    infoOf(field) {
      const dv = this.defaultOf(field);
      let dvText;
      if (field.type === 'toggle') {
        dvText = dv ? '开' : '关';
      } else if (field.type === 'select' && field.options) {
        const option = field.options.find(o => o.value === dv);
        dvText = (option && option.label) || `${dv}`;
      } else {
        dvText = (dv === undefined || dv === null || dv === '') ? '无' : `${dv}`;
      }
      const hint = `默认：${dvText}`;
      return field.info ? `${field.info}，${hint}` : hint;
    },
    valueOf(field) {
      let cur = this.merged;
      for (let i = 0; i < field.path.length; i += 1) {
        cur = cur && cur[field.path[i]];
      }
      return cur;
    },
    inputValue(field) {
      const key = fieldKey(field);
      if (Object.prototype.hasOwnProperty.call(this.rawInputs, key)) {
        return this.rawInputs[key];
      }
      return this.valueOf(field);
    },
    errorOf(field) {
      if (field.type !== 'number') {
        return null;
      }
      const raw = `${this.inputValue(field)}`;
      const num = parseFloat(raw);
      if (raw.trim() === '' || Number.isNaN(num)) {
        return '需为数字';
      }
      if (field.min !== undefined && num < field.min) {
        return `最小值 ${field.min}`;
      }
      if (field.max !== undefined && num > field.max) {
        return `最大值 ${field.max}`;
      }
      return null;
    },
    resyncFromDraft() {
      // 以 draft 文本为准整表回填；正在聚焦编辑的行跳过，不打断输入
      fieldSections.forEach((section) => {
        (section.fields || []).forEach((field) => {
          if (field.type !== 'number' && field.type !== 'text' && field.type !== 'textarea') {
            return;
          }
          const key = fieldKey(field);
          if (this.focusPath === key) {
            return;
          }
          this.rawInputs[key] = this.valueOf(field);
        });
      });
      this.notifyInvalid();
    },
    onToggle(field, checked) {
      this.$emit('set', { path: field.path, value: checked });
    },
    onButtonToggle(method, checked) {
      this.$emit('set', { path: ['editor', 'headButtons', method], value: checked });
    },
    shortcutLabel(button) {
      if (this.capturingMethod === button.method) {
        return '按下快捷键…（Shift+Esc 取消 / Backspace 清除）';
      }
      const combo = shortcutCapture.comboOfMethod(this.merged.shortcuts, button.method);
      if (!combo) {
        return '';
      }
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      return shortcutCapture.displayCombo(combo, isMac);
    },
    onShortcutKey(method, e) {
      // 捕获期间一切按键不外传——重点修复 Esc 穿透到 Modal.vue 的 @keydown.esc.stop 关窗
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) {
        // 修饰+Esc = 取消捕获
        e.target.blur();
        return;
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const combo = shortcutCapture.comboOfMethod(this.merged.shortcuts, method);
        if (combo) {
          this.$emit('remove', { path: ['shortcuts', combo] });
        }
        e.target.blur();
        return;
      }
      const combo = shortcutCapture.comboFromEvent(e);
      if (!combo) {
        return;
      }
      const owner = shortcutCapture.comboOwner(this.merged.shortcuts, combo);
      if (owner === method) {
        e.target.blur();
        return;
      }
      if (owner) {
        // 抢断语义：新请求占有该组合键，旧按钮被清空并给出提示
        this.$emit('remove', { path: ['shortcuts', combo] });
        const byMethod = Object.create(null);
        pagedownButtons.forEach((b) => { byMethod[b.method] = b; });
        this.conflictHint = { combo, fromTitle: (byMethod[owner] || {}).title || owner };
        setTimeout(() => { this.conflictHint = null; }, 4000);
      }
      this.$emit('set', { path: ['shortcuts', combo], value: method });
      e.target.blur();
    },
    onButtonDrop(targetMethod) {
      if (!this.dragMethod || this.dragMethod === targetMethod) {
        return;
      }
      let order = headButtonsSvc.resolveOrder(this.merged.editor || {});
      order = order.filter(m => m !== this.dragMethod);
      order.splice(order.indexOf(targetMethod), 0, this.dragMethod);
      this.dragMethod = null;
      this.$emit('set', { path: ['editor', 'headButtonOrder'], value: order });
    },
    onSelect(field, value) {
      this.$emit('set', { path: field.path, value });
    },
    notifyInvalid() {
      const count = fieldSections
        .reduce((acc, section) => acc.concat(section.fields || []), [])
        .filter(field => this.errorOf(field))
        .length;
      this.$emit('invalid', count > 0);
    },
    onNumberInput(field, raw) {
      const key = fieldKey(field);
      this.rawInputs[key] = raw;
      this.notifyInvalid();
      const num = parseFloat(raw);
      if (!this.errorOf(field)) {
        this.$emit('set', { path: field.path, value: num });
      }
    },
    onTextInput(field, raw) {
      this.rawInputs[fieldKey(field)] = raw;
      this.$emit('set', { path: field.path, value: raw });
    },
  },
};
</script>

<style lang="scss">
@import '../../../styles/variables.scss';

.settings-visual__section-title {
  margin: 12px 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.settings-visual__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.textfield--invalid {
  border-color: $error-color !important;
}

.form-entry__error {
  color: $error-color;
  font-size: 12px;
  margin-top: 4px;
}

.settings-visual__button-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 3px 4px;

  &--hidden {
    opacity: 0.45;
  }

  // CheatBreakerZ 式拖拽预览（换蓝）：悬停目标行整行淡蓝底 + 顶缘 2px 实蓝插入线
  &--drop-target {
    background-color: rgba(12, 147, 228, 0.12);
    box-shadow: inset 0 2px 0 0 #0c93e4;
  }
}

.settings-visual__drag-handle {
  cursor: grab;
  color: rgba(0, 0, 0, 0.35);
  user-select: none;

  .app--dark & {
    color: rgba(255, 255, 255, 0.45);
  }
}

.settings-visual__tile {
  flex: 1 1 auto;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 6px 8px;
  cursor: pointer;
  border-radius: $border-radius-base;
  min-width: 0;

  &:hover {
    background: rgba(0, 0, 0, 0.05);

    .app--dark & {
      background: rgba(255, 255, 255, 0.08);
    }
  }

  svg {
    width: 26px;
    height: 26px;
    flex: 0 0 auto;
  }
}

.settings-visual__tile-label {
  font-size: 12px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.settings-visual select.textfield {
  cursor: pointer;
}

.settings-visual__shortcut {
  width: 150px;
  text-align: center;
  cursor: pointer;
  flex: 0 0 150px;
  margin-left: auto;

  &--capturing {
    border-color: $link-color !important;
  }
}

.settings-visual__conflict-hint {
  color: $error-color;
  font-size: 12px;
  margin-top: 6px;
}

.settings-visual__apply-hint {
  color: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  margin-top: 8px;

  .app--dark & {
    color: rgba(255, 255, 255, 0.5);
  }
}

.settings-visual__textarea {
  min-height: 72px;
  resize: vertical;
  font-family: $font-family-monospace;
  font-size: $font-size-monospace;
}
</style>
