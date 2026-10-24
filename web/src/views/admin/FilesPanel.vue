<script setup lang="ts">
import { computed, inject, onMounted, ref } from 'vue';
import { api, copyText, fileExt, fileKind, fmtBytes, fmtShort, isImage, type FileItem } from '../../api';

const props = defineProps<{ filter?: string }>();
const emit = defineEmits<{ changed: []; select: [file: FileItem | null]; deleted: [] }>();

const files = ref<FileItem[]>([]);
const selectId = ref('');
const q = ref('');
const loading = ref(true);
const loadErr = ref('');
const offset = ref(0);
const sel = ref<Record<number, boolean>>({});
const uploading = ref<{ name: string; pct: number }[]>([]);
const showUploader = ref(false);
const picker = ref<HTMLInputElement | null>(null);
const dropOn = ref(false);
// Cloudreve 支持列表 / 网格两种视图，默认网格
const view = ref<'grid' | 'list'>('grid');
const searchFocus = ref(false);

async function load(reset = true, retry = false) {
  if (reset) offset.value = 0;
  loading.value = true;
  loadErr.value = '';
  try {
    let u = '/api/files?limit=100';
    if (q.value) u += '&q=' + encodeURIComponent(q.value);
    if (offset.value) u += '&offset=' + offset.value;
    const d = await api.get<{ files: FileItem[]; next: number }>(u);
    if (!d) {
      // D1 冷启动偶尔慢一下，先自动重试再报错
      if (!retry) {
        await new Promise((r) => setTimeout(r, 600));
        return load(reset, true);
      }
      loadErr.value = '文件列表加载失败';
      return;
    }
    files.value = (reset ? [] : files.value).concat(d.files || []);
    offset.value = d.next || 0;
    sel.value = {};
  } finally {
    loading.value = false;
  }
}

let timer: any;
function onSearch() {
  clearTimeout(timer);
  timer = setTimeout(() => load(true), 280);
}

async function syncBucket() {
  if (!confirm('扫描存储桶，把里面已有但没登记的文件加入列表？')) return;
  const d = await api.post<{ scanned: number; added: number }>('/api/sync', {});
  if (d) {
    alert(`扫描 ${d.scanned} 个对象，新增 ${d.added} 条`);
    load(true);
    emit('changed');
  }
}

// 左侧「图片 / 视频 / 音乐 / 文档」在这里生效
const filtered = computed(() => {
  if (!props.filter || props.filter === 'all') return files.value;
  return files.value.filter((f) => fileKind(f) === props.filter);
});

function selectFile(f: FileItem) {
  selectId.value = f.id;
  emit('select', f);
}

const selectedCount = () => Object.values(sel.value).filter(Boolean).length;

async function delFile(id: string) {
  if (!confirm('删除该文件？存储对象也会一并删除')) return;
  const d = await api.post('/api/files/delete', { ids: [id] });
  if (d) {
    load(true);
    emit('changed');
    emit('deleted');
  }
}
async function delSelected() {
  // sel 的索引基于 filtered（当前显示的那一份），不是 files
  const ids = filtered.value.filter((_, i) => sel.value[i]).map((f) => f.id);
  if (!ids.length) return;
  if (!confirm(`删除所选 ${ids.length} 个文件？`)) return;
  const d = await api.post('/api/files/delete', { ids });
  if (d) {
    load(true);
    emit('changed');
    emit('deleted');
  }
}
async function copyLink(f: FileItem) {
  const d = await api.get<{ url: string | null; reason?: string }>(`/api/files/${f.id}/link`);
  if (!d) return;
  if (!d.url) {
    alert(d.reason === 'public_base_not_applied' ? '已填了域名但没生效，重新部署一次' : '还没配置公网域名');
    return;
  }
  await copyText(d.url);
}

/* ---------- 上传 ---------- */
function pick() {
  picker.value?.click();
}
// 侧边栏「+ 新建」通过这里唤起
const registerPicker = inject<(fn: () => void) => void>('registerPicker', () => {});
onMounted(() => registerPicker(pick));

function onPick(e: Event) {
  const input = e.target as HTMLInputElement;
  if (input.files) queue(Array.from(input.files));
  input.value = '';
}
function onDrop(e: DragEvent) {
  dropOn.value = false;
  if (e.dataTransfer?.files) queue(Array.from(e.dataTransfer.files));
}

