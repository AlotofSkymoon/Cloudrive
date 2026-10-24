<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { loadAppearance } from './theme';
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

// 拉一次外观配置（图标配色等）。未登录时拿不到，静默用默认值。
onMounted(() => {
  loadAppearance();
});
</script>

<template>
  <component :is="current" :boot="boot" />
</template>
