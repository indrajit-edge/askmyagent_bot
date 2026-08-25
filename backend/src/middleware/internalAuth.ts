import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Shared-secret authentication for the internal API consumed by the VM bot.
 * The caller is a trusted server, not a browser — so we use a service token
 * header instead of the admin JWT session.
 *
 * Mirrors the fail-closed posture of the old Telegram webhook secret check:
 * enforced whenever INTERNAL_API_TOKEN is set, and mandatory in production.
 */
export function requireInternalToken(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_API_TOKEN;
  const received = req.headers['x-internal-token'];

  if (!expected || typeof expected !== 'string') {
    if (process.env.NODE_ENV === 'production') {
      console.error('[InternalAuth] INTERNAL_API_TOKEN is not set in production. Internal API is locked.');
      return res.status(500).json({ error: 'Server misconfiguration: INTERNAL_API_TOKEN is not set.' });
    }
    // Development convenience only: allow unauthenticated local calls when no token is configured.
    return next();
  }

  if (!received || typeof received !== 'string') {
    return res.status(401).json({ error: 'Unauthorized: Missing x-internal-token header.' });
  }

  const expectedBuf = Buffer.from(expected);
  const receivedBuf = Buffer.from(received);

  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid internal token.' });
  }

  next();
}
