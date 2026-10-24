<script setup lang="ts">
import { computed } from 'vue';
import LoginView from './views/LoginView.vue';
import AdminView from './views/AdminView.vue';
import ShareView from './views/ShareView.vue';
import ErrorView from './views/ErrorView.vue';

const boot = window.__CLOUDRIVE__ || { view: 'login', version: '' };

// 服务端决定渲染哪个视图：admin / login / share / error
const current = computed(() => {
  switch (boot.view) {
    case 'admin':
      return AdminView;
    case 'share':
      return ShareView;
    case 'error':
      return ErrorView;
    default:
      return LoginView;
  }
});
</script>

<template>
  <component :is="current" :boot="boot" />
</template>
