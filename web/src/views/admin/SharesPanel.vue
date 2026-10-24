<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, copyText, fmtFull, type ShareItem } from '../../api';

const emit = defineEmits<{ changed: [] }>();

const shares = ref<ShareItem[]>([]);
const loading = ref(true);
const err = ref('');

async function load() {
  loading.value = true;
  err.value = '';
  const d = await api.get<{ shares: ShareItem[] }>('/api/shares');
  if (!d) err.value = '分享列表加载失败';
  else shares.value = d.shares || [];
  loading.value = false;
}

function limitText(s: ShareItem) {
  return s.max_downloads ? `${s.downloads} / ${s.max_downloads} 次` : `已下载 ${s.downloads} 次`;
}

async function del(code: string) {
  if (!confirm('删除这个分享链接？')) return;
  const d = await api.post('/api/shares/delete', { code });
  if (d) {
    load();
    emit('changed');
  }
}

async function copyDirect(code: string) {
  const d = await api.get<{ url: string }>(`/direct/${code}`);
  if (d?.url) await copyText(d.url);
}

onMounted(load);
</script>

<template>
  <section>
    <div class="flex items-center gap-3 mb-3">
      <span class="text-sm text-muted">{{ shares.length }} 条分享</span>
      <span class="flex-1"></span>
      <button class="btn btn-plain btn-sm" @click="load">刷新</button>
    </div>

    <div v-if="err" class="alert alert-error flex items-center gap-3">
      {{ err }}<button class="btn btn-plain btn-sm ml-auto" @click="load">重试</button>
    </div>
    <div v-else-if="loading" class="py-12 text-center text-faint text-sm">加载中…</div>

    <div v-else-if="!shares.length" class="card py-12 text-center">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" class="text-rule mx-auto mb-2">
        <path d="M18 16.08a2.9 2.9 0 0 0-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81a3 3 0 1 0 0 4.38l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92Z" />
      </svg>
      <div class="text-sm text-faint">还没有分享链接，到「我的文件」里点分享创建</div>
    </div>

    <div v-else class="space-y-2">
      <div v-for="s in shares" :key="s.code" class="card px-4 py-3 flex items-center gap-3 flex-wrap">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" class="text-primary flex-none">
          <path d="M18 16.08a2.9 2.9 0 0 0-1.96.77L8.91 12.7a3.3 3.3 0 0 0 0-1.4l7.05-4.11A2.99 2.99 0 1 0 15 5c0 .24.04.47.09.7L8.04 9.81a3 3 0 1 0 0 4.38l7.12 4.16c-.05.21-.08.43-.08.65a2.92 2.92 0 1 0 2.92-2.92Z" />
        </svg>
        <div class="min-w-0 flex-1">
          <div class="text-sm font-medium truncate">{{ s.name }}</div>
          <div class="flex items-center gap-2 mt-0.5 flex-wrap">
            <span class="font-mono text-xs text-muted">/s/{{ s.code }}</span>
            <span v-if="s.password_hash" class="text-[10px] bg-primary-soft text-primary rounded px-1.5 py-0.5">密码</span>
            <span class="text-xs text-faint">{{ s.expires_at ? fmtFull(s.expires_at) : '永久' }} · {{ limitText(s) }}</span>
          </div>
        </div>
        <div class="flex items-center gap-0.5">
          <button class="btn-text btn-sm" @click="copyText(s.url)">复制链接</button>
          <button class="btn-text btn-sm" @click="copyDirect(s.code)">直链</button>
          <button class="btn-danger btn-sm" @click="del(s.code)">取消</button>
        </div>
      </div>
    </div>

    <p class="text-xs text-faint mt-4">分享链接访问时按当前域名拼接，换域名不用改记录。</p>
  </section>
</template>
