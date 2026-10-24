<script setup lang="ts">
// 品牌图标：蓝色云朵 + 白色文件夹 + 右下白色弧线（不带文字）
// 支持彩色 / 黑色 / 白色三种配色，由设置页的「图标配色」决定（auto 时跟随系统深浅）。
import { computed } from 'vue';
import { renderLogoInner } from '../logo';
import { resolvedLogo } from '../theme';

const props = withDefaults(
  defineProps<{
    size?: number | string;
    /** 不传就跟随全局设置 */
    variant?: 'color' | 'black' | 'white';
  }>(),
  { size: 26, variant: undefined }
);

// SVG 的 id 是文档级全局的，同页面多个实例共用 id="g" 会互相覆盖导致颜色错乱，
// 所以每个实例生成一个唯一 id。
const uid = `brand-logo-${Math.random().toString(36).slice(2, 9)}`;

const variant = computed(() => props.variant || resolvedLogo.value);
const inner = computed(() => renderLogoInner(variant.value, uid));
</script>

<template>
  <svg
    :width="props.size"
    :height="props.size"
    viewBox="0 0 64 64"
    class="brand-logo flex-none"
    :class="`brand-logo--${variant}`"
    aria-hidden="true"
    v-html="inner"
  ></svg>
</template>

<style scoped>
/* 配色切换也走过渡，改设置时图标平滑变化而不是硬切 */
.brand-logo :deep(g),
.brand-logo :deep(path) {
  transition: fill 0.25s ease, stroke 0.25s ease;
}

@media (prefers-reduced-motion: reduce) {
  .brand-logo :deep(g),
  .brand-logo :deep(path) {
    transition: none;
  }
}
</style>
