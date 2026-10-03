<template>
  <modal-inner class="modal__inner-1--settings" aria-label="Settings">
    <div class="modal__content">
      <div class="tabs flex flex--row">
        <tab :active="tab === 'visual'" @click="tab = 'visual'">
          可视化
        </tab>
        <tab :active="tab === 'custom'" @click="tab = 'custom'">
          自定义配置
        </tab>
        <tab :active="tab === 'default'" @click="tab = 'default'">
          默认配置
        </tab>
      </div>
      <div v-if="tab === 'visual'" role="tabpanel" aria-label="可视化">
        <settings-visual-tab
          :draft="customSettings"
          @set="onVisualSet"
          @remove="onVisualRemove"
          @invalid="visualInvalid = $event"
        ></settings-visual-tab>
      </div>
      <div class="form-entry" v-else-if="tab === 'custom'" role="tabpanel" aria-label="自定义配置">
        <label class="form-entry__label">YAML</label>
        <div class="form-entry__field form-entry__field--code-editor">
          <code-editor lang="yaml" :value="customSettings" key="custom-settings" @changed="setCustomSettings"></code-editor>
        </div>
      </div>
      <div class="form-entry" v-else-if="tab === 'default'" role="tabpanel" aria-label="默认配置">
        <label class="form-entry__label">YAML</label>
        <div class="form-entry__field form-entry__field--code-editor">
          <code-editor lang="yaml" :value="defaultSettings" key="default-settings" disabled="true"></code-editor>
        </div>
      </div>
      <div class="modal__error modal__error--settings">{{error}}</div>
    </div>
    <div class="modal__button-bar">
      <button class="button" @click="config.reject()">取消</button>
      <button class="button button--resolve" :disabled="!!error || visualInvalid" @click="resolve">确认</button>
    </div>
  </modal-inner>
</template>

<script>
import yaml from 'js-yaml';
import { mapGetters } from 'vuex';
import ModalInner from './common/ModalInner';
import Tab from './common/Tab';
import CodeEditor from '../CodeEditor';
import defaultSettings from '../../data/defaults/defaultSettings.yml?raw';
import store from '../../store';
import settingsYamlSvc from '../../services/settingsYamlSvc';
import SettingsVisualTab from './settings/SettingsVisualTab';

const emptySettings = '# 增加您的自定义配置覆盖默认配置';

export default {
  components: {
    ModalInner,
    Tab,
    CodeEditor,
    SettingsVisualTab,
  },
  data: () => ({
    tab: 'visual',
    defaultSettings,
    customSettings: null,
    error: null,
    visualInvalid: false,
  }),
  computed: {
    ...mapGetters('modal', [
      'config',
    ]),
    strippedCustomSettings() {
      return this.customSettings === emptySettings ? '\n' : this.customSettings.replace(/\t/g, '  ');
    },
  },
  created() {
    const settings = store.getters['data/settings'];
    this.setCustomSettings(settings === '\n' ? emptySettings : settings);
  },
  methods: {
    onVisualSet({ path, value }) {
      // 行级手术写回，产物必为合法 yaml（见 settingsYamlSvc）
      this.customSettings = settingsYamlSvc.set(this.customSettings, path, value);
      this.error = null;
    },
    onVisualRemove({ path }) {
      this.customSettings = settingsYamlSvc.remove(this.customSettings, [path]);
      this.error = null;
    },
    setCustomSettings(value) {
      this.customSettings = value;
      try {
        yaml.load(this.strippedCustomSettings);
        this.error = null;
      } catch (e) {
        this.error = e.message;
      }
    },
    async resolve() {
      if (!this.error) {
        const settings = this.strippedCustomSettings;
        await store.dispatch('data/setSettings', settings);
        this.config.resolve(settings);
      }
    },
  },
};
</script>

<style lang="scss">
@import '../../styles/variables.scss';

.modal__inner-1.modal__inner-1--settings {
  max-width: 560px;
}

.modal__error--settings {
  white-space: pre-wrap;
  font-family: $font-family-monospace;
  font-size: $font-size-monospace;
}
</style>
