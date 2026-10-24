// 前端 API 客户端：所有请求都带 same-origin Cookie，401 时交给调用方处理
export interface ApiResult<T = any> {
  ok: boolean;
  [key: string]: any;
}

async function request<T = any>(path: string, opt: RequestInit = {}): Promise<T | null> {
  const init: RequestInit = { ...opt, credentials: 'same-origin' };
  if (opt.body && typeof opt.body !== 'string') {
    init.headers = { 'content-type': 'application/json', ...(opt.headers || {}) };
    init.body = JSON.stringify(opt.body);
  }
  const r = await fetch(path, init);
  if (r.status === 401) {
    // 会话失效：后台页会自己跳登录，这里只返回 null
    return null;
  }
  const d = await r.json().catch(() => ({} as T));
  if (!r.ok) throw new Error((d as any)?.msg || `请求失败 ${r.status}`);
  return d as T;
}

export const api = {
  get: <T = any>(p: string) => request<T>(p),
  post: <T = any>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: body as any }),
  del: <T = any>(p: string, body?: unknown) => request<T>(p, { method: 'DELETE', body: body as any }),
};

/* ---------- 类型 ---------- */
export interface FileItem {
  id: string;
  name: string;
  size: number;
  mime: string | null;
  uploaded_at: number;
}

export interface ShareItem {
  code: string;
  name: string;
  downloads: number;
  max_downloads: number;
  expires_at: number;
  password_hash?: string | null;
  url: string;
}

export interface LogItem {
  ts: number;
  ip: string;
  country: string | null;
  action: string;
  name: string | null;
  code: string | null;
  bytes: number;
}

export interface BanItem {
  ip: string;
  until: number;
  reason: string | null;
}

export interface Stats {
  files: number;
  shares: number;
  downloads: number;
  bytes: number;
  quota: number;
  traffic: number;
  limit: number;
  driver: string;
}

export interface Config {
  publicBaseUrl: string;
  downloadMode: string;
  ipMaxDownloads: number;
  ipWindowSeconds: number;
  banMinutes: number;
  monthlyTrafficLimit: number;
  uploadMaxSize: number;
  multipartThreshold: number;
  multipartPartSize: number;
  turnstileSitekey: string;
  turnstileSecret: string;
  turnstileEnabled: boolean;
  storageDriver: string;
  r2BucketName: string;
  s3Endpoint: string;
  s3Bucket: string;
  s3Region: string;
  s3ForcePathStyle: boolean;
  s3HasKey: boolean;
  storageQuotaGb: number;
}

export interface StatusProbe {
  ok: boolean;
  hasAdmin: boolean;
  hasEnvAdmin: boolean;
  hasDbAdmin: boolean;
  admin: boolean;
  hasCookie: boolean;
  cookieState: 'none' | 'valid' | 'invalid';
  https: boolean;
  driver: string;
  bucket: string;
}

/* ---------- 小工具 ---------- */
export function fmtBytes(n: number): string {
  const num = Number(n) || 0;
  if (num < 1024) return num + ' B';
  const units = ['KB', 'MB', 'GB', 'TB'];
  let v = num / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return v.toFixed(v >= 100 || i === 0 ? 0 : 1) + ' ' + units[i];
}

const p2 = (x: number) => String(x).padStart(2, '0');

export function fmtShort(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fmtFull(ts: number): string {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`;
}

export function fileExt(name: string): string {
  const s = String(name || '');
  const i = s.lastIndexOf('.');
  return i > 0 ? s.slice(i + 1).toUpperCase().slice(0, 4) : '?';
}

const IMG_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif)$/i;

export function isImage(f: { name?: string; mime?: string | null }): boolean {
  return /^image\//i.test(f.mime || '') || IMG_EXT.test(f.name || '');
}

/* 文件归类：给左侧「图片 / 视频 / 音乐 / 文档」用 */
const VIDEO_EXT = /\.(mp4|webm|mov|mkv|avi|flv|m4v|wmv|ts|mpg|mpeg|3gp)$/i;
const AUDIO_EXT = /\.(mp3|flac|wav|ogg|m4a|aac|opus|wma|ape)$/i;
const DOC_EXT = /\.(pdf|docx?|xlsx?|pptx?|txt|md|csv|epub|rtf|odt|ods|odp|json|ya?ml|zip|rar|7z|tar|gz)$/i;

export type FileKind = 'image' | 'video' | 'audio' | 'doc' | 'other';

export function fileKind(f: { name?: string; mime?: string | null }): FileKind {
  const mime = String(f?.mime || '').toLowerCase();
  const name = String(f?.name || '');
  if (isImage(f)) return 'image';
  if (mime.startsWith('video/') || VIDEO_EXT.test(name)) return 'video';
  if (mime.startsWith('audio/') || AUDIO_EXT.test(name)) return 'audio';
  if (DOC_EXT.test(name) || /^(application\/(pdf|msword|vnd)|text\/)/i.test(mime)) return 'doc';
  return 'other';
}

export async function copyText(t: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(t);
      return;
    } catch {
      /* 退回 prompt */
    }
  }
  prompt('复制', t);
}
