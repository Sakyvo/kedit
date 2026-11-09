<template>
  <div class="form-entry" :class="{'form-entry--inline': inline, 'form-entry--has-select': hasSelect, 'form-entry--wide': wide}" :error="error">
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
  props: ['label', 'info', 'error', 'inline', 'hasSelect', 'wide'],
  data: () => ({
    uid: utils.uid(),
  }),
  mounted() {
    // A custom select (SettingsSelect) renders a combobox div, not a native
    // input, so this can legitimately find nothing. Throwing here broke the
    // settings modal open: the rejection left Vue's scheduler unable to flush,
    // which froze every later reactive update (theme class included) until a
    // reload.
    const field = this.$el.querySelector('input,select,textarea');
    if (field) {
      field.id = this.uid;
    }
  },
};
</script>
