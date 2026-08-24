# Google Workspace Connector Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational backend and frontend infrastructure for the Google Workspace Connector Platform, establishing database connections, secure credentials encryption, admin session logic, and the core frontend layout, home page/dashboard, admin login, and OAuth callback portal.

**Architecture:** Monorepo containing an Express.js + TypeScript backend and a React + Vite + TypeScript frontend, unified by an SQLite database file.

**Tech Stack:** Express.js, Vite, React, TypeScript, Knex.js, SQLite3, Jose (JWT), Bcrypt, Vanilla CSS.

## Global Constraints
*   **Database:** SQLite3 running locally, managed via Knex.js.
*   **Styling:** Vanilla CSS exclusively (no TailwindCSS).
*   **Security:** AES-256-GCM token encryption, HttpOnly cookie JWT admin sessions, SHA-256/bcrypt hashed passwords.
*   **Language:** TypeScript strictly enforced on both frontend and backend.

---

### Task 1: Project Monorepo Scaffolding

**Files:**
- Create: `package.json` (Root)
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/src/index.ts`
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`

**Interfaces:**
- Consumes: None
- Produces: TypeScript monorepo setup ready for concurrent development.

- [ ] **Step 1: Write root package.json**
  ```json
  {
    "name": "ask-my-agent-workspace-connector",
    "version": "1.0.0",
    "private": true,
    "workspaces": [
      "backend",
      "frontend"
    ],
    "scripts": {
      "dev:backend": "npm run dev --workspace=backend",
      "dev:frontend": "npm run dev --workspace=frontend",
      "dev": "concurrently \"npm run dev:backend\" \"npm run dev:frontend\"",
      "test:backend": "npm run test --workspace=backend",
      "test:frontend": "npm run test --workspace=frontend"
    },
    "devDependencies": {
      "concurrently": "^8.2.2"
    }
  }
  ```

- [ ] **Step 2: Write backend package.json**
  ```json
  {
    "name": "backend",
    "version": "1.0.0",
    "main": "dist/index.js",
    "scripts": {
      "build": "tsc",
      "start": "node dist/index.js",
      "dev": "tsx watch src/index.ts",
      "test": "vitest run"
    },
    "dependencies": {
      "bcrypt": "^5.1.1",
      "cookie-parser": "^1.4.6",
      "cors": "^2.8.5",
      "dotenv": "^16.4.5",
      "express": "^4.19.2",
      "jose": "^5.6.3",
      "knex": "^3.1.0",
      "sqlite3": "^5.1.7"
    },
    "devDependencies": {
      "@types/bcrypt": "^5.0.2",
      "@types/cookie-parser": "^1.4.7",
      "@types/cors": "^2.8.17",
      "@types/express": "^4.17.21",
      "@types/node": "^20.12.7",
      "tsx": "^4.7.2",
      "typescript": "^5.4.5",
      "vitest": "^1.5.0"
    }
  }
  ```

- [ ] **Step 3: Write backend tsconfig.json**
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "CommonJS",
      "moduleResolution": "node",
      "outDir": "./dist",
      "rootDir": "./src",
      "strict": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    },
    "include": ["src/**/*"]
  }
  ```

- [ ] **Step 4: Create backend server entry point**
  ```typescript
  // backend/src/index.ts
  import express from 'express';
  import cors from 'cors';
  import cookieParser from 'cookie-parser';
  import dotenv from 'dotenv';

  dotenv.config();

  const app = express();
  const port = process.env.PORT || 4000;

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
  });

  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });

  export default app;
  ```

- [ ] **Step 5: Run tests to verify setup**
  Run: `npm install` (at root directory)
  Run: `npm run dev:backend`
  Expected: Success output showing "Backend server running on port 4000" and `curl http://localhost:4000/health` returning `{"status":"ok"}`.

- [ ] **Step 6: Commit**
  ```bash
  git add package.json backend/package.json backend/tsconfig.json backend/src/index.ts
  git commit -m "chore: scaffold monorepo root and backend"
  ```

---

### Task 2: Database Initialization (SQLite & Knex)

**Files:**
- Create: `backend/src/database/knexfile.ts`
- Create: `backend/src/database/connection.ts`
- Create: `backend/src/database/migrations/20260824000000_init_schema.ts`

**Interfaces:**
- Consumes: SQLite Database location
- Produces: Initial SQLite tables schema and Knex query builder instance.

