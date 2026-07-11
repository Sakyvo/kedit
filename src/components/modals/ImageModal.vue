<template>
  <modal-inner aria-label="插入图像">
    <div class="modal__content">
      <p>请为您的图像提供<b> url </b>，多张图片以逗号或回车分隔。<span v-if="uploading">(图片上传中...)</span></p>
      <form-entry label="URL" error="url">
        <template v-slot:field><textarea class="textfield image-modal__url-input" v-model="url"></textarea></template>
      </form-entry>
    </div>
    <div class="modal__button-bar">
      <input class="hidden-file" id="upload-image-file-input" type="file" accept="image/*" multiple :disabled="uploading" @change="uploadImages">
      <label for="upload-image-file-input"><a class="button">上传图片</a></label>
      <button class="button button--resolve" @click="resolve" :disabled="uploading">确认</button>
    </div>
  </modal-inner>
</template>

<script>
import modalTemplate from './common/modalTemplate';
import store from '../../store';
import imageSvc from '../../services/imageSvc';
import utils from '../../services/utils';

export default modalTemplate({
  data: () => ({
    uploading: false,
    url: '',
  }),
  methods: {
    insertUrls(urls) {
      const { callback } = this.config;
      this.config.resolve();
      // Single URL keeps the historical string contract (wraps the selection),
      // multiple URLs are inserted one per line by pagedown
      callback(urls.length === 1 ? urls[0] : urls);
    },
    resolve(evt) {
      evt.preventDefault(); // Fixes https://github.com/mafgwo/stackedit/issues/1503
      const urls = this.url.split(/[\n,]/)
        .map(url => url.trim())
        .filter(url => url);
      if (!urls.length) {
        this.setError('url');
      } else {
        this.insertUrls(urls);
      }
    },
    async uploadImages(evt) {
      if (!evt.target.files || !evt.target.files.length) {
        return;
      }
      const imgFiles = Array.from(evt.target.files);
      try {
        this.uploading = true;
        const urls = [];
        await utils.awaitSequence(imgFiles, async (imgFile) => {
          try {
            const { url, error } = await imageSvc.updateImg(imgFile);
            if (error) {
              store.dispatch('notification/error', `${imgFile.name} 上传失败：${error}`);
            } else {
              urls.push(url);
            }
          } catch (err) {
            store.dispatch('notification/error', `${imgFile.name} 上传失败：${err.message || err}`);
          }
        });
        if (urls.length) {
          // 上传成功后直接插入文章
          this.insertUrls(urls);
        }
      } finally {
        this.uploading = false;
        // 上传后清空
        evt.target.value = '';
      }
    },
  },
});
</script>

<style lang="scss">
.image-modal__url-input {
  min-height: 84px;
  padding-top: 8px;
  padding-bottom: 8px;
  resize: vertical;
}
</style>
