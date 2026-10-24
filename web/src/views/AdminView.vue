<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref } from 'vue';
import { api, fmtBytes, type Stats } from '../api';
import FilesPanel from './admin/FilesPanel.vue';
import SharesPanel from './admin/SharesPanel.vue';
import LogsPanel from './admin/LogsPanel.vue';
import BansPanel from './admin/BansPanel.vue';
import SettingsPanel from './admin/SettingsPanel.vue';

const props = defineProps<{ boot: any }>();

/* ---------- 侧边栏菜单（Cloudreve 式：图标 + 文字 + 角标） ---------- */
const tabs = [
  { key: 'files', label: '我的文件', icon: 'folder' },
  { key: 'shares', label: '我的分享', icon: 'share' },
  { key: 'logs', label: '下载记录', icon: 'list' },
  { key: 'bans', label: '封禁名单', icon: 'block' },
  { key: 'settings', label: '设置', icon: 'gear' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const active = ref<TabKey>('files');
const stats = ref<Stats | null>(null);
const counts = ref<Record<string, number | string>>({ files: '—', shares: '—', logs: '—', bans: '—' });

async function loadStats() {
  const d = await api.get<Stats>('/api/stats');
  if (!d) return;
  stats.value = d;
  counts.value = {
    files: d.files,
    shares: d.shares,
    logs: d.downloads,
    bans: counts.value.bans,
  };
}
async function loadBansCount() {
  const d = await api.get<{ bans: unknown[] }>('/api/bans');
  if (d) counts.value.bans = (d.bans || []).length;
}

const usedPct = computed(() => {
  const s = stats.value;
  if (!s || !s.quota) return 0;
  return Math.min(100, (s.bytes / (s.quota * 1073741824)) * 100);
});
const usageText = computed(() => {
  const s = stats.value;
  if (!s) return '—';
  return s.quota > 0 ? `${fmtBytes(s.bytes)} / ${fmtBytes(s.quota * 1073741824)}` : fmtBytes(s.bytes);
});

const currentTab = computed(() => tabs.find((t) => t.key === active.value));
const title = computed(() => currentTab.value?.label || '');

/* ---------- 「+ 新建」：切到文件页并唤起选择文件 ---------- */
const picker = ref<(() => void) | null>(null);
provide('registerPicker', (fn: () => void) => (picker.value = fn));

async function newUpload() {
  active.value = 'files';
  await nextTick();
  // FilesPanel 挂载后会注册自己的 pick，等一帧再调
  setTimeout(() => picker.value?.(), 0);
}

async function logout() {
  await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
  location.href = '/';
}

onMounted(() => {
  loadStats();
  loadBansCount();
});
</script>

<template>
  <div class="flex h-screen overflow-hidden max-[860px]:flex-col max-[860px]:h-auto max-[860px]:overflow-visible">
    <!-- 侧边栏 -->
    <aside
      class="w-60 flex-none bg-surface border-r border-rule flex flex-col max-[860px]:w-full max-[860px]:border-r-0 max-[860px]:border-b"
    >
      <!-- 品牌 -->
      <div class="flex items-center gap-2 px-4 h-14 flex-none">
        <svg width="22" height="22" viewBox="0 0 24 24" class="text-primary flex-none" fill="currentColor">
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.63 4.04A5.996 5.996 0 0 0 6 20h13a4.99 4.99 0 0 0 .35-9.96Z" />
        </svg>
        <span class="text-base font-semibold tracking-tight">Filecove</span>
      </div>

      <!-- 新建 -->
      <div class="px-3 pb-3">
        <button class="btn btn-primary w-full" @click="newUpload">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" /></svg>
          新建
        </button>
      </div>

      <!-- 菜单 -->
      <nav class="flex-1 overflow-y-auto px-2 pb-2 max-[860px]:flex max-[860px]:gap-1 max-[860px]:overflow-x-auto max-[860px]:flex-none">
        <div
          v-for="t in tabs"
          :key="t.key"
          class="nav-item"
          :class="active === t.key ? 'nav-item-active' : ''"
          @click="active = t.key"
        >
          <svg v-if="t.icon === 'folder'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" />
          </svg>
          <svg v-else-if="t.icon === 'share'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 16.08a2.9 2.9 0 0 0-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81a3 3 0 1 0 0 4.38l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92Z" />
          </svg>
          <svg v-else-if="t.icon === 'list'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 13h2v-2H3v2Zm0 4h2v-2H3v2Zm0-8h2V7H3v2Zm4 4h14v-2H7v2Zm0 4h14v-2H7v2ZM7 7v2h14V7H7Z" />
          </svg>
          <svg v-else-if="t.icon === 'block'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 2c1.85 0 3.55.63 4.9 1.69L5.69 16.9A8 8 0 0 1 12 4Zm0 16a7.96 7.96 0 0 1-4.9-1.69L18.31 7.1A8 8 0 0 1 12 20Z" />
          </svg>
          <svg v-else class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.14 12.94a7.07 7.07 0 0 0 .05-.94 7.07 7.07 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.62-.06.94 0 .32.02.63.06.94L2.79 14.5a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.49.38 1.03.7 1.62.94l.36 2.54c.04.24.25.42.5.42h3.84c.25 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
          </svg>
          <span class="max-[860px]:whitespace-nowrap">{{ t.label }}</span>
          <span v-if="t.key !== 'settings'" class="nav-badge max-[860px]:hidden">{{ counts[t.key] }}</span>
        </div>
      </nav>

      <!-- 底部：存储 + 账号 -->
      <div class="flex-none border-t border-rule px-4 py-3 max-[860px]:hidden">
        <div class="text-xs text-muted mb-1.5">存储空间</div>
        <div class="h-1.5 bg-rule rounded-full overflow-hidden mb-1.5">
          <i class="block h-full bg-primary rounded-full transition-[width] duration-300" :style="{ width: usedPct + '%' }"></i>
        </div>
        <div class="text-xs text-muted font-mono">{{ usageText }}</div>
        <div class="flex items-center gap-2 mt-3">
          <span class="w-7 h-7 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-medium flex-none">A</span>
          <span class="text-sm text-ink/80 flex-1 truncate">admin</span>
          <button class="text-xs text-muted hover:text-danger" @click="logout">退出</button>
        </div>
      </div>
    </aside>

    <!-- 主区 -->
    <main class="flex-1 min-w-0 flex flex-col overflow-hidden max-[860px]:overflow-visible">
      <!-- 顶栏：面包屑 -->
      <header class="h-14 flex-none bg-surface border-b border-rule flex items-center px-5 gap-3">
        <nav class="flex items-center text-sm text-muted min-w-0">
          <span class="hover:text-ink cursor-pointer" @click="active = 'files'">我的文件</span>
          <template v-if="active !== 'files'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="mx-1 text-faint flex-none"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6Z" /></svg>
            <span class="text-ink font-medium truncate">{{ title }}</span>
          </template>
        </nav>
        <span class="flex-1"></span>
        <span class="text-xs text-faint font-mono mr-1 hidden sm:inline">
          {{ stats ? stats.files + ' 个对象' : '' }}
        </span>
        <button class="btn btn-text btn-sm" @click="loadStats(); loadBansCount()">刷新</button>
      </header>

      <!-- 内容 -->
      <div class="flex-1 overflow-y-auto px-5 py-4 max-[860px]:px-3 max-[860px]:overflow-visible">
        <FilesPanel v-if="active === 'files'" @changed="loadStats()" />
        <SharesPanel v-else-if="active === 'shares'" @changed="loadStats()" />
        <LogsPanel v-else-if="active === 'logs'" />
        <BansPanel v-else-if="active === 'bans'" @changed="loadBansCount()" />
        <SettingsPanel v-else-if="active === 'settings'" />
      </div>
    </main>
  </div>
</template>
