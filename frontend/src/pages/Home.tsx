import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Bot, ShieldCheck, Zap, Sparkles, Mail, Calendar, HardDrive, 
  FileText, Table2, CheckSquare, KeyRound, ChevronRight, Lock, 
  ArrowRight, CheckCircle2, Shield, UserCheck, Check, Layers,
  MessageSquare, Cpu, RefreshCw, Send, ArrowDown, Database
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Marquee } from '../components/ui/Marquee';
import { apiFetch } from '../lib/api';

interface HomeProps {
  onNavigateLogin: () => void;
  onNavigateAdmin: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateTerms?: () => void;
  onSimulateOAuth: (provider: string) => void;
}

const AVAILABLE_CONNECTORS = [
  { name: 'Gmail', icon: Mail, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', desc: 'Read, search & thread emails' },
  { name: 'Google Calendar', icon: Calendar, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', desc: 'Schedules, meetings & agendas' },
  { name: 'Google Drive', icon: HardDrive, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', desc: 'Files, folders & cloud documents' },
  { name: 'Google Docs', icon: FileText, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20', desc: 'Document summaries & reading' },
  { name: 'Google Sheets', icon: Table2, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', desc: 'Tables, cell values & financial data' },
  { name: 'Google Tasks', icon: CheckSquare, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', desc: 'Task lists, to-dos & reminders' },
];

export default function Home({ onNavigateLogin, onNavigateAdmin, onNavigatePrivacy, onNavigateTerms, onSimulateOAuth }: HomeProps) {
  const telegramBotUsername = (import.meta.env.VITE_TELEGRAM_BOT_USERNAME || 'AskMyAgentBot').replace(/^@/, '');
  const telegramBotUrl = import.meta.env.VITE_TELEGRAM_BOT_URL || `https://t.me/${telegramBotUsername}`;
  const adminUsername = 'indrajit_edge';
  const adminProfileUrl = `https://t.me/${adminUsername}`;
  const [isAdminAllowed, setIsAdminAllowed] = useState(false);

  useEffect(() => {
    apiFetch('/api/admin/access-check')
      .then((res) => {
        if (res.ok) {
          setIsAdminAllowed(true);
        } else {
          setIsAdminAllowed(false);
        }
      })
      .catch(() => {
        setIsAdminAllowed(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 relative overflow-hidden font-sans selection:bg-indigo-500 selection:text-white">
      {/* Ambient background glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[700px] pointer-events-none -z-10">
        <div className="absolute top-[-120px] left-1/3 w-[600px] h-[600px] bg-indigo-600/12 rounded-full blur-[140px] animate-pulse-glow" />
        <div className="absolute top-[80px] right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[140px] animate-pulse-glow" style={{ animationDelay: '3s' }} />
        <div className="absolute inset-0 bg-grid-pattern opacity-30 [mask-image:radial-gradient(ellipse_at_center,transparent_20%,black)]" />
      </div>

      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="AskMyAgent Logo" className="h-9 w-9 rounded-xl object-cover border border-indigo-500/30 shadow-md shadow-indigo-500/20" />
            <div>
              <span className="font-bold text-lg text-white tracking-tight">AskMyAgent</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAdminAllowed ? (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={onNavigateAdmin} 
                className="hidden sm:inline-flex text-indigo-300 hover:text-white hover:bg-indigo-500/10 gap-1.5 border border-indigo-500/30"
              >
                <Lock className="h-3.5 w-3.5 text-indigo-400" />
                Admin Portal
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.open(adminProfileUrl, '_blank')} 
                className="hidden sm:inline-flex text-slate-300 hover:text-white gap-1.5"
              >
                <UserCheck className="h-3.5 w-3.5 text-indigo-400" />
                Connect with Admin
              </Button>
            )}
            <Button 
              variant="glow" 
              size="sm" 
              onClick={() => window.open(telegramBotUrl, '_blank')}
              className="gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              Open on Telegram
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs font-semibold mb-6 backdrop-blur-md"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>One AI Agent. Available Everywhere.</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-[1.1] mb-4"
        >
          Your AI Agent. <br />
          <span className="text-gradient">Wherever You Work.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mt-6"
        >
          AskMyAgent brings your everyday tools and services together with one intelligent AI agent, available directly through Telegram.
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto mt-2"
        >
          Connect the services you use, then simply tell your agent what you need.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Button 
            variant="glow" 
            size="lg" 
            onClick={() => window.open(telegramBotUrl, '_blank')}
            className="w-full sm:w-auto px-8 text-base shadow-indigo-500/25"
          >
            <Send className="h-4 w-4 mr-2" />
            Open AskMyAgent on Telegram
          </Button>
          {isAdminAllowed ? (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={onNavigateAdmin}
              className="w-full sm:w-auto text-base gap-2 border-indigo-500/40 hover:bg-indigo-500/10 text-white"
            >
              <Lock className="h-4 w-4 text-indigo-400" />
              Admin Control Center
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="lg" 
              onClick={() => window.open(adminProfileUrl, '_blank')}
              className="w-full sm:w-auto text-base gap-2"
            >
              <UserCheck className="h-4 w-4 text-indigo-400" />
              Connect with Admin (@{adminUsername})
            </Button>
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          className="mt-8 text-xs text-slate-500"
        >
          Your conversations happen in Telegram. This website is your secure home for AskMyAgent.
        </motion.p>
      </section>

      {/* Marquee Section */}
      <section className="py-6 border-y border-white/5 bg-slate-950/50 overflow-hidden">
        <Marquee pauseOnHover className="[--duration:28s]">
          {AVAILABLE_CONNECTORS.map((c) => {
            const Icon = c.icon;
            return (
              <div
                key={c.name}
                className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md mx-2 hover:border-indigo-500/40 transition-all shadow-md"
              >
                <div className={`p-1.5 rounded-lg ${c.bg} ${c.border} border`}>
                  <Icon className={`h-4 w-4 ${c.color}`} />
                </div>
                <span className="font-semibold text-sm text-white">{c.name}</span>
                <span className="text-xs text-slate-400">· {c.desc}</span>
              </div>
            );
          })}
        </Marquee>
      </section>

      {/* One Agent. Many Services. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="purple" className="mb-3">Unified Workspace</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            One Agent. Many Services.
          </h2>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            Your information is spread across different applications. Email in one place. Calendar somewhere else. Files, documents, tasks, and work tools somewhere else.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="border-white/10 bg-slate-900/50 p-6 flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-4">
                <Mail className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Email in one place</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Important messages, threads, and updates buried in your email client.
              </p>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-900/50 p-6 flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
                <Calendar className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Calendar somewhere else</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Daily agendas, upcoming meetings, and schedule checks in a separate app.
              </p>
            </div>
          </Card>

          <Card className="border-white/10 bg-slate-900/50 p-6 flex flex-col justify-between">
            <div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
                <Layers className="h-5 w-5" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Files & tasks elsewhere</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Spreadsheets, docs, cloud folders, and to-do lists scattered across tabs.
              </p>
            </div>
          </Card>
        </div>

        <div className="p-8 rounded-2xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/30 to-slate-900/60 backdrop-blur-xl text-center">
          <h3 className="text-xl font-bold text-white mb-2">
            AskMyAgent connects these services to a single AI agent
          </h3>
          <p className="text-sm text-slate-300 max-w-2xl mx-auto leading-relaxed">
            So you don't have to remember where everything lives. Connect your services once. Ask your agent whenever you need something.
          </p>
        </div>
      </section>

      {/* How AskMyAgent Works */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <Badge variant="emerald" className="mb-3">Simple 3-Step Flow</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How AskMyAgent Works
          </h2>
        </div>

        <div className="space-y-12">
          {/* Step 1 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-2 flex md:justify-center">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-xl font-extrabold text-indigo-400 shadow-lg shadow-indigo-500/10">
                1
              </div>
            </div>
            <div className="md:col-span-10">
              <h3 className="text-2xl font-bold text-white mb-2">Connect Your Services</h3>
              <p className="text-slate-400 leading-relaxed mb-3">
                Use the AskMyAgent website to securely connect the services you want your agent to work with. You decide which services to authorize.
              </p>
              <p className="text-xs text-indigo-300 font-medium">
                Google services are supported today, with more integrations being added over time.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-2 flex md:justify-center">
              <div className="h-14 w-14 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-xl font-extrabold text-purple-400 shadow-lg shadow-purple-500/10">
                2
              </div>
            </div>
            <div className="md:col-span-10">
              <h3 className="text-2xl font-bold text-white mb-2">Talk to Your Agent on Telegram</h3>
              <p className="text-slate-400 leading-relaxed mb-4">
                Once your services are connected, open your configured Telegram bot. You don't need to learn complicated commands. Just ask naturally:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {[
                  "What's on my calendar tomorrow?",
                  "Find the latest email about my project.",
                  "Find my project report.",
                  "Show me my tasks."
                ].map((q) => (
                  <div key={q} className="p-3 rounded-xl bg-slate-900 border border-white/10 text-xs font-mono text-slate-300 flex items-center gap-2">
                    <span className="text-indigo-400">💬</span>
                    <span>"{q}"</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-2 flex md:justify-center">
              <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-xl font-extrabold text-emerald-400 shadow-lg shadow-emerald-500/10">
                3
              </div>
            </div>
            <div className="md:col-span-10">
              <h3 className="text-2xl font-bold text-white mb-2">AskMyAgent Chooses the Right Connector</h3>
              <p className="text-slate-400 leading-relaxed mb-6">
                Your request is interpreted by the AI agent. The agent determines which connected service can provide the information you need. You don't have to manually switch between applications.
              </p>

              {/* Execution Pipeline Diagram */}
              <div className="p-6 rounded-2xl border border-white/10 bg-slate-950/80 font-mono text-xs text-slate-300 space-y-3 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">1</div>
                  <span>Your message</span>
                </div>
                <div className="pl-3 text-slate-600 font-bold">↓</div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">2</div>
                  <span className="text-purple-300 font-bold">AskMyAgent</span>
                </div>
                <div className="pl-3 text-slate-600 font-bold">↓</div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center font-bold">3</div>
                  <span>Understand the request</span>
                </div>
                <div className="pl-3 text-slate-600 font-bold">↓</div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">4</div>
                  <span>Choose the appropriate connector</span>
                </div>
                <div className="pl-3 text-slate-600 font-bold">↓</div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">5</div>
                  <span className="text-emerald-300 font-bold">Connected service</span>
                </div>
                <div className="pl-3 text-slate-600 font-bold">↓</div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-slate-800 text-slate-300 flex items-center justify-center font-bold">6</div>
                  <span>Process the result</span>
                </div>
                <div className="pl-3 text-slate-600 font-bold">↓</div>
                <div className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">7</div>
                  <span className="text-indigo-300 font-bold">Answer you in Telegram</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Built Around Connectors */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="default" className="mb-3">Connector Architecture</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Built Around Connectors
          </h2>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            AskMyAgent isn't tied to a single service or platform. Its connector architecture allows different services to be connected to the same AI agent.
          </p>
        </div>

        {/* Available Connectors (Google) */}
        <div className="mb-12">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <span>Available Connectors</span>
            <Badge variant="emerald" className="text-[10px]">Google</Badge>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {AVAILABLE_CONNECTORS.map((c) => {
              const Icon = c.icon;
              return (
                <div key={c.name} className="p-5 rounded-2xl border border-white/10 bg-slate-900/50 hover:border-indigo-500/30 transition-all flex items-start gap-4">
                  <div className={`p-2.5 rounded-xl ${c.bg} ${c.border} border shrink-0`}>
                    <Icon className={`h-5 w-5 ${c.color}`} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">{c.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{c.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* More Integrations & Future Expansion */}
        <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/60 backdrop-blur-xl">
          <h3 className="text-xl font-bold text-white mb-2">Designed to Grow Beyond Google</h3>
          <p className="text-sm text-slate-400 leading-relaxed mb-6">
            The platform is designed to expand. Future connectors can bring additional productivity tools, communication platforms, developer tools, project management systems, cloud services, and business APIs.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-center text-xs">
            {[
              'Productivity tools',
              'Communication',
              'Developer tools',
              'Project management',
              'Cloud services',
              'Business APIs'
            ].map((item) => (
              <div key={item} className="p-2.5 rounded-xl bg-slate-900 border border-white/5 text-slate-400">
                {item}
              </div>
            ))}
          </div>
          <p className="text-xs text-indigo-300 font-medium mt-6 text-center">
            One agent, growing with your workflow.
          </p>
        </div>
      </section>

      {/* Ask Naturally (Scenario Comparison) */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="purple" className="mb-3">Natural Interaction</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Ask Naturally
          </h2>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            You don't need to remember which application contains the information you're looking for. Just tell AskMyAgent what you want.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manual Way */}
          <Card className="border-white/10 bg-slate-900/40 p-6">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 block mb-3">Instead of searching manually:</span>
            <div className="p-4 rounded-xl bg-slate-950 border border-white/5 text-xs text-slate-400 space-y-2 font-mono">
              <div className="flex items-center gap-2">
                <span>1. Open Gmail</span>
                <span>→</span>
                <span>Search</span>
              </div>
              <div className="flex items-center gap-2">
                <span>2. Find conversation</span>
                <span>→</span>
                <span>Read notes</span>
              </div>
              <div className="flex items-center gap-2">
                <span>3. Open Calendar</span>
                <span>→</span>
                <span>Check free slots</span>
              </div>
            </div>
          </Card>

          {/* AskMyAgent Way */}
          <Card className="border-indigo-500/30 bg-indigo-950/20 p-6">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-3">Just ask your agent:</span>
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/20 text-xs text-indigo-300 space-y-2 font-mono">
              <div className="font-bold text-white">
                "When did Rahul ask me to schedule the project meeting?"
              </div>
              <div className="text-slate-400 font-sans text-xs pt-1">
                Your agent uses the connected services available to it and returns the relevant information directly in Telegram.
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Your Services. Your Choice. */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <Badge variant="emerald" className="mb-3">Granular Control</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight mb-4">
              Your Services. Your Choice.
            </h2>
            <p className="text-slate-400 text-base leading-relaxed mb-4">
              AskMyAgent doesn't need access to everything. You choose which services you connect.
            </p>
            <p className="text-slate-400 text-base leading-relaxed">
              You can connect a service when you need it and disconnect it at any time.
            </p>
          </div>

          <div className="md:col-span-5">
            <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/70 space-y-3 font-mono text-sm">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 font-sans">Connected Services</div>
              <div className="flex items-center gap-3 text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-white">Gmail</span>
                <Badge variant="emerald" className="ml-auto text-[10px]">Connected</Badge>
              </div>
              <div className="flex items-center gap-3 text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-white">Calendar</span>
                <Badge variant="emerald" className="ml-auto text-[10px]">Connected</Badge>
              </div>
              <div className="flex items-center gap-3 text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-white">Drive</span>
                <Badge variant="emerald" className="ml-auto text-[10px]">Connected</Badge>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <span className="h-4 w-4 flex items-center justify-center text-xs">○</span>
                <span>GitHub</span>
                <span className="ml-auto text-[11px] text-slate-600">Available soon</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <span className="h-4 w-4 flex items-center justify-center text-xs">○</span>
                <span>Slack</span>
                <span className="ml-auto text-[11px] text-slate-600">Available soon</span>
              </div>
              <div className="flex items-center gap-3 text-slate-500">
                <span className="h-4 w-4 flex items-center justify-center text-xs">○</span>
                <span>Notion</span>
                <span className="ml-auto text-[11px] text-slate-600">Available soon</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Security Comes First */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="default" className="mb-3">Enterprise Security</Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Security Comes First
          </h2>
          <p className="mt-4 text-base text-slate-400 leading-relaxed">
            AskMyAgent is designed so that connecting your services doesn't mean giving the AI unrestricted control over your accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-4">
              <Lock className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">🔐 Secure Authentication</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Services are connected through standard authentication systems, such as OAuth 2.0.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">🛡️ Protected Credentials</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Sensitive authentication credentials and tokens are encrypted with AES-256 before being stored.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <div className="h-10 w-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4">
              <UserCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">👤 User Isolation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Each user's connected services are strictly isolated from other users.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <div className="h-10 w-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-4">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">🎯 Controlled Permissions</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              AskMyAgent requests access strictly according to the capabilities required by each connector.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 md:col-span-2">
            <div className="h-10 w-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 mb-4">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">✅ Confirmation for Sensitive Actions</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Actions that can change data or perform important operations can require confirmation before execution.
            </p>
          </div>
        </div>

        {/* Data stays with services note */}
        <div className="p-8 rounded-2xl border border-white/10 bg-slate-950/80 text-center">
          <h3 className="text-lg font-bold text-white mb-2">Your Data Stays With Your Services</h3>
          <p className="text-sm text-slate-400 max-w-2xl mx-auto leading-relaxed">
            AskMyAgent is an interface between you and the services you choose to connect. Your Gmail remains Gmail. Your Calendar remains Calendar. Your Drive files remain in Drive. AskMyAgent retrieves the information necessary to fulfil your request and gives you the result through Telegram.
          </p>
        </div>
      </section>

      {/* Why AskMyAgent? Summary Grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-white/5">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Why AskMyAgent?
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <h3 className="text-lg font-bold text-white mb-2">One conversation</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Talk to your agent naturally through Telegram.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <h3 className="text-lg font-bold text-white mb-2">Multiple services</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Connect the tools you already use every day.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <h3 className="text-lg font-bold text-white mb-2">Less app switching</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              Let the agent find information across your connected services.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40">
            <h3 className="text-lg font-bold text-white mb-2">Expandable</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              New connectors can be added as the platform grows.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-white/10 bg-slate-900/40 sm:col-span-2 md:col-span-2">
            <h3 className="text-lg font-bold text-white mb-2">User controlled</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              You decide which services your agent can access.
            </p>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto text-center border-t border-white/5">
        <div className="p-10 sm:p-16 rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950/40 to-slate-900/80 backdrop-blur-2xl shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
            Your AI Agent Lives on Telegram
          </h2>
          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed mb-8">
            No new chat application to learn. No complicated command language. Open Telegram. Find @askmyagent_bot. Ask. AskMyAgent handles the rest.
          </p>

          <Button 
            variant="glow" 
            size="lg" 
            onClick={() => window.open(telegramBotUrl, '_blank')}
            className="px-8 text-base shadow-indigo-500/30"
          >
            <Send className="h-4 w-4 mr-2" />
            Open AskMyAgent on Telegram
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/10 bg-slate-950/90 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 text-slate-300 font-bold text-sm mb-1">
              <Bot className="h-4 w-4 text-indigo-400" />
              <span>AskMyAgent</span>
            </div>
            <p className="text-slate-500 text-xs">One agent. Many services.</p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-slate-400">
            <button onClick={() => window.open(telegramBotUrl, '_blank')} className="hover:text-white transition-colors">Telegram Bot</button>
            {isAdminAllowed && (
              <button onClick={onNavigateAdmin} className="text-indigo-300 hover:text-white transition-colors">Admin Portal</button>
            )}
            <button onClick={() => window.open(adminProfileUrl, '_blank')} className="hover:text-white transition-colors">Connect with Admin (@{adminUsername})</button>
            <span className="text-slate-600">·</span>
            {onNavigatePrivacy ? (
              <button onClick={onNavigatePrivacy} className="hover:text-white transition-colors">Privacy Policy</button>
            ) : (
              <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            )}
            {onNavigateTerms ? (
              <button onClick={onNavigateTerms} className="hover:text-white transition-colors">Terms of Service</button>
            ) : (
              <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
            )}
            <button onClick={() => window.open(adminProfileUrl, '_blank')} className="hover:text-white transition-colors">Support</button>
          </div>

          <p className="text-slate-500 text-xs">© 2026 AskMyAgent. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
