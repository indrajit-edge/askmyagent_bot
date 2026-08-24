import { Request } from 'express';
import { Response } from 'express';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function getAllowedOrigins(): string[] {
  const raw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:5173';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return false;

  const allowedOrigins = getAllowedOrigins();
  if (allowedOrigins.includes('*')) {
    return process.env.NODE_ENV !== 'production';
  }

  if (allowedOrigins.includes(origin)) return true;

  if (process.env.NODE_ENV !== 'production') {
    try {
      const hostname = new URL(origin).hostname;
      return LOCALHOST_HOSTS.has(hostname);
    } catch {
      return false;
    }
  }

  return false;
}

export function isSafeHttpMethod(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());
}

export function getRequestOrigin(req: Request): string | undefined {
  const origin = req.get('origin');
  if (origin) return origin;

  const referer = req.get('referer');
  if (!referer) return undefined;

  try {
    const parsed = new URL(referer);
    return parsed.origin;
  } catch {
    return undefined;
  }
}

export function htmlEscape(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function validatePublicHttpsUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return null;
    if (!url.hostname || LOCALHOST_HOSTS.has(url.hostname)) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function safeErrorMessage(fallback: string): string {
  return process.env.NODE_ENV === 'production' ? 'Internal server error' : fallback;
}

export function logAndSendError(res: Response, err: unknown, fallback: string, status = 500) {
  console.error(`[API Error] ${fallback}:`, err);
  return res.status(status).json({ error: safeErrorMessage(fallback) });
}
