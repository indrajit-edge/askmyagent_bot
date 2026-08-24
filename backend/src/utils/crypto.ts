import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const devEncryptionKey = crypto.randomBytes(32);

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Fatal Security Error] ENCRYPTION_KEY environment variable is missing in production. Application startup aborted.');
    }
    return devEncryptionKey;
  }

  // 32-byte (64 hex characters) validation
  if (key.length === 64 && /^[0-9a-fA-F]+$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('[Fatal Security Error] ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes) in production.');
  }

  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Validates the encryption key on startup (SEC-006).
 */
export function validateEncryptionConfig(): boolean {
  try {
    const key = getEncryptionKey();
    return key.length === 32;
  } catch (err) {
    throw err;
  }
}

/**
 * Encrypts a plaintext string (e.g. OAuth access or refresh token) using AES-256-GCM.
 * Output format: iv:encrypted_hex:auth_tag_hex
 */
export function encryptToken(token: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(token, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${tag}`;
}

/**
 * Decrypts a previously encrypted token string formatted as iv:encrypted_hex:auth_tag_hex.
 */
export function decryptToken(encryptedString: string): string {
  const key = getEncryptionKey();
  const parts = encryptedString.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, encryptedHex, tagHex] = parts;

  if (!ivHex || !encryptedHex || !tagHex) {
    throw new Error('Invalid encrypted token format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
