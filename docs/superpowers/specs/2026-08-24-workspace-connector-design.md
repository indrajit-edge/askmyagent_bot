# Design Spec: Google Workspace Connector Platform & Admin Panel

## 1. Overview & Objectives

The **Google Workspace Connector Platform** provides a centralized, reusable Google OAuth and connector architecture for a Telegram-based AI personal assistant. This spec defines the initial implementation containing:
*   A **SaaS Backend** (Express, TypeScript, SQLite) to manage Telegram bot actions, centralize Google OAuth, store connections securely, and log API operations.
*   A **Web Frontend** (React, Vite, Vanilla CSS) that serves two purposes:
    1.  A secure **Admin Panel** to monitor bot usage, view user states, track quotas, and manage Telegram users.
    2.  A user-facing **OAuth Callback Portal** that handles the redirect after a Telegram user authorizes a Google service, registers their tokens in the database, and instructs them to return to Telegram.

No self-registration or login exists for regular users on the web platform. Only the system admin can log in.

---

## 2. System Architecture

The platform is structured as a monorepo:

```
AskMyAgent/
├── docs/
│   └── superpowers/specs/   # This spec document
├── backend/                 # Express API & Telegram Bot service
└── frontend/                # Vite React single-page application
```

### 2.1 Backend Core Responsibilities
*   **Telegram Bot Interface:** Processes webhook events and schedules background tasks.
*   **Google OAuth Gateway:** Generates state-protected authorization URLs and exchanges authorization codes for refresh tokens.
*   **Shared Token Storage:** Encrypts and decrypts OAuth tokens.
*   **Registry & Tools:** Integrates the Workspace connectors (starting with Gmail and existing Calendar) to expose safe tools to the AI assistant.
*   **Admin API:** Exposes REST endpoints to query bot stats, logs, and users (authenticated via HttpOnly JWT cookies).

### 2.2 Frontend Core Responsibilities
*   **OAuth Callback Route (`/oauth/callback`):** Passive handler. Receives authorization code and `state`, submits them to the backend to complete authentication, and renders a visually rich success state.
*   **Admin Login Route (`/login`):** Validates credentials against backend-controlled configuration.
*   **Admin Dashboard Route (`/admin`):** Secure panel rendering bot usage graphs, real-time quota counters, and user state lists.

---

## 3. Data Model & Database Schema

We use **SQLite** as the database. It will run locally on the Oracle Cloud VM.

### 3.1 `telegram_users`
Tracks users interacting with the Telegram bot.
```sql
CREATE TABLE telegram_users (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    is_blocked INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 3.2 `google_connections`
Stores encrypted credentials separately per user and provider.
```sql
CREATE TABLE google_connections (
    chat_id INTEGER NOT NULL,
    provider TEXT NOT NULL,                  -- 'gmail', 'calendar', 'drive', etc.
    email TEXT NOT NULL,                     -- Authorized Google account email
    encrypted_refresh_token TEXT NOT NULL,   -- AES-256 encrypted refresh token
    encrypted_access_token TEXT NOT NULL,    -- AES-256 encrypted access token
    token_expiry DATETIME NOT NULL,          -- Access token expiry time
    scopes TEXT NOT NULL,                    -- Space-separated scopes
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (chat_id, provider),
    FOREIGN KEY (chat_id) REFERENCES telegram_users(chat_id) ON DELETE CASCADE
);
```

### 3.3 `api_logs`
Tracks Workspace API usage for stats, diagnostics, and quota tracking.
```sql
CREATE TABLE api_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    connector TEXT NOT NULL,                 -- 'gmail', 'calendar'
    operation TEXT NOT NULL,                 -- e.g., 'gmail_search', 'calendar_today'
    status TEXT NOT NULL,                    -- 'success', 'error', 'quota_limit'
    error_message TEXT,                      -- Details if status is 'error'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES telegram_users(chat_id) ON DELETE SET NULL
);
```

---

## 4. Google OAuth Flow Sequence

```
User (Telegram)           Bot/Backend             Browser/Frontend           Google OAuth
   │                          │                          │                          │
   │ 1. /connectgmail         │                          │                          │
   ├─────────────────────────►│                          │                          │
   │                          │ 2. Generate signed state │                          │
   │                          │    containing chat_id    │                          │
   │ 3. Reply with link ──────┼─────────────────────────►│                          │
   │                          │                          │ 4. Redirect with state  │
   │                          │                          ├─────────────────────────►│
   │                          │                          │                          │ 5. Authenticate &
   │                          │                          │                          │    consent
   │                          │                          │ 6. Redirect back with    │
   │                          │                          │    auth code & state     │
   │                          │                          │◄─────────────────────────┤
   │                          │ 7. POST /api/oauth/token │                          │
   │                          │    (code, state)         │                          │
   │                          │◄─────────────────────────┤                          │
   │                          │                          │                          │
   │                          │ 8. Fetch tokens &        │                          │
   │                          │    save to SQLite        │                          │
   │                          │ 9. Response OK           │                          │
   │                          ├─────────────────────────►│                          │
   │                          │                          │ 10. Display Success      │
   │                          │                          │     "Return to Telegram" │
```

---

## 5. Security & Access Control

*   **OAuth State Verification:** The `state` parameter generated by the backend is a signed, timed token containing the user's `chat_id`. This prevents cross-site request forgery and hijacking of tokens across different users.
*   **Token Encryption:** Refresh and access tokens stored in `google_connections` are encrypted using AES-256-GCM using a server-side `ENCRYPTION_KEY` kept in environment variables.
*   **Admin Credentials:** Stored on the server in `.env` as `ADMIN_USERNAME` and `ADMIN_PASSWORD_HASH` (bcrypt). No DB table exists for web administrators.
*   **Admin Sessions:** Auth is maintained via an HttpOnly cookie containing a short-lived signed JWT. This mitigates XSS risks.

---

## 6. Verification & Testing Strategy

1.  **Unit Tests:**
    *   Verify OAuth state generation and signature validation.
    *   Verify AES-256 token encryption and decryption.
    *   Verify admin login credentials and JWT authentication middlewares.
2.  **Integration Tests:**
    *   Mock SQLite database interactions for CRUD operations on user connections and API logs.
    *   Verify route guards return 401/403 for unauthenticated dashboard API calls.
3.  **UI Verification:**
    *   Verify visual feedback during the OAuth callback (loading -> success/failure transitions).
    *   Verify layout responsiveness, accessibility, and style integrity.
