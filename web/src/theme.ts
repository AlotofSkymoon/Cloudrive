// 界面外观的共享状态（主题色、外观模式、图标配色）。
// 视觉基线是 Cloudreve / Material Design，见 web/src/style.css。
// 配置存在数据库里，前端启动时拉一次；拉不到就用默认值，不影响渲染。
import { computed, ref, watch } from 'vue';
import { api } from './api';

export type LogoSetting = 'color' | 'black' | 'white' | 'auto';

/** 用户在设置里选的图标配色：彩色 / 零白 / 原白 / 跟随系统 */
export const logoSetting = ref<LogoSetting>('color');

/** 系统是否处于深色模式（prefers-color-scheme） */
export const prefersDark = ref(false);

/* ============================================================
   外观模式：跟随系统 / 浅色 / 深色
   —— 用户可以在设置页手动锁定白天或夜间，不用改系统设置。
   ============================================================ */
export type AppearanceSetting = 'auto' | 'light' | 'dark';

/** localStorage 的键：首屏同步读取，避免深色用户看到一帧白闪 */
export const APPEARANCE_KEY = 'cloudrive-appearance';

export const APPEARANCE_LABELS: Record<AppearanceSetting, string> = {
  auto: '跟随系统',
  light: '浅色',
  dark: '深色',
};

/** 用户在设置里选的外观模式 */
export const appearanceSetting = ref<AppearanceSetting>('auto');

export function normalizeAppearance(v: unknown): AppearanceSetting {
  const s = String(v ?? '').trim();
  return s === 'light' || s === 'dark' || s === 'auto' ? s : 'auto';
}

/** 最终是否用深色：手动优先，auto 时看系统 */
export const isDark = computed(() => {
  const a = appearanceSetting.value;
  if (a === 'dark') return true;
  if (a === 'light') return false;
  return prefersDark.value;
});

/* ============================================================
   主题色（tint）：影响整个界面的主色
   —— 按钮、导航选中项、进度条、链接、开关、焦点边框……
   不只是品牌图标，图标配色是另一项独立设置。
   ============================================================ */

/** 可选的主题色。值是 Material 调色板的浅色 / 深色两套 RGB 三元组。
 *  默认蓝是 Cloudreve 的主色 #3498db，和 style.css 的 :root 保持一致。 */
export const TINTS = {
  blue: { base: '52 152 219', hover: '41 128 192', darkBase: '93 173 226', darkHover: '133 193 233' },
  purple: { base: '156 39 176', hover: '123 31 162', darkBase: '206 147 216', darkHover: '171 71 188' },
  pink: { base: '233 30 99', hover: '194 24 91', darkBase: '244 143 177', darkHover: '216 27 96' },
  red: { base: '244 67 54', hover: '211 47 47', darkBase: '229 115 115', darkHover: '198 40 40' },
  orange: { base: '255 152 0', hover: '245 124 0', darkBase: '255 183 77', darkHover: '239 108 0' },
  green: { base: '76 175 80', hover: '56 142 60', darkBase: '129 199 132', darkHover: '67 160 71' },
  indigo: { base: '63 81 181', hover: '48 63 159', darkBase: '121 134 203', darkHover: '57 73 171' },
  graphite: { base: '96 125 139', hover: '69 90 100', darkBase: '144 164 174', darkHover: '84 110 122' },
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
  if (isDark.value) {
    root.style.setProperty('--c-tint', t.darkBase);
    root.style.setProperty('--c-tint-dark', t.darkHover);
    root.style.setProperty('--c-tint-light', t.darkBase);
  } else {
    root.style.setProperty('--c-tint', t.base);
    root.style.setProperty('--c-tint-dark', t.hover);
    root.style.setProperty('--c-tint-light', t.base);
  }
}

/**
 * 把外观模式写到 <html data-theme>。
 * auto 时移除属性，让 CSS 的 prefers-color-scheme 生效；
 * light / dark 时显式锁定，覆盖系统设置。
 */
export function applyAppearance() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const a = appearanceSetting.value;
  if (a === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', a);
  // 存一份，供下次首屏同步读取（防白闪）
  try {
    localStorage.setItem(APPEARANCE_KEY, a);
  } catch {
    /* 隐私模式下 localStorage 不可用，忽略即可 */
  }
}

/** 改外观模式时立刻生效（存库前就能看到） */
export function setAppearance(v: string) {
  appearanceSetting.value = normalizeAppearance(v);
  applyAppearance();
  applyTint();
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
  // 首屏先用 localStorage 里存的值，避免配置请求回来前的白闪
  try {
    const saved = localStorage.getItem(APPEARANCE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'auto') appearanceSetting.value = saved;
  } catch {
    /* 读不到就用默认 auto */
  }
  applyAppearance();
  // 主题色与深浅模式任一变化时重新应用
  watch([tintSetting, isDark], applyTint, { immediate: true });
  watch(appearanceSetting, applyAppearance);
  if (inited) return;
  inited = true;
  try {
    const d = await api.get<{
      config?: { logoVariant?: string; tint?: string; appearance?: string };
    }>('/api/config');
    const v = d?.config?.logoVariant;
    if (v === 'color' || v === 'black' || v === 'white' || v === 'auto') logoSetting.value = v;
    tintSetting.value = normalizeTint(d?.config?.tint);
    // 库里存了就用库里的（服务端配置优先于本地缓存）
    const a = normalizeAppearance(d?.config?.appearance);
    if (d?.config?.appearance) {
      appearanceSetting.value = a;
      applyAppearance();
    }
  } catch {
    /* 登录页等未登录场景拿不到配置，用默认即可 */
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
