<script setup>
// A live sample: runs `code` (the same file the page shows below it) with
// the pv built from this repository's source as the global `pv`, in a
// container holding an element with id "viewer". One sample per page.
import { onMounted, onBeforeUnmount, ref } from 'vue';

const props = defineProps({
  code: { type: String, required: true },
  height: { type: Number, default: 400 },
});
const container = ref(null);
const error = ref(null);

onMounted(async () => {
  try {
    const pv = (await import('../../../src/index.ts')).default;
    window.pv = pv;
    new Function('pv', props.code)(pv);
  } catch (e) {
    error.value = String(e && e.message ? e.message : e);
    console.error(e);
  }
});

onBeforeUnmount(() => {
  // the samples create their viewer in #viewer; drop its canvas so a new
  // page starts clean
  const el = container.value && container.value.querySelector('#viewer');
  if (el) el.innerHTML = '';
});
</script>

<template>
  <div class="pv-sample" ref="container">
    <div id="viewer" :style="{ height: height + 'px' }"></div>
    <p v-if="error" class="pv-sample-error">The sample failed: {{ error }}</p>
  </div>
</template>