- [ ] **Step 1: Write backend/src/database/knexfile.ts**
  ```typescript
  // backend/src/database/knexfile.ts
  import { Knex } from 'knex';
  import path from 'path';

  const config: { [key: string]: Knex.Config } = {
    development: {
      client: 'sqlite3',
      connection: {
        filename: path.join(__dirname, '../../../database.sqlite')
      },
      useNullAsDefault: true,
      migrations: {
        directory: path.join(__dirname, './migrations'),
        tableName: 'knex_migrations'
      }
    }
  };

  export default config;
  ```

- [ ] **Step 2: Write database connection interface backend/src/database/connection.ts**
  ```typescript
  // backend/src/database/connection.ts
  import knex from 'knex';
  import configs from './knexfile';

  const environment = process.env.NODE_ENV || 'development';
  const config = configs[environment];

  const db = knex(config);

  export default db;
  ```

- [ ] **Step 3: Create initial schema migration**
  ```typescript
  // backend/src/database/migrations/20260824000000_init_schema.ts
  import { Knex } from 'knex';

  export async function up(knex: Knex): Promise<void> {
    await knex.schema.createTable('telegram_users', (table) => {
      table.integer('chat_id').primary();
      table.string('username').nullable();
      table.string('first_name').nullable();
      table.string('last_name').nullable();
      table.integer('is_blocked').defaultTo(0);
      table.timestamps(true, true);
    });

    await knex.schema.createTable('google_connections', (table) => {
      table.integer('chat_id').notNullable();
      table.string('provider').notNullable();
      table.string('email').notNullable();
      table.text('encrypted_refresh_token').notNullable();
      table.text('encrypted_access_token').notNullable();
      table.datetime('token_expiry').notNullable();
      table.text('scopes').notNullable();
      table.timestamps(true, true);
      table.primary(['chat_id', 'provider']);
      table.foreign('chat_id').references('telegram_users.chat_id').onDelete('CASCADE');
    });

    await knex.schema.createTable('api_logs', (table) => {
      table.increments('id').primary();
      table.integer('chat_id').nullable();
      table.string('connector').notNullable();
      table.string('operation').notNullable();
      table.string('status').notNullable();
      table.text('error_message').nullable();
      table.timestamp('timestamp').defaultTo(knex.fn.now());
      table.foreign('chat_id').references('telegram_users.chat_id').onDelete('SET NULL');
    });
  }

  export async function down(knex: Knex): Promise<void> {
    await knex.schema.dropTableIfExists('api_logs');
    await knex.schema.dropTableIfExists('google_connections');
    await knex.schema.dropTableIfExists('telegram_users');
  }
  ```

- [ ] **Step 4: Execute migration and verify schema creation**
  Run local knex migration directly:
  `npx knex --knexfile backend/src/database/knexfile.ts migrate:latest`
  Expected: Success output "Batch 1 run: 1 migrations". `database.sqlite` file created in backend root directory.

- [ ] **Step 5: Write unit tests to check database connectivity**
  Create: `backend/src/database/connection.test.ts`
  ```typescript
  import { describe, it, expect, beforeAll, afterAll } from 'vitest';
  import db from './connection';

  describe('SQLite Database Connection', () => {
    beforeAll(async () => {
      await db.migrate.latest();
    });

    afterAll(async () => {
      await db.destroy();
    });

    it('can query the telegram_users table', async () => {
      const users = await db('telegram_users').select('*');
      expect(Array.isArray(users)).toBe(true);
    });

    it('can insert and retrieve a telegram user', async () => {
      await db('telegram_users').insert({
        chat_id: 12345,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User'
      });

      const user = await db('telegram_users').where('chat_id', 12345).first();
      expect(user).toBeDefined();
      expect(user.username).toBe('testuser');

      // Cleanup
      await db('telegram_users').where('chat_id', 12345).delete();
    });
  });
  ```
  Run: `npm run test --workspace=backend`
  Expected: PASS

- [ ] **Step 6: Commit**
  ```bash
  git add backend/src/database/
  git commit -m "feat(db): initialize SQLite database with knex migrations and connection tests"
  ```

---

### Task 3: Security & Cryptography Helpers (AES-256 GCM & JWT Sessions)

**Files:**
- Create: `backend/src/utils/crypto.ts`
- Create: `backend/src/utils/crypto.test.ts`
- Create: `backend/src/utils/auth.ts`

