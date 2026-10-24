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
    <div class="flex items-center gap-2.5 py-2.5 border-b border-[#e8e3d8]">
      <div class="flex items-center gap-[7px] flex-1 max-w-[340px] border-b border-rule pb-1">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" class="text-faint flex-none">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <input v-model="q" placeholder="按 IP 或文件名筛选" class="border-0 outline-none bg-transparent w-full text-[12.5px]" />
      </div>
      <span class="flex-1"></span>
      <span class="font-mono text-[10.5px] text-muted tracking-[0.03em]">最近 {{ filtered.length }} 条</span>
    </div>

    <div v-if="err" class="border border-[#e3cfc9] bg-[#fbf1ee] text-[#8a2c19] px-3 py-2.5 text-xs mt-3 flex items-center gap-3">
      {{ err }}<button class="btn btn-sm ml-auto" @click="load">重试</button>
    </div>
    <div v-else-if="loading" class="py-10 text-faint text-[12.5px]">加载中…</div>
    <div v-else-if="!filtered.length" class="py-10 text-faint text-[12.5px]">暂无记录</div>

    <table v-else class="w-full border-collapse">
      <thead>
        <tr>
          <th class="w-[140px]">时间</th>
          <th class="w-[140px]">IP</th>
          <th class="w-[70px]">地区</th>
          <th>动作</th>
          <th class="text-right w-[80px]">大小</th>
          <th class="text-right w-[60px]">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(l, i) in filtered" :key="i" class="hover:bg-[#efede4]">
          <td><span class="time">{{ fmtFull(l.ts) }}</span></td>
          <td><span class="num">{{ l.ip }}</span></td>
          <td><span class="mono">{{ l.country || '—' }}</span></td>
          <td>{{ l.action === 'download' ? '下载' : l.action || '访问' }} · {{ l.name || l.code || '' }}</td>
          <td class="text-right"><span class="num">{{ l.bytes ? fmtBytes(l.bytes) : '—' }}</span></td>
          <td class="text-right">
            <div class="flex justify-end"><button class="text-muted hover:text-danger hover:underline underline-offset-2 text-[11.5px]" @click="ban(l.ip)">封</button></div>
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
