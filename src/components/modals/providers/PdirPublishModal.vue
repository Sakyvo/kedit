<template>
  <modal-inner aria-label="发布到 pdir">
    <div class="modal__content">
      <div class="modal__image">
        <icon-provider provider-id="pdir"></icon-provider>
      </div>
      <p>发布 <b>{{currentFileName}}</b> 到 <b>pdir</b> 编辑单元（包含根标题的整段替换）。</p>
      <div class="side-bar__info" v-if="loadError">
        <p>{{loadError}}</p>
      </div>
      <form-entry label="目标单元" error="target">
        <template v-slot:field>
          <select class="textfield" v-model="selectedTargetKey" :disabled="loading">
            <option value="">请选择…</option>
            <option v-for="target in targets" :key="target.key" :value="target.key">
              {{ target.label }}
            </option>
          </select>
        </template>
        <div class="form-entry__info" v-if="loading">正在读取 pdir 编辑单元…</div>
      </form-entry>
      <form-entry label="提交信息" info="可选的">
        <template v-slot:field><input class="textfield" type="text" v-model.trim="commitMessage" @keydown.enter="resolve()"></template>
      </form-entry>
      <div class="form-entry__info" v-if="imgStats.total">
        将同步 {{imgStats.total}} 张私有图片（命名 {{imgStats.named}} / 未命名 {{imgStats.unnamed}}）；新传/复用/覆盖在发布时按内容比对决定。
      </div>
      <div class="form-entry__info" v-if="validationError">
        ⚠ {{validationError}}
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
  parsePdirTargets,
  resolvePdirTarget,
  listPrivateImgRefs,
  stripFrontMatter,
  validatePdirTargetContent,
  UNNAMED_ALT,
} from '../../../services/providers/helpers/pdirPublishUtils';

export default modalTemplate({
  data: () => ({
    targets: [],
    selectedTargetKey: '',
    commitMessage: '',
    loading: false,
    loadError: '',
  }),
  computed: {
    isRepublish() {
      return !!this.config.location;
    },
    token() {
      return this.config.token || pdirProvider.getToken(this.config.location || {});
    },
    selectedTarget() {
      return this.targets.find(target => target.key === this.selectedTargetKey) || null;
    },
    imgStats() {
      const content = store.getters['content/current'];
      const refs = listPrivateImgRefs((content && content.text) || '');
      const named = refs.filter(ref => ref.alt !== UNNAMED_ALT).length;
      return { total: refs.length, named, unnamed: refs.length - named };
    },
    validationError() {
      if (!this.selectedTarget) {
        return '';
      }
      const content = store.getters['content/current'];
      return validatePdirTargetContent(
        stripFrontMatter((content && content.text) || ''),
        this.selectedTarget,
      );
    },
    canResolve() {
      return !!this.selectedTarget && !this.loading && !this.validationError;
    },
  },
  async created() {
    this.loading = true;
    try {
      const { data } = await pdirProvider.downloadMainMd(this.token);
      this.targets = parsePdirTargets(data);
      if (this.isRepublish) {
        const currentTarget = resolvePdirTarget(this.targets, this.config.location);
        if (currentTarget) {
          this.selectedTargetKey = currentTarget.key;
        } else {
          this.loadError = `原 pdir 目标「${this.config.location.module}」不存在，请重新选择。`;
        }
      } else {
        const namedTarget = this.targets.find(target => target.label === this.currentFileName);
        this.selectedTargetKey = namedTarget ? namedTarget.key : '';
      }
    } catch (e) {
      this.loadError = '读取 pdir 编辑单元失败，请检查网络与仓库权限。';
    }
    this.loading = false;
  },
  methods: {
    resolve() {
      if (!this.canResolve) {
        return;
      }
      const location = {
        ...(this.config.location || {}),
        ...pdirProvider.makeLocation(this.token, this.selectedTarget),
      };
      this.config.resolve({ location, commitMessage: this.commitMessage });
    },
  },
});
</script>
