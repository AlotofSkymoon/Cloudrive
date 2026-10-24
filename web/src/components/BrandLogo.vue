<script setup lang="ts">
// 品牌图标：蓝色云朵 + 白色文件夹 + 右下白色弧线（不带文字）
// 用固定的 gradient id 会在同一页面出现多个实例时冲突（SVG 的 id 是全局的），
// 所以每个实例生成一个唯一 id。
import { BRAND_LOGO_INNER } from '../logo';

const props = withDefaults(defineProps<{ size?: number | string }>(), { size: 26 });

const uid = `brand-logo-${Math.random().toString(36).slice(2, 9)}`;
// 把 defs 里的 id="g" 换成本实例的唯一 id，并让 fill 引用新 id
const inner = BRAND_LOGO_INNER.replace(/id="g"/g, `id="${uid}"`).replace(/url\(#g\)/g, `url(#${uid})`);
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 64 64"
    class="flex-none"
    aria-hidden="true"
    v-html="inner"
  ></svg>
</template>
