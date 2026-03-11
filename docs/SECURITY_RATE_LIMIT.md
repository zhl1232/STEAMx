# Rate Limiting Guide

This project uses two layers of rate limiting.

**Layer 1: App middleware (always on)**
- Implemented in `middleware.ts` for `/api/*`.
- IP-based counters stored in memory per worker instance.
- Includes stricter limits for sensitive write endpoints like `/api/tips` and `/api/messages/send`.
- Designed as a guardrail, not a hard security boundary.

**Layer 2: Cloudflare WAF (recommended for production)**
- Enforces edge limits before requests hit the Worker.
- Provides global counters across all edge instances.

**Suggested Cloudflare rules**
- `POST /api/tips` — limit 10 requests per 60 seconds per IP.
- `POST /api/messages/send` — limit 20 requests per 60 seconds per IP.
- `POST /api/projects` — limit 6 requests per 60 seconds per IP.
- `POST /api/*` — limit 30 requests per 60 seconds per IP.
- `GET /api/*` — limit 120 requests per 60 seconds per IP.

**Notes**
- Several client-side flows write directly to Supabase (e.g., likes, comments, XP logs). These do not pass through Next.js middleware.
- For full protection, move those writes behind server routes or enforce limits in Supabase via RLS and database-side checks.
