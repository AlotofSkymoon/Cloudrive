<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, fmtBytes, type Stats } from '../api';
import FilesPanel from './admin/FilesPanel.vue';
import SharesPanel from './admin/SharesPanel.vue';
import LogsPanel from './admin/LogsPanel.vue';
import BansPanel from './admin/BansPanel.vue';
import SettingsPanel from './admin/SettingsPanel.vue';

const props = defineProps<{ boot: any }>();

const tabs = [
  { key: 'files', no: '01', label: '文件' },
  { key: 'shares', no: '02', label: '分享' },
  { key: 'logs', no: '03', label: '记录' },
  { key: 'bans', no: '04', label: '封禁' },
  { key: 'settings', no: '05', label: '设置' },
] as const;

type TabKey = (typeof tabs)[number]['key'];

const active = ref<TabKey>('files');
const stats = ref<Stats | null>(null);

async function loadStats() {
  const d = await api.get<Stats>('/api/stats');
  if (d) stats.value = d;
}

const counts = computed(() => ({
  files: stats.value?.files ?? '—',
  shares: stats.value?.shares ?? '—',
  logs: stats.value?.downloads ?? '—',
  bans: bansCount.value,
}));

const bansCount = ref<number | string>('—');
async function loadBansCount() {
  const d = await api.get<{ bans: unknown[] }>('/api/bans');
  if (d) bansCount.value = (d.bans || []).length;
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

const title = computed(() => tabs.find((t) => t.key === active.value)?.label || '');

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
  <div>
    <div class="flex min-h-[calc(100vh-34px)] max-w-[1240px] mx-auto max-[860px]:block">
      <!-- 侧栏 -->
      <aside
        class="w-[208px] flex-none px-[18px] pb-[18px] pt-[22px] border-r border-rule flex flex-col sticky top-0 h-[calc(100vh-34px)] max-[860px]:w-auto max-[860px]:border-r-0 max-[860px]:border-b max-[860px]:px-4 max-[860px]:pt-4 max-[860px]:static max-[860px]:h-auto"
      >
        <div class="flex items-baseline gap-[7px] mb-[2px]">
          <h1 class="font-serif text-[21px] font-semibold tracking-tight m-0">Filecove</h1>
          <span class="font-mono text-[9.5px] text-faint tracking-[0.08em]">v{{ boot.version }}</span>
        </div>
        <div class="font-mono text-[10px] text-faint tracking-[0.04em] mb-[26px] max-[860px]:mb-[14px]">
          {{ boot.driver }} · {{ boot.bucket }} · 直链
        </div>

        <nav class="flex flex-col gap-px -mx-2 max-[860px]:flex-row max-[860px]:gap-0 max-[860px]:-mx-1.5 max-[860px]:overflow-x-auto">
          <button
            v-for="t in tabs"
            :key="t.key"
            class="flex items-center gap-2.5 py-[7px] pr-2 pl-2.5 text-[13px] text-muted text-left border-l-2 border-transparent hover:text-ink hover:bg-ink/[0.035] max-[860px]:border-l-0 max-[860px]:border-b-2 max-[860px]:px-2.5 max-[860px]:whitespace-nowrap"
            :class="active === t.key ? 'text-ink border-l-accent bg-ink/[0.045] font-semibold max-[860px]:border-l-0 max-[860px]:border-b-accent max-[860px]:bg-transparent' : ''"
            @click="active = t.key"
          >
            <span class="font-mono text-[9.5px] text-faint tracking-[0.06em] w-[15px] flex-none" :class="active === t.key ? 'text-accent' : ''">{{ t.no }}</span>
            {{ t.label }}
            <span v-if="t.key !== 'settings'" class="ml-auto font-mono text-[10px] text-faint max-[860px]:hidden">{{ counts[t.key] }}</span>
          </button>
        </nav>

        <div class="mt-auto pt-4 border-t border-[#e8e3d8] max-[860px]:flex max-[860px]:items-center max-[860px]:gap-3 max-[860px]:py-2.5 max-[860px]:mt-0">
          <div class="max-[860px]:flex-1 max-[860px]:min-w-[80px]">
            <div class="flex justify-between font-mono text-[9.5px] text-faint tracking-[0.05em] mb-1.5">
              <span>已用</span><span>{{ usageText }}</span>
            </div>
            <div class="h-[3px] bg-rule relative overflow-hidden">
              <i class="absolute inset-y-0 left-0 bg-accent transition-[width] duration-300" :style="{ width: usedPct + '%' }"></i>
            </div>
          </div>
          <div class="flex items-center gap-[7px] mt-4 text-[11.5px] text-muted max-[860px]:mt-0">
            <span class="w-[5px] h-[5px] bg-accent flex-none"></span>admin
            <button class="ml-auto text-[11.5px] text-muted underline decoration-rule underline-offset-2 hover:text-danger" @click="logout">退出</button>
          </div>
        </div>
      </aside>

      <!-- 主区 -->
      <main class="flex-1 min-w-0 px-[30px] pb-[30px] pt-6 max-[860px]:px-4 max-[860px]:pb-6">
        <div class="flex items-end gap-3 pb-[13px] border-b border-ink">
          <h2 class="text-[19px] font-semibold tracking-tight m-0 max-[860px]:text-[17px]">{{ title }}</h2>
          <span class="font-mono text-[10.5px] text-faint tracking-[0.04em] pb-[2px] max-[860px]:hidden">
            {{ stats ? stats.files + ' 个对象 · ' + fmtBytes(stats.bytes) : '—' }}
          </span>
          <span class="flex-1"></span>
          <div class="flex gap-2 items-center">
            <button class="btn" @click="loadStats()">刷新用量</button>
          </div>
        </div>

        <FilesPanel v-if="active === 'files'" @changed="loadStats()" />
        <SharesPanel v-else-if="active === 'shares'" @changed="loadStats()" />
        <LogsPanel v-else-if="active === 'logs'" />
        <BansPanel v-else-if="active === 'bans'" @changed="loadBansCount()" />
        <SettingsPanel v-else-if="active === 'settings'" />
      </main>
    </div>

    <!-- 状态栏 -->
    <div
      class="fixed left-0 right-0 bottom-0 h-[34px] bg-surface border-t border-rule flex items-center font-mono text-[10px] text-muted tracking-[0.03em] px-[14px] z-20"
    >
      <div class="flex items-center gap-1.5 pr-3 border-r border-[#e8e3d8] h-full">
        <span class="w-[5px] h-[5px] bg-accent"></span>{{ boot.driver }} · {{ boot.bucket }}
      </div>
      <div class="pr-3 border-r border-[#e8e3d8] h-full flex items-center">直链 —</div>
      <div class="pr-3 border-r border-[#e8e3d8] h-full flex items-center max-[860px]:hidden">D1 ok</div>
      <div class="flex-1"></div>
      <div class="flex items-center">v{{ boot.version }}</div>
    </div>
  </div>
</template>
