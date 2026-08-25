import './config/env';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import db from './database/connection';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';
import oauthRouter from './routes/oauth';
import internalRouter from './routes/internal';
import { validateEncryptionConfig } from './utils/crypto';
import { validateAuthConfig } from './utils/auth';
import { getAllowedOrigins, isAllowedOrigin } from './utils/security';
import { checkDatabaseConnectivity } from './database/health';

// Fail fast on critical security configuration in production (SEC-006, SEC-007)
try {
  validateEncryptionConfig();
  validateAuthConfig();
} catch (err: any) {
  console.error('[Security Boot Failure]', err.message);
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
}

const app = express();
const port = process.env.PORT || 4000;

// Configure Express trust proxy for Render / reverse proxy
// Default to 'loopback, linklocal, uniquelocal' to trust internal private subnets and resolve the real client IP (SEC-008)
const trustProxyConfig = process.env.TRUST_PROXY
  ? (process.env.TRUST_PROXY === 'true' ? true : (process.env.TRUST_PROXY === 'false' ? false : (isNaN(Number(process.env.TRUST_PROXY)) ? process.env.TRUST_PROXY : Number(process.env.TRUST_PROXY))))
  : 'loopback, linklocal, uniquelocal';
app.set('trust proxy', trustProxyConfig);

// HTTP Security Headers (SEC-009)
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow external font/style loading and OAuth callbacks
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Internal-Token', 'Accept']
}));
console.log(`[Security] CORS allowed origins: ${getAllowedOrigins().join(', ')}`);
app.use(express.json());
app.use(cookieParser());

export async function runStartupMigrations(): Promise<void> {
  try {
    await db.migrate.latest();
    console.log('[Database] Migrations applied successfully.');
  } catch (err) {
    console.error('[Database] Migration error:', err);
    if (process.env.NODE_ENV === 'production') {
      process.exitCode = 1;
      throw err;
    }
  }
}

// API Routes
app.use('/api/admin', adminRouter);
app.use('/api/users', usersRouter);
app.use('/api/oauth', oauthRouter);
// Internal API for the VM Telegram bot (Google Workspace tool calls + OAuth).
// The backend is NOT a Telegram listener — it never calls the Bot API.
app.use('/api/internal', internalRouter);

// Health check endpoints (supporting Render /api/health and standard /health)
const healthHandler = async (req: express.Request, res: express.Response) => {
  try {
    await checkDatabaseConnectivity();
    return res.json({
      status: 'ok',
      service: 'AskMyAgent Workspace Connector Backend',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return res.status(503).json({
      status: 'degraded',
      service: 'AskMyAgent Workspace Connector Backend',
      database: 'error',
      timestamp: new Date().toISOString()
    });
  }
};

app.get('/api/health', healthHandler);
app.get('/health', healthHandler);

let server: any;

export async function startServer(): Promise<any> {
  await runStartupMigrations();

  server = app.listen(Number(port), '0.0.0.0', () => {
    console.log(`[AskMyAgent] Backend server running on http://0.0.0.0:${port}`);
    console.log('[AskMyAgent] Telegram traffic is handled by the VM bot; this service exposes /api/internal only.');
  });

  return server;
}

const handleShutdown = async (signal: string) => {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      try {
        await db.destroy();
        console.log('[Database] Knex connection pool closed.');
      } catch (err) {
        console.error('[Database] Error closing Knex pool during shutdown:', err);
      }
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  startServer().catch(() => {
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
}

export default app;
