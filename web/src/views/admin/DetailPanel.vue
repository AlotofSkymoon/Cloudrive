<script setup lang="ts">
import { ref, watch } from 'vue';
import { api, copyText, fileExt, fileKind, fmtBytes, fmtFull, isImage, type FileItem } from '../../api';

const props = defineProps<{ file: FileItem }>();
const emit = defineEmits<{ close: []; deleted: [] }>();

/* 是否宽屏——宽屏时详情面板内联在右侧，窄屏时是底部抽屉（要有遮罩） */
const inlineQuery = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(min-width: 1200px)')
  : null;
const isInline = ref(inlineQuery ? inlineQuery.matches : true);
if (inlineQuery && typeof inlineQuery.addEventListener === 'function') {
  inlineQuery.addEventListener('change', (e) => (isInline.value = e.matches));
}

const kindText = ref('');
const busy = ref(false);
const msg = ref('');
const lightbox = ref(false);

const KIND_LABEL: Record<string, string> = {
  image: '图片',
  video: '视频',
  audio: '音乐',
  doc: '文档',
  other: '文件',
};

watch(
  () => props.file?.id,
  () => {
    msg.value = '';
    const k = fileKind(props.file);
    kindText.value = KIND_LABEL[k] || '文件';
  },
  { immediate: true }
);

async function copyLink() {
  const d = await api.get<{ url: string | null; reason?: string }>(`/api/files/${props.file.id}/link`);
  if (!d) return;
  if (!d.url) {
    msg.value = d.reason === 'public_base_not_applied' ? '已填域名但未生效，重新部署一次再试' : '还没配置公网域名';
    return;
  }
  await copyText(d.url);
  msg.value = '直链已复制';
}

async function shareNow() {
  if (busy.value) return;
  busy.value = true;
  try {
    const d = await api.post<{ url: string }>('/api/shares', {
      file_id: props.file.id,
      password: '',
      expires_in: 0,
      max_downloads: 0,
    });
    if (d?.url) {
      await copyText(d.url);
      msg.value = '分享链接已复制';
    }
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!confirm(`删除「${props.file.name}」？存储对象也会一并删除`)) return;
  const d = await api.post('/api/files/delete', { ids: [props.file.id] });
  if (d) emit('deleted');
}
</script>

<template>
  <!-- 窄屏（<1200px）：底部抽屉 + 遮罩；宽屏（≥1200px）：右侧固定面板 -->
  <div
    v-if="!isInline"
    class="fixed inset-0 bg-black/40 z-[150] compact:bg-black/50"
    @click="emit('close')"
  ></div>

  <aside
    class="fixed inset-x-0 bottom-0 z-[151] flex flex-col overflow-y-auto max-h-[85vh] rounded-t-xl sheet
           inline:static inline:z-auto inline:max-h-none inline:rounded-none inline:shadow-none
           inline:w-[320px] inline:flex-none inline:h-auto
           inline:bg-surface-container-low inline:border-l inline:border-outline-variant"
  >
    <!-- 抽屉把手：只在手机上显示 -->
    <div class="flex-none flex justify-center pt-2 pb-1 inline:hidden">
      <span class="w-8 h-1 rounded-full bg-outline-variant"></span>
    </div>

    <!-- 头部 -->
    <div class="h-14 flex-none flex items-center px-4 gap-2 border-b border-outline-variant inline:h-16">
      <span class="text-sm font-medium">详细信息</span>
      <span class="flex-1"></span>
      <button class="btn btn-text btn-sm" @click="emit('close')">关闭</button>
    </div>

    <!-- 预览 -->
    <div class="p-4">
      <div class="rounded bg-surface-container overflow-hidden flex items-center justify-center aspect-square">
        <img
          v-if="isImage(file)"
          :src="`/preview/${file.id}`"
          class="w-full h-full object-contain cursor-zoom-in"
          alt=""
          @click="lightbox = true"
        />
        <span v-else class="text-3xl font-mono font-medium text-faint uppercase">{{ fileExt(file.name) }}</span>
      </div>

      <h3 class="text-sm font-medium mt-4 mb-1 break-all leading-snug">{{ file.name }}</h3>
      <div class="text-xs text-muted">{{ kindText }} · {{ fmtBytes(file.size) }}</div>
    </div>

    <!-- 元信息 -->
    <div class="px-4 pb-2">
      <div class="sec-title mb-2">属性</div>
      <div class="flex justify-between py-2 border-b border-outline-variant text-[13px]">
        <span class="text-muted">类型</span><span class="font-mono text-[12px]">{{ file.mime || '—' }}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-outline-variant text-[13px]">
        <span class="text-muted">大小</span><span class="font-mono text-[12px]">{{ fmtBytes(file.size) }}</span>
      </div>
      <div class="flex justify-between py-2 border-b border-outline-variant text-[13px]">
        <span class="text-muted">上传时间</span><span class="font-mono text-[12px]">{{ fmtFull(file.uploaded_at) }}</span>
      </div>
      <div class="flex justify-between py-2 text-[13px]">
        <span class="text-muted">对象 ID</span><span class="font-mono text-[11px] truncate ml-3">{{ file.id }}</span>
      </div>
    </div>

    <!-- 操作 -->
    <div class="px-4 py-4 mt-auto pb-safe">
      <div class="sec-title mb-2">操作</div>
      <div class="flex flex-col gap-1">
        <button class="btn btn-filled btn-block btn-sm" :disabled="busy" @click="shareNow">创建分享并复制</button>
        <button class="btn btn-outlined btn-block btn-sm" @click="copyLink">复制直链</button>
        <button class="btn btn-error btn-block btn-sm" @click="remove">删除</button>
      </div>
      <div v-if="msg" class="alert alert-info mt-3 text-[12px]">{{ msg }}</div>
    </div>

    <!-- 灯箱 -->
    <div
      v-if="lightbox"
      class="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4 cursor-zoom-out"
      @click="lightbox = false"
    >
      <img :src="`/preview/${file.id}`" class="max-w-full max-h-full rounded" alt="" />
    </div>
  </aside>
</template>
