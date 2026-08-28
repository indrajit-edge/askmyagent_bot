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
 * Checks whether an IP address is a private/internal or loopback address.
 */
export function isPrivateIp(ip: string): boolean {
  const normalized = normalizeIp(ip);
  if (!isValidIp(normalized)) return true;

  if (net.isIP(normalized) === 4) {
    if (normalized.startsWith('10.')) return true;
    if (normalized.startsWith('127.')) return true;
    if (normalized.startsWith('192.168.')) return true;
    if (normalized.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized)) return true;
    if (/^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./.test(normalized)) return true;
    return false;
  }

  const lower = normalized.toLowerCase();
  if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) {
    return true;
  }

  return false;
}

/**
 * Extracts and normalizes the client IP from Express request, properly unwrapping
 * cloud reverse proxy and edge headers if req.ip resolves to an internal network address.
 */
export function extractClientIp(req: Request): string {
  const expressIp = req.ip ? normalizeIp(req.ip) : '';
  if (expressIp && isValidIp(expressIp) && !isPrivateIp(expressIp)) {
    return expressIp;
  }

  // Edge proxy headers (Cloudflare, Render edge, CDN)
  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string') {
    const norm = normalizeIp(cfIp);
    if (isValidIp(norm) && !isPrivateIp(norm)) return norm;
  }

  const trueClientIp = req.headers['true-client-ip'];
  if (typeof trueClientIp === 'string') {
    const norm = normalizeIp(trueClientIp);
    if (isValidIp(norm) && !isPrivateIp(norm)) return norm;
  }

  const xRealIp = req.headers['x-real-ip'];
  if (typeof xRealIp === 'string') {
    const norm = normalizeIp(xRealIp);
    if (isValidIp(norm) && !isPrivateIp(norm)) return norm;
  }

  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') {
    const ips = xff.split(',').map((s: string) => normalizeIp(s.trim())).filter(isValidIp);
    const firstPublic = ips.find((ip: string) => !isPrivateIp(ip));
    if (firstPublic) return firstPublic;
  }

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
  if (process.env.ALLOW_PUBLIC_ADMIN === 'true') {
    return next();
  }

  const allowedIps = parseAllowedIps(process.env.ADMIN_ALLOWED_IPS);
  const isProduction = process.env.NODE_ENV === 'production';
  const clientIp = extractClientIp(req);

  // In development, loopback / private subnet is permitted
  if (!isProduction && (clientIp === '127.0.0.1' || clientIp === '::1' || isPrivateIp(clientIp))) {
    return next();
  }

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
