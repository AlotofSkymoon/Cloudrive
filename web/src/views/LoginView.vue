<script setup lang="ts">
import BrandLogo from '../components/BrandLogo.vue';
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
  <div class="min-h-viewport bg-canvas flex flex-col items-center justify-center px-4 py-8 pb-safe">
    <!-- 登录卡片：MUI Paper，居中、elevation -->
    <div class="w-full max-w-[420px] compact:max-w-none">
      <div class="card px-7 py-7 compact:px-5 compact:py-6">
        <!-- 站点品牌：Cloudreve 演示站登录页顶部会显示站点名 -->
        <div class="flex items-center gap-2.5 mb-6">
          <BrandLogo :size="38" />
          <div class="min-w-0">
            <div class="text-[16px] font-medium leading-tight truncate">Cloudrive</div>
            <div class="text-xs text-muted leading-tight mt-0.5">私人网盘 · 直链分享</div>
          </div>
        </div>

        <h1 class="text-[24px] font-medium m-0 leading-tight">登录你的账号</h1>
        <p class="text-sm text-muted m-0 mt-1.5 mb-6">输入管理员密码以继续</p>

        <div v-if="hint" class="alert alert-warn mb-4">{{ hint }}</div>

        <form @submit.prevent="login">
          <!-- MUI outlined TextField：label 浮在边框缺口上 -->
          <div class="login-field mb-5">
            <label for="pwd">私人网盘登录密码</label>
            <input
              id="pwd"
              v-model="pwd"
              type="password"
              autocomplete="current-password"
              :disabled="noPassword"
              class="input w-full"
              @keyup.enter="login"
            />
          </div>

          <button type="submit" :disabled="noPassword || busy" class="btn btn-filled w-full h-10">
            {{ busy ? '验证中…' : '登录' }}
          </button>
        </form>

        <div v-if="err" class="alert alert-error mt-4">{{ err }}</div>

        <!-- 对应演示站的注册入口那一行：我们是单管理员实例，
             不开放注册，所以这里只做说明，不放点了没反应的假链接 -->
        <div class="mt-5 text-[13px] text-muted">私人实例 · 不开放注册，仅管理员可登录</div>

        <div class="h-px bg-rule my-5"></div>

        <!-- 对应演示站的第三方登录区：本实例没有 SSO / QQ / 通行密钥，
             放一排假按钮会误导，改为一条真实可用的自检链接 -->
        <a href="/api/status" target="_blank" rel="noopener" class="block text-center text-[13px] text-primary hover:underline">
          查看实例状态
        </a>
      </div>

      <!-- 底部：对应演示站的条款链接位置，这里放真实的实例信息 -->
      <div class="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-faint font-mono">
        <span v-if="status?.driver">{{ status.driver }}</span>
        <span v-if="status?.bucket">{{ status.bucket }}</span>
        <span>{{ status?.https === false ? 'HTTP' : 'HTTPS' }}</span>
        <span>v{{ boot.version }}</span>
      </div>
    </div>
  </div>
</template>
