<template>
  <modal-inner aria-label="插入图像">
    <div class="modal__content">
      <p>请为您的图像提供<b> url </b>。<span v-if="uploading">(图片上传中...)</span></p>
      <form-entry label="URL" error="url">
        <template v-slot:field><input class="textfield" type="text" v-model.trim="url" @keydown.enter="resolve"></template>
      </form-entry>
    </div>
    <div class="modal__button-bar">
      <input class="hidden-file" id="upload-image-file-input" type="file" accept="image/*" :disabled="uploading" @change="uploadImage">
      <label for="upload-image-file-input"><a class="button">上传图片</a></label>
      <button class="button" @click="reject()">取消</button>
      <button class="button button--resolve" @click="resolve" :disabled="uploading">确认</button>
    </div>
  </modal-inner>
</template>

<script>
import modalTemplate from './common/modalTemplate';
import store from '../../store';
import imageSvc from '../../services/imageSvc';

export default modalTemplate({
  data: () => ({
    uploading: false,
    url: '',
  }),
  methods: {
    resolve(evt) {
      evt.preventDefault(); // Fixes https://github.com/mafgwo/stackedit/issues/1503
      if (!this.url) {
        this.setError('url');
      } else {
        const { callback } = this.config;
        this.config.resolve();
        callback(this.url);
      }
    },
    reject() {
      const { callback } = this.config;
      this.config.reject();
      callback(null);
    },
    async uploadImage(evt) {
      if (!evt.target.files || !evt.target.files.length) {
        return;
      }
      const imgFile = evt.target.files[0];
      try {
        this.uploading = true;
        const { url, error } = await imageSvc.updateImg(imgFile);
        if (error) {
          store.dispatch('notification/error', error);
          return;
        }
        this.url = url;
      } catch (err) {
        store.dispatch('notification/error', err);
      } finally {
        this.uploading = false;
        // 上传后清空
        evt.target.value = '';
      }
    },
  },
});
</script>
