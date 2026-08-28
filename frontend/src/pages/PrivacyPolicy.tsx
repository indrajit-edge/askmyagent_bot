import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, ArrowLeft, Lock, Database, EyeOff, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

interface PrivacyPolicyProps {
  onNavigateHome: () => void;
  onNavigateTerms?: () => void;
}

export default function PrivacyPolicy({ onNavigateHome, onNavigateTerms }: PrivacyPolicyProps) {
  const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'AskMyAgentBot').replace(/^@/, '');
  const telegramBotUrl = `https://t.me/${telegramBotUsername}`;

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Background ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none -z-10">
        <div className="absolute top-[-100px] left-1/3 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] animate-pulse-glow" />
        <div className="absolute top-[100px] right-1/4 w-[400px] h-[400px] bg-purple-600/10 rounded-full blur-[140px] animate-pulse-glow" style={{ animationDelay: '2.5s' }} />
        <div className="absolute inset-0 bg-grid-pattern opacity-25" />
      </div>

      {/* Top Navbar */}
      <nav className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-3.5 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onNavigateHome} 
            className="text-slate-300 hover:text-white gap-1.5 px-2.5 sm:px-3 text-xs"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" />
            <span className="font-bold text-xs sm:text-sm tracking-tight text-white">AskMyAgent Legal</span>
          </div>
          <Button 
            variant="glow" 
            size="sm" 
            onClick={() => window.open(telegramBotUrl, '_blank')}
            className="gap-1.5 text-xs px-2.5 sm:px-3"
          >
            <Send className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Open Bot</span>
            <span className="sm:hidden">Bot</span>
          </Button>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-4">
            <Lock className="h-3.5 w-3.5" />
            Official Privacy Statement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Privacy Policy
          </h1>
          <p className="text-slate-400 text-sm mt-2">
            Last Updated: August 27, 2026 • Effective Immediately
          </p>
        </motion.div>

        <Card className="bg-slate-900/60 border-white/10 backdrop-blur-xl">
          <CardContent className="p-6 sm:p-8 space-y-6 text-sm text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                1. Overview & Commitment to Privacy
              </h2>
              <p>
                <strong>AskMyAgent</strong> (&quot;we&quot;, &quot;our&quot;, or &quot;the Service&quot;) is an AI-powered personal assistant accessible via Telegram that connects securely with Google Workspace APIs (including Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, and Google Tasks) to execute user-instructed actions.
              </p>
              <p>
                We believe privacy is a fundamental human right. We only access the minimal data required to execute your direct natural language commands. We never sell, rent, monetize, or use your personal or workspace data for advertising or unauthorized machine learning model training.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-400" />
                2. Information We Collect and Access
              </h2>
              <p>When you interact with AskMyAgent, we collect and process only the following information:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li><strong>Telegram Account Information:</strong> Your Telegram User ID, username, and first/last name for identity verification and command routing.</li>
                <li><strong>Google Workspace OAuth Tokens:</strong> When you connect a Google service, we store OAuth access and refresh tokens. These tokens are <strong>encrypted using AES-256-GCM</strong> authenticated encryption with 32-byte cryptographic keys.</li>
                <li><strong>User-Initiated Command Context:</strong> Temporary message prompts and parameters required to execute your immediate tool requests (e.g. creating a calendar event, searching emails, or reading a document).</li>
                <li><strong>Activity and Audit Logs:</strong> Timestamped records of tool execution outcomes (success/error, provider, operation name) used for system reliability, quota management, and rate-limiting.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="h-5 w-5 text-purple-400" />
                3. Google API User Data & Limited Use Disclosure
              </h2>
              <p>
                AskMyAgent&apos;s use and transfer to any other app of information received from Google APIs adheres to the{' '}
                <a 
                  href="https://developers.google.com/terms/api-services-user-data-policy" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-indigo-400 hover:underline font-medium"
                >
                  Google API Services User Data Policy
                </a>, including the Limited Use requirements.
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>We only request OAuth scopes necessary to fulfill user-requested features.</li>
                <li>Data obtained from Google Workspace APIs is strictly used to provide user-facing AI assistant capabilities.</li>
                <li>We do not transfer or share your Google user data with third-party data brokers or advertising networks.</li>
                <li>Human workers do not read your private emails, calendar events, or documents unless required for security investigations or explicitly consented to for support.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                4. Data Security & Storage Practices
              </h2>
              <p>
                All data in transit is protected via TLS 1.3 encryption. All OAuth refresh tokens and sensitive access credentials stored in our database are encrypted at rest using AES-256-GCM. Decryption keys are managed via isolated server environment secrets and never stored in the database.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-amber-400" />
                5. Data Retention, Revocation & Deletion Rights
              </h2>
              <p>You maintain complete control over your data at all times:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li><strong>Revoking Access:</strong> You can disconnect any service at any time in Telegram using the <code>/connectors</code> command or by visiting your{' '}
                  <a 
                    href="https://myaccount.google.com/permissions" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-indigo-400 hover:underline"
                  >
                    Google Account Security Permissions
                  </a>.
                </li>
                <li><strong>Full Account Deletion:</strong> You can request complete deletion of your account and all associated tokens, credentials, and logs by contacting our administrator or submitting a delete request. Deletion completely cascades across all database tables.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <EyeOff className="h-5 w-5 text-rose-400" />
                6. Contact & Support
              </h2>
              <p>
                If you have any questions regarding this Privacy Policy, your user data, or wish to exercise your data deletion rights, please reach out directly:
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1 text-xs font-mono">
                <p><strong>Admin & Developer:</strong> Indrajit</p>
                <p><strong>Telegram:</strong> <a href="https://t.me/indrajit_edge" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">@indrajit_edge</a></p>
                <p><strong>Telegram Bot:</strong> <a href={telegramBotUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">@{telegramBotUsername}</a></p>
              </div>
            </section>
          </CardContent>
        </Card>

        {/* Bottom Navigation */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs text-slate-400">
          <Button variant="ghost" size="sm" onClick={onNavigateHome}>
            ← Return to Home
          </Button>
          {onNavigateTerms && (
            <Button variant="outline" size="sm" onClick={onNavigateTerms}>
              View Terms of Service →
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
