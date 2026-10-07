<template>
  <div class="form-entry" :class="{'form-entry--inline': inline}" :error="error">
    <template v-if="inline">
      <label class="form-entry__inline-label" :for="uid"><slot name="field"></slot>{{label}}<span class="form-entry__label-info" v-if="info"> &mdash; {{info}}</span></label>
      <slot></slot>
    </template>
    <template v-else>
      <label class="form-entry__label" :for="uid">{{label}}<span class="form-entry__label-info" v-if="info"> &mdash; {{info}}</span></label>
      <div class="form-entry__field">
        <slot name="field"></slot>
      </div>
      <slot></slot>
    </template>
  </div>
</template>

<script>
import utils from '../../../services/utils';

export default {
  props: ['label', 'info', 'error', 'inline'],
  data: () => ({
    uid: utils.uid(),
  }),
  mounted() {
    this.$el.querySelector('input,select,textarea').id = this.uid;
  },
};
</script>
