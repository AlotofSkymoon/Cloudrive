<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, copyText, fileExt, fmtBytes, fmtShort, isImage, type FileItem } from '../../api';

const emit = defineEmits<{ changed: [] }>();

const files = ref<FileItem[]>([]);
const q = ref('');
const loading = ref(true);
const loadErr = ref('');
const offset = ref(0);
const sel = ref<Record<number, boolean>>({});
const uploading = ref<{ name: string; pct: number }[]>([]);
const showUploader = ref(false);
const picker = ref<HTMLInputElement | null>(null);
const dropOn = ref(false);

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
      // D1 冷启动偶尔会慢一下，先自动重试一次再报错
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

const selectedCount = computedCount();
function computedCount() {
  return () => Object.values(sel.value).filter(Boolean).length;
}

async function delFile(id: string) {
  if (!confirm('删除该文件？存储对象也会一并删除')) return;
  const d = await api.post('/api/files/delete', { ids: [id] });
  if (d) {
    load(true);
    emit('changed');
  }
}

async function delSelected() {
  const ids = files.value.filter((_, i) => sel.value[i]).map((f) => f.id);
  if (!ids.length) return;
  if (!confirm(`删除所选 ${ids.length} 个文件？`)) return;
  const d = await api.post('/api/files/delete', { ids });
  if (d) {
    load(true);
    emit('changed');
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
  const f = files.value[i];
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
defineExpose({ reload: () => load(true) });
</script>

<template>
  <section>
    <div class="flex items-center gap-2.5 py-2.5 border-b border-[#e8e3d8]">
      <div class="flex items-center gap-[7px] flex-1 max-w-[340px] border-b border-rule pb-1">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" class="text-faint flex-none">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5 14 14" />
        </svg>
        <input v-model="q" placeholder="搜索文件名" class="border-0 outline-none bg-transparent w-full text-[12.5px]" @input="onSearch" />
      </div>
      <span class="flex-1"></span>
      <span class="font-mono text-[10.5px] text-muted tracking-[0.03em]">
        {{ selectedCount() ? '已选 ' + selectedCount() + ' 项' : '按时间排序 · 降序' }}
      </span>
      <button v-if="selectedCount()" class="btn btn-sm btn-danger" @click="delSelected">删除所选</button>
    </div>

    <div
      class="mt-3 border border-dashed border-rule rounded-sm px-[14px] py-[13px] flex items-center gap-2.5 cursor-pointer text-[12.5px] text-muted hover:border-faint hover:bg-ink/[0.018]"
      :class="dropOn ? 'border-accent bg-accent/[0.05] text-accent' : ''"
      @click="pick"
      @dragenter.prevent="dropOn = true"
      @dragover.prevent="dropOn = true"
      @dragleave.prevent="dropOn = false"
      @drop.prevent="onDrop"
    >
      <span class="font-mono text-[13px] text-faint w-3" :class="dropOn ? 'text-accent' : ''">+</span>
      <span>拖入文件，或点击选择</span>
      <span class="ml-auto font-mono text-[10px] text-faint tracking-[0.02em] max-[860px]:hidden">
        单文件 ≤ 100 GB · 超过 100 MB 自动分片 · 支持多选
      </span>
    </div>
    <input ref="picker" type="file" multiple hidden @change="onPick" />

    <div v-if="loadErr" class="border border-[#e3cfc9] bg-[#fbf1ee] text-[#8a2c19] px-3 py-2.5 text-xs mt-3 flex items-center gap-3">
      {{ loadErr }}
      <button class="btn btn-sm ml-auto" @click="load(true)">重试</button>
    </div>

    <div v-else-if="loading && !files.length" class="py-10 text-faint text-[12.5px]">加载中…</div>

    <div v-else-if="!files.length" class="py-10 text-faint text-[12.5px]">还没有文件，把文件拖到上面即可上传</div>

    <table v-else class="w-full border-collapse mt-0.5">
      <thead>
        <tr>
          <th class="w-[26px]"></th>
          <th class="w-[34px]">类型</th>
          <th>文件名</th>
          <th class="text-right w-[84px]">大小</th>
          <th class="text-right w-[132px]">上传时间</th>
          <th class="text-right w-[126px]">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(f, i) in files" :key="f.id" class="hover:bg-[#efede4]">
          <td>
            <span
              class="w-[13px] h-[13px] border border-faint rounded-[1px] inline-block relative align-[-2px] cursor-pointer"
              :class="sel[i] ? 'bg-accent border-accent' : ''"
              @click="sel[i] = !sel[i]"
            ></span>
          </td>
          <td>
            <img
              v-if="isImage(f)"
              class="thumb w-[30px] h-[30px] flex-none object-cover rounded-sm bg-[#e8e3d8] cursor-zoom-in"
              :src="`/preview/${f.id}`"
              :data-id="f.id"
              loading="lazy"
              alt=""
              @error="thumbFail"
              @click="lightbox = f.id"
            />
            <span v-else class="ext">{{ fileExt(f.name) }}</span>
          </td>
          <td>
            <div class="flex items-center gap-2.5 min-w-0">
              <b class="font-normal truncate" :title="f.name">{{ f.name }}</b>
              <span class="hidden font-mono text-[9.5px] text-faint ml-auto whitespace-nowrap pl-2 max-[860px]:flex">
                <span>{{ fmtBytes(f.size) }}</span>
              </span>
            </div>
          </td>
          <td class="text-right"><span class="num">{{ fmtBytes(f.size) }}</span></td>
          <td class="text-right"><span class="time">{{ fmtShort(f.uploaded_at) }}</span></td>
          <td>
            <div class="flex items-center justify-end text-[11.5px] whitespace-nowrap">
              <button class="text-muted hover:text-ink hover:underline underline-offset-2" @click="openShare(i)">分享</button>
              <span class="text-rule px-[7px] select-none">·</span>
              <button class="text-muted hover:text-ink hover:underline underline-offset-2" @click="copyLink(f)">直链</button>
              <span class="text-rule px-[7px] select-none">·</span>
              <button class="text-muted hover:text-danger hover:underline underline-offset-2" @click="delFile(f.id)">删除</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="offset" class="mt-3"><button class="btn btn-sm" @click="load(false)">加载更多</button></div>

    <!-- 上传队列 -->
    <div v-if="showUploader" class="fixed right-4 bottom-[46px] w-[320px] bg-surface border border-ink z-50 max-[860px]:left-3 max-[860px]:right-3 max-[860px]:w-auto">
      <div class="flex items-center gap-2 px-3 py-[9px] border-b border-rule text-xs">
        <span>上传队列</span><span class="font-mono text-[10px]">{{ uploading.length }}</span>
        <span class="flex-1"></span>
        <button class="text-faint text-[11px] hover:text-ink" @click="showUploader = false">收起</button>
      </div>
      <div v-for="(t, i) in uploading" :key="i" class="flex items-center gap-2.5 px-3 py-[9px] border-b border-[#e8e3d8] last:border-b-0">
        <span class="ext">{{ fileExt(t.name) }}</span>
        <div class="flex-1 min-w-0">
          <b class="block font-normal text-[11.5px] truncate">{{ t.name }}</b>
          <span class="block h-[2px] bg-rule mt-[5px] relative"><i class="absolute inset-y-0 left-0 bg-accent transition-[width]" :style="{ width: t.pct + '%' }"></i></span>
        </div>
        <span class="font-mono text-[9.5px] text-faint w-9 text-right">{{ t.pct >= 100 ? '完成' : t.pct + '%' }}</span>
      </div>
    </div>

    <!-- 分享弹窗 -->
    <div v-if="shareIdx !== null" class="fixed inset-0 bg-ink/25 flex items-center justify-center p-[18px] z-[60]" @click.self="shareIdx = null">
      <div class="bg-surface border border-ink w-full max-w-[392px]">
        <div class="px-4 pt-[14px] pb-3 border-b border-rule flex items-baseline gap-2">
          <h3 class="text-sm font-semibold m-0">{{ shareLink ? '分享已创建' : '创建分享' }}</h3>
          <button class="ml-auto text-faint text-[15px] leading-none hover:text-ink" @click="shareIdx = null">×</button>
        </div>

        <div v-if="!shareLink" class="p-4">
          <div class="flex items-center gap-2.5 mb-[11px]">
            <label class="w-16 flex-none text-xs text-muted">文件</label>
            <div class="flex-1 min-w-0 truncate text-xs">{{ files[shareIdx].name }}</div>
          </div>
          <div class="flex items-center gap-2.5 mb-[11px]">
            <label class="w-16 flex-none text-xs text-muted">有效期</label>
            <select v-model="shareExp" class="flex-1 min-w-0 border border-rule bg-white rounded-sm px-2 py-[5px] text-xs outline-none">
              <option value="0">永久</option>
              <option value="3600">1 小时</option>
              <option value="86400">1 天</option>
              <option value="604800">7 天</option>
              <option value="2592000">30 天</option>
            </select>
          </div>
          <div class="flex items-center gap-2.5 mb-[11px]">
            <label class="w-16 flex-none text-xs text-muted">密码</label>
            <input v-model="sharePwd" placeholder="可选" class="flex-1 min-w-0 border border-rule bg-white rounded-sm px-2 py-[5px] text-xs outline-none" />
            <span class="unit">留空则不需要</span>
          </div>
          <div class="flex items-center gap-2.5">
            <label class="w-16 flex-none text-xs text-muted">次数</label>
            <input v-model="shareMax" type="number" min="0" class="flex-1 min-w-0 border border-rule bg-white rounded-sm px-2 py-[5px] text-xs outline-none" />
            <span class="unit">次 · 0 不限</span>
          </div>
        </div>

        <div v-else class="p-4">
          <div class="sec-title mb-1.5">链接</div>
          <div class="flex border border-rule bg-white">
            <input :value="shareLink" readonly class="border-0 flex-1 font-mono text-[11px] px-2 py-[7px] outline-none bg-transparent min-w-0" />
            <button class="border-l border-rule px-[10px] text-[11.5px] text-ink/80 hover:bg-[#efede4]" @click="copyText(shareLink)">复制</button>
          </div>
          <div class="sec-title mt-3.5 mb-1.5">直链</div>
          <div class="flex border border-rule bg-white">
            <input :value="shareLink" readonly class="border-0 flex-1 font-mono text-[11px] px-2 py-[7px] outline-none bg-transparent min-w-0" />
            <button class="border-l border-rule px-[10px] text-[11.5px] text-ink/80 hover:bg-[#efede4]" @click="copyDirect(shareLink.split('/s/')[1])">取直链</button>
          </div>
        </div>

        <div class="px-4 py-[11px] border-t border-rule flex justify-end gap-2 bg-[#f7f5ef]">
          <button class="btn" @click="shareIdx = null">{{ shareLink ? '关闭' : '取消' }}</button>
          <button v-if="!shareLink" class="btn btn-solid" @click="createShare">创建</button>
        </div>
      </div>
    </div>

    <!-- 灯箱 -->
    <div v-if="lightbox" class="fixed inset-0 bg-ink/90 flex items-center justify-center z-[120] p-4 cursor-zoom-out" @click="lightbox = null">
      <img :src="`/preview/${lightbox}`" class="max-w-full max-h-full" alt="" />
    </div>
  </section>
</template>
