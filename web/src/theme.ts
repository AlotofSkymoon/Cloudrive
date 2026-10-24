// 界面外观的共享状态（主题色、图标配色）。
// 配置存在数据库里，前端启动时拉一次；拉不到就用默认值，不影响渲染。
import { computed, ref, watch } from 'vue';
import { api } from './api';

export type LogoSetting = 'color' | 'black' | 'white' | 'auto';

/** 用户在设置里选的图标配色：彩色 / 零白 / 原白 / 跟随系统 */
export const logoSetting = ref<LogoSetting>('color');

/** 系统是否处于深色模式（prefers-color-scheme） */
export const prefersDark = ref(false);

/* ============================================================
   主题色（tint）：影响整个界面的主色
   —— 按钮、导航选中项、进度条、链接、开关、焦点边框……
   不只是品牌图标，图标配色是另一项独立设置。
   ============================================================ */

/** 可选的主题色。值是 iOS 系统色的浅色 / 深色两套 RGB 三元组。 */
export const TINTS = {
  blue: { base: '0 122 255', hover: '0 84 227', darkBase: '10 132 255', darkHover: '54 156 255' },
  purple: { base: '175 82 222', hover: '140 58 180', darkBase: '191 90 242', darkHover: '160 68 205' },
  pink: { base: '255 45 85', hover: '220 32 70', darkBase: '255 55 95', darkHover: '225 45 80' },
  red: { base: '255 59 48', hover: '210 45 36', darkBase: '255 69 58', darkHover: '215 55 46' },
  orange: { base: '255 149 0', hover: '215 122 0', darkBase: '255 159 10', darkHover: '215 130 5' },
  green: { base: '52 199 89', hover: '40 168 72', darkBase: '48 209 88', darkHover: '40 178 74' },
  indigo: { base: '88 86 214', hover: '68 66 175', darkBase: '125 122 255', darkHover: '104 101 215' },
  graphite: { base: '142 142 147', hover: '118 118 123', darkBase: '152 152 157', darkHover: '128 128 133' },
} as const;

export type TintName = keyof typeof TINTS;

/** 主题色的显示名（设置页下拉框用） */
export const TINT_LABELS: Record<TintName, string> = {
  blue: '蓝色',
  purple: '紫色',
  pink: '粉色',
  red: '红色',
  orange: '橙色',
  green: '绿色',
  indigo: '靛蓝',
  graphite: '石墨',
};

export const TINT_NAMES = Object.keys(TINTS) as TintName[];

/** 校验并回落：非法值用默认蓝，避免写坏 CSS 变量导致整站变色 */
export function normalizeTint(v: unknown): TintName {
  const s = String(v ?? '').trim();
  return s in TINTS ? (s as TintName) : 'blue';
}

/** 用户在设置里选的主题色 */
export const tintSetting = ref<TintName>('blue');

/**
 * 把主题色写进 CSS 变量。
 * 用 inline style 覆盖 :root 里的默认值——优先级高于样式表，
 * 所以浅色深色两套都能被正确覆盖。
 */
function applyTint() {
  if (typeof document === 'undefined') return;
  const t = TINTS[tintSetting.value] || TINTS.blue;
  const root = document.documentElement;
  if (prefersDark.value) {
    root.style.setProperty('--c-tint', t.darkBase);
    root.style.setProperty('--c-tint-dark', t.darkHover);
    root.style.setProperty('--c-tint-light', t.darkBase);
  } else {
    root.style.setProperty('--c-tint', t.base);
    root.style.setProperty('--c-tint-dark', t.hover);
    root.style.setProperty('--c-tint-light', t.base);
  }
}

let inited = false;

/** 监听系统深色模式变化；返回是否成功注册 */
export function watchColorScheme() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  prefersDark.value = mq.matches;
  if (typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', (e) => (prefersDark.value = e.matches));
  }
  return true;
}

/** 启动拉一次配置。未登录 / 请求失败都静默回落默认值。 */
export async function loadAppearance() {
  watchColorScheme();
  // 主题色与系统深浅都变化时重新应用
  watch([tintSetting, prefersDark], applyTint, { immediate: true });
  if (inited) return;
  inited = true;
  try {
    const d = await api.get<{ config?: { logoVariant?: string; tint?: string } }>('/api/config');
    const v = d?.config?.logoVariant;
    if (v === 'color' || v === 'black' || v === 'white' || v === 'auto') logoSetting.value = v;
    tintSetting.value = normalizeTint(d?.config?.tint);
  } catch {
    /* 登录页等未登录场景拿不到配置，用默认蓝色即可 */
  }
  applyTint();
}

/** 改主题色时立刻预览（存库前就能看到效果） */
export function setTint(v: string) {
  tintSetting.value = normalizeTint(v);
  applyTint();
}

/** 最终生效的图标配色：auto 时按系统深浅给黑或白 */
export const resolvedLogo = computed(() => {
  const v = logoSetting.value;
  if (v === 'auto') return prefersDark.value ? 'white' : 'black';
  return v;
});
