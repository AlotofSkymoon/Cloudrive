<script setup lang="ts">
import { computed, nextTick, onMounted, provide, ref } from 'vue';
import { api, fmtBytes, type FileItem, type Stats } from '../api';
import FilesPanel from './admin/FilesPanel.vue';
import DetailPanel from './admin/DetailPanel.vue';
import SharesPanel from './admin/SharesPanel.vue';
import LogsPanel from './admin/LogsPanel.vue';
import BansPanel from './admin/BansPanel.vue';
import SettingsPanel from './admin/SettingsPanel.vue';

/* ---------- 左侧导航（Cloudreve 式：我的文件 + 按类型分类 + 管理项） ---------- */
type NavKey = 'all' | 'images' | 'videos' | 'audio' | 'docs' | 'shares' | 'logs' | 'bans' | 'settings';

const library = [
  { key: 'all', label: '我的文件', kind: 'all', icon: 'folder' },
  { key: 'images', label: '图片', kind: 'image', icon: 'image' },
  { key: 'videos', label: '视频', kind: 'video', icon: 'video' },
  { key: 'audio', label: '音乐', kind: 'audio', icon: 'audio' },
  { key: 'docs', label: '文档', kind: 'doc', icon: 'doc' },
  { key: 'software', label: '软件', kind: 'software', icon: 'software' },
] as const;

const manage = [
  { key: 'shares', label: '我的分享', icon: 'share' },
  { key: 'logs', label: '下载记录', icon: 'list' },
  { key: 'bans', label: '封禁名单', icon: 'block' },
  { key: 'settings', label: '设置', icon: 'gear' },
] as const;

const active = ref<NavKey>('all');
const stats = ref<Stats | null>(null);
const counts = ref<Record<string, number | string>>({
  files: '—',
  shares: '—',
  logs: '—',
  bans: '—',
});

const FILE_KEYS: NavKey[] = ['all', 'images', 'videos', 'audio', 'docs', 'software'];
const isFileView = computed(() => FILE_KEYS.includes(active.value));
const currentFilter = computed(() => {
  const item = library.find((t) => t.key === active.value);
  return item ? item.kind : 'all';
});
const currentLabel = computed(() => {
  const l = library.find((t) => t.key === active.value);
  const m = manage.find((t) => t.key === active.value);
  return (l || m)?.label || '';
});

