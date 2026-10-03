<template>
  <div class="settings-visual">
    <div class="settings-visual__section" v-for="section in fieldSections" :key="section.title">
      <h3 class="settings-visual__section-title">{{ section.title }}</h3>
      <template v-if="section.type === 'buttonList'">
        <div
          v-for="button in orderedButtons"
          :key="button.method"
          class="settings-visual__button-row"
          :class="{'settings-visual__button-row--hidden': !button.visible}"
          :draggable="!focusPath"
          @dragstart="dragMethod = button.method"
          @dragover.prevent
          @drop.prevent="onButtonDrop(button.method)"
        >
          <span class="settings-visual__drag-handle" title="拖拽排序">≡</span>
          <label class="settings-visual__button-label">
            <input
              type="checkbox"
              :checked="button.visible"
              @change="onButtonToggle(button.method, $event.target.checked)"
            >
            <component :is="'icon-' + button.icon"></component>
            <span>{{ button.title }}</span>
          </label>
          <button class="button" title="上移" @click="onButtonMove(button.method, -1)">↑</button>
          <button class="button" title="下移" @click="onButtonMove(button.method, 1)">↓</button>
        </div>
      </template>
      <template v-else>
      <form-entry v-for="field in section.fields" :key="fieldKey(field)" :label="field.label">
        <template slot="field">
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
        </template>
      </form-entry>
      </template>
    </div>
  </div>
</template>

<script>
import yaml from 'js-yaml';
import settingsYamlSvc from '../../../services/settingsYamlSvc';
import headButtonsSvc from '../../../services/headButtonsSvc';
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
          if (field.type !== 'number') {
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
    onButtonMove(method, dir) {
      const order = headButtonsSvc.resolveOrder(this.merged.editor || {});
      this.$emit('set', { path: ['editor', 'headButtonOrder'], value: headButtonsSvc.move(order, method, dir) });
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
</style>
