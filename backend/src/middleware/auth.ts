import { Request, Response, NextFunction } from 'express';
import { verifyAdminToken, AdminPayload } from '../utils/auth';
import { getRequestOrigin, isAllowedOrigin, isSafeHttpMethod } from '../utils/security';

export interface AuthenticatedRequest extends Request {
  admin?: AdminPayload;
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!isSafeHttpMethod(req.method)) {
    const requestOrigin = getRequestOrigin(req);
    if (!requestOrigin || !isAllowedOrigin(requestOrigin)) {
      return res.status(403).json({ error: 'Request origin is not allowed' });
    }
  }

  const token = req.cookies?.admin_session;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const payload = await verifyAdminToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid' });
  }

  req.admin = payload;
  next();
}
