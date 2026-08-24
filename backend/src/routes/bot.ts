import { Router } from 'express';
import crypto from 'crypto';
import { TelegramWebhookController } from '../bot/webhook';
import { TelegramBotService } from '../bot/telegramService';
import { requireAdmin } from '../middleware/auth';
import { validatePublicHttpsUrl } from '../utils/security';

const router = Router();

/**
 * Middleware: Verify Telegram Webhook Secret Token (SEC-003)
 */
function verifyTelegramWebhookSecret(req: any, res: any, next: any) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

  // In production, or if secret is configured, strictly enforce secret token header
  if (secret || process.env.NODE_ENV === 'production') {
    const receivedHeader = req.headers['x-telegram-bot-api-secret-token'];

    if (!receivedHeader || typeof receivedHeader !== 'string') {
      return res.status(401).json({ error: 'Unauthorized: Missing Telegram webhook secret token.' });
    }

    if (!secret) {
      return res.status(500).json({ error: 'Server misconfiguration: TELEGRAM_WEBHOOK_SECRET is not set in production.' });
    }

    const expectedBuf = Buffer.from(secret);
    const receivedBuf = Buffer.from(receivedHeader);

    if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Telegram webhook secret token.' });
    }
  }

  next();
}

// Telegram Webhook endpoint (called by Telegram servers)
router.post('/webhook', verifyTelegramWebhookSecret, async (req, res) => {
  try {
    const update = req.body;
    if (!update || typeof update !== 'object') {
      return res.status(400).json({ error: 'Malformed update body' });
    }

    const result = await TelegramWebhookController.handleUpdate(update);

    // If a reply is generated, send it back to the Telegram chat
    if (result.chatId && result.replyText) {
      await TelegramBotService.sendMessage(result.chatId, result.replyText, result.replyMarkup);
    }

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Webhook processing error' });
  }
});

// Configure Telegram Webhook pointing to VM server (Protected: Admin Only - SEC-002)
router.post('/set-webhook', requireAdmin, async (req, res) => {
  const { webhookUrl } = req.body;
  if (!webhookUrl) {
    return res.status(400).json({ error: 'webhookUrl is required (e.g. https://your-domain.com/api/bot/webhook)' });
  }

  const safeWebhookUrl = validatePublicHttpsUrl(webhookUrl);
  if (!safeWebhookUrl) {
    return res.status(400).json({ error: 'webhookUrl must be a public HTTPS URL without credentials or raw IP/localhost hostnames.' });
  }

  const result = await TelegramBotService.setWebhook(safeWebhookUrl);
  return res.json(result);
});

// Clear Webhook (Protected: Admin Only - SEC-002)
router.post('/delete-webhook', requireAdmin, async (req, res) => {
  const ok = await TelegramBotService.deleteWebhook();
  return res.json({ ok, message: ok ? 'Webhook cleared. Polling mode available.' : 'Failed to clear webhook.' });
});

// Bot connection status
router.get('/status', (req, res) => {
  const hasToken = !!process.env.TELEGRAM_BOT_TOKEN;
  res.json({
    configured: hasToken,
    mode: process.env.TELEGRAM_WEBHOOK_URL ? 'webhook' : (hasToken ? 'polling' : 'unconfigured'),
    webhookConfigured: !!process.env.TELEGRAM_WEBHOOK_URL
  });
});

// Direct test message simulator endpoint (SEC-004: Blocked in production)
router.post('/simulate', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Simulator endpoint is disabled in production.' });
  }

  const { chatId, text } = req.body;

  if (!chatId || !text) {
    return res.status(400).json({ error: 'chatId and text are required' });
  }

  try {
    const result = await TelegramWebhookController.handleUpdate({
      message: {
        message_id: Date.now(),
        chat: { id: Number(chatId) },
        text
      }
    });

    return res.json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Simulation error' });
  }
});

export default router;
