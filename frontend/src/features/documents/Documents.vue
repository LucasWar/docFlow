<script setup lang="ts">
import { ref } from 'vue'
import ListDocuments from './Components/ListDocuments.vue';
import UploadDocuments from './Components/UploadDocuments.vue';

const currentView = ref('list')
</script>

<template>
  <main>
    <component
      :is="
        currentView === 'list'
          ? ListDocuments
          : UploadDocuments
      "
      @upload="currentView = 'upload'"
      @cancel="currentView = 'list'"
    />
  </main>
</template>     