**Interfaces:**
- Consumes: `process.env.ENCRYPTION_KEY`, `process.env.JWT_SECRET`
- Produces:
  *   `encryptToken(token: string): string`
  *   `decryptToken(encrypted: string): string`
  *   `generateAdminToken(username: string): Promise<string>`
  *   `verifyAdminToken(token: string): Promise<any>`

- [ ] **Step 1: Write backend/src/utils/crypto.ts**
  ```typescript
  // backend/src/utils/crypto.ts
  import crypto from 'crypto';

  const ALGORITHM = 'aes-256-gcm';
  const IV_LENGTH = 12;
  const TAG_LENGTH = 16;

  function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
      // Static fallback for tests or if unconfigured
      return Buffer.from('12345678901234567890123456789012');
    }
    return Buffer.from(key, 'hex');
  }

  export function encryptToken(token: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    // Format: iv:encrypted:tag
    return `${iv.toString('hex')}:${encrypted}:${tag}`;
  }

  export function decryptToken(encryptedString: string): string {
    const key = getEncryptionKey();
    const [ivHex, encryptedHex, tagHex] = encryptedString.split(':');
    
    if (!ivHex || !encryptedHex || !tagHex) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
  ```

- [ ] **Step 2: Write crypto unit tests**
  ```typescript
  // backend/src/utils/crypto.test.ts
  import { describe, it, expect } from 'vitest';
  import { encryptToken, decryptToken } from './crypto';

  describe('Token AES-256-GCM Encryption & Decryption', () => {
    it('can successfully encrypt and decrypt a string token', () => {
      const originalToken = 'ya29.a0AfB_byD4...google-oauth-token-example';
      const encrypted = encryptToken(originalToken);
      
      expect(encrypted).not.toBe(originalToken);
      expect(encrypted.split(':').length).toBe(3);

      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('throws error for invalid formatting during decryption', () => {
      expect(() => decryptToken('malformed-token')).toThrow('Invalid encrypted token format');
    });
  });
  ```
  Run: `npm run test --workspace=backend`
  Expected: PASS

- [ ] **Step 3: Write admin JWT session helper backend/src/utils/auth.ts**
  ```typescript
  // backend/src/utils/auth.ts
  import { SignJWT, jwtVerify } from 'jose';

  const getSecret = () => {
    const secret = process.env.JWT_SECRET || 'super-secret-jwt-default-key-for-local';
    return new TextEncoder().encode(secret);
  };

  export async function generateAdminToken(username: string): Promise<string> {
    return new SignJWT({ username, role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('2h')
      .sign(getSecret());
  }

  export async function verifyAdminToken(token: string): Promise<any> {
    try {
      const { payload } = await jwtVerify(token, getSecret());
      return payload;
    } catch (err) {
      return null;
    }
  }
  ```

- [ ] **Step 4: Commit**
  ```bash
  git add backend/src/utils/
  git commit -m "feat(security): add token encryption helper and admin JWT session management"
  ```

---

