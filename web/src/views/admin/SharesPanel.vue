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
  if (!d) {
    err.value = '分享列表加载失败';
  } else {
    shares.value = d.shares || [];
  }
  loading.value = false;
}

function limitText(s: ShareItem) {
  return s.max_downloads ? `${s.downloads} / ${s.max_downloads} 次` : `已下载 ${s.downloads}`;
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
    <div class="flex items-center gap-2.5 py-2.5 border-b border-[#e8e3d8]">
      <span class="font-mono text-[10.5px] text-muted tracking-[0.03em]">{{ shares.length }} 条分享</span>
      <span class="flex-1"></span>
      <button class="btn btn-sm" @click="load">刷新</button>
    </div>

    <div v-if="err" class="border border-[#e3cfc9] bg-[#fbf1ee] text-[#8a2c19] px-3 py-2.5 text-xs mt-3 flex items-center gap-3">
      {{ err }}<button class="btn btn-sm ml-auto" @click="load">重试</button>
    </div>
    <div v-else-if="loading" class="py-10 text-faint text-[12.5px]">加载中…</div>
    <div v-else-if="!shares.length" class="py-10 text-faint text-[12.5px]">还没有分享链接，到文件页点「分享」创建</div>

    <div
      v-for="s in shares"
      :key="s.code"
      class="border border-rule bg-surface px-[14px] py-[13px] mt-2.5 flex items-center gap-3.5 flex-wrap"
    >
      <span class="font-mono text-[13px] tracking-[0.06em] text-ink border-b border-rule pb-[1px]">/s/{{ s.code }}</span>
      <span class="font-mono text-[10px] text-faint tracking-[0.03em]">{{ s.name }}<span v-if="s.password_hash"> · 密码</span></span>
      <span class="flex-1"></span>
      <span class="font-mono text-[10px] text-faint tracking-[0.03em]">
        {{ s.expires_at ? fmtFull(s.expires_at) : '永久' }} · {{ limitText(s) }}
      </span>
      <button class="linkbtn" @click="copyText(s.url)">复制</button>
      <button class="linkbtn text-ink/80" @click="copyDirect(s.code)">直链</button>
      <button class="linkbtn !text-danger" @click="del(s.code)">取消</button>
    </div>

    <p class="text-faint text-[12.5px] pt-[26px]">分享链接访问时按当前域名拼接，换域名不用改记录。</p>
  </section>
</template>
