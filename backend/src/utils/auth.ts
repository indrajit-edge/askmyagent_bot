import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const devJwtSecret = crypto.randomBytes(32);

const getSecret = (): Uint8Array => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Fatal Security Error] JWT_SECRET environment variable is missing in production. Application startup aborted.');
    }
    return devJwtSecret;
  }
  return new TextEncoder().encode(secret);
};

export interface AdminPayload {
  username: string;
  role: 'admin';
  [key: string]: any;
}

/**
 * Validates JWT configuration on startup (SEC-007).
 */
export function validateAuthConfig(): boolean {
  const secret = getSecret();
  return secret.length > 0;
}

export async function generateAdminToken(username: string): Promise<string> {
  return new SignJWT({ username, role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('2h')
    .sign(getSecret());
}

export async function verifyAdminToken(token: string): Promise<AdminPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as AdminPayload;
  } catch {
    return null;
  }
}
