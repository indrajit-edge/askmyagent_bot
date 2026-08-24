import crypto from 'crypto';

const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes validity
const consumedNonces = new Map<string, number>(); // nonce -> timestamp
const devStateSecret = crypto.randomBytes(32).toString('base64url');

// Cleanup consumed nonces periodically (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, timestamp] of consumedNonces.entries()) {
    if (now - timestamp > STATE_TTL_MS) {
      consumedNonces.delete(nonce);
    }
  }
}, 10 * 60 * 1000).unref();

function getStateSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[Security Error] JWT_SECRET or ENCRYPTION_KEY must be configured in production for OAuth state signing.');
    }
    return devStateSecret;
  }
  return secret;
}

export interface OAuthStatePayload {
  chatId: number;
  provider: string;
  timestamp: number;
  nonce: string;
}

/**
 * Generates a signed, single-use, time-limited OAuth state token containing the Telegram chat_id and provider.
 */
export function generateOAuthState(chatId: number, provider: string): string {
  if (!chatId || typeof chatId !== 'number') {
    throw new Error('Valid numeric chatId is required to generate OAuth state.');
  }
  if (!provider || typeof provider !== 'string') {
    throw new Error('Valid provider string is required to generate OAuth state.');
  }

  const payload: OAuthStatePayload = {
    chatId,
    provider: provider.toLowerCase().trim(),
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };

  const jsonStr = JSON.stringify(payload);
  const payloadB64 = Buffer.from(jsonStr).toString('base64url');

  const hmac = crypto.createHmac('sha256', getStateSecret());
  hmac.update(payloadB64);
  const signature = hmac.digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the signature, integrity, single-use validity, and expiration of the OAuth state parameter.
 * Strictly rejects any unsigned, expired, replayed, or malformed state.
 */
export function verifyOAuthState(stateStr: string): { chatId: number; provider: string } {
  if (!stateStr || typeof stateStr !== 'string') {
    throw new Error('Missing or invalid OAuth state parameter.');
  }

  // Strictly enforce signed state format: payloadB64.signature
  const parts = stateStr.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Invalid OAuth state structure. Unsigned states are strictly rejected.');
  }

  const [payloadB64, signature] = parts;

  // 1. Verify HMAC-SHA256 signature with timing-safe comparison
  const hmac = crypto.createHmac('sha256', getStateSecret());
  hmac.update(payloadB64);
  const expectedSignature = hmac.digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('Invalid OAuth state signature. State tampering detected.');
  }

  // 2. Decode and parse JSON payload
  let payload: OAuthStatePayload;
  try {
    const decodedJson = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(decodedJson);
  } catch {
    throw new Error('Failed to parse OAuth state payload.');
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('Malformed OAuth state payload.');
  }

  const { chatId, provider, timestamp, nonce } = payload;

  if (!chatId || typeof chatId !== 'number' || !provider || typeof provider !== 'string') {
    throw new Error('Incomplete OAuth state payload.');
  }

  // 3. Verify expiration
  if (!timestamp || typeof timestamp !== 'number' || Date.now() - timestamp > STATE_TTL_MS) {
    throw new Error('OAuth state parameter has expired. Please initiate connection again.');
  }

  // 4. Verify single-use nonce against replay attacks
  if (!nonce || typeof nonce !== 'string') {
    throw new Error('Missing cryptographic nonce in OAuth state.');
  }

  if (consumedNonces.has(nonce)) {
    throw new Error('OAuth state token has already been used. Replay attempt detected.');
  }

  consumedNonces.set(nonce, Date.now());

  return {
    chatId: Number(chatId),
    provider: provider.toLowerCase().trim()
  };
}

/**
 * Utility to clear consumed nonces (used in test suites).
 */
export function resetConsumedNonces(): void {
  consumedNonces.clear();
}
