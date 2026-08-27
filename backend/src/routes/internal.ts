import { Router, Request, Response } from 'express';
import db from '../database/connection';
import { GeminiToolDispatcher } from '../services/toolDispatcher';
import { GoogleConnectorRegistry } from '../connectors/registry';
import { GoogleTokenStore, normalizeChatId } from '../oauth/tokenStore';
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
 * Ensures a users + telegram_users row exists for the given chat_id,
 * enriching it with real profile data from bot_users or incoming request profile.
 */
async function ensureTelegramIdentity(chatId: number, profile?: InternalProfile): Promise<void> {
  // Check bot_users table for actual Telegram profile details
  let botUser: any = null;
  try {
    const hasBotTable = await db.schema.hasTable('bot_users');
    if (hasBotTable) {
      botUser = await db('bot_users').where('chat_id', chatId).first();
    }
  } catch {}

  const username = profile?.username || botUser?.username || null;
  const firstName = profile?.first_name || botUser?.first_name || null;
  const lastName = profile?.last_name || botUser?.last_name || null;

  const existing = await db('telegram_users')
    .where('telegram_id', chatId)
    .orWhere('chat_id', chatId)
    .first();

  if (existing) {
    // If existing row has placeholder values or missing name/username, update it
    const isPlaceholder = !existing.first_name || existing.first_name === 'Telegram' || !existing.username || existing.username.startsWith('user_');
    if (isPlaceholder && (firstName || lastName || username)) {
      await UserService.upsertTelegramUser({
        telegramId: chatId,
        username: username || (existing.username && !existing.username.startsWith('user_') ? existing.username : null),
        firstName: firstName || (existing.first_name !== 'Telegram' ? existing.first_name : null),
        lastName: lastName || (existing.last_name !== 'User' ? existing.last_name : null)
      });
    }
    return;
  }

  await UserService.upsertTelegramUser({
    telegramId: chatId,
    username: username || null,
    firstName: firstName || null,
    lastName: lastName || null
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

    // Check if user is blocked / disabled
    const tgUser = await db('telegram_users')
      .where('telegram_id', Number(chat_id))
      .orWhere('chat_id', Number(chat_id))
      .first();

    if (tgUser && (tgUser.is_blocked === 1 || tgUser.is_blocked === true)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Your account is disabled by administrator.'
      });
    }

    if (tgUser && tgUser.user_id) {
      const parentUser = await db('users').where('id', tgUser.user_id).first();
      if (parentUser && parentUser.status === 'disabled') {
        return res.status(403).json({
          success: false,
          error: 'Access denied. Your account is disabled by administrator.'
        });
      }
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

    // Check if user is blocked / disabled
    const tgUser = await db('telegram_users')
      .where('telegram_id', Number(chat_id))
      .orWhere('chat_id', Number(chat_id))
      .first();

    if (tgUser && (tgUser.is_blocked === 1 || tgUser.is_blocked === true)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Your account is disabled by administrator.'
      });
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
 * GET /api/internal/user-status?chat_id=123
 * Allows the VM bot to verify if a user exists and is active.
 * Returns { exists: boolean, active: boolean, blocked: boolean }
 */
router.get('/user-status', async (req: Request, res: Response) => {
  try {
    const chatId = normalizeChatId(req.query.chat_id);
    if (chatId === null) {
      return res.status(400).json({ success: false, error: 'chat_id query parameter is required.' });
    }

    const numChatId = Number(chatId);

    // Check telegram_users
    const tgUser = await db('telegram_users')
      .where('telegram_id', numChatId)
      .orWhere('chat_id', numChatId)
      .first();

    // Check bot_users
    let hasBotUser = false;
    try {
      const hasBotTable = await db.schema.hasTable('bot_users');
      if (hasBotTable) {
        const bRow = await db('bot_users').where('chat_id', numChatId).first();
        if (bRow) hasBotUser = true;
      }
    } catch {}

    if (!tgUser && !hasBotUser) {
      return res.json({ success: true, exists: false, active: false, blocked: false });
    }

    let isBlocked = tgUser?.is_blocked === 1 || tgUser?.is_blocked === true;
    if (tgUser?.user_id) {
      const pUser = await db('users').where('id', tgUser.user_id).first();
      if (pUser && pUser.status === 'disabled') {
        isBlocked = true;
      }
    }

    return res.json({
      success: true,
      exists: true,
      active: !isBlocked,
      blocked: isBlocked
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'Failed to query user status.' });
  }
});

/**
 * GET /api/internal/oauth/status?chat_id=123[&provider=calendar]
 *
 * Connection-status contract consumed by the VM bot's /connectors command.
 * chat_id accepts a number or numeric string and is normalized BigInt-safely.
 *
 * Exact response shapes (STABLE — do not change without coordinating with the
 * VM bot, which parses `status.get("providers", status)`):
 *
 * 1. All providers (no `provider` query param):
 *    {
 *      "success": true,
 *      "chat_id": "7319408446",
 *      "providers": {
 *        "gmail":    { "connected": false, "email": null },
 *        "calendar": { "connected": true,  "email": "user@gmail.com" }
 *      },
 *      "connections": [
 *        { "provider": "gmail",    "connected": false, "email": null },
 *        { "provider": "calendar", "connected": true,  "email": "user@gmail.com" }
 *      ]
 *    }
 *    - `providers`: object KEYED by lowercase provider name (primary shape).
 *    - `connections`: same data as an array (legacy/compat shape).
 *    - `chat_id` is echoed as a STRING: Postgres bigint is not JSON-safe as a
 *      JS number beyond 2^53, so consumers must treat it as an opaque id.
 *
 * 2. Single provider (`?chat_id=123&provider=calendar`) stays flat:
 *    { "success": true, "provider": "calendar", "connected": true,
 *      "email": "user@gmail.com" }
 */
router.get('/oauth/status', async (req: Request, res: Response) => {
  try {
    const chatId = normalizeChatId(req.query.chat_id);
    if (chatId === null) {
      return res.status(400).json({ success: false, error: 'chat_id query parameter must be an integer Telegram chat id.' });
    }

    const providerParam = req.query.provider ? String(req.query.provider).toLowerCase() : null;

    if (providerParam) {
      const connected = await GoogleTokenStore.isConnected(chatId, providerParam);
      let email: string | null = null;
      if (connected) {
        const creds = await GoogleTokenStore.getCredentials(chatId, providerParam);
        email = creds?.email ?? null;
      }
      return res.json({ success: true, provider: providerParam, connected, email });
    }

    const registry = GoogleConnectorRegistry.getInstance();
    const connections = await Promise.all(
      registry.getAllConnectors().map(async (connector) => {
        const connected = await GoogleTokenStore.isConnected(chatId, connector.name);
        let email: string | null = null;
        if (connected) {
          const creds = await GoogleTokenStore.getCredentials(chatId, connector.name);
          email = creds?.email ?? null;
        }
        return { provider: connector.name.toLowerCase(), connected, email };
      })
    );

    // Primary shape: providers map keyed by lowercase name (bot.py reads this).
    // Legacy shape: connections array kept so existing consumers don't break.
    const providers: Record<string, { connected: boolean; email: string | null }> = {};
    for (const c of connections) {
      providers[c.provider] = { connected: c.connected, email: c.email };
    }
    return res.json({
      success: true,
      chat_id: String(chatId),
      providers,
      connections
    });
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
