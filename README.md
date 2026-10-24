# Cloudrive —— 用 Cloudflare Workers + R2 自建网盘（下载走直链）

> 当前版本 **v1.6.0**（成品版），变更记录见 [CHANGELOG.md](./CHANGELOG.md)

把 **Cloudflare R2**（或任何 S3 兼容存储）变成能上传、能分享、能直链下载的网盘，全部跑在 **Workers** 上（不是 Pages），不用服务器，用免费额度就能跑。

- 存储：R2 绑定 **或** 任意 S3 兼容存储（R2 的 S3 API、Backblaze B2、MinIO、腾讯 COS、阿里云 OSS…），改几个变量就能换
- 下载：**直链优先**，`/d/xxx` 直接 302 到对象存储本身，不经过 Worker 中转
- 分享：短链 `/s/xxx`，支持有效期、访问密码、下载次数
- 防护：单 IP 限流、超限自动封禁、手动封禁解封、Cloudflare Turnstile 人机验证、月度流量上限
- 界面：液态玻璃风格单页，手机浏览器也好用；零依赖、无构建产物

---

## 关于版本

**成品版**，功能已经完整可用，后续只会做维护和少量改进——修 bug、小幅优化体验、适配 Cloudflare 平台变化，不会有破坏性改动。

## 技术栈

| 层 | 用的东西 |
| --- | --- |
| 运行时 | Cloudflare **Workers**（不是 Pages），无构建产物的额外托管 |
| 后端 | **TypeScript**（原生 fetch 路由，无框架） |
| 前端 | **Vue 3** + **Tailwind CSS**，用 Vite 构建 |
| 数据库 | D1（文件、分享、记录、封禁、配置） |
| 存储 | R2 绑定 或 任意 S3 兼容存储 |

前端是**构建后内联进 Worker** 的（`npm run build` → `src/web-assets.ts`），所以部署仍然只有一个 Worker 入口，不需要静态资源绑定。

本地开发：

```bash
npm install
npm run dev            # wrangler dev
npm run build          # 构建前端并内联（部署前必做）
npm run typecheck      # tsc --noEmit
npm test               # vitest
```

用 Actions 部署的话这些会自动跑，不用手动执行。

## 界面

设计参考 **Cloudreve**：左侧图标侧边栏 + 顶部面包屑 + 主内容区，Material Design 蓝白配色。

- **三栏布局**：左侧导航抽屉 + 中间文件网格 + 右侧详情面板
- **左侧导航**：我的文件下按类型分「图片 / 视频 / 音乐 / 文档 / 软件」，点一下即筛选
- **文件区**：支持**网格 / 列表双视图**切换（默认网格），图片显示缩略图，支持多选
- **详情面板**：点文件后在右侧展开，显示预览、类型、大小、上传时间，可直接创建分享、复制直链、删除
- **上传**：顶栏「+ 新建」或拖拽到虚线框；右下角「上传任务」面板逐任务显示进度条、百分比、已传大小/总大小、实时速度
- **设置页**：分组卡片表单，每项右侧标注这个值来自「后台设置 / 环境变量 / 内置默认」
- **登录页**：居中卡片 + 云朵 Logo，底部显示存储与协议信息
- **分享页**：大图预览 + 元信息 + 下载区；失效页用大号状态码

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

## 二、部署（GitHub Actions 全自动，不用改任何文件）

全程不用命令行，也不用往 `wrangler.toml` 里填 `database_id`——**D1 数据库和 R2 存储桶都由 Actions 自动创建**，id 会自动写回配置文件再部署。

### 1. Fork 本仓库
点右上角 **Fork**，复制到你自己的 GitHub 账号。

### 2. 拿 Cloudflare API 令牌和 Account ID
**Account ID**：打开 Cloudflare 控制台，右侧栏或 **Workers 和 Pages** 概览页就能看到一串 32 位十六进制字符。

**API 令牌**：右上角头像 → **我的个人资料 → API 令牌 → 创建令牌**，用「**编辑 Cloudflare Workers**」模板，或自定义令牌时至少给这三项权限：

| 范围 | 权限 |
| --- | --- |
| Account → Workers Scripts | 编辑 |
| Account → D1 | 编辑 |
| Account → R2 | 编辑 |

