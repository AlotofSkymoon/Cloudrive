// 界面外观的共享状态（图标配色等）。
// 配置存在数据库里，前端启动时拉一次；拉不到就用默认值，不影响渲染。
import { computed, ref } from 'vue';
import { api } from './api';

export type LogoSetting = 'color' | 'black' | 'white' | 'auto';

/** 用户在设置里选的：彩色 / 黑色 / 白色 / 跟随系统 */
export const logoSetting = ref<LogoSetting>('color');

/** 系统是否处于深色模式（prefers-color-scheme） */
export const prefersDark = ref(false);

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
  if (inited) return;
  inited = true;
  try {
    const d = await api.get<{ config?: { logoVariant?: string } }>('/api/config');
    const v = d?.config?.logoVariant;
    if (v === 'color' || v === 'black' || v === 'white' || v === 'auto') logoSetting.value = v;
  } catch {
    /* 登录页等未登录场景拿不到配置，用默认彩色即可 */
  }
}

/** 最终生效的配色：auto 时按系统深浅给黑或白 */
export const resolvedLogo = computed(() => {
  const v = logoSetting.value;
  if (v === 'auto') return prefersDark.value ? 'white' : 'black';
  return v;
});
