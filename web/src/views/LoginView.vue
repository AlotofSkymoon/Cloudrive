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
      hint.value = 'ADMIN_PASSWORD 已设置，它的优先级高于后台改过的密码，请用环境变量那个密码登录。';
    }
    // 会话本来就有效的话直接进后台
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
  <div class="min-h-screen bg-canvas flex flex-col items-center justify-center px-4">
    <!-- 品牌 -->
    <div class="flex flex-col items-center mb-6">
      <svg width="56" height="56" viewBox="0 0 24 24" class="text-primary mb-3" fill="currentColor">
        <path d="M19.35 10.04A7.49 7.49 0 0 0 12 4a7.48 7.48 0 0 0-6.63 4.04A5.996 5.996 0 0 0 6 20h13a4.99 4.99 0 0 0 .35-9.96Z" />
      </svg>
      <h1 class="text-2xl font-medium tracking-tight m-0">Filecove</h1>
      <p class="text-sm text-muted m-0 mt-1">私人网盘 · 直链分享</p>
    </div>

    <!-- 登录卡片 -->
    <div class="card w-full max-w-sm p-8 shadow-e2">
      <div v-if="hint" class="alert alert-warn mb-4">{{ hint }}</div>

      <form @submit.prevent="login">
        <label for="pwd" class="block text-xs font-medium uppercase tracking-wide text-muted mb-1.5">登录密码</label>
        <input
          id="pwd"
          v-model="pwd"
          type="password"
          autocomplete="current-password"
          placeholder="输入管理员密码"
          :disabled="noPassword"
          class="input"
          @keyup.enter="login"
        />

        <button type="submit" :disabled="noPassword || busy" class="btn btn-filled w-full mt-5">
          {{ busy ? '验证中…' : '登 录' }}
        </button>
      </form>

      <div v-if="err" class="alert alert-error mt-4">{{ err }}</div>
    </div>

    <!-- 实例信息 -->
    <div class="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-faint font-mono">
      <span v-if="status?.driver">{{ status.driver }}</span>
      <span v-if="status?.bucket">{{ status.bucket }}</span>
      <span>{{ status?.https === false ? 'HTTP' : 'HTTPS' }}</span>
      <span>v{{ boot.version }}</span>
    </div>
  </div>
</template>