### 3. 在 GitHub 里配 Secrets
进你 Fork 的仓库 → **Settings → Secrets and variables → Actions → New repository secret**，添加：

| Secret | 是否必需 | 说明 |
| --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | ✅ | 第 2 步的令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ | 第 2 步的 Account ID |
| `ADMIN_PASSWORD` | ✅ | 网盘后台登录密码，自己设一个 |
| `TURNSTILE_SECRET` | 可选 | 开人机验证时填 |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | 可选 | 改用 S3 兼容存储时填 |

> 少配 `ADMIN_PASSWORD` 的话，工作流会在第一步直接报错提醒你，不会部署出一个登不进去的网盘。

### 4. 触发部署
**Actions → Deploy Cloudrive → Run workflow**（之后每次推 main 分支也会自动部署）。

工作流会依次做：检查 Secrets → 装依赖 → **自动建/复用 D1 数据库 `filecove` 并把 id 写回 `wrangler.toml`** → **自动建/复用 R2 桶 `filecove`** → 建表 → 部署 Worker 并注入密钥。

跑完在 **Run workflow 的 Summary** 里能看到用到的库名和桶名。数据库已存在就复用，重跑不会重复创建。

### 5. 配置在网页里改，基本不用碰环境变量

默认配置会在 Worker **首次运行时写进 D1**（`settings` 表），之后一律以数据库里的值为准。所以：

- 环境变量**一个都不用配**（`ADMIN_PASSWORD` 例外，它走 Secrets）
- 设置页改后立即生效，重新部署不会冲掉
- 需要切的项全在设置页：直链域名、下载方式、限流封禁、上传分片、存储驱动、S3 信息、Turnstile、登录密码

优先级：**设置页（数据库）> 环境变量 > 内置默认**。每个配置项右侧的小标签会告诉你当前值来自哪一层。

只有你想让 Actions 代管某个变量时，才需要仓库变量 `PRESET_VARS`（每行 `K=V`）；留空就完全不写。

Actions 会自动把一套默认变量写进 Worker，所以部署完你在控制台能看到一整排（`DOWNLOAD_MODE`、`IP_MAX_DOWNLOADS`、`UPLOAD_MAX_SIZE` 等）。规则是：

1. Worker 上**没有**的变量 → 用默认值补上（首次部署会看到一整排）
2. Worker 上**已有**的 → 原样保留，绝不动
3. 仓库变量 `PRESET_VARS` 里**显式写明**的 → 以它为准，覆盖同名变量

想让 Actions 代管某个变量时，到 **Settings → Secrets and variables → Actions → Variables** 添加 `PRESET_VARS`，每行一个 `K=V`：

```
PUBLIC_BASE_URL=https://cdn.example.com
DOWNLOAD_MODE=auto
```

留空也没问题，只是不额外覆盖而已。密钥（如 `ADMIN_PASSWORD`）不在这个名单里，请继续用 Secrets。

> 后台「设置」页里改的配置会存进数据库，**优先级高于环境变量**，也不会被部署冲掉。每个配置项右边的小标签会告诉你这个值现在来自「后台设置 / 环境变量 / 内置默认」。

### 6.（可选）手动微调单个变量
默认**不需要做这一步**。仓库变量 `PRESET_VARS` 留空时，Actions 一个变量都不写，你在控制台改的值（比如 `PUBLIC_BASE_URL`）每次部署都会完整保留。

想让 Actions 代管时，到 **Settings → Secrets and variables → Actions → Variables** 添加 `PRESET_VARS`，每行一个 `K=V`：

```
PUBLIC_BASE_URL=https://cdn.example.com
DOWNLOAD_MODE=auto
```

只有写在这里的变量会覆盖控制台的同名变量，**其余变量不受影响**。密钥（如 `ADMIN_PASSWORD`）不在这个名单里，请继续用 Secrets。

同理，密钥也遵循「控制台优先」：`ADMIN_PASSWORD` 若只在控制台配过、GitHub Secret 没配，Actions 会**跳过不覆盖**，也不会因此报错。

### 6. 最后两件必须手动做的事
自动化只到部署为止，这两步要你自己的域名，必须手动：

