<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, fmtFull, type BanItem } from '../../api';

const emit = defineEmits<{ changed: [] }>();

const bans = ref<BanItem[]>([]);
const loading = ref(true);
const err = ref('');
const cfg = ref<{ banMinutes: number }>({ banMinutes: 60 });

async function load() {
  loading.value = true;
  err.value = '';
  const d = await api.get<{ bans: BanItem[] }>('/api/bans');
  if (!d) err.value = '封禁列表加载失败';
  else bans.value = d.bans || [];
  loading.value = false;
  emit('changed');

  const c = await api.get<any>('/api/config');
  if (c?.config) cfg.value = { banMinutes: c.config.banMinutes };
}

async function unban(ip: string) {
  const d = await api.post('/api/bans/unban', { ip });
  if (d) load();
}

async function addBan() {
  const ip = prompt('要封禁的 IP：');
  if (!ip) return;
  const m = prompt(`封禁 ${ip.trim()} 多少分钟？`, String(cfg.value.banMinutes || 60));
  if (!m) return;
  const d = await api.post('/api/bans', { ip: ip.trim(), minutes: Number(m) || 60, reason: '管理员手动封禁' });
  if (d) load();
}

function sourceOf(b: BanItem) {
  return (b.reason || '').includes('管理员') ? '手动' : '自动';
}

onMounted(load);
</script>

<template>
  <section>
    <div class="flex items-center gap-3 mb-3">
      <span class="text-sm text-muted">{{ bans.length }} 个 IP 处于封禁中</span>
      <span class="flex-1"></span>
      <button class="btn btn-primary btn-sm" @click="addBan">手动封禁</button>
    </div>

    <div v-if="err" class="alert alert-error flex items-center gap-3">
      {{ err }}<button class="btn btn-plain btn-sm ml-auto" @click="load">重试</button>
    </div>
    <div v-else-if="loading" class="py-12 text-center text-faint text-sm">加载中…</div>

    <div v-else-if="!bans.length" class="card py-12 text-center text-sm text-faint">当前没有封禁记录</div>

    <div v-else class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th class="w-40">IP</th>
            <th class="w-20">来源</th>
            <th>原因</th>
            <th class="w-40">解除时间</th>
            <th class="text-right w-20">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in bans" :key="b.ip">
            <td><span class="num">{{ b.ip }}</span></td>
            <td>
              <span
                class="text-[10px] rounded px-1.5 py-0.5"
                :class="sourceOf(b) === '手动' ? 'bg-primary-soft text-primary' : 'bg-[#f0f0f0] text-muted'"
              >{{ sourceOf(b) }}</span>
            </td>
            <td class="text-muted">{{ b.reason || '—' }}</td>
            <td><span class="time">{{ fmtFull(b.until) }}</span></td>
            <td class="text-right"><button class="btn-text btn-sm" @click="unban(b.ip)">解封</button></td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-xs text-faint mt-4">封禁由限流自动触发，也可以在下载记录里手动封禁。解封立即生效。</p>
  </section>
</template>