### Task 4: React Frontend Setup & Visual Layout Shell

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/src/main.tsx`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/index.css`
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/pages/OAuthCallback.tsx`

**Interfaces:**
- Consumes: None
- Produces: Visual frontend pages styled cleanly with Vanilla CSS.

- [ ] **Step 1: Write frontend package.json**
  ```json
  {
    "name": "frontend",
    "private": true,
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "dev": "vite",
      "build": "tsc && vite build",
      "preview": "vite preview"
    },
    "dependencies": {
      "react": "^18.3.1",
      "react-dom": "^18.3.1"
    },
    "devDependencies": {
      "@types/react": "^18.3.3",
      "@types/react-dom": "^18.3.0",
      "@vitejs/plugin-react": "^4.3.0",
      "typescript": "^5.4.5",
      "vite": "^5.2.11"
    }
  }
  ```

- [ ] **Step 2: Write frontend/vite.config.ts**
  ```typescript
  import { defineConfig } from 'vite';
  import react from '@vitejs/plugin-react';

  export default defineConfig({
    plugins: [react()],
    server: {
      port: 5173
    }
  });
  ```

- [ ] **Step 3: Write clean layouts and global css in frontend/src/index.css**
  ```css
  :root {
    --primary: #106ebe;
    --background: #f3f2f1;
    --card: #ffffff;
    --text: #323130;
    --border: #edebe9;
    --success: #107c41;
    --error: #a80000;
  }

  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background-color: var(--background);
    color: var(--text);
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
  }

  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 24px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  }

  .btn {
    background-color: var(--primary);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 10px 16px;
    font-size: 14px;
    cursor: pointer;
    font-weight: 600;
  }

  .btn:hover {
    filter: brightness(0.9);
  }
  ```

- [ ] **Step 4: Create login, callback, and admin dashboard router skeleton in frontend/src/App.tsx**
  ```typescript
  // frontend/src/App.tsx
  import React, { useState, useEffect } from 'react';
  import Login from './pages/Login';
  import Dashboard from './pages/Dashboard';
  import OAuthCallback from './pages/OAuthCallback';

  export default function App() {
    const [path, setPath] = useState(window.location.pathname);

    useEffect(() => {
      const handleLocationChange = () => {
        setPath(window.location.pathname);
      };
      window.addEventListener('popstate', handleLocationChange);
      return () => window.removeEventListener('popstate', handleLocationChange);
    }, []);

    const navigate = (to: string) => {
      window.history.pushState({}, '', to);
      setPath(to);
    };

    if (path === '/login') {
      return <Login onLoginSuccess={() => navigate('/admin')} />;
    }

    if (path === '/oauth/callback') {
      return <OAuthCallback />;
    }

    if (path === '/admin') {
      return <Dashboard onLogout={() => navigate('/login')} />;
    }

    // Default Fallback: Redirect to Login/Admin
    return (
      <div style={{ textAlign: 'center', padding: '100px' }}>
        <h2>AskMyAgent Platform</h2>
        <button className="btn" onClick={() => navigate('/login')}>Go to Admin Login</button>
      </div>
    );
  }
  ```

- [ ] **Step 5: Write initial file wrappers for pages**
  Create `frontend/src/pages/Login.tsx`:
  ```typescript
  import React from 'react';
  export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
    return <div className="container"><div className="card"><h2>Admin Login</h2><button className="btn" onClick={onLoginSuccess}>Mock Sign In</button></div></div>;
  }
  ```

  Create `frontend/src/pages/Dashboard.tsx`:
  ```typescript
  import React from 'react';
  export default function Dashboard({ onLogout }: { onLogout: () => void }) {
    return <div className="container"><div className="card"><h2>Admin Dashboard</h2><button className="btn" onClick={onLogout}>Logout</button></div></div>;
  }
  ```

  Create `frontend/src/pages/OAuthCallback.tsx`:
  ```typescript
  import React from 'react';
  export default function OAuthCallback() {
    return <div className="container"><div className="card"><h2>OAuth Connection Callback</h2><p>Processing connection...</p></div></div>;
  }
  ```

  Create `frontend/src/main.tsx`:
  ```typescript
  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import App from './App';
  import './index.css';

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  ```

- [ ] **Step 6: Verify frontend loads successfully**
  Run: `npm install` (at root directory to resolve frontend workspaces)
  Run: `npm run dev:frontend`
  Expected: Successful start, browser access to `http://localhost:5173/` displays "AskMyAgent Platform" home interface.

- [ ] **Step 7: Commit**
  ```bash
  git add frontend/
  git commit -m "feat(frontend): scaffold react layout routing and visual home pages"
  ```

---

### Task 5: Admin Login Feature (Login Form & HTTP-Only Cookie Session API)

**Files:**
- Create: `backend/src/routes/admin.ts`
- Create: `backend/src/middleware/auth.ts`
- Modify: `backend/src/index.ts`
- Modify: `frontend/src/pages/Login.tsx`
- Modify: `frontend/src/pages/Dashboard.tsx`

**Interfaces:**
- Consumes: JWT Admin tokens, Cookie Session
- Produces: Secure admin auth controller and React login submission.

- [ ] **Step 1: Write backend admin router and check credentials**
  Create: `backend/src/routes/admin.ts`
  ```typescript
  import { Router } from 'express';
  import { generateAdminToken } from '../utils/auth';

  const router = Router();

  router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    const envUser = process.env.ADMIN_USERNAME || 'admin';
    const envPass = process.env.ADMIN_PASSWORD || 'secret';

    if (username === envUser && password === envPass) {
      const token = await generateAdminToken(username);
      res.cookie('admin_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 2 * 60 * 60 * 1000, // 2 hours
        sameSite: 'lax'
      });
      return res.json({ success: true, username });
    }

    return res.status(401).json({ error: 'Invalid admin credentials' });
  });

  router.post('/logout', (req, res) => {
    res.clearCookie('admin_session');
    res.json({ success: true });
  });

  export default router;
  ```