async function loadStats() {
  const d = await api.get<Stats>('/api/stats');
  if (!d) return;
  stats.value = d;
  counts.value = { ...counts.value, files: d.files, shares: d.shares, logs: d.downloads };
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

/* ---------- 右侧详情面板 ---------- */
const selected = ref<FileItem | null>(null);
function onSelect(f: FileItem | null) {
  selected.value = f;
}
async function onDeleted() {
  selected.value = null;
  await loadStats();
}

/* ---------- 「+ 新建」 ---------- */
const picker = ref<(() => void) | null>(null);
provide('registerPicker', (fn: () => void) => (picker.value = fn));

async function newUpload() {
  active.value = 'all';
  await nextTick();
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
  <div class="flex h-screen overflow-hidden bg-canvas max-[900px]:flex-col max-[900px]:h-auto max-[900px]:overflow-visible">
    <!-- 左侧导航抽屉 -->
    <aside
      class="w-[280px] flex-none bg-surface-container-low border-r border-outline-variant flex flex-col max-[900px]:w-full max-[900px]:border-r-0 max-[900px]:border-b"
    >
      <div class="flex items-center gap-3 px-4 h-16 flex-none">
        <svg width="26" height="26" viewBox="0 0 24 24" class="text-primary flex-none" fill="currentColor">
          <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.63 4.04A5.996 5.996 0 0 0 6 20h13a4.99 4.99 0 0 0 .35-9.96Z" />
        </svg>
        <span class="text-lg tracking-tight">Filecove</span>
      </div>

      <nav class="flex-1 overflow-y-auto pb-2 max-[900px]:flex max-[900px]:gap-1 max-[900px]:overflow-x-auto max-[900px]:flex-none">
        <div class="px-4 pt-2 pb-1 text-xs font-medium tracking-wide text-faint">我的文件</div>
        <div class="px-2">
          <div
            v-for="t in library"
            :key="t.key"
            class="nav-item"
            :class="active === t.key ? 'nav-item-active' : ''"
            @click="active = t.key"
          >
            <svg v-if="t.icon === 'folder'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" />
            </svg>
            <svg v-else-if="t.icon === 'image'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21 19V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2ZM8.5 13.5l2.5 3 3.5-4.5 4.5 6H5l3.5-4.5Z" />
            </svg>
            <svg v-else-if="t.icon === 'video'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4Z" />
            </svg>
            <svg v-else-if="t.icon === 'audio'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6Z" />
            </svg>
            <svg v-else-if="t.icon === 'software'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20 7h-4V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm-6 0h-4V5h4v2Zm-7 6h4v2H7v-2Zm0 4h10v2H7v-2Z" />
            </svg>
            <svg v-else class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 7V3.5L18.5 9H13Z" />
            </svg>
            <span>{{ t.label }}</span>
          </div>
        </div>

        <div class="px-4 pt-4 pb-1 text-xs font-medium tracking-wide text-faint">管理</div>
        <div class="px-2">
          <div
            v-for="t in manage"
            :key="t.key"
            class="nav-item"
            :class="active === t.key ? 'nav-item-active' : ''"
            @click="active = t.key"
          >
            <svg v-if="t.icon === 'share'" class="nav-icon" viewBox="0 0 24 24" fill="currentColor">
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
            <span>{{ t.label }}</span>
            <span v-if="t.key !== 'settings'" class="nav-badge">{{ counts[t.key] }}</span>
          </div>
        </div>
      </nav>

      <!-- 存储用量 -->
      <div class="flex-none border-t border-outline-variant px-4 py-4 max-[900px]:hidden">
        <div class="text-xs text-muted mb-2">存储空间</div>
        <div class="h-1.5 bg-outline-variant rounded-full overflow-hidden mb-2">
          <i class="block h-full bg-primary rounded-full transition-[width] duration-300" :style="{ width: usedPct + '%' }"></i>
        </div>
        <div class="text-xs text-muted font-mono">{{ usageText }}</div>
        <div class="flex items-center gap-2 mt-3">
          <span class="w-8 h-8 rounded-full bg-primary-soft text-[#001F2C] flex items-center justify-center text-xs font-medium flex-none">A</span>
          <span class="text-sm flex-1 truncate">admin</span>
          <button class="text-xs text-muted hover:text-error" @click="logout">退出</button>
        </div>
      </div>
    </aside>

    <!-- 中间主区 -->
    <main class="flex-1 min-w-0 flex flex-col overflow-hidden max-[900px]:overflow-visible">
      <header class="h-16 flex-none bg-surface-container border-b border-outline-variant flex items-center px-6 gap-3">
        <nav class="flex items-center text-sm text-muted min-w-0">
          <span class="cursor-pointer hover:text-ink" @click="active = 'all'">我的文件</span>
          <template v-if="active !== 'all'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" class="mx-1 text-faint flex-none"><path d="M10 6 8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6-6-6Z" /></svg>
            <span class="text-ink font-medium truncate">{{ currentLabel }}</span>
          </template>
        </nav>
        <span class="flex-1"></span>
        <span class="text-xs text-faint font-mono mr-2 hidden sm:inline">{{ stats ? stats.files + ' 个对象' : '' }}</span>
        <button class="btn btn-text btn-sm" @click="loadStats(); loadBansCount()">刷新</button>
        <!-- Cloudreve 的「+ New」在顶栏右侧 -->
        <button class="btn btn-filled btn-sm" @click="newUpload">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z" /></svg>
          新建
        </button>
      </header>

      <div class="flex-1 overflow-y-auto px-6 py-5 max-[900px]:px-3 max-[900px]:overflow-visible">
        <FilesPanel
          v-if="isFileView"
          :filter="currentFilter"
          @select="onSelect"
          @changed="loadStats()"
          @deleted="onDeleted"
        />
        <SharesPanel v-else-if="active === 'shares'" @changed="loadStats()" />
        <LogsPanel v-else-if="active === 'logs'" />
        <BansPanel v-else-if="active === 'bans'" @changed="loadBansCount()" />
        <SettingsPanel v-else-if="active === 'settings'" />
      </div>
    </main>

    <!-- 右侧详情面板 -->
    <DetailPanel
      v-if="isFileView && selected"
      :file="selected"
      class="max-[1100px]:hidden"
      @close="selected = null"
      @deleted="onDeleted"
    />
  </div>
</template>
