# Filecove —— 用 Cloudflare Workers + R2 自建网盘（下载走直链）

把 **Cloudflare R2**（或任何 S3 兼容存储）变成能上传、能分享、能直链下载的网盘，全部跑在 **Workers** 上（不是 Pages），不用服务器，用免费额度就能跑。

- 存储：R2 绑定 **或** 任意 S3 兼容存储（R2 的 S3 API、Backblaze B2、MinIO、腾讯 COS、阿里云 OSS…），改几个变量就能换
- 下载：**直链优先**，`/d/xxx` 直接 302 到对象存储本身，不经过 Worker 中转
- 分享：短链 `/s/xxx`，支持有效期、访问密码、下载次数
- 防护：单 IP 限流、超限自动封禁、手动封禁解封、Cloudflare Turnstile 人机验证、月度流量上限
- 界面：液态玻璃风格单页，手机浏览器也好用；零依赖、无构建产物

---

## 一、路由一览

| 路径 | 作用 |
| --- | --- |
| `/` | 管理后台（未登录显示登录页） |
| `/s/:code` | 分享页（带密码 / 人机验证） |
| `/d/:code` | 下载 → 302 跳到对象直链 |
| `/raw/:code` | 在线预览（图片 / 视频 / PDF） |
| `/direct/:code` | 返回 JSON 格式的直链地址，方便程序调用 |
| `/api/*` | 后台接口（需登录） |

---

## 二、部署（Cloudflare 网页端，约 15 分钟，全程不用命令行）

> 需要：一个 GitHub 账号、一个 Cloudflare 账号、一个自定义域名（强烈建议，`workers.dev` 域名国内常打不开）。

### 1. Fork 本仓库
点右上角 **Fork**，复制到你自己的 GitHub 账号（Worker 要从你的仓库拉代码）。

### 2. 创建 R2 存储桶
控制台左侧 **存储和数据库 → R2 对象存储 → 创建存储桶**，名称填 `filecove`，位置「自动」，创建。

### 3. 创建 D1 数据库
**存储和数据库 → D1 SQL 数据库 → 创建数据库**，名称填 `filecove`。建好后打开它，复制 **database_id**。

### 4. 把 database_id 填进 wrangler.toml
在你 Fork 的仓库里打开 `wrangler.toml`，右上角铅笔编辑，把

```toml
database_id = "在这里填写你的 D1 database_id"
```

换成刚复制的 id，点 **Commit changes**。

> 建表不用你管：Worker 第一次被访问时会自动执行建表语句（幂等，重复执行无副作用）。

### 5. 部署 Worker
**计算 → Workers 和 Pages → 创建 → 连接到 GitHub**，选中你 Fork 的仓库，下一步 → **部署**（框架预设留空）。等构建显示成功。

### 6. 绑定 R2 和 D1
进入 Worker → **设置 → 绑定 → 添加**：

| 类型 | 变量名 | 资源 |
| --- | --- | --- |
| R2 存储桶 | `BUCKET` | 第 2 步的桶 |
| D1 数据库 | `DB` | 第 3 步的数据库 |

变量名必须完全一致，否则代码找不到资源。

### 7. 设置变量
**设置 → 变量和机密 → 添加**：

| 名称 | 类型 | 值 |
| --- | --- | --- |
| `ADMIN_PASSWORD` | **机密**（加密） | 你的后台登录密码 |
| `PUBLIC_BASE_URL` | 文本 | 桶的公网域名，**直链的关键**，见下一节 |

### 8. 绑定自定义域名
**设置 → 域和路由 → 添加 → 自定义域**，例如 `pan.yourdomain.com`（域名需托管在 Cloudflare）。

打开它，输入 `ADMIN_PASSWORD` 登录，网盘就能用了。之后生成的分享链接都会用你的域名。

---

## 三、让下载变成「真·直链」

下载链路按这个顺序降级，**不用任何配置也能下载**，但配了 `PUBLIC_BASE_URL` 才是纯直链：

1. **public（推荐）**：配 `PUBLIC_BASE_URL` → `/d/xxx` 直接 302 到 `https://cdn.yourdomain.com/对象key`，流量从对象存储走，不占 Worker
2. **signed**：没公网域名但配了 S3 凭据 → 302 到带签名的临时直链（默认 15 分钟有效）
3. **proxy**：都没有 → Worker 流式转发（R2 出站本身免费，但会消耗请求数）

### 拿到 PUBLIC_BASE_URL 的两种方式

**A. R2 自定义域（推荐）**：R2 → 你的桶 → **设置 → 公共访问 → 自定义域 → 连接域**，填 `cdn.yourdomain.com`。这个值就是 `PUBLIC_BASE_URL`（带 `https://`，末尾不要斜杠）。

**B. r2.dev 临时域名**：同一个页面开启 **r2.dev 域名**，把得到的 `https://pub-xxxx.r2.dev` 填进去。它会限流，只建议临时测试。

> 不想公开桶？那就别配 `PUBLIC_BASE_URL`，改配 S3 凭据走「预签名直链」（见下一节），链接照样是直链，只是带时效性。

### 换用 S3 兼容存储 / 让 R2 走 S3 API

配了 S3 凭据后额外获得两个能力：**浏览器直传**（突破 Worker 100MB 请求体限制）和**大文件分片上传**。

