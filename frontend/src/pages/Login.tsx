import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, User, Key, ArrowLeft, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';

interface LoginProps {
  onLoginSuccess: () => void;
  onNavigateHome: () => void;
}

export default function Login({ onLoginSuccess, onNavigateHome }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onLoginSuccess();
      } else {
        setError(data.error || 'Invalid credentials. Please verify your credentials.');
      }
    } catch {
      setError('Network connection error: Failed to contact backend server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
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
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <Card className="border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center mb-3 shadow-lg shadow-indigo-500/20">
              <Lock className="h-6 w-6 text-indigo-400" />
            </div>
            <CardTitle className="text-2xl">Admin Control Center</CardTitle>
            <CardDescription>
              Sign in to manage synchronized Telegram users, audit logs, and system metrics.
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium"
                >
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{error}</span>
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Admin Username</label>
                <Input
                  type="text"
                  placeholder="Configured admin username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  icon={<User className="h-4 w-4" />}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  icon={<Key className="h-4 w-4" />}
                  required
                />
              </div>

              <Button
                type="submit"
                variant="glow"
                isLoading={loading}
                className="w-full mt-2"
                size="lg"
              >
                Authenticate Session
              </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pt-0 text-center border-t border-white/5 mt-4">
            <p className="text-[11px] text-slate-500">
              Authentication issues a secure HttpOnly signed JWT session token.
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
}
