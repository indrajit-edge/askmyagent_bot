import { Router, Request, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { requireAdminNetworkAccess } from '../middleware/adminNetwork';
import { UserService } from '../services/userService';
import db from '../database/connection';
import { logAndSendError } from '../utils/security';

const router = Router();

router.use(requireAdminNetworkAccess);
router.use(requireAdmin);

/**
 * Read-only view of VM-bot-owned bot_users rows (Option A integration).
 *
 * The Python bot creates these rows independently; until VM-bot -> internal-API
 * identity sync is implemented, we surface them in the admin Users list so the
 * dashboard shows a complete picture. Column detection is defensive because
 * the schema is owned by the VM bot and may vary.
 */
async function fetchVmBotUsers(): Promise<Record<string, any>[]> {
  try {
    const hasTable = await db.schema.hasTable('bot_users');
    if (!hasTable) return [];

    const colRows = await db.raw(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'bot_users'`
    );
    const columns: string[] = colRows.rows
      ? colRows.rows.map((r: any) => r.column_name)
      : colRows.map((r: any) => r.column_name);

    if (!columns.includes('chat_id')) return [];

    const safeColumns = ['chat_id']
      .filter((c) => columns.includes(c))
      .concat(
        ['username', 'first_name', 'last_name', 'preferred_model', 'created_at', 'updated_at', 'last_seen_at']
          .filter((c) => columns.includes(c))
      );
    // gemini_api_key / calendar_* values are NEVER selected — only existence flags
    const hasGeminiKeyCol = columns.includes('gemini_api_key');
    const hasCalendarCols =
      columns.includes('calendar_credentials_path') || columns.includes('calendar_id');

    const selects: any[] = [...safeColumns];
    if (hasGeminiKeyCol) {
      selects.push(db.raw('(gemini_api_key IS NOT NULL) AS has_gemini_key'));
    }

    const rows = await db('bot_users').select(selects);

    return rows.map((row: any) => ({
      ...row,
      hasGeminiKey: hasGeminiKeyCol ? !!row.has_gemini_key : false,
      hasCalendarConfig: hasCalendarCols
    }));
  } catch (err: any) {
    console.warn('[UsersList] bot_users read-only integration unavailable:', err.message);
    return [];
  }
}

// GET /api/users — List all users joined with Telegram metadata,
// merged (read-only) with VM-bot-owned bot_users rows.
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, status, role } = req.query as Record<string, string>;
    const users = await UserService.getUsersWithTelegram({ search, status, role });

    const withSource = users.map((u: any) => ({ ...u, source: 'backend' as const }));

    // status/role filters cannot match VM rows (no such columns) — skip merging then.
    const filtersActive = (status && status !== 'all') || (role && role !== 'all');

    let result: Record<string, any>[] = withSource;

    if (!filtersActive) {
      const botUsers = await fetchVmBotUsers();
      const knownChatIds = new Set(
        withSource.map((u) => String(u.telegram?.telegramId ?? ''))
      );

      const searchTerm = search?.trim().toLowerCase();
      const vmItems = botUsers
        .filter((b) => !knownChatIds.has(String(b.chat_id))) // backend row wins on collision
        .filter((b) => {
          if (!searchTerm) return true;
          const haystack = [
            b.username,
            b.first_name,
            b.last_name,
            String(b.chat_id)
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          return haystack.includes(searchTerm);
        })
        .map((b) => ({
          id: null, // no backend primary key; VM-managed rows are read-only
          name:
            [b.first_name, b.last_name].filter(Boolean).join(' ') ||
            (b.username ? `@${b.username}` : `Telegram User ${b.chat_id}`),
          email: null,
          role: 'user',
          status: 'active',
          createdAt: b.created_at || null,
          updatedAt: b.updated_at || null,
          telegram: {
            telegramId: b.chat_id,
            username: b.username || null,
            firstName: b.first_name || null,
            lastName: b.last_name || null,
            lastSeenAt: b.last_seen_at || b.updated_at || b.created_at || null
          },
          preferredModel: b.preferred_model || null,
          hasGeminiKey: b.hasGeminiKey,
          hasCalendarConfig: b.hasCalendarConfig,
          source: 'vm-bot' as const
        }));

      result = [...withSource, ...vmItems];
    }

    res.json(result);
  } catch (err: any) {
    return logAndSendError(res, err, 'Failed to fetch users');
  }
});

// GET /api/users/:id — Get single user with Telegram metadata
router.get('/:id', async (req: Request, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Valid numeric user ID is required' });
  }

  try {
    const user = await UserService.getUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (err: any) {
    return logAndSendError(res, err, 'Failed to fetch user');
  }
});

// PATCH /api/users/:id — Update user details (name, role, status)
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Valid numeric user ID is required' });
  }

  const { name, role, status } = req.body;

  try {
    const updated = await UserService.updateUser(userId, { name, role, status });
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record audit log
    await db('api_logs').insert({
      chat_id: updated.telegram?.telegramId || null,
      connector: 'admin_panel',
      operation: `update_user_${userId}`,
      status: 'success',
      error_message: `Admin ${req.admin?.username || 'system'} updated user #${userId}`
    });

    res.json(updated);
  } catch (err: any) {
    return logAndSendError(res, err, 'Failed to update user');
  }
});

// PATCH /api/users/:id/status — Quick toggle/update status ('active' / 'disabled')
router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Valid numeric user ID is required' });
  }

  const { status } = req.body;
  if (!status || !['active', 'disabled', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Valid status is required (active, disabled, pending)' });
  }

  try {
    const success = await UserService.updateUserStatus(userId, status);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record audit log
    await db('api_logs').insert({
      chat_id: null,
      connector: 'admin_panel',
      operation: `set_status_${status}_user_${userId}`,
      status: 'success',
      error_message: `Admin ${req.admin?.username || 'system'} changed user #${userId} status to ${status}`
    });

    res.json({ success: true, id: userId, status });
  } catch (err: any) {
    return logAndSendError(res, err, 'Failed to update user status');
  }
});

// DELETE /api/users/:id — Delete user (with audit log)
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId)) {
    return res.status(400).json({ error: 'Valid numeric user ID is required' });
  }

  try {
    const success = await UserService.deleteUser(userId);
    if (!success) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Record audit log
    await db('api_logs').insert({
      chat_id: null,
      connector: 'admin_panel',
      operation: `delete_user_${userId}`,
      status: 'success',
      error_message: `Admin ${req.admin?.username || 'system'} deleted user #${userId}`
    });

    res.json({ success: true, message: `User #${userId} deleted successfully` });
  } catch (err: any) {
    return logAndSendError(res, err, 'Failed to delete user');
  }
});

export default router;
