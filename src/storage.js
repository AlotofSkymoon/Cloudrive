// 存储抽象层：R2 绑定 / 任意 S3 兼容存储（R2 的 S3 API、Backblaze B2、MinIO、腾讯云 COS、阿里云 OSS ...）
import { presign, signedFetch, uriEncode } from './sigv4.js';

function encodeKeyPath(key) {
  return key.split('/').map((s) => uriEncode(s)).join('/');
}

class R2Storage {
  constructor(env) {
    this.driver = 'r2';
    this.bucket = env.BUCKET;
    this.label = env.R2_BUCKET_NAME || 'R2 绑定存储桶';
    this.publicBase = (env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  }
  get canPresign() {
    return false;
  }
  publicUrl(key) {
    return this.publicBase ? `${this.publicBase}/${encodeKeyPath(key)}` : null;
  }
  async put(key, body, { contentType } = {}) {
    return this.bucket.put(key, body, {
      httpMetadata: { contentType: contentType || 'application/octet-stream', cacheControl: 'public, max-age=31536000' },
    });
  }
  async head(key) {
    const o = await this.bucket.head(key);
    if (!o) return null;
    return { size: o.size, contentType: o.httpMetadata?.contentType || 'application/octet-stream', etag: o.etag };
  }
  async get(key, range) {
    const o = range ? await this.bucket.get(key, { range }) : await this.bucket.get(key);
    if (!o) return null;
    return {
      body: o.body,
      size: o.size,
      contentType: o.httpMetadata?.contentType || 'application/octet-stream',
      etag: o.etag,
      range: o.range,
    };
  }
  async delete(key) {
    await this.bucket.delete(key);
  }
  // 列举桶内对象，用于「同步已有文件」到数据库
  async list(maxKeys = 1000) {
    if (!this.bucket.list) return [];
    const out = [];
    let cursor;
    let guard = 0;
    do {
      const res = await this.bucket.list({ limit: 1000, cursor });
      for (const o of res.objects || []) {
        out.push({ key: o.key, size: o.size || 0, uploaded: o.uploaded ? Math.floor(new Date(o.uploaded).getTime() / 1000) : 0 });
      }
      cursor = res.truncated ? res.cursor : undefined;
      guard++;
    } while (cursor && out.length < maxKeys && guard < 20);
    return out;
  }
  async presignPut() {
    return null;
  }
  async presignGet() {
    return null;
  }
}

class S3Storage {
  constructor(env) {
    this.driver = 's3';
    this.cfg = {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      sessionToken: env.S3_SESSION_TOKEN || '',
      region: env.S3_REGION || 'auto',
    };
    this.endpoint = (env.S3_ENDPOINT || '').replace(/\/+$/, '');
    this.bucket = env.S3_BUCKET;
    this.label = env.S3_BUCKET + ' @ ' + new URL(this.endpoint).host;
    this.pathStyle = String(env.S3_FORCE_PATH_STYLE ?? 'true') !== 'false';
    this.publicBase = (env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  }
  get canPresign() {
    return true;
  }
  baseUrl() {
    const u = new URL(this.endpoint);
    return this.pathStyle ? `${u.origin}/${uriEncode(this.bucket)}` : `${u.protocol}//${this.bucket}.${u.host}`;
  }
  objectUrl(key, query = {}) {
    const qs = Object.entries(query)
      .map(([k, v]) => `${uriEncode(k, true)}=${uriEncode(String(v), true)}`)
      .join('&');
    return `${this.baseUrl()}/${encodeKeyPath(key)}${qs ? '?' + qs : ''}`;
  }
  publicUrl(key) {
    return this.publicBase ? `${this.publicBase}/${encodeKeyPath(key)}` : null;
  }
  async put(key, body, { contentType } = {}) {
    // 走 Worker 流式上传（小文件兜底）
    const buf = await new Response(body).arrayBuffer();
    const res = await signedFetch(this.cfg, this.objectUrl(key), {
      method: 'PUT',
      headers: { 'content-type': contentType || 'application/octet-stream' },
      body: buf,
    });
    if (!res.ok) throw new Error(`S3 PUT 失败: ${res.status} ${await res.text()}`);
    return true;
  }
  async head(key) {
    const res = await signedFetch(this.cfg, this.objectUrl(key), { method: 'HEAD' });
    if (!res.ok) return null;
    return {
      size: Number(res.headers.get('content-length') || 0),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      etag: res.headers.get('etag') || '',
    };
  }
  async get(key, range) {
    const headers = {};
    if (range) headers['range'] = `bytes=${range.offset}-${range.offset + range.length - 1}`;
    const res = await signedFetch(this.cfg, this.objectUrl(key), { method: 'GET', headers });
    if (!res.ok && res.status !== 206) return null;
    return {
      body: res.body,
      size: Number(res.headers.get('content-length') || 0),
      contentType: res.headers.get('content-type') || 'application/octet-stream',
      etag: res.headers.get('etag') || '',
      status: res.status,
      headers: res.headers,
    };
  }
  async delete(key) {
    const res = await signedFetch(this.cfg, this.objectUrl(key), { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(`S3 DELETE 失败: ${res.status}`);
  }
  async presignPut(key, { contentType, expires = 3600 } = {}) {
    return presign(this.cfg, {
      method: 'PUT',
      url: this.objectUrl(key),
      headers: { 'content-type': contentType || 'application/octet-stream' },
      expires,
    });
  }
  async presignGet(key, { expires = 900, filename, download = true } = {}) {
    const query = {};
    if (filename) {
      const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
      const utf8 = encodeURIComponent(filename);
      query['response-content-disposition'] =
        `${download ? 'attachment' : 'inline'}; filename="${ascii}"; filename*=UTF-8''${utf8}`;
    }
    return presign(this.cfg, { method: 'GET', url: this.objectUrl(key), query, expires });
  }
  async createMultipart(key, contentType) {
    const res = await signedFetch(this.cfg, `${this.objectUrl(key)}?uploads`, {
      method: 'POST',
      headers: { 'content-type': contentType || 'application/octet-stream' },
    });
    const xml = await res.text();
    if (!res.ok) throw new Error(`创建分片上传失败: ${res.status} ${xml}`);
    const m = /<UploadId>([^<]+)<\/UploadId>/.exec(xml);
    if (!m) throw new Error('创建分片上传失败：无法解析 UploadId');
    return m[1];
  }
  async presignPart(key, uploadId, partNumber, expires = 3600) {
    return presign(this.cfg, {
      method: 'PUT',
      url: this.objectUrl(key, { uploadId, partNumber }),
      expires,
    });
  }
  async completeMultipart(key, uploadId, parts) {
    const xml =
      '<CompleteMultipartUpload>' +
      parts
        .slice()
        .sort((a, b) => a.PartNumber - b.PartNumber)
        .map((p) => `<Part><PartNumber>${p.PartNumber}</PartNumber><ETag>${p.ETag}</ETag></Part>`)
        .join('') +
      '</CompleteMultipartUpload>';
    const res = await signedFetch(this.cfg, this.objectUrl(key, { uploadId }), {
      method: 'POST',
      headers: { 'content-type': 'application/xml' },
      body: xml,
    });
    if (!res.ok) throw new Error(`合并分片失败: ${res.status} ${await res.text()}`);
    return true;
  }
  async abortMultipart(key, uploadId) {
    await signedFetch(this.cfg, this.objectUrl(key, { uploadId }), { method: 'DELETE' });
  }
  // ListObjectsV2：把桶里已有的对象同步进数据库
  async list(maxKeys = 1000) {
    const out = [];
    let token = '';
    let guard = 0;
    do {
      const query = { 'list-type': '2', 'max-keys': '1000' };
      if (token) query['continuation-token'] = token;
      const res = await signedFetch(this.cfg, this.objectUrl('', query), { method: 'GET' });
      const xml = await res.text();
      if (!res.ok) break;
      for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = /<Key>([\s\S]*?)<\/Key>/.exec(m[1])?.[1];
        if (!key) continue;
        const size = Number(/<Size>(\d+)<\/Size>/.exec(m[1])?.[1] || 0);
        const last = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(m[1])?.[1];
        out.push({ key: decodeXml(key), size, uploaded: last ? Math.floor(new Date(last).getTime() / 1000) : 0 });
      }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? decodeXml(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/.exec(xml)?.[1] || '')
        : '';
      guard++;
    } while (token && out.length < maxKeys && guard < 20);
    return out;
  }
}

function decodeXml(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

export function createStorage(env) {
  const mode = String(env.STORAGE_DRIVER || 'auto').toLowerCase();
  const hasS3 = !!(env.S3_ENDPOINT && env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY);
  if (mode === 'r2' || (mode === 'auto' && !hasS3)) {
    if (!env.BUCKET) throw new Error('未绑定 R2 存储桶（BUCKET），也未配置 S3_* 变量');
    return new R2Storage(env);
  }
  if (!hasS3) throw new Error('S3 配置不完整：需要 S3_ENDPOINT / S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY');
  return new S3Storage(env);
}
