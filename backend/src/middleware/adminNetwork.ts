import { Request, Response, NextFunction } from 'express';
import net from 'net';
import db from '../database/connection';

/**
 * Normalizes an IP string (e.g. trimming whitespace, unwrapping IPv4-mapped IPv6 ::ffff:x.x.x.x).
 */
export function normalizeIp(ip: string): string {
  const trimmed = (ip || '').trim();
  if (trimmed.startsWith('::ffff:')) {
    const v4 = trimmed.substring(7);
    if (net.isIP(v4) === 4) {
      return v4;
    }
  }
  return trimmed;
}

/**
 * Checks if a string is a valid IPv4 or IPv6 address.
 */
export function isValidIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  return net.isIP(normalized) !== 0;
}

/**
 * Parses and validates comma-separated allowed IPs from ADMIN_ALLOWED_IPS.
 * Whitespace is trimmed, invalid values are filtered out.
 */
export function parseAllowedIps(raw?: string): string[] {
  if (!raw || typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map((ip) => normalizeIp(ip))
    .filter((ip): ip is string => {
      if (!ip) return false;
      return isValidIp(ip);
    });
}

/**
 * Extracts and normalizes the client IP from Express request.
 */
export function extractClientIp(req: Request): string {
  const rawIp = req.ip || req.socket?.remoteAddress || 'unknown';
  return normalizeIp(rawIp);
}

const MAX_LOG_THROTTLE_ENTRIES = 1000;
const deniedLogThrottle = new Map<string, number>();

function shouldLogDenial(clientIp: string): boolean {
  const now = Date.now();

  // Bounded memory cleanup
  if (deniedLogThrottle.size > MAX_LOG_THROTTLE_ENTRIES) {
    for (const [key, time] of deniedLogThrottle.entries()) {
      if (now - time > 60_000) {
        deniedLogThrottle.delete(key);
      }
    }
    if (deniedLogThrottle.size > MAX_LOG_THROTTLE_ENTRIES) {
      deniedLogThrottle.clear();
    }
  }

  const lastLogged = deniedLogThrottle.get(clientIp);
  if (lastLogged && now - lastLogged < 60_000) {
    return false;
  }
  deniedLogThrottle.set(clientIp, now);
  return true;
}

async function logIpDenial(req: Request, clientIp: string): Promise<void> {
  if (!shouldLogDenial(clientIp)) return;

  try {
    const userAgent = (req.get('user-agent') || '').substring(0, 255);
    await db('api_logs').insert({
      chat_id: null,
      connector: 'admin_network',
      operation: 'ADMIN_IP_DENIED',
      status: 'error',
      error_message: `Admin access denied from IP ${clientIp} to ${req.method} ${req.path}${userAgent ? ` (UA: ${userAgent})` : ''}`
    });
  } catch {
    // Ignore logging failures - never fail open
  }
}

/**
 * Enforces network-level restriction on admin routes.
 * Only IP addresses configured in ADMIN_ALLOWED_IPS may access protected admin endpoints.
 * In production, fails closed (HTTP 403) if ADMIN_ALLOWED_IPS is missing or empty.
 */
export function requireAdminNetworkAccess(req: Request, res: Response, next: NextFunction) {
  const allowedIps = parseAllowedIps(process.env.ADMIN_ALLOWED_IPS);
  const isProduction = process.env.NODE_ENV === 'production';
  const clientIp = extractClientIp(req);

  // Production fail-closed: missing or empty allowlist denies all admin access
  if (allowedIps.length === 0) {
    if (isProduction) {
      console.warn(`[AdminNetwork] Denied admin access from ${clientIp}: ADMIN_ALLOWED_IPS is not configured in production`);
      logIpDenial(req, clientIp).catch(() => {});
      return res.status(403).json({ error: 'Admin access restricted' });
    }
    return next();
  }

  if (!allowedIps.includes(clientIp)) {
    console.warn(`[AdminNetwork] Denied admin access from ${clientIp} to ${req.method} ${req.path}`);
    logIpDenial(req, clientIp).catch(() => {});
    return res.status(403).json({ error: 'Admin access restricted' });
  }

  next();
}
