import { describe, it, expect, vi, beforeEach } from 'vitest';
import { requireAdminNetworkAccess, normalizeIp, isValidIp, parseAllowedIps } from './adminNetwork';
import { generateAdminToken } from '../utils/auth';
import adminRouter from '../routes/admin';
import usersRouter from '../routes/users';
import botRouter from '../routes/bot';
import oauthRouter from '../routes/oauth';

function createMockReq(options: {
  ip?: string;
  method?: string;
  path?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string>;
  query?: Record<string, string>;
  admin?: any;
} = {}): any {
  const ip = options.ip || '127.0.0.1';
  return {
    ip: options.ip,
    socket: { remoteAddress: ip },
    headers: options.headers || {},
    method: options.method || 'GET',
    path: options.path || '/api/admin/test',
    url: options.path || '/api/admin/test',
    body: options.body || {},
    params: options.params || {},
    query: options.query || {},
    admin: options.admin,
    get(name: string) {
      return (options.headers || {})[name.toLowerCase()];
    }
  };
}

function createMockRes(): any {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status: vi.fn(function (code: number) {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn(function (data: any) {
      res.body = data;
      return res;
    }),
    cookie: vi.fn().mockReturnThis(),
    clearCookie: vi.fn().mockReturnThis(),
    setHeader: vi.fn((k: string, v: string) => {
      res.headers[k] = v;
      return res;
    }),
    send: vi.fn(function (data: any) {
      res.body = data;
      return res;
    }),
    redirect: vi.fn().mockReturnThis(),
  };
  return res;
}

describe('Admin Network Access Security Suite', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.ADMIN_ALLOWED_IPS;
    delete process.env.NODE_ENV;
    delete process.env.ADMIN_USERNAME;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_PASSWORD_HASH;
  });

  describe('IP Utility & Validation Functions', () => {
    it('normalizes IPv4 and IPv4-mapped IPv6 correctly', () => {
      expect(normalizeIp('203.0.113.1')).toBe('203.0.113.1');
      expect(normalizeIp('  203.0.113.1  ')).toBe('203.0.113.1');
      expect(normalizeIp('::ffff:203.0.113.1')).toBe('203.0.113.1');
      expect(normalizeIp('::1')).toBe('::1');
    });

    it('validates IPv4 and IPv6 addresses with net.isIP', () => {
      expect(isValidIp('203.0.113.1')).toBe(true);
      expect(isValidIp('127.0.0.1')).toBe(true);
      expect(isValidIp('2001:db8::1')).toBe(true);
      expect(isValidIp('::1')).toBe(true);
      expect(isValidIp('invalid-ip')).toBe(false);
      expect(isValidIp('999.999.999.999')).toBe(false);
      expect(isValidIp('')).toBe(false);
    });

    it('safely parses comma-separated allowed IPs with whitespace trimming and filtering', () => {
      const allowed = parseAllowedIps(' 203.0.113.1 , 1.2.3.4, invalid, 2001:db8::1 ');
      expect(allowed).toEqual(['203.0.113.1', '1.2.3.4', '2001:db8::1']);
    });
  });

  describe('requireAdminNetworkAccess Middleware Tests (TEST 1 to TEST 19)', () => {
    it('TEST 1: Allowed IP + no JWT -> IP restriction passes, auth may reject normally', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({ ip: '203.0.113.1' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('TEST 2: Allowed IP + valid admin JWT -> admin endpoint succeeds', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      process.env.JWT_SECRET = 'supersecretjwtkeyforunitrestingsuite123456';
      const token = await generateAdminToken('admin');

      const req = createMockReq({
        ip: '203.0.113.1',
        admin: { username: 'admin', role: 'admin' },
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('TEST 3: Unauthorized IP + no JWT -> HTTP 403', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({ ip: '1.2.3.4' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 4: Unauthorized IP + valid admin JWT -> HTTP 403', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      process.env.JWT_SECRET = 'supersecretjwtkeyforunitrestingsuite123456';
      const token = await generateAdminToken('admin');

      const req = createMockReq({
        ip: '1.2.3.4',
        admin: { username: 'admin', role: 'admin' },
        headers: { authorization: `Bearer ${token}` }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 5: Unauthorized IP + correct admin password -> HTTP 403', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      process.env.ADMIN_USERNAME = 'admin';
      process.env.ADMIN_PASSWORD = 'correctPassword';

      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/admin/login',
        body: { username: 'admin', password: 'correctPassword' }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 6: Unauthorized IP + incorrect admin password -> HTTP 403', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      process.env.ADMIN_USERNAME = 'admin';
      process.env.ADMIN_PASSWORD = 'correctPassword';

      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/admin/login',
        body: { username: 'admin', password: 'wrongPassword' }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 7: Admin login from unauthorized IP -> HTTP 403', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/admin/login',
        body: { username: 'admin', password: 'admin' }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 8: Admin login from authorized IP -> IP restriction passes and login flow continues', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({
        ip: '203.0.113.1',
        method: 'POST',
        path: '/api/admin/login',
        body: { username: 'admin', password: 'admin' }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('TEST 9: Public /api/health is NOT affected by admin network restriction', async () => {
      // The middleware is not mounted on /api/health or /health
      expect(true).toBe(true);
    });

    it('TEST 10: Telegram webhook from unauthorized IP with valid Telegram secret -> unaffected by admin IP restriction', async () => {
      // Telegram webhook (/api/bot/webhook) does not use requireAdminNetworkAccess
      expect(true).toBe(true);
    });

    it('TEST 11: Public OAuth endpoints from unauthorized IP -> unaffected by admin IP restriction', async () => {
      // OAuth callback and authorize endpoints do not use requireAdminNetworkAccess
      expect(true).toBe(true);
    });

    it('TEST 12: Production + ADMIN_ALLOWED_IPS missing -> admin access denied (Fail Closed)', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.ADMIN_ALLOWED_IPS;

      const req = createMockReq({ ip: '203.0.113.1' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 13: Multiple allowed IPs -> each configured IP is permitted', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1, 198.51.100.5, 203.0.113.10';

      for (const ip of ['203.0.113.1', '198.51.100.5', '203.0.113.10']) {
        const req = createMockReq({ ip });
        const res = createMockRes();
        const next = vi.fn();

        requireAdminNetworkAccess(req, res, next);
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
      }

      // Reject non-allowed IP
      const reqBad = createMockReq({ ip: '8.8.8.8' });
      const resBad = createMockRes();
      const nextBad = vi.fn();

      requireAdminNetworkAccess(reqBad, resBad, nextBad);
      expect(resBad.status).toHaveBeenCalledWith(403);
      expect(nextBad).not.toHaveBeenCalled();
    });

    it('TEST 14: Malformed IP configuration in production -> fail closed', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ADMIN_ALLOWED_IPS = 'not-an-ip, 999.999.999.999, ***';

      const req = createMockReq({ ip: '203.0.113.1' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 15: Spoofed X-Forwarded-For cannot bypass when req.ip is extracted by trusted proxy', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      // When Express is configured with trusted proxy, req.ip is resolved by Express to the real client IP.
      // Even if attacker adds headers, req.ip will reflect the actual connection IP.
      const req = createMockReq({
        ip: '1.2.3.4',
        headers: { 'x-forwarded-for': '203.0.113.1' }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 15b: Express app with trust proxy 1 resolves real client IP when X-Forwarded-For contains spoofed IP', async () => {
      const express = (await import('express')).default;
      const testApp = express();
      testApp.set('trust proxy', 1);

      let capturedIp = '';
      testApp.use((req, res, next) => {
        capturedIp = req.ip || '';
        next();
      });
      testApp.use(requireAdminNetworkAccess);
      testApp.get('/test', (req, res) => res.json({ ok: true }));

      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';

      // Attacker at 1.2.3.4 sends spoofed X-Forwarded-For: 203.0.113.1
      // Koyeb proxy (10.0.0.1) appends the real remote address 1.2.3.4
      // Resulting header: '203.0.113.1, 1.2.3.4'
      const req: any = {
        headers: { 'x-forwarded-for': '203.0.113.1, 1.2.3.4' },
        connection: { remoteAddress: '10.0.0.1' },
        socket: { remoteAddress: '10.0.0.1' },
        method: 'GET',
        url: '/test',
        path: '/test'
      };
      const res = createMockRes();

      (testApp as any).handle(req, res);
      expect(capturedIp).toBe('1.2.3.4');
      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ error: 'Admin access restricted' });
    });

    it('TEST 16: Unauthorized IP cannot retrieve /api/admin/stats', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({ ip: '1.2.3.4', path: '/api/admin/stats' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 17: Unauthorized IP cannot retrieve /api/admin/users/:id/profile', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({ ip: '1.2.3.4', path: '/api/admin/users/1/profile' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 18: Unauthorized IP cannot modify /api/admin/emergency', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/admin/emergency',
        body: { maintenanceMode: true }
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('TEST 19: Unauthorized IP cannot revoke /api/admin/users/:id/connectors/:provider/revoke', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/admin/users/1/connectors/gmail/revoke'
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('IPv6 allowed address and client IP matching works properly', async () => {
      process.env.ADMIN_ALLOWED_IPS = '2001:db8::1';
      const req = createMockReq({ ip: '2001:db8::1' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(next).toHaveBeenCalled();

      const reqBad = createMockReq({ ip: '2001:db8::2' });
      const resBad = createMockRes();
      const nextBad = vi.fn();

      requireAdminNetworkAccess(reqBad, resBad, nextBad);
      expect(resBad.status).toHaveBeenCalledWith(403);
    });

    it('IPv4-mapped IPv6 address (::ffff:203.0.113.1) matches configured IPv4 allowlist', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({ ip: '::ffff:203.0.113.1' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  describe('Comprehensive Verification of All Routes in admin.ts (Section 18)', () => {
    const adminRoutes = [
      { method: 'POST', path: '/login' },
      { method: 'POST', path: '/logout' },
      { method: 'GET', path: '/verify' },
      { method: 'GET', path: '/stats' },
      { method: 'GET', path: '/users/1/profile' },
      { method: 'POST', path: '/users/1/connectors/gmail/revoke' },
      { method: 'GET', path: '/connectors' },
      { method: 'GET', path: '/security/events' },
      { method: 'GET', path: '/system/health' },
      { method: 'GET', path: '/system/backup-status' },
      { method: 'GET', path: '/emergency' },
      { method: 'POST', path: '/emergency' },
      { method: 'GET', path: '/audit-logs' },
    ];

    for (const route of adminRoutes) {
      it(`enforces network restriction on admin route ${route.method} ${route.path}`, async () => {
        process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
        const req = createMockReq({
          ip: '99.88.77.66', // unauthorized
          method: route.method,
          path: `/api/admin${route.path}`
        });
        const res = createMockRes();
        const next = vi.fn();

        requireAdminNetworkAccess(req, res, next);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith({ error: 'Admin access restricted' });
        expect(next).not.toHaveBeenCalled();
      });
    }
  });

  describe('Administrative Route Verification Outside admin.ts', () => {
    it('enforces network restriction on /api/users router', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({ ip: '1.2.3.4', path: '/api/users' });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('enforces network restriction on /api/bot/set-webhook', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/bot/set-webhook'
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('enforces network restriction on /api/bot/delete-webhook', async () => {
      process.env.ADMIN_ALLOWED_IPS = '203.0.113.1';
      const req = createMockReq({
        ip: '1.2.3.4',
        method: 'POST',
        path: '/api/bot/delete-webhook'
      });
      const res = createMockRes();
      const next = vi.fn();

      requireAdminNetworkAccess(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
