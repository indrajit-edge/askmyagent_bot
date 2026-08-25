import { Router, Request, Response } from 'express';
import db from '../database/connection';
import { GeminiToolDispatcher } from '../services/toolDispatcher';
import { GoogleConnectorRegistry } from '../connectors/registry';
import { GoogleTokenStore } from '../oauth/tokenStore';
import { UserService } from '../services/userService';
import { ConfirmationManager } from '../confirmation';
import { QuotaManager } from '../quota/quotaManager';
import { requireInternalToken } from '../middleware/internalAuth';

const router = Router();
router.use(requireInternalToken);

interface InternalProfile {
  username?: string;
  first_name?: string;
  last_name?: string;
}

/**
 * Ensures a users + telegram_users row exists for the given chat_id without
 * clobbering existing profile data (unlike a blind upsert).
 */
async function ensureTelegramIdentity(chatId: number, profile?: InternalProfile): Promise<void> {
  const existing = await db('telegram_users')
    .where('telegram_id', chatId)
    .orWhere('chat_id', chatId)
    .first();

  if (existing) return;

  await UserService.upsertTelegramUser({
    telegramId: chatId,
    username: profile?.username || `user_${chatId}`,
    firstName: profile?.first_name || 'Telegram',
    lastName: profile?.last_name || 'User'
  });
}

/**
 * POST /api/internal/tool-call
 * Body: { chat_id: number, tool_name: string, args?: object, profile?: {...} }
 * Executes a Google Workspace connector tool on behalf of a Telegram user and
 * returns the tool result JSON that the VM bot can feed back to Gemini.
 */
router.post('/tool-call', async (req: Request, res: Response) => {
  try {
    const { chat_id, tool_name, args, profile } = req.body || {};

    if (!Number.isInteger(chat_id)) {
      return res.status(400).json({ success: false, error: 'chat_id must be an integer Telegram chat id.' });
    }
    if (!tool_name || typeof tool_name !== 'string') {
      return res.status(400).json({ success: false, error: 'tool_name is required.' });
    }

    await ensureTelegramIdentity(Number(chat_id), profile);

    const provider = tool_name.split('_')[0].toLowerCase();
    const quota = await QuotaManager.checkQuota(Number(chat_id), provider);
    if (!quota.allowed) {
      return res.status(429).json({
        success: false,
        error: `Rate limit exceeded for ${provider}. Retry after ${quota.retryAfterSeconds}s.`,
        retry_after_seconds: quota.retryAfterSeconds
      });
    }

    const result = await GeminiToolDispatcher.dispatch({
      chatId: Number(chat_id),
      toolName: tool_name,
      arguments: (args && typeof args === 'object' ? args : {})
    });

    return res.json({
      success: result.success,
      tool_name: result.toolName,
      ...(result.result !== undefined ? { result: result.result } : {}),
      ...(result.error ? { error: result.error } : {})
    });
  } catch (err: any) {
    console.error('[InternalAPI] tool-call failed:', err.message);
    return res.status(500).json({ success: false, error: 'Internal tool execution failed.' });
  }
});

/**
 * POST /api/internal/oauth/start
 * Body: { chat_id: number, provider: string, profile?: {...} }
 * Returns the Google consent URL for connecting a provider (formerly the
 * /connectcalendar bot command flow).
 */
router.post('/oauth/start', async (req: Request, res: Response) => {
  try {
    const { chat_id, provider, profile } = req.body || {};

    if (!Number.isInteger(chat_id)) {
      return res.status(400).json({ success: false, error: 'chat_id must be an integer Telegram chat id.' });
    }
    if (!provider || typeof provider !== 'string') {
      return res.status(400).json({ success: false, error: 'provider is required.' });
    }

    const connector = GoogleConnectorRegistry.getInstance().getConnector(provider);
    if (!connector) {
      return res.status(404).json({ success: false, error: `Unknown provider "${provider}".` });
    }

    await ensureTelegramIdentity(Number(chat_id), profile);

    const authUrl = connector.getAuthorizationUrl(Number(chat_id));
    return res.json({ success: true, provider, auth_url: authUrl });
  } catch (err: any) {
    console.error('[InternalAPI] oauth/start failed:', err.message);
    return res.status(503).json({ success: false, error: err.message || 'OAuth is not configured.' });
  }
});

/**
 * GET /api/internal/oauth/status?chat_id=123&provider=calendar
 * Provider is optional; omitted means "all providers".
 * Used by the VM bot to tell whether a user must run /connect<service> first.
 */
router.get('/oauth/status', async (req: Request, res: Response) => {
  try {
    const chatId = Number(req.query.chat_id);
    if (!Number.isInteger(chatId)) {
      return res.status(400).json({ success: false, error: 'chat_id query parameter must be an integer.' });
    }

    const provider = req.query.provider ? String(req.query.provider).toLowerCase() : null;

    if (provider) {
      const connected = await GoogleTokenStore.isConnected(chatId, provider);
      let email: string | null = null;
      if (connected) {
        const creds = await GoogleTokenStore.getCredentials(chatId, provider);
        email = creds?.email ?? null;
      }
      return res.json({ success: true, provider, connected, email });
    }

    const registry = GoogleConnectorRegistry.getInstance();
    const connections = await Promise.all(
      registry.getAllConnectors().map(async (connector) => ({
        provider: connector.name,
        connected: await GoogleTokenStore.isConnected(chatId, connector.name)
      }))
    );
    return res.json({ success: true, connections });
  } catch (err: any) {
    console.error('[InternalAPI] oauth/status failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to read connection status.' });
  }
});

/**
 * GET /api/internal/tools
 * Lists every registered connector tool so the VM bot can build its Gemini
 * function schemas from a single source of truth.
 */
router.get('/tools', async (_req: Request, res: Response) => {
  return res.json({ success: true, tools: GoogleConnectorRegistry.getInstance().getAllTools() });
});

/**
 * POST /api/internal/confirmation/resolve
 * Body: { chat_id: number, action_id: string, decision: 'confirm' | 'cancel' }
 * Resolves pending high-impact actions (formerly Telegram inline buttons).
 */
router.post('/confirmation/resolve', async (req: Request, res: Response) => {
  try {
    const { chat_id, action_id, decision } = req.body || {};

    if (!Number.isInteger(chat_id) || !action_id || typeof action_id !== 'string') {
      return res.status(400).json({ success: false, error: 'chat_id (integer) and action_id (string) are required.' });
    }
    if (decision !== 'confirm' && decision !== 'cancel') {
      return res.status(400).json({ success: false, error: 'decision must be "confirm" or "cancel".' });
    }

    const outcome =
      decision === 'confirm'
        ? await ConfirmationManager.confirmAction(Number(chat_id), action_id)
        : ConfirmationManager.cancelAction(Number(chat_id), action_id);

    return res.json({ ...outcome });
  } catch (err: any) {
    console.error('[InternalAPI] confirmation/resolve failed:', err.message);
    return res.status(500).json({ success: false, error: 'Failed to resolve confirmation.' });
  }
});

export default router;
