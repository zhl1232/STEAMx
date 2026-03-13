# Rate Limiting Guide

This project uses three layers of rate limiting.

**Layer 1: App middleware (always on)**
- Implemented in `middleware.ts` for `/api/*`.
- IP-based counters stored in memory per worker instance.
- Includes stricter limits for sensitive write endpoints like `/api/tips` and `/api/messages/send`.
- Designed as a guardrail, not a hard security boundary.

**Layer 2: Cloudflare WAF (recommended for production)**
- Enforces edge limits before requests hit the Worker.
- Provides global counters across all edge instances.

**Layer 3: Database-backed per-user limits (write endpoints)**
- Implemented via `consume_rate_limit` RPC and enforced in key write API routes.
- Guards against distributed edge instances by using the database as the source of truth.
- Returns `429` with `Retry-After` and `X-RateLimit-*` headers when exceeded.

## Cloudflare WAF 配置（自动化脚本）

仓库提供脚本快速创建/补齐 WAF 全局限流规则（不会删除已有规则）：

```bash
CF_API_TOKEN=xxx CF_ZONE_ID=yyy node scripts/cloudflare-waf-rate-limit.mjs
```

脚本会在 `http_ratelimit` 规则集下创建以下规则（若不存在）：
- `POST /api/tips` — 10 / 60s
- `POST /api/messages/send` — 20 / 60s
- `POST /api/projects` — 6 / 60s
- `POST /api/*` — 30 / 60s
- `GET /api/*` — 120 / 60s

说明：
- `CF_API_TOKEN` 需要具有 Zone Rulesets 的编辑权限（建议最小权限）。
- `CF_ZONE_ID` 为 Cloudflare Zone ID。
  - 若有 preview/staging 域名，请分别在对应 Zone 执行一次。

**Suggested Cloudflare rules**
- `POST /api/tips` — limit 10 requests per 60 seconds per IP.
- `POST /api/messages/send` — limit 20 requests per 60 seconds per IP.
- `POST /api/projects` — limit 6 requests per 60 seconds per IP.
- `POST /api/*` — limit 30 requests per 60 seconds per IP.
- `GET /api/*` — limit 120 requests per 60 seconds per IP.

**Notes**
- Several client-side flows write directly to Supabase (e.g., likes, comments, XP logs). These do not pass through Next.js middleware.
- For full protection, move those writes behind server routes or enforce limits in Supabase via RLS and database-side checks.
