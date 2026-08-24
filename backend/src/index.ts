import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import db from './database/connection';
import adminRouter from './routes/admin';
import usersRouter from './routes/users';
import oauthRouter from './routes/oauth';
import botRouter from './routes/bot';
import { TelegramBotService } from './bot/telegramService';
import { validateEncryptionConfig } from './utils/crypto';
import { validateAuthConfig } from './utils/auth';
import { getAllowedOrigins, isAllowedOrigin } from './utils/security';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Telegram-Bot-Api-Secret-Token', 'Accept']
}));
console.log(`[Security] CORS allowed origins: ${getAllowedOrigins().join(', ')}`);
app.use(express.json());
app.use(cookieParser());

// Auto-run migrations on server boot
db.migrate.latest().then(() => {
  console.log('[Database] Migrations applied successfully.');
}).catch((err) => {
  console.error('[Database] Migration error:', err);
});

// API Routes
app.use('/api/admin', adminRouter);
app.use('/api/users', usersRouter);
app.use('/api/oauth', oauthRouter);
app.use('/api/bot', botRouter);

// Health check endpoints (supporting both Koyeb /api/health and standard /health)
const healthHandler = async (req: express.Request, res: express.Response) => {
  try {
    await db.raw('SELECT 1');
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

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => {
    console.log(`[AskMyAgent] Backend server running on http://localhost:${port}`);

    // Auto-connect Telegram bot based on configuration
    if (process.env.TELEGRAM_BOT_TOKEN) {
      if (process.env.TELEGRAM_WEBHOOK_URL) {
        console.log('[TelegramBot] Configuring webhook from TELEGRAM_WEBHOOK_URL.');
        TelegramBotService.setWebhook(process.env.TELEGRAM_WEBHOOK_URL);
      } else {
        console.log('[TelegramBot] Starting long-polling service...');
        TelegramBotService.startPolling();
      }
    } else {
      console.log('[TelegramBot] Tip: Set TELEGRAM_BOT_TOKEN in .env to connect your live Telegram bot.');
    }
  });
}

export default app;
