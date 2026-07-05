<template>
  <modal-inner aria-label="使用 GitHub Token 登录">
    <div class="modal__content">
      <div class="modal__image">
        <icon-provider provider-id="github"></icon-provider>
      </div>
      <p>粘贴 <b>GitHub Personal Access Token</b> 登录 <b>KEDIT</b>，同步您的主文档空间。</p>
      <form-entry label="Personal Access Token" error="accessToken">
        <template v-slot:field><input class="textfield" type="password" v-model.trim="accessToken" @keydown.enter="resolve()"></template>
        <div class="form-entry__info">
          在 <a href="https://github.com/settings/tokens" target="_blank">GitHub → Settings → Tokens (classic)</a> 生成，需勾选 <b>repo</b> 权限（私有仓库读写）。Token 仅保存在本浏览器中。
        </div>
      </form-entry>
    </div>
    <div class="modal__button-bar">
      <button class="button" @click="config.reject()">取消</button>
      <button class="button button--resolve" @click="resolve()">确认</button>
    </div>
  </modal-inner>
</template>

<script>
import modalTemplate from '../common/modalTemplate';

export default modalTemplate({
  data: () => ({
    accessToken: '',
  }),
  methods: {
    resolve() {
      if (!this.accessToken) {
        this.setError('accessToken');
        return;
      }
      this.config.resolve({
        accessToken: this.accessToken,
      });
    },
  },
});
</script>
