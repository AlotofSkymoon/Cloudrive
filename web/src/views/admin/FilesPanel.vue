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
/* 上传任务：Cloudreve 式的任务面板，逐个显示进度 / 已传大小 / 速度 */
type TaskStatus = 'queued' | 'uploading' | 'done' | 'error';
interface UploadTask {
  id: number;
  name: string;
  size: number;
  loaded: number;
  pct: number;
  speed: number; // 字节/秒（指数滑动平均）
  status: TaskStatus;
  mode: string; // 直传 / 分片 / Worker
  error?: string;
  file: File;
  xhr?: XMLHttpRequest | null;
  _last: number;
  _lastTs: number;
}
const uploading = ref<UploadTask[]>([]);
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
// 顶栏「+ 新建」通过这里唤起
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

const MAX_CONCURRENT = 3;
let taskSeq = 0;

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** 累加已传字节，顺便算速度（对累计量做指数滑动平均） */
function advance(t: UploadTask, delta: number) {
  if (delta > 0) t.loaded = Math.min(t.size, t.loaded + delta);
  t.pct = t.size > 0 ? Math.min(100, Math.round((t.loaded / t.size) * 100)) : 0;
  const ts = now();
  const dt = (ts - t._lastTs) / 1000;
  if (dt >= 0.3) {
    const inst = (t.loaded - t._last) / dt;
    t.speed = t.speed > 0 ? t.speed * 0.7 + inst * 0.3 : inst;
    t._last = t.loaded;
    t._lastTs = ts;
  }
}

// 超过 1.5 秒没有新进度就把速度归零，避免卡住后还显示旧速度
setInterval(() => {
  const ts = now();
  for (const t of uploading.value) {
    if (t.status === 'uploading' && ts - t._lastTs > 1500) t.speed = 0;
  }
}, 1000);

function xhr(
  method: string,
  url: string,
  headers: Record<string, string>,
  blob: Blob,
  onLoaded?: (loaded: number) => void
): Promise<XMLHttpRequest> & { req: XMLHttpRequest } {
  const x = new XMLHttpRequest();
  const p: any = new Promise<XMLHttpRequest>((res, rej) => {
    x.open(method, url, true);
    for (const k in headers) x.setRequestHeader(k, headers[k]);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable && onLoaded) onLoaded(e.loaded);
    };
    x.onload = () => (x.status >= 200 && x.status < 300 ? res(x) : rej(new Error('HTTP ' + x.status)));
    x.onerror = () => rej(new Error('网络错误'));
    x.onabort = () => rej(new Error('已取消'));
    x.send(blob);
  });
  p.req = x;
  return p;
}

async function queue(list: File[]) {
  showUploader.value = true;
  const tasks = list.map<UploadTask>((f) => ({
    id: ++taskSeq,
    name: f.name,
    size: f.size,
    loaded: 0,
    pct: 0,
    speed: 0,
    status: 'queued',
    mode: '',
    file: f,
    xhr: null,
    _last: 0,
    _lastTs: now(),
  }));
  uploading.value.push(...tasks);

  // 并行跑（Cloudreve 是并行的），但同一时间最多 3 个
  let cursor = 0;
  async function worker() {
    for (;;) {
      const t = tasks[cursor++];
      if (!t) return;
      t.status = 'uploading';
      t._lastTs = now();
      try {
        await uploadOne(t);
        t.loaded = t.size || t.loaded;
        t.pct = 100;
        t.speed = 0;
        t.status = 'done';
      } catch (err: any) {
        t.error = String(err?.message || err);
        t.status = 'error';
        t.speed = 0;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(MAX_CONCURRENT, tasks.length) }, worker));
  load(true);
  emit('changed');
}

function retry(t: UploadTask) {
  t.status = 'queued';
  t.loaded = 0;
  t.pct = 0;
  t.speed = 0;
  t.error = '';
  queue([t.file]).then(() => {
    const i = uploading.value.findIndex((x) => x.id === t.id);
    if (i >= 0) uploading.value.splice(i, 1);
  });
}

function cancel(t: UploadTask) {
  t.xhr?.abort();
  const i = uploading.value.findIndex((x) => x.id === t.id);
  if (i >= 0) uploading.value.splice(i, 1);
}