1. **绑定自定义域名**：Cloudflare → **Workers 和 Pages → cloudrive → 设置 → 域和路由 → 添加 → 自定义域**，例如 `pan.yourdomain.com`（`workers.dev` 域名国内常打不开）。
2. **配 `PUBLIC_BASE_URL`**：同一个 Worker 的 **设置 → 变量和机密 → 添加**（类型选「文本」），值填桶的公网域名，见下一节。

完成，打开你的域名、输入 `ADMIN_PASSWORD` 即可登录。

> 顺带一提：建表不用管，Worker 第一次被访问时会自动建（工作流里也执行了一次 `schema.sql` 让它立即就绪）。

### 不想用 Actions？走 Cloudflare 网页端
**计算 → Workers 和 Pages → 创建 → 连接到 GitHub** 这条路径不会跑我们的脚本，需要先拿到 `database_id` 填进 `wrangler.toml`。两种方式任选：

- 本地跑一次：`npm install && npm run setup`（需要 Cloudflare 凭据，会自动建库并把 id 写回文件，然后提交这个改动）
- 或手动：控制台建好 D1 后复制 id，替换 `wrangler.toml` 里的 `database_id`

之后同样在设置里绑定 `BUCKET`（R2 桶）和 `DB`（D1 库）两个变量即可，名字必须一致。

### 图片预览

图片文件现在直接出图，不用下载才知道里面是什么：

- **后台文件列表**：每行显示缩略图，点一下看大图（灯箱）
- **分享页**：图片直接在页面上方铺开预览，点图片放大
- 非图片按类型给图标（视频 / 音频 / 压缩包 / 文档 / 其他）
- 缩略图和预览都走直链或预签名地址，不额外占 Worker 流量；加载不出来会自动退回图标

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

**密码输对了，页面一闪又回到登录页？**
这是表单默认提交导致的：`login()` 是 async 函数，返回的是 Promise，而 `return login()` 这种写法返回真值**并不能**阻止表单默认提交——浏览器会立刻发起一次原生 GET 导航，把还在飞的 `/api/login` 请求掐断，Cookie 根本没机会写入，页面自然又回到登录页。现在改为同步 `return false` 并在函数内 `preventDefault()` 双保险。

**输入密码后一直回到登录页，进不去后台？**

先打开 `/api/status`，看这几个字段就能定位：

| 字段 | 含义 | 说明 |
| --- | --- | --- |
| `hasAdmin` | 是否已配置管理员密码 | `false` 说明 Worker 侧没有 `ADMIN_PASSWORD` |
| `admin` | 当前 Cookie 是否被接受 | `true` 说明其实已登录 |
| `cookieState` | `none` / `valid` / `invalid` | 见下表 |

`cookieState` 三种情况分别代表：

- **`none`**：浏览器压根没发 Cookie。要么还没登录，要么**浏览器没把 Cookie 存下来**（无痕模式、隐私扩展、HTTP/HTTPS 混用）。登录页检测到「刚登录成功过却没有 Cookie」会直接提示这一点。
- **`valid`**：会话正常。若仍停在登录页，是浏览器缓存了页面，硬刷新（Ctrl/Cmd + Shift + R）即可；现在登录成功后也会自动带到后台。
- **`invalid`**：Cookie 发了但 Worker 判定无效，通常是**密码改过导致旧会话失效**，或同域有多个部署互踢。清空本站 Cookie 重新登录。

如果 `hasAdmin` 为 `true` 但你输入密码后提示「密码错误」，那就是**密码值本身对不上**。按常见程度排：

1. **首尾混进了空格或换行** —— 从控制台复制 Secret 时极易发生，肉眼完全看不出来。现在比对时两侧都会自动去空白；若 Worker 里那个值确实带空白，登录页会提示「长度 X，去空白后 Y」，删掉重新粘贴并重新部署即可。
2. **GitHub Secret 与 Cloudflare 控制台变量是两份独立的值** —— 后部署的会覆盖前者。建议只留一处，避免自己跟自己对不上。
3. **改完没重新部署** —— 改变量不会自动注入已运行的 Worker，必须重新部署才生效。