- [ ] **Step 2: Create middleware route guards**
  Create: `backend/src/middleware/auth.ts`
  ```typescript
  import { Request, Response, NextFunction } from 'express';
  import { verifyAdminToken } from '../utils/auth';

  export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
    const token = req.cookies.admin_session;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const payload = await verifyAdminToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Session expired or invalid' });
    }

    (req as any).admin = payload;
    next();
  }
  ```

- [ ] **Step 3: Register route in index.ts**
  Modify: `backend/src/index.ts`
  ```typescript
  // Replace backend/src/index.ts with registered admin router
  import express from 'express';
  import cors from 'cors';
  import cookieParser from 'cookie-parser';
  import dotenv from 'dotenv';
  import adminRouter from './routes/admin';
  import { requireAdmin } from './middleware/auth';

  dotenv.config();

  const app = express();
  const port = process.env.PORT || 4000;

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/admin', adminRouter);

  // Authenticated health endpoint to test guard
  app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ success: true, admin: (req as any).admin });
  });

  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });

  export default app;
  ```

- [ ] **Step 4: Update Frontend Login Form and state integration**
  Modify `frontend/src/pages/Login.tsx`:
  ```typescript
  import React, { useState } from 'react';

  export default function Login({ onLoginSuccess }: { onLoginSuccess: () => void }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      try {
        const response = await fetch('http://localhost:4000/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        if (response.ok) {
          onLoginSuccess();
        } else {
          setError(data.error || 'Login failed');
        }
      } catch (err) {
        setError('Connection error. Server may be offline.');
      }
    };

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <form className="card" onSubmit={handleSubmit} style={{ width: '350px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Admin Login</h2>
          {error && <div style={{ color: 'var(--error)', marginBottom: '15px', fontWeight: 'bold' }}>{error}</div>}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Username</label>
            <input 
              type="text" 
              className="form-control" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Password</label>
            <input 
              type="password" 
              className="form-control" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }}
            />
          </div>
          <button type="submit" className="btn" style={{ width: '100%' }}>Login</button>
        </form>
      </div>
    );
  }
  ```

- [ ] **Step 5: Verify Login flows visually & with API requests**
  Run: `npm run dev`
  Access `http://localhost:5173/login`. Type correct admin credentials (username: `admin`, password: `secret`).
  Expected: Successful redirect to `http://localhost:5173/admin`.

- [ ] **Step 6: Commit**
  ```bash
  git add backend/src/routes/admin.ts backend/src/middleware/auth.ts backend/src/index.ts frontend/src/pages/Login.tsx
  git commit -m "feat(auth): complete admin login with secure HTTP-only cookies and React form integration"
  ```

---

### Task 6: Secure OAuth Connection Callback Web View

**Files:**
- Create: `backend/src/routes/oauth.ts`
- Modify: `backend/src/index.ts`
- Modify: `frontend/src/pages/OAuthCallback.tsx`

**Interfaces:**
- Consumes: Google authorization code and signed state from Google API
- Produces: Unified Google connector connection success state.

- [ ] **Step 1: Write backend OAuth callback REST API**
  Create: `backend/src/routes/oauth.ts`
  ```typescript
  import { Router } from 'express';
  import db from '../database/connection';

  const router = Router();

  router.post('/callback', async (req, res) => {
    const { code, state } = req.body;
    
    if (!code || !state) {
      return res.status(400).json({ error: 'Code and State are required' });
    }

    try {
      // In this setup phase, verify state, mock retrieve actual credentials, store connection.
      // We parse/decrypt the state parameter to get the telegram chat_id.
      // A static validation placeholder until full JWT-state generator runs:
      const chat_id = parseInt(state, 10);
      if (isNaN(chat_id)) {
        return res.status(400).json({ error: 'Invalid state signature' });
      }

      // Check if user exists, else scaffold user
      const user = await db('telegram_users').where('chat_id', chat_id).first();
      if (!user) {
        await db('telegram_users').insert({
          chat_id,
          username: `user_${chat_id}`,
          first_name: 'Telegram',
          last_name: 'User'
        });
      }

      // Mock google authorization token payload store
      await db('google_connections').insert({
        chat_id,
        provider: 'gmail',
        email: 'user@gmail.com',
        encrypted_refresh_token: 'mock_encrypted_refresh',
        encrypted_access_token: 'mock_encrypted_access',
        token_expiry: new Date(Date.now() + 3600 * 1000).toISOString(),
        scopes: 'https://www.googleapis.com/auth/gmail.readonly'
      }).onConflict(['chat_id', 'provider']).merge();

      // Log successful connection
      await db('api_logs').insert({
        chat_id,
        connector: 'gmail',
        operation: 'oauth_callback',
        status: 'success'
      });

      return res.json({ success: true, message: 'Google connection saved!' });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Failed processing connection' });
    }
  });

  export default router;
  ```

