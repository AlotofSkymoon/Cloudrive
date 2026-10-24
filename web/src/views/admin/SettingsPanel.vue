<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { api, type Config } from '../../api';

// 配置全部存在数据库里，在设置页改；环境变量只是兜底。
// 每项右侧的小标签标着当前值来自哪一层。
const cfg = reactive<Config>({
  publicBaseUrl: '',
  downloadMode: 'auto',
  ipMaxDownloads: 30,
  ipWindowSeconds: 3600,
  banMinutes: 60,
  monthlyTrafficLimit: 0,
  uploadMaxSize: 107374182400,
  multipartThreshold: 104857600,
  multipartPartSize: 16777216,
  turnstileSitekey: '',
  turnstileSecret: '',
  turnstileEnabled: false,
  storageDriver: 'auto',
  r2BucketName: 'filecove',
  s3Endpoint: '',
  s3Bucket: '',
  s3Region: 'auto',
  s3ForcePathStyle: true,
  s3HasKey: false,
  storageQuotaGb: 10,
});

const sources = ref<Record<string, string>>({});
const dirty = ref(false);
const loading = ref(true);
const err = ref('');
const diag = ref<any>(null);
const pwd = ref('');
// S3 密钥是「留空不改」，单独用两个输入框存，不参与 v-model 回填
const s3Ak = ref('');
const s3Sk = ref('');

async function load() {
  loading.value = true;
  err.value = '';
  const d = await api.get<{ config: Config; sources: Record<string, string> }>('/api/config');
  if (!d) {
    err.value = '设置加载失败';
  } else {
    Object.assign(cfg, d.config);
    sources.value = d.sources || {};
  }
  loading.value = false;
  dirty.value = false;
}

async function save() {
  const body: Record<string, unknown> = {
    publicBaseUrl: cfg.publicBaseUrl,
    downloadMode: cfg.downloadMode,
    ipMaxDownloads: Number(cfg.ipMaxDownloads),
    ipWindowSeconds: Number(cfg.ipWindowSeconds),
    banMinutes: Number(cfg.banMinutes),
    monthlyTrafficLimit: Number(cfg.monthlyTrafficLimit),
    turnstileSitekey: cfg.turnstileSitekey,
    turnstileSecret: cfg.turnstileSecret,
    turnstileEnabled: !!cfg.turnstileEnabled,
    uploadMaxSize: Number(cfg.uploadMaxSize),
    multipartThreshold: Number(cfg.multipartThreshold),
    multipartPartSize: Number(cfg.multipartPartSize),
    storageDriver: cfg.storageDriver,
    r2BucketName: cfg.r2BucketName,
    storageQuotaGb: Number(cfg.storageQuotaGb),
    s3Endpoint: cfg.s3Endpoint,
    s3Bucket: cfg.s3Bucket,
    s3Region: cfg.s3Region,
  };
  // 密钥留空表示不改动（后端会忽略空白值，不会把原值清掉）
  if (pwd.value) body.adminPassword = pwd.value;
  if (s3Ak.value) body.s3AccessKeyId = s3Ak.value;
  if (s3Sk.value) body.s3SecretAccessKey = s3Sk.value;
  const d = await api.post<{ msg?: string }>('/api/config', body);
  if (d) {
    alert('设置已保存');
    pwd.value = '';
    s3Ak.value = '';
    s3Sk.value = '';
    load();
  }
}

/* 直链自检：填了域名到底生效没有 */
async function checkBase() {
  const d = await api.get<any>('/api/diag/link');
  diag.value = d;
}

function mark() {
  dirty.value = true;
}

const gb = (n: number) => Math.round((Number(n) || 0) / 1073741824);
const mb = (n: number) => Math.round((Number(n) || 0) / 1048576);
const toGb = (v: number) => Math.round((Number(v) || 0) * 1073741824);
const toMb = (v: number) => Math.round((Number(v) || 0) * 1048576);

