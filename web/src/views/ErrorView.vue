<script setup lang="ts">
const props = defineProps<{ boot: any }>();
const code = props.boot?.error?.code || '404';
const msg = props.boot?.error?.msg || '页面不存在';
</script>

<template>
  <div class="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
    <div class="flex flex-col items-center">
      <svg width="52" height="52" viewBox="0 0 24 24" class="text-rule mb-4" fill="currentColor">
        <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.63 4.04A5.996 5.996 0 0 0 6 20h13a4.99 4.99 0 0 0 .35-9.96Z" />
      </svg>
      <div class="text-6xl font-light text-rule leading-none tracking-tight">{{ code }}</div>
      <h2 class="text-lg font-medium mt-4 mb-1.5">{{ msg }}</h2>
      <p class="text-sm text-muted m-0 mb-6 text-center max-w-sm">
        <template v-if="code === '404'">这个地址不存在。如果是别人给你的链接，可能已经失效或被取消。</template>
        <template v-else>分享已过期或被分享者取消。如果你需要这个文件，请联系分享者重新生成链接。</template>
      </p>
      <a href="/" class="btn btn-filled no-underline">返回首页</a>
    </div>
  </div>
</template>