在 **设置 → 变量和机密** 添加（凭据类用「机密」）：

| 名称 | 示例值 |
| --- | --- |
| `S3_ENDPOINT` | `https://<accountid>.r2.cloudflarestorage.com` |
| `S3_BUCKET` | `filecove` |
| `S3_REGION` | `auto` |
| `S3_ACCESS_KEY_ID` | R2 API 令牌的 Access Key ID |
| `S3_SECRET_ACCESS_KEY` | 对应的 Secret |
| `S3_FORCE_PATH_STYLE` | `true` |

R2 的 API 令牌：**R2 概览 → 管理 R2 API 令牌 → 创建 API 令牌**（选「对象读与写」）。

其它存储换成自己的 endpoint 即可，例如：
- Backblaze B2：`https://s3.us-west-004.backblazeb2.com`
- MinIO：`https://minio.example.com`
- 腾讯云 COS：`https://cos.ap-guangzhou.myqcloud.com`

配置好 S3 凭据后 **`BUCKET` 绑定就可以不管了**（有 S3 配置时优先走 S3）。

### 浏览器直传需要的 CORS

走 S3 API / 直传时，桶要允许你的网盘域名访问。R2 桶 → **设置 → CORS 策略 → 添加**：

```json
[
  {
    "AllowedOrigins": ["https://pan.yourdomain.com"],
    "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

`ExposeHeaders` 里的 `ETag` 必须有，否则分片上传读不到 ETag 会失败。

---

## 四、安全与防刷

**后台 → 设置页**可以改这些（存进 D1，不用重新部署）：

- `PUBLIC_BASE_URL` / 下载方式（auto / public / signed / proxy）
- 单 IP 每窗口下载上限、超限封禁时长
- 月度流量上限（超出后拒绝下载，防止 R2 被刷爆）
- Turnstile Sitekey / Secret、人机验证开关
- 修改管理员密码（若环境变量 `ADMIN_PASSWORD` 已设置，环境变量优先，UI 改不生效）

**开启 Turnstile**：Cloudflare → **应用程序安全 → Turnstile → 添加站点**，域名填你的网盘域名，拿到 Sitekey 和 Secret 粘进后台设置，打开「开启人机验证」，分享页下载前就要过一次验证。

**封禁页**可以看到被自动封禁的 IP（含原因和解封时间），也可以手动封禁 / 解封；**记录页**有每次下载的时间、IP、地区、UA、大小，点「封」可直接封禁该 IP。

---

## 五、常见问题

**一定要有域名吗？**
部署本身不需要，但默认的 `workers.dev` 域名在国内很多地方打不开，分享出去别人也用不了，所以自定义域名基本是刚需。

**R2 免费额度够用吗？**
存储 10GB/月，A 类操作（写）每月 100 万次、B 类（读）1000 万次，**出网流量免费**。个人分享完全够，只是要防刷：配好单 IP 限流 + 月度流量上限 + Turnstile。

**上传有大小限制吗？**
只绑 R2（没配 S3 凭据）时走 Worker 中转，单文件受 Worker 请求体限制（约 100MB）。配了 S3 凭据后浏览器直传 + 分片，大文件不受限（默认超过 100MB 自动分片，每片 16MB，3 路并发）。

**桶里本来就有文件，列表里看不到？**
文件列表以数据库记录为准。点文件页的 **同步桶内** 按钮，会扫描桶里已有对象并登记进来。

**换了桶 / 换域名后旧分享链接还能用吗？**
分享记录里存的是对象 key，换桶后 key 还在就能用；换域名后链接的域名部分会跟着新域名走（链接是访问时按当前域名拼的）。

**忘记管理员密码？**
环境变量 `ADMIN_PASSWORD` 优先级最高：去 Worker 设置里改这个机密值即可（改完重新部署生效）；删掉它就回落到数据库里 UI 改过的密码。

**D1 / R2 名字必须叫 filecove 吗？**
不是。桶名和数据库名随意，只要第 6 步绑定时选对就行；代码里固定的是**绑定变量名** `BUCKET` 和 `DB`。

---

## 六、本地开发与测试

```bash
npm install
cp .dev.vars.example .dev.vars   # 填自己的密钥
npx wrangler dev                 # 本地起服务
npx wrangler deploy              # 命令行部署
npm test                         # 端到端冒烟测试（本地模拟 D1/R2，不需要真实账号）
```

测试用本地模拟的 D1 与 R2 跑完整流程：登录、上传、直链、分享、密码、次数限制、限流封禁、同步、搜索、删除。

GitHub Actions 也已配好（`.github/workflows/deploy.yml`），在仓库 Settings 里配上 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID` 等 secrets，推 main 分支就自动部署。

---

## 七、目录结构

```
src/
  index.js     路由与后台接口
  storage.js   存储抽象层（R2 绑定 / S3 兼容）
  sigv4.js     AWS Signature V4（纯 WebCrypto，无依赖）
  share.js     分享页、下载、限流校验
  db.js        D1 数据层（首次访问自动建表）
  auth.js      管理员会话 Cookie、分享密码哈希、Turnstile 校验
  limit.js     限流 / 封禁 / 月度流量
  ui.js        前端单页（HTML + CSS + JS，内嵌无外链）
  util.js      通用工具
schema.sql     表结构（也可手动执行）
```

---

## License

MIT
