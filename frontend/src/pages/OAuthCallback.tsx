import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Loader2, ShieldCheck, ArrowLeft, Send } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { apiFetch } from '../lib/api';

interface OAuthCallbackProps {
  onNavigateHome: () => void;
}

export default function OAuthCallback({ onNavigateHome }: OAuthCallbackProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [providerName, setProviderName] = useState('Google Workspace');
  const [authorizedEmail, setAuthorizedEmail] = useState('');

  // Plain https://t.me/ link (not tg://) so it works in browser tabs (e.g.
  // web.telegram.org) and auto-redirects into the native Telegram app if installed.
  const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'your_bot_username').replace(/^@/, '');
  const telegramBotUrl = `https://t.me/${telegramBotUsername}`;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const queryStatus = params.get('status');
    const queryProvider = params.get('provider');
    const queryEmail = params.get('email');
    const queryError = params.get('error');

    // Handle direct redirect from backend GET callback
    if (queryStatus === 'success') {
      setStatus('success');
      if (queryProvider) setProviderName(`Google ${queryProvider.charAt(0).toUpperCase() + queryProvider.slice(1)}`);
      if (queryEmail) setAuthorizedEmail(queryEmail);
      return;
    }

    if (queryStatus === 'error' || queryError) {
      setStatus('error');
      setErrorMsg(queryError || 'Google Workspace authorization was not completed.');
      return;
    }

    // Handle standard code + state exchange
    if (!code || !state) {
      setStatus('error');
      setErrorMsg('Authorization code or state parameter is missing from the callback URL.');
      return;
    }

    // Determine provider name from state if present (e.g. payload in base64url)
    try {
      if (state.includes('.')) {
        const payloadB64 = state.split('.')[0];
        const decoded = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
        if (decoded.provider) {
          const prov = decoded.provider.charAt(0).toUpperCase() + decoded.provider.slice(1);
          setProviderName(`Google ${prov}`);
        }
      }
    } catch {
      // Fallback
    }

    apiFetch('/api/oauth/callback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state })
    })
      .then(async (res) => {
        const data = await res.json();
        if (res.ok && data.success) {
          setStatus('success');
          if (data.provider) {
            setProviderName(`Google ${data.provider.charAt(0).toUpperCase() + data.provider.slice(1)}`);
          }
          if (data.email) {
            setAuthorizedEmail(data.email);
          }
        } else {
          setStatus('error');
          setErrorMsg(data.error || 'Failed to finalize Google Workspace authorization.');
        }
      })
      .catch(() => {
        setStatus('error');
        setErrorMsg('Network error: Could not reach backend server to verify credentials.');
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background ambient glows */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-glow" />
      <div className="absolute inset-0 bg-grid-pattern opacity-30 -z-10" />

      {/* Top back button */}
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={onNavigateHome}
        className="absolute top-6 left-6 inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors p-2 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md"
      >
        <ArrowLeft className="h-4 w-4" />
        Return to Home
      </motion.button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="w-full max-w-md"
      >
        <Card className="border-white/10 bg-slate-900/85 shadow-2xl backdrop-blur-2xl text-center">
          {/* Loading State */}
          {status === 'loading' && (
            <>
              <CardHeader className="pb-2">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20">
                  <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
                </div>
                <CardTitle className="text-2xl">Linking {providerName}</CardTitle>
                <CardDescription className="text-slate-400 text-sm">
                  Exchanging authorization code and securely encrypting your credentials...
                </CardDescription>
              </CardHeader>
              <CardContent className="py-6 flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  AES-256-GCM Token Encryption in progress
                </div>
              </CardContent>
            </>
          )}

          {/* Success State */}
          {status === 'success' && (
            <>
              <CardHeader className="pb-2">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <Badge variant="emerald" className="mx-auto mb-2">Connected Successfully</Badge>
                <CardTitle className="text-2xl text-white">{providerName} Connected!</CardTitle>
                <CardDescription className="text-slate-300 text-sm mt-1">
                  {authorizedEmail ? (
                    <span>Authorized account: <strong className="text-white">{authorizedEmail}</strong></span>
                  ) : (
                    <span>Your account is now linked with AskMyAgent.</span>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 pb-4 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  You can now safely return to Telegram to issue natural language commands to your AI assistant.
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  {/* Purely navigational: the OAuth token exchange completes
                      server-side before this page renders, so nothing depends
                      on the user clicking this link. */}
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-semibold hover:opacity-95 shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Open AskMyAgent on Telegram
                  </a>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    If nothing happens, search for{' '}
                    <code className="text-slate-300 select-all">@{telegramBotUsername}</code>{' '}
                    in Telegram.
                  </p>
                  <Button
                    variant="outline"
                    onClick={onNavigateHome}
                    className="w-full text-xs text-slate-400 hover:text-white"
                  >
                    Return to Overview
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Error State */}
          {status === 'error' && (
            <>
              <CardHeader className="pb-2">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 shadow-lg shadow-rose-500/20">
                  <XCircle className="h-7 w-7 text-rose-400" />
                </div>
                <Badge variant="rose" className="mx-auto mb-2">Authorization Error</Badge>
                <CardTitle className="text-2xl text-white">Connection Failed</CardTitle>
                <CardDescription className="text-rose-300 text-xs font-medium mt-1">
                  {errorMsg}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-2 pb-4 space-y-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  Please return to Telegram and type <code>/connectors</code> to generate a fresh, secure authorization link.
                </p>

                <div className="flex flex-col gap-2 pt-2">
                  <a
                    href={telegramBotUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-medium border border-white/10 transition-all"
                  >
                    <Send className="h-4 w-4" />
                    Return to Telegram
                  </a>
                  <Button
                    variant="outline"
                    onClick={onNavigateHome}
                    className="w-full text-xs text-slate-400 hover:text-white"
                  >
                    Back to Home
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          <CardFooter className="flex justify-center border-t border-white/5 py-3">
            <span className="text-[11px] text-slate-500">
              AskMyAgent Security • AES-256-GCM Authenticated Encryption
            </span>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
