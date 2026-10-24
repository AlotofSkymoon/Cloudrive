<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api, fmtBytes, fmtFull, type LogItem } from '../../api';

const logs = ref<LogItem[]>([]);
const q = ref('');
const loading = ref(true);
const err = ref('');
const cfg = ref<{ banMinutes: number }>({ banMinutes: 60 });

async function load() {
  loading.value = true;
  err.value = '';
  const d = await api.get<{ logs: LogItem[] }>('/api/logs');
  if (!d) err.value = '下载记录加载失败';
  else logs.value = d.logs || [];
  loading.value = false;

  const c = await api.get<any>('/api/config');
  if (c?.config) cfg.value = { banMinutes: c.config.banMinutes };
}

const filtered = computed(() => {
  const kw = q.value.trim().toLowerCase();
  if (!kw) return logs.value;
  return logs.value.filter(
    (l) => String(l.ip || '').toLowerCase().includes(kw) || String(l.name || l.code || '').toLowerCase().includes(kw)
  );
});

async function ban(ip: string) {
  const m = prompt(`封禁 ${ip} 多少分钟？`, String(cfg.value.banMinutes || 60));
  if (!m) return;
  const d = await api.post('/api/bans', { ip, minutes: Number(m) || 60, reason: '管理员手动封禁' });
  if (d) alert('已封禁');
}

onMounted(load);
</script>

<template>
  <section>
    <div class="flex items-center gap-3 mb-3">
      <div class="flex items-center gap-2 h-9 px-3 rounded border border-rule bg-surface flex-1 max-w-[320px]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="text-faint flex-none">
          <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" />
        </svg>
        <input v-model="q" placeholder="按 IP 或文件名筛选" class="border-0 outline-none bg-transparent w-full text-sm" />
      </div>
      <span class="flex-1"></span>
      <span class="text-sm text-muted">最近 {{ filtered.length }} 条</span>
    </div>

    <div v-if="err" class="alert alert-error flex items-center gap-3">
      {{ err }}<button class="btn btn-outlined btn-sm ml-auto" @click="load">重试</button>
    </div>
    <div v-else-if="loading" class="py-12 text-center text-faint text-sm">加载中…</div>

    <div v-else-if="!filtered.length" class="card py-12 text-center text-sm text-faint">暂无记录</div>

    <div v-else class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th class="w-40">时间</th>
            <th class="w-36">IP</th>
            <th class="w-20">地区</th>
            <th>动作</th>
            <th class="text-right w-24">大小</th>
            <th class="text-right w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(l, i) in filtered" :key="i">
            <td><span class="time">{{ fmtFull(l.ts) }}</span></td>
            <td><span class="num">{{ l.ip }}</span></td>
            <td><span class="mono">{{ l.country || '—' }}</span></td>
            <td class="truncate max-w-[240px]">{{ l.action === 'download' ? '下载' : l.action || '访问' }} · {{ l.name || l.code || '' }}</td>
            <td class="text-right"><span class="num">{{ l.bytes ? fmtBytes(l.bytes) : '—' }}</span></td>
            <td class="text-right"><button class="btn-error btn-sm" @click="ban(l.ip)">封禁</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
