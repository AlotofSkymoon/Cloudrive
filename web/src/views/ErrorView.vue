<script setup lang="ts">
import BrandLogo from '../components/BrandLogo.vue';
const props = defineProps<{ boot: any }>();
const code = props.boot?.error?.code || '404';
const msg = props.boot?.error?.msg || '页面不存在';
</script>

<template>
  <div class="min-h-viewport bg-canvas flex flex-col items-center justify-center px-4 py-8 pb-safe">
    <div class="flex flex-col items-center">
      <BrandLogo :size="52" class="mb-4 opacity-60" />
      <div class="text-[64px] font-bold text-faint leading-none tracking-tight">{{ code }}</div>
      <h2 class="text-[17px] font-semibold mt-4 mb-1.5">{{ msg }}</h2>
      <p class="text-[15px] text-muted m-0 mb-6 text-center max-w-sm">
        <template v-if="code === '404'">这个地址不存在。如果是别人给你的链接，可能已经失效或被取消。</template>
        <template v-else>分享已过期或被分享者取消。如果你需要这个文件，请联系分享者重新生成链接。</template>
      </p>
      <a href="/" class="btn btn-filled no-underline">返回首页</a>
    </div>
  </div>
</template>
