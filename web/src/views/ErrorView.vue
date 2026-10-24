<script setup lang="ts">
const props = defineProps<{ boot: any }>();
const code = props.boot?.error?.code || '404';
const msg = props.boot?.error?.msg || '页面不存在';
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="flex items-center gap-2 px-6 py-5 font-mono text-[10px] text-faint tracking-wide">
      <span class="font-serif text-[15px] text-ink font-semibold tracking-tight">Filecove</span>
      <span>ERROR</span>
      <span class="flex-1"></span>
      <span>{{ code }}</span>
    </div>

    <div class="flex-1 flex items-center justify-center px-5 pb-[60px]">
      <div class="w-full max-w-[420px] text-center">
        <div class="font-mono text-[52px] tracking-[0.04em] text-rule leading-none">{{ code }}</div>
        <h2 class="text-[18px] font-semibold mt-[14px] mb-1.5">{{ msg }}</h2>
        <p class="text-[12.5px] text-muted m-0 mb-[22px] leading-[1.7]">
          <template v-if="code === '404'">这个地址不存在。如果是别人给你的链接，可能已经失效或被取消。</template>
          <template v-else>分享已过期或被分享者取消。如果你需要这个文件，请联系分享者重新生成链接。</template>
        </p>
        <div class="border border-rule bg-surface px-[14px] py-3 text-left">
          <div class="flex justify-between py-[5px] text-[11.5px]">
            <span class="text-faint font-mono text-[10px] tracking-[0.04em]">状态</span>
            <b class="font-mono font-normal text-[11px] text-ink/80">{{ msg }}</b>
          </div>
        </div>
        <a href="/" class="btn mt-[18px] w-full h-[34px] justify-center no-underline">返回首页</a>
      </div>
    </div>
  </div>
</template>
