import { Router } from 'express';
import { GoogleOAuthService } from '../oauth/oauthService';
import { isAllowedOrigin } from '../utils/security';

const router = Router();

// OAuth callback endpoint (POST: called by frontend SPA)
router.post('/callback', async (req, res) => {
  const { code, state } = req.body;

  if (!code || !state) {
    return res.status(400).json({ error: 'Authorization code and state are required.' });
  }

  try {
    const result = await GoogleOAuthService.handleCallback(code, state);
    return res.json({
      success: true,
      message: `Google Workspace connection for ${result.provider} established successfully!`,
      chatId: result.chatId,
      provider: result.provider,
      email: result.email
    });
  } catch (err: any) {
    return res.status(400).json({
      error: err.message || 'Failed to finalize Google Workspace authorization.'
    });
  }
});

// Direct OAuth callback endpoint (GET: called directly by Google redirect)
router.get('/callback', async (req, res) => {
  const code = req.query.code as string;
  const state = req.query.state as string;
  const configuredFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const frontendUrl = isAllowedOrigin(configuredFrontendUrl) ? configuredFrontendUrl : 'http://localhost:5173';

  if (!code || !state) {
    return res.redirect(`${frontendUrl}/oauth/callback?error=${encodeURIComponent('Missing code or state parameter.')}`);
  }

  try {
    const result = await GoogleOAuthService.handleCallback(code, state);
    return res.redirect(`${frontendUrl}/oauth/callback?status=success&provider=${encodeURIComponent(result.provider)}&email=${encodeURIComponent(result.email)}`);
  } catch (err: any) {
    return res.redirect(`${frontendUrl}/oauth/callback?status=error&error=${encodeURIComponent(err.message || 'OAuth authorization failed.')}`);
  }
});

// Endpoint to generate an authorization URL for testing or bot integration
router.get('/authorize', (req, res) => {
  const chatId = parseInt(req.query.chat_id as string, 10);
  const provider = (req.query.provider as string) || 'gmail';

  if (isNaN(chatId)) {
    return res.status(400).json({ error: 'Valid numeric chat_id is required' });
  }

  const url = GoogleOAuthService.getAuthorizationUrl(chatId, provider);
  return res.json({ success: true, url, provider, chatId });
});

export default router;
