import { generateOAuthState, verifyOAuthState } from './state';
import { getScopesForProvider } from './scopes';
import { GoogleTokenStore } from './tokenStore';
import db from '../database/connection';

export class GoogleOAuthService {
  private static getClientId(): string {
    return process.env.GOOGLE_CLIENT_ID || '';
  }

  private static getClientSecret(): string {
    return process.env.GOOGLE_CLIENT_SECRET || '';
  }

  private static getRedirectUri(): string {
    return process.env.GOOGLE_REDIRECT_URI || `${process.env.FRONTEND_URL || 'http://localhost:5173'}/oauth/callback`;
  }

  /**
   * Generates a signed, state-protected Google OAuth authorization URL for a specific provider.
   */
  static getAuthorizationUrl(chatId: number, provider: string): string {
    const scopes = getScopesForProvider(provider);
    const state = generateOAuthState(chatId, provider);
    const redirectUri = this.getRedirectUri();
    const clientId = this.getClientId();

    if (!clientId) {
      throw new Error('Google OAuth is not configured on this server (missing GOOGLE_CLIENT_ID).');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Processes the OAuth callback: verifies state, exchanges auth code, and saves encrypted tokens.
   * Fails fast if real token exchange fails (SEC-008).
   */
  static async handleCallback(code: string, state: string): Promise<{ chatId: number; provider: string; email: string }> {
    if (!code || typeof code !== 'string') {
      throw new Error('Authorization code is required.');
    }
    if (!state || typeof state !== 'string') {
      throw new Error('OAuth state parameter is required.');
    }

    // 1. Verify signed state parameter (cryptographic HMAC signature & TTL)
    const { chatId, provider } = verifyOAuthState(state);

    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    const scopes = getScopesForProvider(provider);

    let accessToken: string;
    let refreshToken: string;
    let email = `${provider}-user-${chatId}@example.invalid`;
    let expiry = new Date(Date.now() + 3600 * 1000);

    const isLiveGcpConfigured = !!(clientId && clientSecret);
    const isMockCode = code.startsWith('mock_') || code.startsWith('test_');

    // 2. Perform Real Token Exchange with Google Cloud OAuth
    if (isLiveGcpConfigured && !isMockCode) {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: this.getRedirectUri(),
          grant_type: 'authorization_code'
        })
      });

      if (!tokenRes.ok) {
        const errorBody = await tokenRes.text().catch(() => '');
        // Log safe audit failure
        await db('api_logs').insert({
          chat_id: chatId,
          connector: provider,
          operation: 'oauth_callback_failed',
          status: 'error',
          error_message: 'Google Cloud OAuth token exchange was rejected by Google servers.'
        }).catch(() => {});

        throw new Error('Google OAuth token exchange failed. The authorization code was rejected or has expired.');
      }

      const tokenData = await tokenRes.json();
      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token || `reauth_needed_${Date.now()}`;
      if (tokenData.expires_in) {
        expiry = new Date(Date.now() + tokenData.expires_in * 1000);
      }

      // Fetch verified user email
      try {
        const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (userinfoRes.ok) {
          const userinfo = await userinfoRes.json();
          if (userinfo.email) {
            email = userinfo.email;
          }
        }
      } catch {
        // Fallback to provider email format if userinfo endpoint fails
      }
    } else {
      // Mock exchange permitted only when live GCP credentials are not set or explicit test mock code is used
      if (process.env.NODE_ENV === 'production' && !isLiveGcpConfigured) {
        throw new Error('Google OAuth is not configured on this server (missing GOOGLE_CLIENT_ID/SECRET).');
      }

      refreshToken = `1//0g_refresh_${code}_${Date.now()}`;
      accessToken = `ya29.a0_${code}_${Date.now()}`;
    }

    // 3. Encrypt and persist to SQLite database
    await GoogleTokenStore.storeCredentials(
      chatId,
      provider,
      email,
      refreshToken,
      accessToken,
      expiry,
      scopes
    );

    // 4. Record successful audit log
    await db('api_logs').insert({
      chat_id: chatId,
      connector: provider,
      operation: 'oauth_callback',
      status: 'success'
    });

    return { chatId, provider, email };
  }
}
