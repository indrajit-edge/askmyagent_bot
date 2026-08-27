import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ArrowLeft, ShieldCheck, CheckCircle2, AlertTriangle, Scale, Send } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';

interface TermsOfServiceProps {
  onNavigateHome: () => void;
  onNavigatePrivacy?: () => void;
}

export default function TermsOfService({ onNavigateHome, onNavigatePrivacy }: TermsOfServiceProps) {
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
            <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-400" />
            <span className="font-bold text-xs sm:text-sm tracking-tight text-white">AskMyAgent Legal</span>
          </div>
          <Button 
            variant="glow" 
            size="sm" 
            onClick={() => window.open(telegramBotUrl, '_blank')}
            className="gap-1.5 hidden sm:inline-flex text-xs px-3"
          >
            <Send className="h-3.5 w-3.5" />
            Open Bot
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
            <Scale className="h-3.5 w-3.5" />
            Terms of Service Agreement
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Terms of Service
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
                1. Acceptance of Terms
              </h2>
              <p>
                By connecting your Google Workspace account, messaging the AskMyAgent Telegram bot, or using any associated services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-indigo-400" />
                2. Description of the Service
              </h2>
              <p>
                <strong>AskMyAgent</strong> is an intelligent assistant platform that connects Telegram messaging with authorized third-party services, primarily Google Workspace (Gmail, Google Calendar, Google Drive, Google Docs, Google Sheets, Google Tasks). The service allows you to interact with your workspace tools using conversational natural language commands.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                3. User Responsibilities & Acceptable Use
              </h2>
              <p>When using AskMyAgent, you agree that you will not:</p>
              <ul className="list-disc pl-5 space-y-1 text-slate-300">
                <li>Use the service to transmit spam, unlawful, abusive, harassing, or fraudulent communications.</li>
                <li>Attempt to bypass rate limits, quotas, IP protections, or authentication mechanisms.</li>
                <li>Execute automated attacks, reverse-engineer proprietary backend algorithms, or disrupt service stability.</li>
                <li>Authorize accounts or access services on behalf of third parties without explicit authorization.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Scale className="h-5 w-5 text-purple-400" />
                4. Third-Party Services & API Limits
              </h2>
              <p>
                AskMyAgent integrates with Google APIs and Telegram APIs. Your use of these third-party platforms is subject to their respective terms and privacy policies. AskMyAgent is not responsible for interruptions, downtime, or rate-limiting caused by upstream third-party service providers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                5. Disclaimer of Warranties & Limitation of Liability
              </h2>
              <p>
                The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis without warranties of any kind, whether express or implied. To the maximum extent permitted by law, AskMyAgent and its developers shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <FileText className="h-5 w-5 text-rose-400" />
                6. Termination & Contact
              </h2>
              <p>
                We reserve the right to suspend or terminate access to the Service for any user who violates these Terms or engages in abusive behavior.
              </p>
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1 text-xs font-mono mt-3">
                <p><strong>Admin & Operator:</strong> Indrajit</p>
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
          {onNavigatePrivacy && (
            <Button variant="outline" size="sm" onClick={onNavigatePrivacy}>
              View Privacy Policy →
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
