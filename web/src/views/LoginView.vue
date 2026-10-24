<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, type StatusProbe } from '../api';

const props = defineProps<{ boot: any }>();

const pwd = ref('');
const err = ref('');
const hint = ref('');
const busy = ref(false);
const status = ref<StatusProbe | null>(props.boot?.status || null);

const noPassword = ref(false);

async function probe() {
  try {
    const d = await api.get<StatusProbe>('/api/status');
    if (!d) return;
    status.value = d;
    if (!d.hasAdmin) {
      noPassword.value = true;
      hint.value =
        '还没设置登录密码。到 Workers → 设置 → 变量和机密，添加 ADMIN_PASSWORD（选「机密」）后重新部署。';
    } else if (!d.https) {
      hint.value = '当前是 HTTP 访问，浏览器不会保存登录状态，请改用 HTTPS 打开本页。';
    } else if (d.hasEnvAdmin && d.hasDbAdmin) {
      err.value = 'ADMIN_PASSWORD 已设置，它的优先级高于后台改过的密码，请用环境变量那个密码登录。';
    }
    // 会话本来就有效的话，直接进后台，不用再输一次
    if (d.admin) location.replace('/?_=' + Date.now());
  } catch {
    /* 探针失败不影响登录 */
  }
}

async function login() {
  if (busy.value) return;
  busy.value = true;
  err.value = '';
  try {
    const r = await fetch('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password: pwd.value }),
      credentials: 'same-origin',
    });
    const d = await r.json().catch(() => ({}) as any);
    if (d?.ok) {
      location.replace('/?_=' + Date.now());
      return;
    }
    let msg = d?.msg || `进不去（HTTP ${r.status}）`;
    if (d?.hint && (d.hint.hasLeadingTrailingSpace || d.hint.hasLineBreak)) {
      msg += `　提示：Worker 里存的密码首尾带空格或换行（长度 ${d.hint.length}，去空白后 ${d.hint.trimmedLength}）。删掉重新粘贴并重新部署。`;
    }
    err.value = msg;
  } catch (e: any) {
    err.value = '请求失败：' + (e?.message || e);
  } finally {
    busy.value = false;
  }
}

onMounted(probe);
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <div class="flex items-center gap-2 px-6 py-5 font-mono text-[10px] text-faint tracking-wide">
      <span class="font-serif text-[15px] text-ink font-semibold tracking-tight">Filecove</span>
      <span>PRIVATE DRIVE</span>
      <span class="flex-1"></span>
      <span>v{{ boot.version }}</span>
    </div>

    <div class="flex-1 flex items-center justify-center px-5 pb-[60px]">
      <div class="grid grid-cols-[300px_190px] gap-[46px] items-start w-full max-w-[560px]">
        <div class="w-full max-w-[330px]">
          <div class="font-mono text-[9.5px] tracking-[0.12em] text-faint mb-2">RESTRICTED</div>
          <h2 class="font-serif text-[26px] font-semibold tracking-tight m-0 mb-1.5">私人网盘</h2>
          <p class="text-xs text-muted m-0 mb-[26px] leading-[1.7]">
            这个站点只对管理员开放。密码来自 Worker 的 <span class="mono">ADMIN_PASSWORD</span>。
          </p>

          <div v-if="hint" class="border border-[#e0d7bd] bg-[#faf6e8] text-[#7a6320] px-3 py-2.5 text-xs leading-[1.65] mb-4">
            {{ hint }}
          </div>

          <form @submit.prevent="login">
            <label for="pwd" class="block font-mono text-[9.5px] tracking-[0.08em] text-faint mb-1.5">登录密码</label>
            <input
              id="pwd"
              v-model="pwd"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••••••"
              :disabled="noPassword"
              class="w-full border-0 border-b border-ink bg-transparent py-1.5 pb-2 text-[15px] outline-none tracking-wide disabled:opacity-50"
            />
            <div class="font-mono text-[9.5px] text-faint mt-[7px] tracking-wide">SESSION 12H · HTTPONLY</div>

            <button
              type="submit"
              :disabled="noPassword || busy"
              class="btn btn-solid w-full h-9 justify-center mt-[22px] text-[13px] disabled:opacity-50"
            >
              {{ busy ? '验证中…' : '登 录' }}
            </button>
          </form>

          <div v-if="err" class="border border-[#e3cfc9] bg-[#fbf1ee] text-[#8a2c19] px-3 py-2.5 text-xs leading-[1.65] mt-4">
            {{ err }}
          </div>

          <div class="flex justify-between mt-[18px] font-mono text-[9.5px] text-faint">
            <span>Filecove {{ boot.version }}</span>
            <a href="#" class="text-muted underline decoration-rule underline-offset-2" @click.prevent>忘记密码？改 Worker 变量</a>
          </div>
        </div>

        <aside class="border-l border-rule pl-[26px] max-[860px]:hidden">
          <div class="font-mono text-[9px] tracking-[0.12em] text-faint mb-2.5">INSTANCE</div>
          <div class="flex justify-between gap-3 py-[7px] border-b border-[#e8e3d8] font-mono text-[9.5px] tracking-wide">
            <span class="text-faint">STORAGE</span><b class="font-normal text-ink/80 truncate">{{ status?.driver || '—' }}</b>
          </div>
          <div class="flex justify-between gap-3 py-[7px] border-b border-[#e8e3d8] font-mono text-[9.5px] tracking-wide">
            <span class="text-faint">BUCKET</span><b class="font-normal text-ink/80 truncate">{{ status?.bucket || '—' }}</b>
          </div>
          <div class="flex justify-between gap-3 py-[7px] border-b border-[#e8e3d8] font-mono text-[9.5px] tracking-wide">
            <span class="text-faint">PROTOCOL</span><b class="font-normal text-ink/80">{{ status?.https ? 'HTTPS' : 'HTTP' }}</b>
          </div>
          <div class="flex justify-between gap-3 py-[7px] font-mono text-[9.5px] tracking-wide">
            <span class="text-faint">VERSION</span><b class="font-normal text-ink/80">v{{ boot.version }}</b>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>
