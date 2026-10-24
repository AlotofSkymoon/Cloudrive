<script setup lang="ts">
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

const lightbox = ref(false);
const expireText = s.expires_at ? fmtFull(s.expires_at) : '永久';
const limitText = s.max_downloads ? `${s.downloads || 0} / ${s.max_downloads} 次` : '不限次数';

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
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="flex items-center gap-2 px-6 py-5 font-mono text-[10px] text-faint tracking-wide">
      <span class="font-serif text-[15px] text-ink font-semibold tracking-tight">Filecove</span>
      <span>SHARE</span>
      <span class="flex-1"></span>
      <span>/s/{{ code }}</span>
    </div>

    <div class="flex-1 flex items-start justify-center px-5 pb-[60px] pt-2">
      <div class="w-full max-w-[520px]">
        <div class="border border-rule bg-surface">
          <div class="px-[18px] py-4 border-b border-[#e8e3d8] flex items-center gap-2.5">
            <span class="ext !w-[34px] !flex-none !text-[9px] !py-[3px]">{{ fileExt(s.file_name) }}</span>
            <div class="min-w-0">
              <b class="block font-medium text-sm truncate">{{ s.file_name }}</b>
              <span class="font-mono text-[9.5px] text-faint tracking-[0.03em]">{{ fmtBytes(s.file_size) }} · {{ s.file_mime || '文件' }}</span>
            </div>
          </div>

          <div
            v-if="!disabled && isImage({ name: s.file_name, mime: s.file_mime }) && !prevFailed"
            class="border-b border-[#e8e3d8] flex items-center justify-center min-h-[190px]"
          >
            <img
              id="pv-img"
              :src="`/raw/${code}`"
              class="block w-full max-h-[340px] object-contain cursor-zoom-in"
              loading="lazy"
              alt=""
              @error="prevFail"
              @click="lightbox = true"
            />
          </div>
          <div
            v-else
            class="border-b border-[#e8e3d8] flex items-center justify-center min-h-[190px] text-faint font-mono text-[9.5px] tracking-[0.1em]"
            style="background-image: repeating-linear-gradient(45deg, transparent, transparent 7px, rgba(28, 27, 24, 0.045) 7px, rgba(28, 27, 24, 0.045) 8px)"
          >
            预览不可用 · 点击下载
          </div>

          <div class="px-[18px] pt-1 pb-[14px]">
            <div class="flex justify-between py-2 border-b border-[#e8e3d8] text-xs">
              <span class="text-muted">分享时间</span><b class="font-mono font-normal text-[11.5px]">{{ fmtFull(s.created_at) }}</b>
            </div>
            <div class="flex justify-between py-2 border-b border-[#e8e3d8] text-xs">
              <span class="text-muted">有效期</span><b class="font-mono font-normal text-[11.5px]">{{ expireText }}</b>
            </div>
            <div class="flex justify-between py-2 text-xs">
              <span class="text-muted">下载次数</span><b class="font-mono font-normal text-[11.5px]">{{ limitText }}</b>
            </div>
          </div>

          <div class="px-[18px] py-[14px] border-t border-rule bg-[#f7f5ef]">
            <div v-if="needPwd" class="flex gap-2 mb-2.5">
              <input
                v-model="pwd"
                type="password"
                placeholder="访问密码"
                class="flex-1 min-w-0 border border-rule bg-white rounded-sm px-[9px] py-[7px] text-[12.5px] outline-none focus:border-accent"
              />
            </div>
            <div v-if="needTs" class="mb-2.5">
              <div id="cf-ts" class="flex-1"></div>
              <span class="font-mono text-[9.5px] text-faint">完成下面的验证后再下载</span>
            </div>

            <button
              v-if="!disabled"
              class="btn btn-solid w-full h-9 justify-center text-[13px] disabled:opacity-50"
              :disabled="busy"
              @click="start"
            >
              {{ busy ? '处理中…' : '下 载' }}
            </button>
            <button v-else class="btn w-full h-9 justify-center" disabled>
              {{ s.banned ? 'IP 已被限制' : s.error || '不可用' }}
            </button>
          </div>
        </div>

        <div v-if="err" class="border border-[#e3cfc9] bg-[#fbf1ee] text-[#8a2c19] px-3 py-2.5 text-xs leading-[1.65] mt-3">
          {{ err }}
        </div>

        <div class="mt-3 font-mono text-[9.5px] text-faint text-center tracking-[0.03em]">
          由 Filecove 提供 · 下载走直链 · 如遇问题请联系分享者
        </div>
      </div>
    </div>

    <div v-if="lightbox" class="fixed inset-0 bg-ink/90 flex items-center justify-center z-[120] p-4 cursor-zoom-out" @click="lightbox = false">
      <img :src="`/raw/${code}`" class="max-w-full max-h-full" alt="" />
    </div>
  </div>
</template>