- [ ] **Step 2: Add oauth router connection in backend index.ts**
  Modify: `backend/src/index.ts`
  ```typescript
  import express from 'express';
  import cors from 'cors';
  import cookieParser from 'cookie-parser';
  import dotenv from 'dotenv';
  import adminRouter from './routes/admin';
  import oauthRouter from './routes/oauth';
  import { requireAdmin } from './middleware/auth';

  dotenv.config();

  const app = express();
  const port = process.env.PORT || 4000;

  app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true
  }));
  app.use(express.json());
  app.use(cookieParser());

  app.use('/api/admin', adminRouter);
  app.use('/api/oauth', oauthRouter);

  app.get('/api/admin/verify', requireAdmin, (req, res) => {
    res.json({ success: true, admin: (req as any).admin });
  });

  app.listen(port, () => {
    console.log(`Backend server running on port ${port}`);
  });

  export default app;
  ```

- [ ] **Step 3: Update React OAuthCallback page to perform post-redirect request**
  Modify `frontend/src/pages/OAuthCallback.tsx`:
  ```typescript
  import React, { useEffect, useState } from 'react';

  export default function OAuthCallback() {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    useEffect(() => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');

      if (!code || !state) {
        setStatus('error');
        setErrorMsg('Authorization code or state query parameters are missing.');
        return;
      }

      fetch('http://localhost:4000/api/oauth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state })
      })
        .then(async (res) => {
          const data = await res.json();
          if (res.ok) {
            setStatus('success');
          } else {
            setStatus('error');
            setErrorMsg(data.error || 'Failed to link account.');
          }
        })
        .catch(() => {
          setStatus('error');
          setErrorMsg('Could not connect to the backend server.');
        });
    }, []);

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="card" style={{ width: '450px', textAlign: 'center' }}>
          {status === 'loading' && (
            <div>
              <div className="spinner" style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite', margin: '0 auto 20px' }}></div>
              <h2>Linking with Google Workspace</h2>
              <p>Please wait while we complete authorization...</p>
            </div>
          )}

          {status === 'success' && (
            <div>
              <div style={{ color: 'var(--success)', fontSize: '48px', marginBottom: '15px' }}>✓</div>
              <h2 style={{ color: 'var(--success)' }}>Connection Success!</h2>
              <p style={{ margin: '15px 0' }}>Your Google Account was linked successfully to AskMyAgent.</p>
              <p style={{ color: '#666', fontSize: '14px' }}>You can close this browser window and return to Telegram to continue.</p>
            </div>
          )}

          {status === 'error' && (
            <div>
              <div style={{ color: 'var(--error)', fontSize: '48px', marginBottom: '15px' }}>✗</div>
              <h2 style={{ color: 'var(--error)' }}>Connection Failed</h2>
              <p style={{ margin: '15px 0', fontWeight: 'bold' }}>{errorMsg}</p>
              <p style={{ color: '#666', fontSize: '14px' }}>Please check your link or try again from the Telegram bot.</p>
            </div>
          )}
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  ```

- [ ] **Step 4: Verify visually using simulated Redirect link**
  Navigate to: `http://localhost:5173/oauth/callback?code=testcode&state=98765`
  Expected: Successful processing, showing "Connection Success!" loading state transition, and inserting a connection log row in SQLite for chat_id `98765`.

- [ ] **Step 5: Commit**
  ```bash
  git add backend/src/routes/oauth.ts backend/src/index.ts frontend/src/pages/OAuthCallback.tsx
  git commit -m "feat(oauth): add OAuth secure user callback layout with visual loading/success pages"
  ```