按这个顺序排查，登录页本身也会把检测结果显示出来（打开页面时会先探测一次）：

1. **Worker 侧根本没设 `ADMIN_PASSWORD`** —— 最常见。登录页会红字提示「Worker 侧还没设置管理员密码」并禁用输入框。去 Workers → `cloudrive` → 设置 → 变量和机密，添加 `ADMIN_PASSWORD`（类型选「机密」），保存后**重新部署**才生效（改变量不会自动注入已运行的 Worker）。用 GitHub Actions 部署的话它会自动注入。
2. **用的是 HTTP 访问** —— 登录页顶部会黄字提示。浏览器不会保存 HTTPS-only 的 Cookie，必须走 HTTPS。
3. **在后台「设置」里改过密码，但环境变量还在** —— 环境变量 `ADMIN_PASSWORD` 优先级更高，请用环境变量那个密码登录（登录页会提示这一点）。
4. **浏览器缓存了登录页** —— 登录成功已改为 `location.replace('/?_=时间戳')` 强制绕开缓存；还不行就硬刷新（Ctrl/Cmd + Shift + R）或清一下该站点的 Cookie。

打开 `/api/status` 可以直接看到 `hasAdmin`（是否已配置密码）、`hasEnvAdmin`、`hasDbAdmin`、`https`，不需要登录。

**侧栏「已用」显示多少？**
统计 `files` 表里所有文件的 `size` 总和。容量上限可在设置页改（设置 → 存储 → 容量上限，默认按 R2 免费额度 10 GB），填 0 就不显示进度条、只显示已用容量。用 S3 或其他存储时按实际容量填。

**设置页填了公网域名，点直链还是提示没配？**
先点设置页公网域名右边的**「检测」**按钮，它会直接告诉你属于哪种：

- **还没填公网域名** —— 填了才有对象直链。不填也能用，下载会走预签名地址（同样不经过 Worker，只是带 15 分钟时效）
- **已填了域名，但存储层没读到** —— 配置是从数据库读的，最常见的原因是**还没重新部署**。重新部署一次即可
- **直链已生效** —— 会给一个示例链接，点开如果是 404，说明这个域名在存储桶上没有开公开访问，需要到桶的「公共访问」里绑定自定义域

**图标（favicon）**
页面图标是内联 SVG：蓝色云朵 + 白色文件夹 + 右下白色弧线，不带文字。访问 `/favicon.svg` 或 `/logo.svg` 可以直接查看，替换 `src/logo.js` 里的 `LOGO_SVG` 即可换成你自己的图形。

**图片/缩略图加载不出来？**
预览走 Worker 代理，不跳直链——因为直链域名一旦没有公开访问（很常见），缩略图就会全部 404。预览流量很小，先保证一定能显示；**下载仍然走直链**，不受影响。

另外缩略图和分享页预览失败时会自动重试一次（换 query 绕开缓存），仍失败才退回类型标签/占位，不会出现破图。

**后台一直卡在「加载中…」？**
任何列表加载失败都会显示「加载失败 + 重试」按钮，不会出现假死式的「加载中…」。如果一直停在加载中，先点重试；仍不行就打开浏览器控制台看 `/api/files` 的返回。

文件列表加载失败时还会先自动重试一次（D1 冷启动偶尔会慢一下）。

**控制台里只剩一个 ADMIN_PASSWORD，其他变量去哪了？**
这是正常的。配置存在数据库里、在设置页改，不需要出现在 Worker 的环境变量中——所以控制台只显示你自己加的 `ADMIN_PASSWORD`。

`wrangler.toml` 里刻意不声明 `[vars]`：一旦声明，wrangler deploy 会把配置文件里的值同步到 Worker，你在控制台改的值每次部署都会被冲回默认。功能上不受影响，代码里每一项都有同样的默认值。

**重新部署会不会把我改的配置冲掉？**
不会。配置存在数据库里，优先级高于环境变量；`wrangler.toml` 里也刻意不声明 `[vars]`（声明了会被 wrangler deploy 同步覆盖）：

- 设置页改的值：存进数据库，重新部署不动
- 文本变量（如 `PUBLIC_BASE_URL`）：部署完全不碰
- 密钥（如 `ADMIN_PASSWORD`）：GitHub Secret 配了才覆盖；只在控制台配过则原样保留

