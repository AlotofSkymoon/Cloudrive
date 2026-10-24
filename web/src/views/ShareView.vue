<script setup lang="ts">
import BrandLogo from '../components/BrandLogo.vue';
import { onMounted, ref } from 'vue';
import { api, fileExt, fmtBytes, fmtFull, isImage } from '../api';

const props = defineProps<{ boot: any }>();

const s = props.boot?.share || {};
const code = props.boot?.share?.code || '';
const pwd = ref('');
const busy = ref(false);
const err = ref('');
// need_password / need_turnstile 在 boot 根层（不是 share 里）
const needPwd = !!props.boot?.need_password;
const needTs = !!props.boot?.need_turnstile;
const sitekey = props.boot?.turnstile_sitekey || '';
const tsToken = ref('');
const prevFailed = ref(false);

const disabled = !!s.error || !!s.banned;

function prevFail() {
  // 预览加载不出来先重试一次，再退回占位
  const img = document.getElementById('pv-img') as HTMLImageElement | null;
  if (img && !img.dataset.retried) {
    img.dataset.retried = '1';
    setTimeout(() => (img.src = `/raw/${code}?r=` + Date.now()), 500);
    return;
  }
  prevFailed.value = true;
}

async function start() {
  if (busy.value) return;
  busy.value = true;
  err.value = '';
  try {
    const body: Record<string, unknown> = {};
    if (needPwd) body.password = pwd.value;
    if (needTs) {
      if (!tsToken.value) {
        err.value = '请先完成人机验证';
        busy.value = false;
        return;
      }
      body.turnstile = tsToken.value;
    }
    const r = await fetch(`/s/${code}/unlock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
    });
    const d = await r.json().catch(() => ({} as any));
    if (d?.ok) {
      location.href = `/d/${code}`;
      return;
    }
    err.value = d?.msg || '验证失败';
  } catch (e: any) {
    err.value = '请求失败：' + (e?.message || e);
  } finally {
    busy.value = false;
  }
}

/* ---------- Turnstile ---------- */
onMounted(() => {
  if (!needTs || !sitekey) return;
  const render = () => {
    const el = document.getElementById('cf-ts');
    if (!el || !(window as any).turnstile) return;
    (window as any).turnstile.render(el, {
      sitekey,
      callback: (t: string) => (tsToken.value = t),
      'error-callback': () => (err.value = '人机验证加载失败，请刷新重试'),
    });
  };
  if ((window as any).turnstile) return render();
  const sc = document.createElement('script');
  sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  sc.async = true;
  sc.defer = true;
  sc.onload = render;
  document.head.appendChild(sc);
});

const lightbox = ref(false);
const expireText = s.expires_at ? fmtFull(s.expires_at) : '永久';
const limitText = s.max_downloads ? `${s.downloads || 0} / ${s.max_downloads} 次` : '不限次数';
</script>

<template>
  <div class="min-h-viewport bg-canvas flex flex-col items-center justify-center px-4 py-8 pb-safe compact:px-3">
    <!-- 品牌 -->
    <div class="flex items-center gap-2 mb-5">
      <BrandLogo :size="26" />
      <span class="text-[17px] font-semibold tracking-tight">Cloudrive</span>
    </div>

    <div class="card w-full max-w-md overflow-hidden compact:max-w-none">
      <!-- 预览 -->
      <div class="bg-canvas flex items-center justify-center min-h-[200px] border-b border-rule compact:min-h-[140px]">
        <img
          v-if="!disabled && isImage({ name: s.file_name, mime: s.file_mime }) && !prevFailed"
          id="pv-img"
          :src="`/raw/${code}`"
          class="block w-full max-h-[360px] object-contain cursor-zoom-in compact:max-h-[240px]"
          loading="lazy"
          alt=""
          @error="prevFail"
          @click="lightbox = true"
        />
        <div v-else class="flex flex-col items-center gap-2 text-faint py-10">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Zm-1 7V3.5L18.5 9H13Z" />
          </svg>
          <span class="font-mono text-[13px] uppercase tracking-wide">{{ fileExt(s.file_name) }}</span>
        </div>
      </div>

      <!-- 文件信息 -->
      <div class="px-5 py-4">
        <h2 class="text-[17px] font-semibold m-0 mb-1 break-all">{{ s.file_name }}</h2>
        <div class="text-[13px] text-muted">{{ fmtBytes(s.file_size) }} · {{ s.file_mime || '文件' }}</div>

        <div class="mt-4 space-y-0">
          <div class="flex justify-between py-2 border-b border-rule text-[13px]">
            <span class="text-muted">分享时间</span><span class="font-mono text-[13px]">{{ fmtFull(s.created_at) }}</span>
          </div>
          <div class="flex justify-between py-2 border-b border-rule text-[13px]">
            <span class="text-muted">有效期</span><span class="font-mono text-[13px]">{{ expireText }}</span>
          </div>
          <div class="flex justify-between py-2 text-[13px]">
            <span class="text-muted">下载次数</span><span class="font-mono text-[13px]">{{ limitText }}</span>
          </div>
        </div>
      </div>

      <!-- 操作区 -->
      <div class="px-5 py-4 border-t border-rule bg-soft">
        <input
          v-if="needPwd"
          v-model="pwd"
          type="password"
          placeholder="访问密码"
          class="input mb-3"
          @keyup.enter="start"
        />
        <div v-if="needTs" class="mb-3">
          <div id="cf-ts"></div>
        </div>

        <button v-if="!disabled" class="btn btn-filled w-full" :disabled="busy" @click="start">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 16l-5-5h3V4h4v7h3l-5 5Zm-7 2h14v2H5v-2Z" /></svg>
          {{ busy ? '处理中…' : '下载' }}
        </button>
        <button v-else class="btn btn-outlined w-full" disabled>
          {{ s.banned ? 'IP 已被限制' : s.error || '不可用' }}
        </button>
      </div>
    </div>

    <div v-if="err" class="alert alert-error mt-4 w-full max-w-md">{{ err }}</div>

    <div class="mt-6 text-[13px] text-faint text-center">由 Cloudrive 提供 · 下载走直链</div>

    <!-- 灯箱 -->
    <Transition name="fade">
    <div v-if="lightbox" class="fixed inset-0 bg-black/90 flex items-center justify-center z-[120] p-4 cursor-zoom-out" @click="lightbox = false">
      <img :src="`/raw/${code}`" class="zoom-in max-w-full max-h-full rounded" alt="" />
    </div>
    </Transition>
  </div>
</template>
