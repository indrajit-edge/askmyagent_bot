import { Router, Request, Response } from 'express';
import { requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { requireAdminNetworkAccess } from '../middleware/adminNetwork';
import { UserService } from '../services/userService';
import db from '../database/connection';
import { logAndSendError } from '../utils/security';

const router = Router();

router.use(requireAdminNetworkAccess);
router.use(requireAdmin);

// GET /api/users — List all users joined with Telegram metadata
router.get('/', async (req: Request, res: Response) => {
  try {
    const { search, status, role } = req.query as Record<string, string>;
    const users = await UserService.getUsersWithTelegram({ search, status, role });
    res.json(users);
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