想让 Actions 代管某个变量，见第 5 步的 `PRESET_VARS`。

**下载跳到 404（页面不存在：/d/xxx/...）？**
直链域名没写完整。`PUBLIC_BASE_URL` 只填 `v6.cc.cd` 这种裸域名时，拼出来的链接没有 `https://`，浏览器会把它当成**相对路径**，按当前地址 `/d/abc123` 解析成 `/d/v6.cc.cd/...` —— 于是 404。

填裸域名会自动补 `https://`：写 `cdn.example.com` 或 `https://cdn.example.com` 都可以。设置页保存时也会校验，填错会直接提示。

如果补了 https 后还是 404，那说明这个域名本身不是桶的公网访问域名：R2 需要在桶的「设置 → 公共访问 → 自定义域」里绑定，S3 则需要开启公有读或挂 CDN。

**忘记登录密码？**
环境变量 `ADMIN_PASSWORD` 优先级最高：去 Worker 设置里改这个机密值即可（改完重新部署生效）；删掉它就回落到数据库里 UI 改过的密码。

**自动建库是怎么实现的？需要装 wrangler 吗？**
脚本走 Cloudflare REST API（`/d1/database`、`/r2/buckets`），返回的是确定的 JSON，不依赖 `wrangler d1 create` 的输出格式；只有 REST 调不通时才回退到 wrangler CLI 解析文本。能拿到 uuid 后自动写回 `wrangler.toml` 的 `database_id`。

**想指定数据库 / 桶的地理位置？**
在仓库 Secrets 之外，用仓库变量（Variables）加 `D1_LOCATION` 或 `R2_LOCATION`，可选值：`wnam`（北美西）、`enam`（北美东）、`weur`（西欧）、`eeur`（东欧）、`apac`（亚太）、`oc`（大洋洲）。不填就由 Cloudflare 自动选。

**Actions 报权限错误 / 建库失败？**
多半是 API 令牌权限不够。确认令牌有 **Workers Scripts: 编辑**、**D1: 编辑**、**R2: 编辑** 三项（用「编辑 Cloudflare Workers」模板最省事），并且 `CLOUDFLARE_ACCOUNT_ID` 填的是账户 ID 而不是区域 ID。

**重跑工作流会重复建库或丢数据吗？**
不会。脚本先查同名数据库，存在就复用；R2 桶已存在也直接跳过。只有首次会创建。

**D1 / R2 名字必须叫 filecove 吗？**
不是。改 `wrangler.toml` 里的 `bucket_name` / `database_name`（或用环境变量 `R2_BUCKET_NAME` / `D1_DATABASE_NAME` 覆盖），后续 Actions 会按新名字自动创建。代码里固定不变的是**绑定变量名** `BUCKET` 和 `DB`。
注意：改名会指向**新建的空库/空桶**，原来的文件不在里面——要换名字请先迁移数据。项目从 Filecove 改名为 Cloudrive 时就是这么处理的：只改 Worker 名和界面显示，桶名和库名保持 `filecove`，所以已上传的文件不受影响。

---

## 六、本地开发与测试

```bash
npm install
cp .dev.vars.example .dev.vars   # 填自己的密钥
npm run setup                    # 自动建 D1/R2 并写回 database_id（需 Cloudflare 凭据）
npx wrangler dev                 # 本地起服务
npx wrangler deploy              # 命令行部署
npm test                         # 端到端冒烟测试（本地模拟 D1/R2，不需要真实账号）
```

测试用本地模拟的 D1 与 R2 跑完整流程：登录、上传、直链、分享、密码、次数限制、限流封禁、同步、搜索、删除；另有一组用伪造 wrangler 命令验证「自动建库并写回 id」的测试，都不需要真实 Cloudflare 账号。

GitHub Actions 已配好（`.github/workflows/deploy.yml`）：配好 Secrets 后推 main 分支或手动 Run workflow，就会自动建库建桶并部署，详见第二章。

---

## 七、目录结构

```
scripts/
  setup-resources.mjs   自动创建/复用 D1 与 R2，并写回 database_id
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
