# AskMyAgent — Render Backend Deployment Guide

This guide covers deploying the AskMyAgent Node.js/Express/TypeScript backend to [Render](https://render.com/).

---

## 1. Architecture Overview

- **Service Type**: Render Web Service (Node.js Environment)
- **Runtime**: Node.js 20+
- **Statelessness**: Fully stateless backend (zero persistent local disk dependency)
- **Database**: Managed PostgreSQL (`DATABASE_URL`) with connection pooling and SSL
- **Health Check Endpoint**: `GET /api/health`
- **Reverse Proxy**: Render Edge Proxy (1 hop) passing client IP in `X-Forwarded-For`

---

## 2. Prerequisites

1. Render account at [render.com](https://dashboard.render.com).
2. Managed PostgreSQL database instance (from Supabase, Neon, AWS RDS, Render PostgreSQL, etc.).
3. Google Cloud OAuth 2.0 Credentials (for Workspace connectors).
4. Telegram Bot Token from `@BotFather`.
5. Public VPN IP for `ADMIN_ALLOWED_IPS` (e.g. `130.210.5.232`).

---

## 3. Step-by-Step Deployment on Render

### Step 1: Create a Web Service
1. Log in to the [Render Dashboard](https://dashboard.render.com) and click **New +** > **Web Service**.
2. Connect your GitHub account and select the `askmyagent_bot` repository.
3. Configure the following service settings:
   - **Name**: `askmyagent-backend`
   - **Region**: Frankfurt (EU Central) or your preferred region
   - **Branch**: `main`
   - **Root Directory**: *(leave blank to use repository root)*
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build --workspace=backend`
   - **Start Command**: `npm run start --workspace=backend`
   - **Plan**: `Starter` (or preferred plan)

### Step 2: Configure Health Check Path
Under **Advanced**:
- **Health Check Path**: `/api/health`

---

## 4. Environment Variables on Render

In the **Environment** tab of your Render Web Service, add the following environment variables:

| Variable | Example Value | Description / Secret Status |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enforces production security and optimization |
| `FRONTEND_URL` | `https://askmyagent.com` | Production Vercel domain for CORS & OAuth redirects |
| `CORS_ORIGIN` | `https://askmyagent.com` | Allowed CORS origin for browser requests |
| `DATABASE_URL` | `postgres://user:pass@host:5432/askmyagent?sslmode=require` | **SECRET**: Managed PostgreSQL connection string |
| `DB_SSL` | `true` | Enables PostgreSQL SSL mode |
| `ADMIN_USERNAME` | `admin` | **SECRET**: Admin Control Center username |
| `ADMIN_PASSWORD_HASH` | `$2b$12$...` | **SECRET**: Bcrypt hash of admin password |
| `ADMIN_ALLOWED_IPS` | `130.210.5.232` | **RESTRICTED**: Comma-separated public VPN IPs |
| `ENCRYPTION_KEY` | *(64-hex char string)* | **SECRET**: 32-byte AES-256-GCM token storage key |
| `JWT_SECRET` | *(64-char random base64url string)* | **SECRET**: Admin session & OAuth state signing secret |
| `INTERNAL_API_TOKEN` | *(random 32-char hex string)* | **SECRET**: Shared secret for VM bot → backend internal API calls (`x-internal-token`) |
| `GOOGLE_CLIENT_ID` | `xyz.apps.googleusercontent.com` | Google Cloud OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | *(secret)* | **SECRET**: Google Cloud OAuth Client Secret |
| `GOOGLE_REDIRECT_URI` | `https://api.askmyagent.com/api/oauth/callback` | OAuth redirect callback endpoint |
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-DEF...` | **OPTIONAL / OUTBOUND ONLY**: Used exclusively for one-way OAuth completion notifications (`sendMessage`). The VM Python bot owns all inbound polling (`getUpdates`). |
| `TRUST_PROXY` | `1` | Express trusted proxy hop count for Render ingress |

*(Note: Render automatically injects `PORT=10000`, which Express binds to via `process.env.PORT`)*.

---

## 5. Custom Domain Configuration (`api.askmyagent.com`)

1. In the Render Dashboard: Navigate to your Web Service > **Settings** > **Custom Domains** > **Add Custom Domain**.
2. Enter: `api.askmyagent.com`.
3. In your DNS provider (Cloudflare, Namecheap, Route53, etc.), add the CNAME record instructed by Render:
   ```text
   CNAME  api.askmyagent.com  ->  askmyagent-backend.onrender.com
   ```
4. Render automatically provisions and renews an SSL/TLS certificate via Let's Encrypt.

---

## 6. VM Bot Integration (Internal API)

The backend is **not** a Telegram listener. The Python bot on the VM owns the
bot token exclusively for inbound traffic (polling mode) and calls this service over HTTPS:

```bash
# Example: execute a Google Workspace tool on behalf of a Telegram user
curl -X POST https://api.askmyagent.com/api/internal/tool-call \
  -H "Content-Type: application/json" \
  -H "x-internal-token: <INTERNAL_API_TOKEN>" \
  -d '{"chat_id": 123456789, "tool_name": "calendar_today", "args": {}}'
```

Available internal endpoints:
- `POST /api/internal/tool-call` — run a connector tool (`{chat_id, tool_name, args}`)
- `POST /api/internal/oauth/start` — get a Google consent URL (`{chat_id, provider}`)
- `GET  /api/internal/oauth/status?chat_id=&provider=` — connection status
- `GET  /api/internal/tools` — registered tool schemas for Gemini function calling
- `POST /api/internal/confirmation/resolve` — resolve pending write confirmations

> **Telegram Bot Token Usage**:
> The optional `TELEGRAM_BOT_TOKEN` env var is used **strictly for outbound**
> notifications (e.g. sending a one-way `sendMessage` confirmation after OAuth
> completion). The backend **never** calls `getUpdates`, `setWebhook`, or
> `deleteWebhook`, ensuring zero 409 Conflict collisions with the VM Python bot.
> `TELEGRAM_WEBHOOK_URL` and `TELEGRAM_WEBHOOK_SECRET` must remain deleted.