async function uploadOne(t: UploadTask) {
  const file = t.file;
  const r = await api.post<any>('/api/upload/presign', {
    name: file.name,
    size: file.size,
    mime: file.type || 'application/octet-stream',
  });
  if (!r) throw new Error('获取上传凭证失败');

  if (r.mode === 'direct') {
    t.mode = '直传';
    const p = xhr('PUT', r.url, { 'content-type': file.type || 'application/octet-stream' }, file, (l) => advance(t, l));
    t.xhr = p.req;
    await p;
  } else if (r.mode === 'multipart') {
    t.mode = '分片';
    const parts = Math.ceil(file.size / r.partSize);
    const uploaded: { PartNumber: number; ETag: string }[] = [];
    // 每个分片各自记录已传字节，增量累加，避免并行时互相覆盖
    const partLoaded = new Array(parts).fill(0);
    let next = 0;
    async function partWorker() {
      for (;;) {
        const i = next++;
        if (i >= parts) return;
        const chunk = file.slice(i * r.partSize, (i + 1) * r.partSize);
        const p = xhr('PUT', r.urls[i], {}, chunk, (l) => {
          const d = l - partLoaded[i];
          partLoaded[i] = l;
          advance(t, d);
        });
        t.xhr = p.req;
        const x = await p;
        const etag = x.getResponseHeader('ETag');
        if (!etag) throw new Error('读取分片 ETag 失败，请检查存储桶 CORS 是否暴露 ETag');
        uploaded.push({ PartNumber: i + 1, ETag: etag.replace(/"/g, '') });
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, parts) }, partWorker));
    uploaded.sort((a, b) => a.PartNumber - b.PartNumber);
    await api.post('/api/upload/multipart/complete', { key: r.key, uploadId: r.uploadId, parts: uploaded, fileId: r.fileId });
  } else {
    t.mode = 'Worker';
    const p = xhr('PUT', r.url, { 'content-type': file.type || 'application/octet-stream' }, file, (l) => advance(t, l));
    t.xhr = p.req;
    await p;
    await api.post('/api/upload/confirm', { fileId: r.fileId, size: file.size });
  }
  t.xhr = null;
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

function fmtSpeed(bps: number): string {
  return fmtBytes(bps) + '/s';
}

function clearDone() {
  uploading.value = uploading.value.filter((t) => t.status !== 'done');
}

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

    <!-- 上传任务面板（Cloudreve 式：右下角，逐任务显示进度 / 已传 / 速度） -->
    <div
      v-if="showUploader"
      class="fixed right-6 bottom-6 w-[380px] bg-surface-container-lowest rounded-lg shadow-e3 z-50 overflow-hidden max-[900px]:left-3 max-[900px]:right-3 max-[900px]:w-auto"
    >
      <div class="flex items-center gap-2 px-4 h-14 border-b border-outline-variant">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" class="text-primary"><path d="M12 16l-5-5h3V4h4v7h3l-5 5Zm-7 2h14v2H5v-2Z" /></svg>
        <span class="text-sm font-medium">上传任务</span>
        <span class="text-xs text-muted font-mono">{{ uploading.length }}</span>
        <span class="flex-1"></span>
        <button class="btn btn-text !px-2 btn-sm" @click="clearDone">清除已完成</button>
        <button class="text-faint text-lg leading-none hover:text-ink px-1" @click="showUploader = false">×</button>
      </div>

      <div class="max-h-[340px] overflow-y-auto">
        <div
          v-for="t in uploading"
          :key="t.id"
          class="flex items-start gap-3 px-4 py-3 border-b border-outline-variant/40 last:border-b-0"
        >
          <span class="ext mt-0.5">{{ fileExt(t.name) }}</span>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <span class="text-[13px] truncate flex-1" :title="t.name">{{ t.name }}</span>
              <span
                v-if="t.status === 'uploading' || t.status === 'queued'"
                class="text-[10px] px-1.5 py-0.5 rounded-sm bg-secondary-container text-[#0C1C22] flex-none"
              >{{ t.status === 'queued' ? '排队中' : t.mode || '上传中' }}</span>
              <span
                v-else-if="t.status === 'done'"
                class="text-[10px] px-1.5 py-0.5 rounded-sm bg-[#C8E7FF] text-[#001F2C] flex-none"
              >已上传</span>
              <span
                v-else
                class="text-[10px] px-1.5 py-0.5 rounded-sm bg-error-container text-[#410002] flex-none"
              >失败</span>
            </div>

            <div class="h-1 bg-outline-variant rounded-full mt-2 overflow-hidden">
              <i
                class="block h-full rounded-full transition-[width] duration-200"
                :class="t.status === 'error' ? 'bg-error' : t.status === 'done' ? 'bg-primary' : 'bg-primary'"
                :style="{ width: t.pct + '%' }"
              ></i>
            </div>

            <div class="flex items-center gap-2 mt-1.5 text-[11px] text-muted font-mono">
              <span class="text-ink">{{ t.pct }}%</span>
              <span>{{ fmtBytes(t.loaded) }} / {{ fmtBytes(t.size) }}</span>
              <span v-if="t.speed > 0" class="text-primary">{{ fmtSpeed(t.speed) }}</span>
              <span class="flex-1"></span>
              <span v-if="t.status === 'error'" class="text-error truncate max-w-[120px]" :title="t.error">{{ t.error }}</span>
            </div>
          </div>

          <div class="flex-none flex items-center">
            <button
              v-if="t.status === 'error'"
              class="btn btn-text !px-2 btn-sm"
              @click="retry(t)"
            >重试</button>
            <button
              v-else-if="t.status === 'uploading' || t.status === 'queued'"
              class="text-faint hover:text-error text-sm px-1"
              @click="cancel(t)"
            >×</button>
          </div>
        </div>

        <div v-if="!uploading.length" class="px-4 py-8 text-center text-sm text-faint">暂无上传任务</div>
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
