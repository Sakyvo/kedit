<template>
  <modal-inner aria-label="发布到 pdir">
    <div class="modal__content">
      <div class="modal__image">
        <icon-provider provider-id="pdir"></icon-provider>
      </div>
      <p>发布 <b>{{currentFileName}}</b> 到 <b>pdir</b> 模块（保留模块标题，只替换正文）。</p>
      <div class="side-bar__info" v-if="loadError">
        <p>{{loadError}}</p>
      </div>
      <form-entry v-if="isRepublish" label="目标模块">
        <template v-slot:field><input class="textfield" type="text" :value="config.location.module" disabled></template>
      </form-entry>
      <form-entry v-else label="目标模块" error="module">
        <template v-slot:field>
          <select class="textfield" v-model="selectedModule" :disabled="loading">
            <option v-for="module in modules" :key="module.title" :value="module.title">
              {{ module.title }}
            </option>
          </select>
        </template>
        <div class="form-entry__info" v-if="loading">正在读取 pdir 模块清单…</div>
      </form-entry>
      <form-entry label="提交信息" info="可选的">
        <template v-slot:field><input class="textfield" type="text" v-model.trim="commitMessage" @keydown.enter="resolve()"></template>
      </form-entry>
      <div class="form-entry__info" v-if="privateImgCount">
        ⚠ 文档含 {{privateImgCount}} 张私有图片：图片管线尚未就绪，暂无法发布。
      </div>
      <div class="form-entry__info" v-if="headingViolation">
        ⚠ {{headingViolation}}
      </div>
    </div>
    <div class="modal__button-bar">
      <button class="button" @click="config.reject()">取消</button>
      <button class="button button--resolve" :disabled="!canResolve" @click="resolve()">确认发布</button>
    </div>
  </modal-inner>
</template>

<script>
import store from '../../../store';
import modalTemplate from '../common/modalTemplate';
import pdirProvider from '../../../services/providers/pdirProvider';
import {
  parsePdirModules,
  listPrivateImgRefs,
  stripFrontMatter,
  findForbiddenHeadings,
} from '../../../services/providers/helpers/pdirPublishUtils';

export default modalTemplate({
  data: () => ({
    modules: [],
    selectedModule: '',
    commitMessage: '',
    loading: false,
    loadError: '',
  }),
  computed: {
    isRepublish() {
      return !!this.config.location;
    },
    privateImgCount() {
      const content = store.getters['content/current'];
      return listPrivateImgRefs((content && content.text) || '').length;
    },
    headingViolation() {
      const content = store.getters['content/current'];
      const violations = findForbiddenHeadings(stripFrontMatter((content && content.text) || ''));
      if (!violations.length) {
        return '';
      }
      const first = violations[0];
      return `第${first.line + 1}行「${'#'.repeat(first.level)} ${first.title}」等 ${violations.length} 处标题层级过高（pdir 向文档需从 #### 起步）。`;
    },
    canResolve() {
      if (this.privateImgCount || this.headingViolation) {
        return false;
      }
      return this.isRepublish || !!this.selectedModule;
    },
  },
  async created() {
    if (this.isRepublish) {
      return;
    }
    this.loading = true;
    try {
      const token = this.config.token;
      const { data } = await pdirProvider.downloadMainMd(token);
      this.modules = parsePdirModules(data);
      if (this.modules.length) {
        this.selectedModule = this.modules[0].title;
      } else {
        this.loadError = 'pdir 内容源中没有可用模块。';
      }
    } catch (e) {
      this.loadError = '读取 pdir 模块清单失败，请检查网络与仓库权限。';
    }
    this.loading = false;
  },
  methods: {
    resolve() {
      if (!this.canResolve) {
        return;
      }
      if (this.isRepublish) {
        this.config.resolve({ commitMessage: this.commitMessage });
        return;
      }
      const location = pdirProvider.makeLocation(this.config.token, this.selectedModule);
      this.config.resolve({ location, commitMessage: this.commitMessage });
    },
  },
});
</script>
