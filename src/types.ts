// 全项目共享的 TypeScript 类型定义
// 后端（Worker）与前端（Vue3）共用同一套字段结构，改字段名时两边一起报错。

/** Worker 的执行上下文（waitUntil / passThroughOnException） */
export interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException?(): void;
}

/** Worker 环境变量 + 数据库里合并进来的配置 */
export interface Env {
  DB: D1Like;
  BUCKET?: R2Like;
  ADMIN_PASSWORD?: string;
  PUBLIC_BASE_URL?: string;
  DOWNLOAD_MODE?: string;
  IP_MAX_DOWNLOADS?: string;
  IP_WINDOW_SECONDS?: string;
  BAN_MINUTES?: string;
  MONTHLY_TRAFFIC_LIMIT?: string;
  UPLOAD_MAX_SIZE?: string;
  MULTIPART_THRESHOLD?: string;
  MULTIPART_PART_SIZE?: string;
  TURNSTILE_SITEKEY?: string;
  TURNSTILE_SECRET?: string;
  TURNSTILE_ENABLED?: string;
  STORAGE_DRIVER?: string;
  R2_BUCKET_NAME?: string;
  STORAGE_QUOTA_GB?: string;
  S3_ENDPOINT?: string;
  S3_BUCKET?: string;
  S3_REGION?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE?: string;
  [key: string]: unknown;
}

/** D1 的最小可用描述（测试里是 FakeD1） */
export interface D1Like {
  prepare(sql: string): {
    bind(...args: unknown[]): {
      run(): Promise<unknown>;
      all(): Promise<{ results?: Record<string, unknown>[] }>;
      first(): Promise<Record<string, unknown> | null>;
    };
    run(): Promise<unknown>;
    all(): Promise<{ results?: Record<string, unknown>[] }>;
    first(): Promise<Record<string, unknown> | null>;
  };
}

/** R2 桶的最小可用描述（测试里是 FakeBucket） */
export interface R2Like {
  put(key: string, body: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  get(key: string, opts?: unknown): Promise<R2ObjectLike | null>;
  head(key: string): Promise<R2ObjectLike | null>;
  delete(key: string): Promise<unknown>;
  list(opts?: Record<string, unknown>): Promise<{ objects: R2ObjectLike[] }>;
}

export interface R2ObjectLike {
  key: string;
  size: number;
  body?: ReadableStream | null;
  httpMetadata?: { contentType?: string };
  writeHttpMetadata?(headers: Headers): void;
}

/** 文件记录（files 表） */
export interface FileRow {
  id: string;
  key: string;
  name: string;
  size: number;
  mime: string | null;
  uploaded_at: number;
  ip: string | null;
}

/** 分享记录（shares 表） */
export interface ShareRow {
  code: string;
  file_id: string;
  password_hash: string | null;
  salt: string | null;
  expires_at: number;
  max_downloads: number;
  downloads: number;
  traffic: number;
  show_name: number;
  created_at: number;
  last_at: number | null;
  disabled: number;
}

/** 封禁记录（bans 表） */
export interface BanRow {
  ip: string;
  until: number;
  reason: string | null;
}

/** 访问记录（logs 表） */
export interface LogRow {
  ts: number;
  ip: string;
  country: string | null;
  action: string;
  name: string | null;
  code: string | null;
  bytes: number;
  ua: string | null;
}

/** 统一配置（/api/config 与设置页共用） */
export interface Cfg {
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

/** 每个配置项的来源，用于在设置页标注 */
export type ConfigSource = '后台设置' | '环境变量' | '内置默认';

/** 存储层接口：R2 与 S3 两种实现都要满足 */
export interface Storage {
  readonly driver: 'r2' | 's3';
  readonly label: string;
  readonly publicBase: string;
  publicUrl(key: string): string | null;
  put(key: string, body: BodyInit | ReadableStream, opts?: PutOpts): Promise<void>;
  head(key: string): Promise<{ size: number; contentType?: string } | null>;
  get(key: string, range?: { offset: number; length: number }): Promise<GetResult | null>;
  delete(key: string): Promise<void>;
  list(maxKeys?: number): Promise<{ key: string; size: number }[]>;
  presignPut?(...args: unknown[]): Promise<unknown>;
  presignGet?(key: string, opts?: PresignGetOpts): Promise<string | null>;
  createMultipart?(key: string, contentType: string): Promise<{ uploadId: string }>;
  presignPart?(key: string, uploadId: string, partNumber: number, expires?: number): Promise<string>;
  completeMultipart?(key: string, uploadId: string, parts: { PartNumber: number; ETag: string }[]): Promise<unknown>;
  abortMultipart?(key: string, uploadId: string): Promise<unknown>;
}

export interface PutOpts {
  contentType?: string;
}

export interface GetResult {
  body: ReadableStream | ArrayBuffer | string;
  size: number;
  contentType?: string;
  etag?: string;
  status?: number;
  headers?: Headers;
  range?: unknown;
  [key: string]: unknown;
}

export interface PresignGetOpts {
  expires?: number;
  filename?: string;
  download?: boolean;
}

/** 上传凭证的返回形态 */
export type UploadMode = 'worker' | 'direct' | 'multipart';

export interface UploadTicket {
  mode: UploadMode;
  fileId: string;
  key: string;
  url?: string;
  urls?: string[];
  uploadId?: string;
  partSize?: number;
}