const uploadGb = ref(0);
const threshMb = ref(0);
const partMb = ref(0);
function applyUnits() {
  cfg.uploadMaxSize = toGb(uploadGb.value);
  cfg.multipartThreshold = toMb(threshMb.value);
  cfg.multipartPartSize = toMb(partMb.value);
}

const trafficGb = ref(0);
function applyTraffic() {
  cfg.monthlyTrafficLimit = Math.round(Number(trafficGb.value) * 1073741824);
}

function syncUnits() {
  uploadGb.value = gb(cfg.uploadMaxSize);
  threshMb.value = mb(cfg.multipartThreshold);
  partMb.value = mb(cfg.multipartPartSize);
  trafficGb.value = Number((cfg.monthlyTrafficLimit / 1073741824).toFixed(2));
}

onMounted(async () => {
  await load();
  syncUnits();
});
</script>

<template>
  <section class="max-w-[720px]">
    <div v-if="err" class="alert alert-error flex items-center gap-3">
      {{ err }}<button class="btn btn-outlined btn-sm ml-auto" @click="load">重试</button>
    </div>
    <div v-else-if="loading" class="py-12 text-center text-faint text-sm">加载中…</div>

    <div v-else class="space-y-4 pb-20">
      <!-- 直链与下载 -->
      <div class="card">
        <div class="px-5 h-12 flex items-center border-b border-rule">
          <h3 class="text-sm font-medium m-0">直链与下载</h3>
        </div>
        <div class="px-5">
          <div class="field">
            <label class="field-label">
              公网域名<span class="src" v-if="sources.PUBLIC_BASE_URL">{{ sources.PUBLIC_BASE_URL }}</span>
              <div class="field-desc">对象存储的公开访问域名</div>
            </label>
            <input v-model="cfg.publicBaseUrl" class="input" placeholder="cdn.example.com" @input="mark" />
            <button class="btn btn-outlined btn-sm" @click="checkBase">检测</button>
          </div>
          <div v-if="diag" class="pb-3">
            <div v-if="diag.reason === 'no_public_base'" class="alert alert-warn">
              还没填公网域名。填了才有对象直链；不填也能用，下载会走预签名地址（同样不经过 Worker，只是带 15 分钟时效）。
            </div>
            <div v-else-if="diag.reason === 'public_base_not_applied'" class="alert alert-error">
              <b>已填了域名，但存储层没读到。</b>配置是从数据库读的，最常见的原因是还没重新部署。去 Actions 再跑一次，然后回来点「检测」。
            </div>
            <div v-else class="alert alert-info">
              <b>直链已生效。</b>下载会直接跳到 <code class="font-mono text-xs">{{ diag.effectiveBase || diag.configuredBase }}</code>。
              <span v-if="diag.sample"><br />示例：{{ diag.sample }}</span>
              <br />如果点开示例是 404，说明这个域名在存储桶上没有开公开访问，需要到桶的「公共访问」里绑定自定义域。
            </div>
          </div>
          <div class="field !border-b-0">
            <label class="field-label">
              下载方式<span class="src" v-if="sources.DOWNLOAD_MODE">{{ sources.DOWNLOAD_MODE }}</span>
            </label>
            <select v-model="cfg.downloadMode" class="input" @change="mark">
              <option value="auto">auto — 有公网域名走直链</option>
              <option value="public">public — 强制直链</option>
              <option value="signed">signed — 预签名（15 分钟）</option>
              <option value="proxy">proxy — Worker 代理</option>
            </select>
          </div>
        </div>
      </div>

      <!-- 限流与防刷 -->
      <div class="card">
        <div class="px-5 h-12 flex items-center border-b border-rule">
          <h3 class="text-sm font-medium m-0">限流与防刷</h3>
        </div>
        <div class="px-5">
          <div class="field">
            <label class="field-label">
              单 IP 下载上限<span class="src" v-if="sources.IP_MAX_DOWNLOADS">{{ sources.IP_MAX_DOWNLOADS }}</span>
            </label>
            <input v-model="cfg.ipMaxDownloads" type="number" class="input !flex-none !w-20" @input="mark" />
            <span class="unit">次 /</span>
            <input v-model="cfg.ipWindowSeconds" type="number" class="input !flex-none !w-20" @input="mark" />
            <span class="unit">秒</span>
          </div>
          <div class="field">
            <label class="field-label">
              超限封禁时长<span class="src" v-if="sources.BAN_MINUTES">{{ sources.BAN_MINUTES }}</span>
            </label>
            <input v-model="cfg.banMinutes" type="number" class="input !flex-none !w-20" @input="mark" />
            <span class="unit">分钟</span>
          </div>
          <div class="field !border-b-0">
            <label class="field-label">
              月度流量上限<span class="src" v-if="sources.MONTHLY_TRAFFIC_LIMIT">{{ sources.MONTHLY_TRAFFIC_LIMIT }}</span>
              <div class="field-desc">超出后拒绝下载，0 为不限</div>
            </label>
            <input v-model="trafficGb" type="number" class="input !flex-none !w-20" @input="mark" @change="applyTraffic" />
            <span class="unit">GB</span>
          </div>
        </div>
      </div>

      <!-- 人机验证 -->
      <div class="card">
        <div class="px-5 h-12 flex items-center border-b border-rule">
          <h3 class="text-sm font-medium m-0">人机验证</h3>
        </div>
        <div class="px-5">
          <div class="field">
            <label class="field-label">
              Turnstile<div class="field-desc">分享页下载前过一次验证</div>
            </label>
            <button
              class="switch"
              :class="cfg.turnstileEnabled ? 'switch-on' : 'switch-off'"
              @click="cfg.turnstileEnabled = !cfg.turnstileEnabled; mark()"
            >
              <i class="switch-dot"></i>
            </button>
            <span class="unit">{{ cfg.turnstileEnabled ? '已开启' : '已关闭' }}</span>
          </div>
          <div class="field">
            <label class="field-label">
              Sitekey<span class="src" v-if="sources.TURNSTILE_SITEKEY">{{ sources.TURNSTILE_SITEKEY }}</span>
            </label>
            <input v-model="cfg.turnstileSitekey" class="input" @input="mark" />
          </div>
          <div class="field !border-b-0">
            <label class="field-label">Secret<span class="src" v-if="sources.TURNSTILE_SECRET">{{ sources.TURNSTILE_SECRET }}</span></label>
            <input v-model="cfg.turnstileSecret" type="password" class="input" placeholder="留空不改" @input="mark" />
          </div>
        </div>
      </div>

      <!-- 上传 -->
      <div class="card">
        <div class="px-5 h-12 flex items-center border-b border-rule">
          <h3 class="text-sm font-medium m-0">上传</h3>
        </div>
        <div class="px-5">
          <div class="field">
            <label class="field-label">单文件上限<span class="src" v-if="sources.UPLOAD_MAX_SIZE">{{ sources.UPLOAD_MAX_SIZE }}</span></label>
            <input v-model="uploadGb" type="number" class="input !flex-none !w-20" @input="mark" @change="applyUnits" />
            <span class="unit">GB</span>
          </div>
          <div class="field">
            <label class="field-label">
              分片阈值<div class="field-desc">超过这个大小走分片直传</div>
            </label>
            <input v-model="threshMb" type="number" class="input !flex-none !w-20" @input="mark" @change="applyUnits" />
            <span class="unit">MB</span>
          </div>
          <div class="field !border-b-0">
            <label class="field-label">分片大小</label>
            <input v-model="partMb" type="number" class="input !flex-none !w-20" @input="mark" @change="applyUnits" />
            <span class="unit">MB</span>
          </div>
        </div>
      </div>

      <!-- 存储 -->
      <div class="card">
        <div class="px-5 h-12 flex items-center border-b border-rule">
          <h3 class="text-sm font-medium m-0">存储</h3>
        </div>
        <div class="px-5">
          <div class="field">
            <label class="field-label">
              驱动<span class="src" v-if="sources.STORAGE_DRIVER">{{ sources.STORAGE_DRIVER }}</span>
              <div class="field-desc">切到 S3 需要把下面几项填全</div>
            </label>
            <select v-model="cfg.storageDriver" class="input" @change="mark">
              <option value="auto">auto — 有 S3 配置用 S3，否则 R2 绑定</option>
              <option value="r2">r2 — 只用 R2 绑定</option>
              <option value="s3">s3 — 只用 S3 兼容</option>
            </select>
          </div>
          <div class="field">
            <label class="field-label">
              R2 桶名<div class="field-desc">R2 绑定模式下仅用于显示</div>
            </label>
            <input v-model="cfg.r2BucketName" class="input" @input="mark" />
          </div>
          <div class="field">
            <label class="field-label">
              容量上限<div class="field-desc">只影响侧栏进度条，填 0 不显示</div>
            </label>
            <input v-model="cfg.storageQuotaGb" type="number" class="input !flex-none !w-20" @input="mark" />
            <span class="unit">GB</span>
          </div>
          <div class="field">
            <label class="field-label">
              S3 Endpoint<div class="field-desc">B2 / COS / OSS / MinIO / R2 的 S3 API 地址</div>
            </label>
            <input v-model="cfg.s3Endpoint" class="input" placeholder="https://s3.example.com" @input="mark" />
          </div>
          <div class="field">
            <label class="field-label">S3 桶</label>
            <input v-model="cfg.s3Bucket" class="input" @input="mark" />
          </div>
          <div class="field">
            <label class="field-label">
              S3 区域<div class="field-desc">R2 填 auto</div>
            </label>
            <input v-model="cfg.s3Region" class="input" @input="mark" />
          </div>
          <div class="field">
            <label class="field-label">
              S3 Access Key<span class="unit ml-0" v-if="cfg.s3HasKey">（已设置）</span>
              <div class="field-desc">留空则不改动</div>
            </label>
            <input v-model="s3Ak" class="input !flex-none !w-[240px]" placeholder="留空不改" />
          </div>
          <div class="field !border-b-0">
            <label class="field-label">
              S3 Secret Key<div class="field-desc">留空则不改动</div>
            </label>
            <input v-model="s3Sk" type="password" class="input !flex-none !w-[240px]" placeholder="留空不改" />
          </div>
        </div>
      </div>

      <!-- 管理员 -->
      <div class="card">
        <div class="px-5 h-12 flex items-center border-b border-rule">
          <h3 class="text-sm font-medium m-0">管理员</h3>
        </div>
        <div class="px-5">
          <div class="field !border-b-0">
            <label class="field-label">
              登录密码<div class="field-desc">留空表示不修改</div>
            </label>
            <input v-model="pwd" type="password" class="input !flex-none !w-[240px]" placeholder="留空不改" />
          </div>
        </div>
      </div>
    </div>

    <!-- 保存栏 -->
    <div class="fixed bottom-0 left-[300px] right-0 bg-surface-container border-t border-outline-variant px-6 py-4 flex items-center gap-3 z-20 pb-safe stacked:left-0 stacked:px-3">
      <span v-if="dirty" class="w-2 h-2 rounded-full bg-warn flex-none"></span>
      <span class="text-sm text-muted">
        {{ dirty ? '有未保存的改动' : '改完点保存，会存进数据库（优先级高于环境变量，重新部署不会冲掉）' }}
      </span>
      <span class="flex-1"></span>
      <button class="btn btn-outlined" @click="load">放弃</button>
      <button class="btn btn-filled" @click="save">保存</button>
    </div>
  </section>
</template>