let busy = false;
async function queue(list: File[]) {
  if (busy) return;
  busy = true;
  showUploader.value = true;
  try {
    for (const f of list) {
      const idx = uploading.value.length;
      uploading.value.push({ name: f.name, pct: 0 });
      try {
        await uploadOne(f, idx);
        uploading.value[idx].pct = 100;
      } catch (err: any) {
        alert('上传失败：' + (err?.message || err));
      }
    }
  } finally {
    busy = false;
    load(true);
    emit('changed');
  }
}

function xhr(method: string, url: string, headers: Record<string, string>, blob: Blob, onProg?: (p: number) => void) {
  return new Promise<XMLHttpRequest>((res, rej) => {
    const x = new XMLHttpRequest();
    x.open(method, url, true);
    for (const k in headers) x.setRequestHeader(k, headers[k]);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && onProg) onProg(e.loaded / e.total);
    };
    x.onload = () => (x.status >= 200 && x.status < 300 ? res(x) : rej(new Error('HTTP ' + x.status)));
    x.onerror = () => rej(new Error('网络错误'));
    x.send(blob);
  });
}

async function uploadOne(file: File, idx: number) {
  const setPct = (p: number) => (uploading.value[idx].pct = Math.round(p));
  const r = await api.post<any>('/api/upload/presign', {
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
  });
  if (!r) throw new Error('获取上传凭证失败');

  if (r.mode === 'direct') {
    await xhr('PUT', r.url, { 'content-type': file.type || 'application/octet-stream' }, file, (p) => setPct(p * 100));
  } else if (r.mode === 'multipart') {
    const parts = Math.ceil(file.size / r.partSize);
    const uploaded: { PartNumber: number; ETag: string }[] = [];
    let next = 0;
    async function worker() {
      for (;;) {
        const i = next++;
        if (i >= parts) return;
        const chunk = file.slice(i * r.partSize, (i + 1) * r.partSize);
        const x = await xhr('PUT', r.urls[i], {}, chunk);
        const etag = x.getResponseHeader('ETag');
        if (!etag) throw new Error('读取分片 ETag 失败，请检查存储桶 CORS 是否暴露 ETag');
        uploaded.push({ PartNumber: i + 1, ETag: etag.replace(/"/g, '') });
        setPct(Math.min(98, (uploaded.length / parts) * 100));
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, parts) }, worker));
    uploaded.sort((a, b) => a.PartNumber - b.PartNumber);
    await api.post('/api/upload/multipart/complete', { key: r.key, uploadId: r.uploadId, parts: uploaded, fileId: r.fileId });
  } else {
    await xhr('PUT', r.url, { 'content-type': file.type || 'application/octet-stream' }, file, (p) => setPct(p * 100));
    await api.post('/api/upload/confirm', { fileId: r.fileId, size: file.size });
  }
}

/* ---------- 分享弹窗 ---------- */
const shareIdx = ref<number | null>(null);
const sharePwd = ref('');
const shareExp = ref('0');
const shareMax = ref('0');
const shareLink = ref('');

function openShare(i: number) {
  shareIdx.value = i;
  sharePwd.value = '';
  shareExp.value = '0';
  shareMax.value = '0';
  shareLink.value = '';
}
async function createShare() {
  const i = shareIdx.value;
  if (i == null) return;
  const f = filtered.value[i];
  const d = await api.post<{ url: string; code: string }>('/api/shares', {
    file_id: f.id,
    password: sharePwd.value,
    expires_in: Number(shareExp.value),
    max_downloads: Number(shareMax.value) || 0,
  });
  if (d) shareLink.value = d.url;
}
async function copyDirect(code: string) {
  const d = await api.get<{ url: string }>(`/direct/${code}`);
  if (d?.url) await copyText(d.url);
}

/* 缩略图失败先重试一次，再退回后缀标签 */
function thumbFail(el: Event) {
  const img = el.target as HTMLImageElement;
  if (!img || !img.parentElement) return;
  if (!img.dataset.retried) {
    img.dataset.retried = '1';
    setTimeout(() => (img.src = `/preview/${img.dataset.id}?r=` + Date.now()), 400);
    return;
  }
  const span = document.createElement('span');
  span.className = 'ext';
  span.textContent = fileExt(files.value.find((f) => f.id === img.dataset.id)?.name || '');
  img.parentElement.replaceChild(span, img);
}

const lightbox = ref<string | null>(null);

onMounted(() => load(true));
</script>

<template>
  <section>
    <!-- 工具栏：搜索 + 视图切换 -->
    <div class="flex items-center gap-3 mb-3 flex-wrap">
      <div
        class="flex items-center gap-2 h-9 px-3 rounded border bg-surface flex-1 min-w-[180px] max-w-[320px] transition-colors"
        :class="searchFocus ? 'border-primary' : 'border-rule'"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" class="text-faint flex-none">
          <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5Zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9Z" />
        </svg>
        <input
          v-model="q"
          placeholder="搜索文件"
          class="border-0 outline-none bg-transparent w-full text-sm"
          @input="onSearch"
          @focus="searchFocus = true"
          @blur="searchFocus = false"
        />
      </div>

      <span class="flex-1"></span>

      <div class="flex items-center gap-1 bg-soft rounded border border-rule p-0.5">
        <button
          class="w-8 h-7 flex items-center justify-center rounded"
          :class="view === 'grid' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink'"
          title="网格视图"
          @click="view = 'grid'"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 0h8v8h-8v-8Z" /></svg>
        </button>
        <button
          class="w-8 h-7 flex items-center justify-center rounded"
          :class="view === 'list' ? 'bg-surface text-primary shadow-sm' : 'text-muted hover:text-ink'"
          title="列表视图"
          @click="view = 'list'"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h2v2H3V5Zm0 6h2v2H3v-2Zm0 6h2v2H3v-2Zm4-12h14v2H7V5Zm0 6h14v2H7v-2Zm0 6h14v2H7v-2Z" /></svg>
        </button>
      </div>

      <button class="btn btn-outlined btn-sm" @click="syncBucket">同步桶内</button>
      <button v-if="selectedCount()" class="btn btn-error btn-sm" @click="delSelected">删除 ({{ selectedCount() }})</button>
    </div>

    <!-- 上传区（Cloudreve 式拖拽区） -->
    <div
      class="rounded-lg border-2 border-dashed px-4 py-6 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-sm text-muted transition-colors mb-3"
      :class="dropOn ? 'border-primary bg-primary-soft text-primary' : 'border-rule hover:border-faint hover:bg-soft'"
      @click="pick"
      @dragenter.prevent="dropOn = true"
      @dragover.prevent="dropOn = true"
      @dragleave.prevent="dropOn = false"
      @drop.prevent="onDrop"
    >
      <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="opacity-40">
        <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.63 4.04A5.996 5.996 0 0 0 6 20h13a4.99 4.99 0 0 0 .35-9.96ZM14 13v4h-4v-4H7l5-5 5 5h-3Z" />
      </svg>
      <span>拖拽文件至此，或<span class="text-primary">点击上传</span></span>
      <span class="text-xs text-faint">超过 100 MB 自动分片 · 支持多选</span>
    </div>
    <input ref="picker" type="file" multiple hidden @change="onPick" />

    <div v-if="loadErr" class="alert alert-error mb-3 flex items-center gap-3">
      {{ loadErr }}
      <button class="btn btn-outlined btn-sm ml-auto" @click="load(true)">重试</button>
    </div>
    <div v-else-if="loading && !files.length" class="py-12 text-center text-faint text-sm">加载中…</div>

    <!-- 空状态 -->
    <div v-else-if="!filtered.length" class="py-12 text-center">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" class="text-rule mx-auto mb-2">
        <path d="M10 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-8l-2-2Z" />
      </svg>
      <div class="text-sm text-faint">{{ files.length ? '这个分类下没有文件' : '还没有文件，把文件拖到上面即可上传' }}</div>
    </div>

    <!-- 网格视图 -->
    <div
      v-else-if="view === 'grid'"
      class="grid gap-3"
      style="grid-template-columns: repeat(auto-fill, minmax(140px, 1fr))"
    >
      <div
        v-for="(f, i) in filtered"
        :key="f.id"
        class="card p-2 cursor-pointer relative group transition-shadow hover:shadow-e2"
        :class="selectId === f.id ? 'ring-2 ring-primary' : ''"
        @click.self="selectFile(f)"
      >
        <!-- 多选 -->
        <span
          class="absolute top-2 left-2 w-5 h-5 rounded border-2 border-white flex items-center justify-center z-10 shadow"
          :class="sel[i] ? 'bg-primary border-primary' : 'bg-black/20 border-white'"
          @click.stop="sel[i] = !sel[i]"
        >
          <svg v-if="sel[i]" width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" /></svg>
        </span>

        <!-- 缩略图 -->
        <div class="aspect-square bg-canvas rounded flex items-center justify-center overflow-hidden mb-2">
          <img
            v-if="isImage(f)"
            class="w-full h-full object-cover cursor-zoom-in"
            :src="`/preview/${f.id}`"
            :data-id="f.id"
            loading="lazy"
            alt=""
            @error="thumbFail"
            @click.stop="lightbox = f.id"
          />
          <span v-else class="text-2xl font-mono font-medium text-faint uppercase">{{ fileExt(f.name) }}</span>
        </div>

        <div class="px-1 pb-1">
          <div class="text-[13px] truncate font-medium" :title="f.name">{{ f.name }}</div>
          <div class="text-xs text-faint mt-0.5">{{ fmtBytes(f.size) }}</div>
        </div>

        <!-- 悬浮操作 -->
        <div class="flex items-center gap-1 px-1 pb-1">
          <button class="btn-text !px-1.5 !h-7 !text-xs flex-1" @click.stop="openShare(i)">分享</button>
          <button class="btn-text !px-1.5 !h-7 !text-xs flex-1" @click.stop="copyLink(f)">直链</button>
          <button class="btn-error !px-1.5 !h-7 !text-xs flex-1" @click.stop="delFile(f.id)">删除</button>
        </div>
      </div>
    </div>

    <!-- 列表视图 -->
    <div v-else class="card overflow-hidden">
      <table>
        <thead>
          <tr>
            <th class="w-10"></th>
            <th class="w-12"></th>
            <th>文件名</th>
            <th class="text-right w-24">大小</th>
            <th class="text-right w-36">上传时间</th>
            <th class="text-right w-32">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(f, i) in filtered" :key="f.id" :class="selectId === f.id ? 'bg-primary-soft' : ''" @click="selectFile(f)">
            <td>
              <span
                class="w-4 h-4 border-2 border-faint rounded inline-flex items-center justify-center align-middle cursor-pointer"
                :class="sel[i] ? 'bg-primary border-primary' : ''"
                @click="sel[i] = !sel[i]"
              >
                <svg v-if="sel[i]" width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" /></svg>
              </span>
            </td>
            <td>
              <img
                v-if="isImage(f)"
                class="w-8 h-8 rounded object-cover cursor-zoom-in"
                :src="`/preview/${f.id}`"
                :data-id="f.id"
                loading="lazy"
                alt=""
                @error="thumbFail"
                @click="lightbox = f.id"
              />
              <span v-else class="ext">{{ fileExt(f.name) }}</span>
            </td>
            <td><div class="truncate max-w-[280px]" :title="f.name">{{ f.name }}</div></td>
            <td class="text-right"><span class="num">{{ fmtBytes(f.size) }}</span></td>
            <td class="text-right"><span class="time">{{ fmtShort(f.uploaded_at) }}</span></td>
            <td>
              <div class="flex items-center justify-end gap-0.5">
                <button class="btn-text !px-2 !h-7 !text-xs" @click="openShare(i)">分享</button>
                <button class="btn-text !px-2 !h-7 !text-xs" @click="copyLink(f)">直链</button>
                <button class="btn-error !px-2 !h-7 !text-xs" @click="delFile(f.id)">删除</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="offset" class="mt-4 text-center"><button class="btn btn-outlined btn-sm" @click="load(false)">加载更多</button></div>

    <!-- 上传队列 -->
    <div v-if="showUploader" class="fixed right-5 bottom-5 w-80 bg-surface rounded-lg border border-rule shadow-e3 z-50 max-[860px]:left-3 max-[860px]:right-3 max-[860px]:w-auto">
      <div class="flex items-center gap-2 px-4 h-11 border-b border-rule text-sm font-medium">
        <span>上传队列</span>
        <span class="text-xs text-faint font-mono">{{ uploading.length }}</span>
        <span class="flex-1"></span>
        <button class="text-faint text-xs hover:text-ink" @click="showUploader = false">收起</button>
      </div>
      <div class="max-h-64 overflow-y-auto">
        <div v-for="(t, i) in uploading" :key="i" class="flex items-center gap-3 px-4 py-2.5 border-b border-outline-variant/40 last:border-b-0">
          <span class="ext">{{ fileExt(t.name) }}</span>
          <div class="flex-1 min-w-0">
            <div class="text-[13px] truncate">{{ t.name }}</div>
            <div class="h-1 bg-rule rounded-full mt-1.5 overflow-hidden">
              <i class="block h-full bg-primary rounded-full transition-[width]" :style="{ width: t.pct + '%' }"></i>
            </div>
          </div>
          <span class="text-[11px] text-faint font-mono w-10 text-right">{{ t.pct >= 100 ? '完成' : t.pct + '%' }}</span>
        </div>
      </div>
    </div>

    <!-- 分享弹窗 -->
    <div v-if="shareIdx !== null" class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-[60]" @click.self="shareIdx = null">
      <div class="bg-surface rounded-lg w-full max-w-[420px] shadow-e3">
        <div class="px-5 h-14 flex items-center gap-2 border-b border-rule">
          <h3 class="text-base font-medium m-0">{{ shareLink ? '分享已创建' : '创建分享' }}</h3>
          <button class="ml-auto text-faint text-xl leading-none hover:text-ink" @click="shareIdx = null">×</button>
        </div>

        <div v-if="!shareLink" class="p-5">
          <div class="flex items-center gap-3 mb-3">
            <label class="w-16 flex-none text-sm text-muted">文件</label>
            <div class="flex-1 min-w-0 truncate text-sm">{{ filtered[shareIdx].name }}</div>
          </div>
          <div class="flex items-center gap-3 mb-3">
            <label class="w-16 flex-none text-sm text-muted">有效期</label>
            <select v-model="shareExp" class="input">
              <option value="0">永久</option>
              <option value="3600">1 小时</option>
              <option value="86400">1 天</option>
              <option value="604800">7 天</option>
              <option value="2592000">30 天</option>
            </select>
          </div>
          <div class="flex items-center gap-3 mb-3">
            <label class="w-16 flex-none text-sm text-muted">密码</label>
            <input v-model="sharePwd" placeholder="可选" class="input" />
          </div>
          <div class="flex items-center gap-3">
            <label class="w-16 flex-none text-sm text-muted">次数</label>
            <input v-model="shareMax" type="number" min="0" class="input" />
            <span class="unit">0 为不限</span>
          </div>
        </div>

        <div v-else class="p-5">
          <div class="sec-title mb-1.5">分享链接</div>
          <div class="flex rounded border border-rule overflow-hidden mb-3">
            <input :value="shareLink" readonly class="border-0 flex-1 font-mono text-xs px-3 py-2 outline-none bg-transparent min-w-0" />
            <button class="border-l border-rule px-3 text-xs text-primary hover:bg-primary-soft" @click="copyText(shareLink)">复制</button>
          </div>
          <div class="sec-title mb-1.5">直链</div>
          <div class="flex rounded border border-rule overflow-hidden">
            <input :value="shareLink" readonly class="border-0 flex-1 font-mono text-xs px-3 py-2 outline-none bg-transparent min-w-0" />
            <button class="border-l border-rule px-3 text-xs text-primary hover:bg-primary-soft" @click="copyDirect(shareLink.split('/s/')[1])">取直链</button>
          </div>
        </div>

        <div class="px-5 h-14 border-t border-rule flex items-center justify-end gap-2 bg-soft rounded-b-lg">
          <button class="btn btn-outlined" @click="shareIdx = null">{{ shareLink ? '关闭' : '取消' }}</button>
          <button v-if="!shareLink" class="btn btn-filled" @click="createShare">创建</button>
        </div>
      </div>
    </div>

    <!-- 灯箱 -->
    <div v-if="lightbox" class="fixed inset-0 bg-black/90 flex items-center justify-center z-[120] p-4 cursor-zoom-out" @click="lightbox = null">
      <img :src="`/preview/${lightbox}`" class="max-w-full max-h-full rounded" alt="" />
    </div>
  </section>
</template>
