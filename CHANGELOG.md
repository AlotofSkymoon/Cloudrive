# 更新日志

本项目遵循语义化版本（SemVer）。每次合并进 `main` 的可感知变更都会记在这里，并发一条 GitHub Release。

- **主版本**：不兼容的变更（如配置项改名、表结构不兼容升级）
- **次版本**：新增能力（通常以新增功能为主）
- **修订号**：修 bug、优化体验，升级无感

---

## 0.3.1 — 2026-10-23

修掉「没配可选 Secret 就部署失败」的问题——只要没开 Turnstile 或没用 S3，Actions 就会失败。

**修复**
- `wrangler-action` 的 `secrets` 输入要求列出的每个名字在 env 里都有非空值，否则报 `Value for secret TURNSTILE_SECRET not found in environment` 并中断部署。现在改为先用 `scripts/ci-secrets.mjs` 过滤，**只把确实配了值的密钥列进上传名单**，没配的直接跳过
- 密钥名单一律只打印名字，不打印值（`GITHUB_OUTPUT` 与日志都不含明文）

**新增**
- `scripts/ci-secrets.mjs`：输出需要上传的密钥名单，缺 `ADMIN_PASSWORD` 时明确报错
- `CI_SECRETS_CANDIDATES` 可覆盖候选名单，方便接入自定义密钥
- 新增 7 项测试：过滤、全量、缺必需项报错、空白值判定、输出不泄漏密钥值、自定义名单

升级方式：拉最新代码重新部署即可，无破坏性变更。

---

## 0.3.0 — 2026-10-23

修掉 Actions 自动建库失败的问题，这是 Cloudflare 网页端之外的主推部署路径。

**修复**
- `wrangler d1 create` 在 wrangler 4.x 下**不支持 `--json`**，传了会直接打帮助并退出，导致「创建 D1 数据库失败」——现在改为直接调用 Cloudflare REST API（`/d1/database`、`/r2/buckets`），返回确定的 JSON，不再依赖 CLI 输出格式
- 创建时返回 `already exists`（并发或被别人先建好）不再报错，自动转为复用已有数据库
- API 返回 401/403 时给出明确提示，指向「令牌缺少 D1 编辑权限」这个真实原因，而不是甩一段 wrangler 帮助

**新增**
- `D1_LOCATION` / `R2_LOCATION` 可指定数据库与桶的地理位置（`apac`/`weur`/`wnam` 等），不填由 Cloudflare 自动选
- REST 不可用时回退到 wrangler CLI 兜底，两条路都失败才报错退出

**测试**
- 资源脚本新增 8 项测试：本地起 HTTP 服务模拟 Cloudflare API，覆盖复用 / 创建 / id 已填时跳过 / 已存在转复用 / R2 存在时跳过 / 鉴权失败回退 / 双重失败报错 / 缺凭据
- 测试改用异步 `spawn`（`spawnSync` 会阻塞 mock 服务导致死锁）

升级方式：拉最新代码重新部署即可，无破坏性变更。

---

## 0.2.0 — 2026-10-23

部署从「手动填 id」变成「Actions 全自动」。

**新增**
- `scripts/setup-resources.mjs`：自动创建/复用 D1 数据库与 R2 存储桶，并把 `database_id` 写回 `wrangler.toml`
- `deploy.yml` 重排顺序：先校验必需 Secrets（缺 `ADMIN_PASSWORD` 会明确报错，不再部署出登不进去的网盘）→ 准备资源 → 建表 → 部署
- `npm run setup`：本地也能一键准备资源
- 新增「同步桶内」：扫描存储桶里已有对象并登记进列表
- 文件列表支持关键字搜索与分页加载
- 大文件分片上传改为 3 路并发

**变更**
- `wrangler.toml` 的 `database_id` 改为占位提示，由 Actions / `npm run setup` 自动填充，无需手填

---

## 0.1.0 — 2026-10-22

首个可用版本。

**新增**
- 存储抽象层：R2 绑定 或 任意 S3 兼容存储（SigV4 纯 WebCrypto 实现，通过 AWS 官方测试向量）
- 下载直链优先：`PUBLIC_BASE_URL` 直链 → 预签名直链 → Worker 代理兜底
- 分享短链 `/s/xxx`：有效期、访问密码、下载次数限制；`/direct/xxx` 返回 JSON 直链
- 防护：单 IP 限流、超限自动封禁、手动封禁解封、Turnstile 人机验证、月度流量上限
- 下载记录（时间/IP/地区/UA/大小）与统计概览
- 液态玻璃风格单页界面，零依赖、无构建产物

**修复**
- 下载次数上限判断失效（SQL 参数顺序问题），超限仍能继续下载
- 错误页返回字符串而非 `Response`，生产环境会直接报错

---

## 发版流程

```bash
# 1. 更新 package.json 的 version，并在上面补一段 CHANGELOG
# 2. 提交并打 tag
git tag -a v0.3.1 -m "v0.3.1"
git push origin v0.3.0
# 3. 在 GitHub 上基于该 tag 发 Release，正文抄对应版本的 CHANGELOG 段落
```
