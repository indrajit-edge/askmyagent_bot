import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Key, Activity, Database, Search, Eye, Edit2, 
  Trash2, LogOut, RefreshCw, Bot, ShieldCheck, ArrowLeft,
  CheckCircle2, XCircle, AlertCircle, Sparkles, Filter, ChevronRight,
  Shield, AlertTriangle, Clock, HardDrive, Lock, ShieldAlert,
  Power, Check, Info, Server, Flame, Sliders, Loader2,
  LayoutDashboard, Layers, FileText, Home
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { apiFetch } from '../lib/api';
import { cn } from '../lib/utils';

interface Stats {
  totalUsers: number;
  totalConnections: number;
  totalApiCalls: number;
  connectionsByProvider: { provider: string; count: number }[];
  logsByStatus: { status: string; count: number }[];
}

export interface UserItem {
  id: number | null; // null for read-only VM-bot rows
  name: string;
  email: string | null;
  role: 'user' | 'admin';
  status: 'active' | 'disabled' | 'pending';
  createdAt: string;
  updatedAt: string;
  telegram: {
    telegramId: number;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    lastSeenAt: string;
  } | null;
  // Which system created the row: 'backend' = users/telegram_users,
  // 'vm-bot' = read-only mirror of the VM Python bot's bot_users table.
  source?: 'backend' | 'vm-bot';
  preferredModel?: string | null;
  hasGeminiKey?: boolean;
  hasCalendarConfig?: boolean;
}

export interface UserProfileDetails extends UserItem {
  geminiKeyStatus: {
    configured: boolean;
    status: 'Configured' | 'Not configured';
    lastUsed: string | null;
  };
  connectors: {
    name: string;
    title: string;
    icon: string;
    connected: boolean;
    email: string | null;
    scopes: string[];
    connectionDate: string | null;
    lastActivity: string | null;
    lastError: string | null;
    tokenStatus: 'CONNECTED' | 'DISCONNECTED' | 'EXPIRED' | 'REVOKED' | 'ERROR';
  }[];
}

interface ConnectorMetric {
  name: string;
  title: string;
  icon: string;
  provider: string;
  enabled: boolean;
  apiHealth: string;
  oauthHealth: string;
  connectedUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  quotaEvents: number;
  lastSuccessfulRequest: string | null;
  lastFailure: string | null;
}

interface SecurityEvent {
  id: number;
  timestamp: string;
  chatId: number | null;
  connector: string;
  operation: string;
  status: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  details: string;
}

interface SystemHealth {
  backend: string;
  database: string;
  dbEngine?: string;
  internalApi: string;
  googleOAuth: string;
  gemini: string;
  uptimeSeconds: number;
  memoryUsageMb: number;
  dbSizeKb: number;
  emergencyMode: boolean;
}

interface BackupStatus {
  lastBackup: string;
  backupSchedule: string;
  retentionPolicy: string;
  databaseEngine?: string;
  databaseSizeKb: number;
  status: string;
  note: string;
}

interface ApiLog {
  id: number;
  chat_id: number | null;
  connector: string;
  operation: string;
  status: string;
  error_message: string | null;
  timestamp: string;
}

interface DashboardProps {
  onLogout: () => void;
  onNavigateHome: () => void;
}

export default function Dashboard({ onLogout, onNavigateHome }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [connectors, setConnectors] = useState<ConnectorMetric[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [backupStatus, setBackupStatus] = useState<BackupStatus | null>(null);
  const [logs, setLogs] = useState<ApiLog[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'connectors' | 'security' | 'audit' | 'health' | 'backups' | 'emergency'
  >('overview');

  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [securitySeverityFilter, setSecuritySeverityFilter] = useState('all');
  const [auditSearchTerm, setAuditSearchTerm] = useState('');
  const [auditStatusFilter, setAuditStatusFilter] = useState('all');

  // Modals & Interactive states
  const [viewingProfile, setViewingProfile] = useState<UserProfileDetails | null>(null);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [editFormData, setEditFormData] = useState({ name: '', role: 'user', status: 'active' });
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Emergency Controls State
  const [emergencyState, setEmergencyState] = useState({
    pauseNewOAuth: false,
    maintenanceMode: false
  });

  const fetchData = async (isInitial = false) => {
    try {
      if (isInitial) {
        setInitialLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (roleFilter !== 'all') params.append('role', roleFilter);

      const [usersRes, statsRes, connRes, secRes, healthRes, backupRes, logsRes, emergRes] = await Promise.all([
        apiFetch(`/api/users?${params.toString()}`),
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/connectors'),
        apiFetch('/api/admin/security/events'),
        apiFetch('/api/admin/system/health'),
        apiFetch('/api/admin/system/backup-status'),
        apiFetch('/api/admin/audit-logs'),
        apiFetch('/api/admin/emergency')
      ]);

      const responses = [usersRes, statsRes, connRes, secRes, healthRes, backupRes, logsRes, emergRes];

      if (responses.some(r => r.status === 401)) {
        onLogout();
        return;
      }

      if (responses.some(r => r.status === 403)) {
        setError('Admin access is restricted to the authorized network.');
        setInitialLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!usersRes.ok || !statsRes.ok) {
        throw new Error(`Failed to load control center data (Status ${usersRes.status})`);
      }

      const usersData = await usersRes.json();
      const statsData = await statsRes.json();
      const connData = await connRes.json();
      const secData = await secRes.json();
      const healthData = await healthRes.json();
      const backupData = await backupRes.json();
      const logsData = await logsRes.json();
      const emergData = await emergRes.json();

      setUsers(Array.isArray(usersData) ? usersData : []);
      if (statsData.success) setStats(statsData.stats);
      if (connData.success) setConnectors(connData.connectors);
      if (secData.success) setSecurityEvents(secData.events);
      if (healthData.success) setSystemHealth(healthData.health);
      if (backupData.success) setBackupStatus(backupData.backupStatus);
      if (logsData.success) setLogs(logsData.logs);
      if (emergData.success) setEmergencyState(emergData.emergencyState);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setInitialLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [statusFilter, roleFilter]);

  // Auto-dismiss action notice banner after 4.5 seconds
  useEffect(() => {
    if (actionNotice) {
      const timer = setTimeout(() => {
        setActionNotice(null);
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [actionNotice]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData(false);
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/admin/logout', { method: 'POST' });
    } finally {
      onLogout();
    }
  };

  // Open Full User Profile
  const handleOpenProfile = async (user: UserItem) => {
    try {
      const identifier = user.id ?? user.telegram?.telegramId;
      if (!identifier) {
        setActionNotice({ type: 'error', text: 'No identifier available for user.' });
        return;
      }
      const res = await apiFetch(`/api/admin/users/${identifier}/profile`);
      if (res.ok) {
        const data = await res.json();
        setViewingProfile(data.profile);
      } else {
        setActionNotice({ type: 'error', text: 'Failed to load user profile details' });
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Network error loading profile' });
    }
  };

  // Revoke User Connector
  const handleRevokeConnector = async (userId: number | string, provider: string) => {
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/connectors/${provider}/revoke`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice({ type: 'success', text: `Revoked ${provider} connection for user.` });
        if (viewingProfile) {
          const identifier = viewingProfile.id ?? viewingProfile.telegram?.telegramId;
          if (identifier) {
            const refRes = await apiFetch(`/api/admin/users/${identifier}/profile`);
            if (refRes.ok) {
              const refData = await refRes.json();
              setViewingProfile(refData.profile);
            }
          }
        }
        fetchData();
      } else {
        setActionNotice({ type: 'error', text: data.error || 'Failed to revoke connector' });
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Network error revoking connector.' });
    }
  };

  // Save Edit User (Name, Role: user|admin, Status)
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setActionNotice(null);

    const identifier = editingUser.id ?? editingUser.telegram?.telegramId;
    if (!identifier) {
      setActionNotice({ type: 'error', text: 'User identifier not found.' });
      return;
    }

    try {
      const res = await apiFetch(`/api/users/${identifier}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editFormData)
      });
      const data = await res.json();

      if (res.ok) {
        setActionNotice({ type: 'success', text: `User "${editingUser.name}" updated successfully.` });
        setEditingUser(null);
        fetchData();
      } else {
        setActionNotice({ type: 'error', text: data.error || 'Failed to update user' });
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Network error updating user.' });
    }
  };

  // Quick Role Toggle (USER <-> ADMIN)
  const handleToggleRole = async (user: UserItem) => {
    const identifier = user.id ?? user.telegram?.telegramId;
    if (!identifier) return;

    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    // Optimistic UI update
    setUsers(prev => prev.map(u => {
      if ((user.id && u.id === user.id) || (user.telegram?.telegramId && u.telegram?.telegramId === user.telegram?.telegramId)) {
        return { ...u, role: nextRole };
      }
      return u;
    }));

    try {
      const res = await apiFetch(`/api/users/${identifier}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: nextRole })
      });
      const data = await res.json();
      if (res.ok) {
        setActionNotice({ type: 'success', text: `User "${user.name}" role updated to ${nextRole.toUpperCase()}.` });
        fetchData(false);
      } else {
        setActionNotice({ type: 'error', text: data.error || 'Failed to update role' });
        fetchData(false);
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Network error updating role.' });
      fetchData(false);
    }
  };

  // Toggle user status action
  const handleToggleStatus = async (user: UserItem) => {
    const identifier = user.id ?? user.telegram?.telegramId;
    if (!identifier) return;

    const nextStatus = user.status === 'active' ? 'disabled' : 'active';
    // Optimistic UI update
    setUsers(prev => prev.map(u => {
      if ((user.id && u.id === user.id) || (user.telegram?.telegramId && u.telegram?.telegramId === user.telegram?.telegramId)) {
        return { ...u, status: nextStatus };
      }
      return u;
    }));

    try {
      const res = await apiFetch(`/api/users/${identifier}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        setActionNotice({ type: 'success', text: `User "${user.name}" is now ${nextStatus}.` });
        fetchData(false);
      } else {
        const data = await res.json();
        setActionNotice({ type: 'error', text: data.error || 'Failed to update status' });
        fetchData(false);
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Network error toggling status.' });
      fetchData(false);
    }
  };

  // Execute Delete
  const handleExecuteDelete = async () => {
    if (!userToDelete) return;
    const identifier = userToDelete.id ?? userToDelete.telegram?.telegramId;
    if (!identifier) return;

    // Optimistic UI update: Remove user immediately from local list
    const targetId = userToDelete.id;
    const targetChatId = userToDelete.telegram?.telegramId;
    setUsers(prev => prev.filter(u => {
      if (targetId && u.id === targetId) return false;
      if (targetChatId && u.telegram?.telegramId === targetChatId) return false;
      return true;
    }));

    try {
      const res = await apiFetch(`/api/users/${identifier}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setActionNotice({ type: 'success', text: `User "${userToDelete.name}" was deleted from all database tables.` });
        setUserToDelete(null);
        fetchData(false);
      } else {
        const data = await res.json();
        setActionNotice({ type: 'error', text: data.error || 'Failed to delete user' });
        fetchData(false);
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Network error deleting user.' });
      fetchData(false);
    }
  };

  // Toggle Emergency Controls
  const handleUpdateEmergency = async (key: 'pauseNewOAuth' | 'maintenanceMode', val: boolean) => {
    try {
      const payload = { ...emergencyState, [key]: val };
      const res = await apiFetch('/api/admin/emergency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setEmergencyState(data.emergencyState);
        setActionNotice({ type: 'success', text: `Emergency control updated: ${key} = ${val}` });
      }
    } catch {
      setActionNotice({ type: 'error', text: 'Failed to update emergency settings.' });
    }
  };

  const formatUptime = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${sec % 60}s`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
        <div className="w-full max-w-md">
          <Card className="border-rose-500/20 bg-slate-900/80 shadow-2xl backdrop-blur-2xl text-center p-6">
            <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
            <p className="text-sm text-slate-400 mb-6">{error}</p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" size="sm" onClick={onNavigateHome}>
                Return to Home
              </Button>
              <Button variant="secondary" size="sm" onClick={() => fetchData(true)}>
                Retry
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (initialLoading && !stats) {
    return (
      <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/15 rounded-full blur-[140px] pointer-events-none -z-10 animate-pulse-glow" />
        <div className="absolute inset-0 bg-grid-pattern opacity-30 -z-10" />
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Loader2 className="h-7 w-7 text-indigo-400 animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Loading Admin Control Center</h3>
            <p className="text-xs text-slate-400 mt-1">Verifying session and loading telemetry...</p>
          </div>
        </div>
      </div>
    );
  }

  const filteredSecurityEvents = securityEvents.filter((ev) => {
    if (securitySeverityFilter === 'all') return true;
    return ev.severity.toUpperCase() === securitySeverityFilter.toUpperCase();
  });

  const filteredLogs = logs.filter((l) => {
    if (auditStatusFilter === 'success' && l.status !== 'success') return false;
    if (auditStatusFilter === 'failed' && l.status === 'success') return false;
    if (!auditSearchTerm.trim()) return true;
    const term = auditSearchTerm.toLowerCase();
    const haystack = [
      String(l.id),
      String(l.chat_id || ''),
      l.connector,
      l.operation,
      l.status,
      l.error_message || ''
    ].join(' ').toLowerCase();
    return haystack.includes(term);
  });

  return (
    <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col relative overflow-hidden font-sans">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute inset-0 bg-grid-pattern opacity-20 -z-10" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-white/5 bg-slate-950/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onNavigateHome}>
            <img src="/logo.jpg" alt="AskMyAgent Logo" className="h-9 w-9 rounded-xl object-cover border border-indigo-500/30 shadow-md shadow-indigo-500/20" />
            <div className="flex items-center gap-2.5">
              <span className="font-bold text-base sm:text-lg text-white tracking-tight">AskMyAgent</span>
              <Badge variant="purple" className="hidden sm:inline-flex text-[10px] uppercase font-mono tracking-wider font-semibold border-indigo-500/40 bg-indigo-500/10 text-indigo-300">
                Admin Control Center
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Authorized Admin Network</span>
            </div>

            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onNavigateHome}
              className="hidden md:inline-flex text-slate-300 hover:text-white gap-1.5 text-xs px-3"
            >
              <Home className="h-3.5 w-3.5 text-indigo-400" />
              <span>Public Portal</span>
            </Button>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => fetchData(false)} 
              disabled={isRefreshing} 
              className="gap-1.5 text-xs border-white/10 hover:border-indigo-500/30 px-3"
            >
              <RefreshCw className={cn("h-3.5 w-3.5 text-indigo-400", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">{isRefreshing ? 'Syncing...' : 'Sync Telemetry'}</span>
            </Button>

            <Button 
              variant="secondary" 
              size="sm" 
              onClick={handleLogout} 
              className="gap-1.5 text-xs hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-300 transition-colors px-3"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-400" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        {/* Banner Action Notice */}
        <AnimatePresence>
          {actionNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className={`flex items-center justify-between p-3.5 sm:p-4 mb-6 rounded-xl border ${
                actionNotice.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
                {actionNotice.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                )}
                <span>{actionNotice.text}</span>
              </div>
              <button
                onClick={() => setActionNotice(null)}
                className="text-slate-400 hover:text-white text-xs font-bold px-2 py-1"
              >
                ✕
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Top Header Section */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Application Administration</h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Central control center for user management, connector health, audit logs, and security oversight.
          </p>
        </div>

        {/* Navigation Tabs (Full-width modern segmented control bar with icons) */}
        <div className="overflow-x-auto -mx-3 sm:mx-0 px-3 sm:px-0 scrollbar-none mb-8">
          <div className="inline-flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-900/80 border border-white/10 text-xs font-medium backdrop-blur-xl min-w-max shadow-lg shadow-black/20">
            {[
              { id: 'overview', label: 'Overview', icon: LayoutDashboard },
              { id: 'users', label: `Users (${users.length})`, icon: Users },
              { id: 'connectors', label: 'Connectors', icon: Layers },
              { id: 'security', label: `Security (${securityEvents.length})`, icon: ShieldCheck },
              { id: 'audit', label: 'Audit Logs', icon: FileText },
              { id: 'health', label: 'System Health', icon: Activity },
              { id: 'backups', label: 'Backups', icon: HardDrive },
              { id: 'emergency', label: 'Emergency', icon: Flame },
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all duration-200 whitespace-nowrap cursor-pointer",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/25 font-semibold"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Icon className={cn("h-3.5 w-3.5", isActive ? "text-white" : "text-slate-400")} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Quick KPI Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card 
            onClick={() => setActiveTab('users')}
            className="border-white/10 bg-slate-900/60 cursor-pointer hover:border-indigo-500/40 hover:bg-slate-900/90 transition-all duration-200 group"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider group-hover:text-slate-300">
                <span>Synchronized Users</span>
                <Users className="h-4 w-4 text-indigo-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {stats?.totalUsers ?? users.length}
              </div>
              <p className="text-xs text-indigo-300 mt-1 flex items-center justify-between">
                <span>Single source: Telegram Bot</span>
                <span className="text-[10px] text-slate-500 group-hover:text-indigo-400 font-medium">View Users →</span>
              </p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => setActiveTab('connectors')}
            className="border-white/10 bg-slate-900/60 cursor-pointer hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all duration-200 group"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider group-hover:text-slate-300">
                <span>Encrypted Connections</span>
                <Key className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {stats?.totalConnections ?? 0}
              </div>
              <p className="text-xs text-emerald-300 mt-1 flex items-center justify-between">
                <span>AES-256-GCM tokens at rest</span>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 font-medium">View Connectors →</span>
              </p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => setActiveTab('audit')}
            className="border-white/10 bg-slate-900/60 cursor-pointer hover:border-cyan-500/40 hover:bg-slate-900/90 transition-all duration-200 group"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider group-hover:text-slate-300">
                <span>API Calls Executed</span>
                <Activity className="h-4 w-4 text-cyan-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {stats?.totalApiCalls ?? 0}
              </div>
              <p className="text-xs text-cyan-300 mt-1 flex items-center justify-between">
                <span>Tracked in relational api_logs</span>
                <span className="text-[10px] text-slate-500 group-hover:text-cyan-400 font-medium">View Logs →</span>
              </p>
            </CardContent>
          </Card>

          <Card 
            onClick={() => setActiveTab('health')}
            className="border-white/10 bg-slate-900/60 cursor-pointer hover:border-emerald-500/40 hover:bg-slate-900/90 transition-all duration-200 group"
          >
            <CardContent className="p-5">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider group-hover:text-slate-300">
                <span>System Status</span>
                <ShieldCheck className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
                HEALTHY
              </div>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-between">
                <span>Uptime: {systemHealth ? formatUptime(systemHealth.uptimeSeconds) : 'Live'}</span>
                <span className="text-[10px] text-slate-500 group-hover:text-emerald-400 font-medium">View Health →</span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Platform Summary Card */}
              <Card className="border-white/10 bg-slate-900/40">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="h-5 w-5 text-indigo-400" />
                    Platform Infrastructure Summary
                  </CardTitle>
                  <CardDescription>
                    Application-level overview of services and relational storage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Application Roles</span>
                    <Badge variant="outline">USER & ADMIN Only</Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Database Engine</span>
                    <span className="font-semibold text-white">{systemHealth?.dbEngine || 'PostgreSQL'} + Knex Relational</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Google OAuth 2.0 Health</span>
                    <Badge variant="emerald">Healthy</Badge>
                  </div>
                  <div className="flex justify-between py-2 border-b border-white/5">
                    <span className="text-slate-400">Telegram Bot Gateway</span>
                    <Badge variant="emerald">Active (Long-Polling / Webhook)</Badge>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-slate-400">Security Architecture</span>
                    <span className="text-emerald-300 font-mono text-xs">AES-256-GCM + Single-Use HMAC State</span>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Security Highlights */}
              <Card className="border-white/10 bg-slate-900/40">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-amber-400" />
                    Recent Security Events
                  </CardTitle>
                  <CardDescription>
                    Latest authentication, quota, and security tracking events.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {securityEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">No security anomalies detected.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {securityEvents.slice(0, 4).map((ev) => (
                        <div key={ev.id} className="p-2.5 rounded-xl bg-slate-950 border border-white/5 flex items-start justify-between gap-3 text-xs">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">{ev.operation}</span>
                              <Badge variant={ev.severity === 'WARNING' ? 'amber' : ev.severity === 'ERROR' ? 'rose' : 'outline'} className="text-[10px] py-0">
                                {ev.severity}
                              </Badge>
                            </div>
                            <p className="text-slate-400 mt-0.5 max-w-sm truncate">{ev.details}</p>
                          </div>
                          <span className="text-slate-500 text-[10px] whitespace-nowrap">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* TAB 2: USERS MANAGEMENT */}
        {activeTab === 'users' && (
          <Card className="border-white/10 bg-slate-900/40">
            <CardContent className="p-6">
              {/* Search and Filters Toolbar */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
                <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full md:max-w-md">
                  <Input
                    placeholder="Search name, username, or Telegram ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    icon={<Search className="h-4 w-4" />}
                  />
                  <Button type="submit" variant="secondary" size="md">
                    Search
                  </Button>
                </form>

                <div className="flex items-center gap-2 w-full md:w-auto">
                  <select
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">Status: All</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    <option value="pending">Pending</option>
                  </select>

                  <select
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                  >
                    <option value="all">Role: All</option>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>

                  {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setRoleFilter('all');
                      }}
                      className="text-xs text-slate-400 hover:text-white px-2.5"
                    >
                      Reset
                    </Button>
                  )}
                </div>
              </div>

              {/* Users Table */}
              {initialLoading && users.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-400 mb-3" />
                  <p className="text-sm">Loading users...</p>
                </div>
              ) : users.length === 0 ? (
                <div className="py-20 text-center">
                  <Bot className="h-12 w-12 mx-auto text-slate-600 mb-3" />
                  <h3 className="text-base font-semibold text-white">No Users Found</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    {searchTerm || statusFilter !== 'all' || roleFilter !== 'all'
                      ? 'No users match the active filter criteria.'
                      : 'Users are created automatically upon sending commands in Telegram.'}
                  </p>
                  {(searchTerm || statusFilter !== 'all' || roleFilter !== 'all') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setStatusFilter('all');
                        setRoleFilter('all');
                      }}
                      className="mt-4 text-xs border-white/10 hover:border-indigo-500/30"
                    >
                      Clear All Filters
                    </Button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold uppercase text-slate-400">
                        <th className="pb-3 px-3">User ID</th>
                        <th className="pb-3 px-3">Telegram ID</th>
                        <th className="pb-3 px-3">Username</th>
                        <th className="pb-3 px-3">Name</th>
                        <th className="pb-3 px-3">Source</th>
                        <th className="pb-3 px-3">Role</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3">Last Seen</th>
                        <th className="pb-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {users.map((u) => (
                        <tr key={u.id ?? `vm-${u.telegram?.telegramId}`} className="hover:bg-white/[0.02] transition-colors">
                          <td className="py-3 px-3 font-mono text-xs text-indigo-300">{u.id ? `#${u.id}` : '—'}</td>
                          <td className="py-3 px-3 font-mono text-xs text-slate-300">
                            {u.telegram ? u.telegram.telegramId : '—'}
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-300">
                            {u.telegram?.username ? (
                              <span className="text-cyan-400 font-medium">@{u.telegram.username}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-3 font-medium text-white">{u.name}</td>
                          <td className="py-3 px-3">
                            {u.source === 'vm-bot' ? (
                              <Badge variant="outline" className="text-[11px] uppercase font-mono border-cyan-500/40 text-cyan-300">
                                VM Bot
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-[11px] uppercase font-mono">
                                Backend
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={u.role === 'admin' ? 'purple' : 'outline'} className="text-[11px] uppercase font-mono">
                              {u.role}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant={u.status === 'active' ? 'emerald' : 'rose'} className="text-[11px] capitalize">
                              {u.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-xs text-slate-400">
                            {u.telegram?.lastSeenAt ? new Date(u.telegram.lastSeenAt).toLocaleString() : '—'}
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenProfile(u)}
                                className="h-8 px-2 text-xs"
                                title="View Detailed Profile"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1 text-indigo-400" />
                                Profile
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => handleToggleRole(u)}
                                className="h-8 px-2 text-xs"
                                title={u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                              >
                                {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleToggleStatus(u)}
                                className="h-8 px-2 text-xs"
                              >
                                {u.status === 'active' ? 'Disable' : 'Enable'}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setUserToDelete(u)}
                                className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                title="Delete User from Database"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 3: CONNECTOR CENTER */}
        {activeTab === 'connectors' && (
          <div className="space-y-6">
            <Card className="border-white/10 bg-slate-900/40">
              <CardHeader>
                <CardTitle className="text-lg">Connector Center (Provider-Agnostic)</CardTitle>
                <CardDescription>
                  Centralized registry of all active connectors with request volume, health ratings, and quota metrics.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {connectors.map((c) => (
                    <div key={c.name} className="p-5 rounded-2xl border border-white/10 bg-slate-950/70 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2.5">
                            <span className="text-2xl">{c.icon}</span>
                            <div>
                              <h4 className="font-bold text-white text-base">{c.title}</h4>
                              <span className="text-[11px] text-slate-500 font-mono">Provider: {c.provider}</span>
                            </div>
                          </div>
                          <Badge variant={c.apiHealth === 'HEALTHY' ? 'emerald' : 'rose'} className="text-[10px]">
                            {c.apiHealth}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-xs py-2 border-t border-white/5">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Connected Users:</span>
                            <span className="font-bold text-white">{c.connectedUsers}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Total Tool Requests:</span>
                            <span className="font-mono text-cyan-300">{c.totalRequests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Successful:</span>
                            <span className="text-emerald-400 font-mono">{c.successfulRequests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Failed / Errors:</span>
                            <span className="text-rose-400 font-mono">{c.failedRequests}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Quota Limit Events:</span>
                            <span className="text-amber-400 font-mono">{c.quotaEvents}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-white/5 text-[11px] text-slate-500">
                        Last Active: {c.lastSuccessfulRequest ? new Date(c.lastSuccessfulRequest).toLocaleTimeString() : 'No recent activity'}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4: SECURITY CENTER */}
        {activeTab === 'security' && (
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-400" />
                  Security Center & Anomaly Log
                </CardTitle>
                <CardDescription>
                  Audited security events including admin logins, OAuth validations, and rate-limit violations. Zero secrets logged.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  value={securitySeverityFilter}
                  onChange={(e) => setSecuritySeverityFilter(e.target.value)}
                >
                  <option value="all">Severity: All</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="ERROR">Error</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
                {securitySeverityFilter !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSecuritySeverityFilter('all')}
                    className="text-xs text-slate-400 hover:text-white px-2.5"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredSecurityEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <ShieldCheck className="h-8 w-8 mx-auto text-emerald-400/60 mb-2" />
                  <p>No security events matching the selected filter.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold uppercase text-slate-400">
                        <th className="pb-3 px-3">Severity</th>
                        <th className="pb-3 px-3">Timestamp</th>
                        <th className="pb-3 px-3">Operation</th>
                        <th className="pb-3 px-3">Connector</th>
                        <th className="pb-3 px-3">Chat ID</th>
                        <th className="pb-3 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-xs">
                      {filteredSecurityEvents.map((ev) => (
                        <tr key={ev.id} className="hover:bg-white/[0.02]">
                          <td className="py-3 px-3">
                            <Badge variant={ev.severity === 'CRITICAL' || ev.severity === 'ERROR' ? 'rose' : ev.severity === 'WARNING' ? 'amber' : 'outline'} className="text-[10px]">
                              {ev.severity}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-slate-400 font-sans">{new Date(ev.timestamp).toLocaleString()}</td>
                          <td className="py-3 px-3 text-white font-bold">{ev.operation}</td>
                          <td className="py-3 px-3 text-slate-300 font-sans">{ev.connector}</td>
                          <td className="py-3 px-3 text-indigo-300">{ev.chatId || 'System'}</td>
                          <td className="py-3 px-3 text-slate-400 font-sans max-w-sm truncate">{ev.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 5: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg">Immutable Mutation & Audit Log Stream</CardTitle>
                <CardDescription>
                  Read-only record of all administrative actions and transactional system modifications.
                </CardDescription>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 shrink-0 w-full lg:w-auto">
                <Input
                  placeholder="Search logs by actor, operation..."
                  value={auditSearchTerm}
                  onChange={(e) => setAuditSearchTerm(e.target.value)}
                  className="text-xs h-9 w-full sm:w-60"
                  icon={<Search className="h-3.5 w-3.5" />}
                />
                <select
                  className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 w-full sm:w-auto"
                  value={auditStatusFilter}
                  onChange={(e) => setAuditStatusFilter(e.target.value)}
                >
                  <option value="all">Status: All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed / Error</option>
                </select>
                {(auditSearchTerm || auditStatusFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuditSearchTerm('');
                      setAuditStatusFilter('all');
                    }}
                    className="text-xs text-slate-400 hover:text-white px-2.5"
                  >
                    Reset
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {filteredLogs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  <FileText className="h-8 w-8 mx-auto text-slate-600 mb-2" />
                  <p>No audit logs matching current criteria.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs font-semibold uppercase text-slate-400">
                        <th className="pb-3 px-3">ID</th>
                        <th className="pb-3 px-3">Timestamp</th>
                        <th className="pb-3 px-3">Actor / Target</th>
                        <th className="pb-3 px-3">Category</th>
                        <th className="pb-3 px-3">Operation</th>
                        <th className="pb-3 px-3">Status</th>
                        <th className="pb-3 px-3">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono text-xs">
                      {filteredLogs.map((l) => (
                        <tr key={l.id} className="hover:bg-white/[0.02]">
                          <td className="py-2.5 px-3 text-slate-500">#{l.id}</td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans">{new Date(l.timestamp).toLocaleString()}</td>
                          <td className="py-2.5 px-3 text-indigo-300">{l.chat_id || 'Admin'}</td>
                          <td className="py-2.5 px-3 text-white font-sans">{l.connector}</td>
                          <td className="py-2.5 px-3 text-cyan-400">{l.operation}</td>
                          <td className="py-2.5 px-3">
                            <Badge variant={l.status === 'success' ? 'emerald' : 'rose'} className="text-[10px] uppercase font-sans">
                              {l.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 font-sans max-w-xs truncate">{l.error_message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 6: SYSTEM HEALTH */}
        {activeTab === 'health' && (
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-400" />
                Application Health Status
              </CardTitle>
              <CardDescription>
                Safe operational metrics without exposing server paths, environment variables, or private data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Node.js Express Backend</span>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> HEALTHY
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">{systemHealth?.dbEngine || 'Relational'} Database Engine</span>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> {systemHealth?.database === 'HEALTHY' ? 'HEALTHY' : 'UNHEALTHY'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Telegram Bot Gateway</span>
                  <div className="text-base font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" /> HEALTHY
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Application Uptime</span>
                  <div className="text-base font-bold text-white font-mono">
                    {systemHealth ? formatUptime(systemHealth.uptimeSeconds) : '—'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">Memory Heap Usage</span>
                  <div className="text-base font-bold text-cyan-300 font-mono">
                    {systemHealth ? `${systemHealth.memoryUsageMb} MB` : '—'}
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-xs text-slate-400">{systemHealth?.dbEngine || 'Database'} Storage Size</span>
                  <div className="text-base font-bold text-purple-300 font-mono">
                    {systemHealth ? `${systemHealth.dbSizeKb} KB` : '—'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 7: BACKUPS */}
        {activeTab === 'backups' && (
          <Card className="border-white/10 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <HardDrive className="h-5 w-5 text-indigo-400" />
                {backupStatus?.databaseEngine || systemHealth?.dbEngine || 'Database'} Backup Oversight
              </CardTitle>
              <CardDescription>
                Backup execution status and retention policy. Restoration remains a Server Owner operation via SSH.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-950 border border-white/5 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Database Engine:</span>
                    <span className="text-white font-mono">{backupStatus?.databaseEngine || systemHealth?.dbEngine || 'Relational'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Automated Schedule:</span>
                    <span className="text-emerald-300 font-semibold">{backupStatus?.backupSchedule || 'Daily Automated Cloud Snapshot'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Retention Policy:</span>
                    <span className="text-white">{backupStatus?.retentionPolicy || '30 Days Point-in-Time Recovery'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Backup Status:</span>
                    <Badge variant="emerald">HEALTHY</Badge>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-indigo-950/20 border border-indigo-500/20 text-xs text-slate-300 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm mb-2 flex items-center gap-1.5">
                      <Shield className="h-4 w-4 text-indigo-400" />
                      Infrastructure Security Note
                    </h4>
                    <p className="leading-relaxed text-slate-400">
                      Raw database backup files are never exposed through the web browser. Database restoration is strictly performed by the Server Owner through SSH terminal access on the VPS.
                    </p>
                  </div>
                  <span className="text-[11px] text-indigo-300 font-mono mt-3">Ref: docs/SERVER_OWNER.md</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* TAB 8: EMERGENCY CONTROLS */}
        {activeTab === 'emergency' && (
          <Card className="border-rose-500/30 bg-slate-900/40">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-rose-400">
                <Flame className="h-5 w-5 text-rose-400" />
                Emergency Application Controls
              </CardTitle>
              <CardDescription>
                Protected application-level circuit breakers. All toggles require admin authentication and log audit events.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-sm">Pause New Google OAuth Connections</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Temporarily prevents users from starting new OAuth authorization handshakes.</p>
                </div>
                <Button
                  variant={emergencyState.pauseNewOAuth ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => handleUpdateEmergency('pauseNewOAuth', !emergencyState.pauseNewOAuth)}
                  className="self-start sm:self-auto shrink-0"
                >
                  {emergencyState.pauseNewOAuth ? 'Resume OAuth' : 'Pause OAuth'}
                </Button>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-white text-sm">Maintenance Mode</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Flags system as undergoing maintenance for Telegram bot responses.</p>
                </div>
                <Button
                  variant={emergencyState.maintenanceMode ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => handleUpdateEmergency('maintenanceMode', !emergencyState.maintenanceMode)}
                  className="self-start sm:self-auto shrink-0"
                >
                  {emergencyState.maintenanceMode ? 'Disable Maintenance' : 'Enable Maintenance'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* DETAILED USER PROFILE MODAL */}
      <Dialog
        isOpen={!!viewingProfile}
        onClose={() => setViewingProfile(null)}
        title={viewingProfile?.id ? `User Profile #${viewingProfile.id}` : `User Profile (${viewingProfile?.name || 'Telegram User'})`}
        description="Comprehensive account metadata, Gemini API key status, AI model settings, and connected services."
        maxWidth="lg"
      >
        {viewingProfile && (
          <div className="space-y-5 text-sm">
            {/* Account Info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-950 border border-white/5">
              <div>
                <span className="text-xs text-slate-400 block">Name</span>
                <span className="font-bold text-white truncate block">{viewingProfile.name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Telegram Username</span>
                <span className="text-cyan-400 text-xs font-medium block truncate">
                  {viewingProfile.telegram?.username ? `@${viewingProfile.telegram.username}` : 'None'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Role</span>
                <Badge variant={viewingProfile.role === 'admin' ? 'purple' : 'outline'} className="mt-1 uppercase font-mono text-[10px]">
                  {viewingProfile.role}
                </Badge>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Status</span>
                <Badge variant={viewingProfile.status === 'active' ? 'emerald' : 'rose'} className="mt-1 capitalize text-[10px]">
                  {viewingProfile.status}
                </Badge>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Telegram ID</span>
                <span className="font-mono text-indigo-300 text-xs">{viewingProfile.telegram?.telegramId || 'None'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Source</span>
                <Badge variant="outline" className={`mt-1 text-[10px] uppercase font-mono ${viewingProfile.source === 'vm-bot' ? 'border-cyan-500/40 text-cyan-300' : ''}`}>
                  {viewingProfile.source === 'vm-bot' ? 'VM Bot' : 'Backend'}
                </Badge>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Preferred Model</span>
                <span className="text-xs text-slate-200 font-mono block truncate">
                  {viewingProfile.preferredModel || 'Gemini 2.5 Flash'}
                </span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Last Seen</span>
                <span className="text-xs text-slate-400 block truncate">
                  {viewingProfile.telegram?.lastSeenAt ? new Date(viewingProfile.telegram.lastSeenAt).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            {/* Gemini API Key Status (Never secrets) */}
            <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span className="font-bold text-white">Gemini AI Configuration</span>
                </div>
                <div className="text-slate-400 text-xs">
                  Key Status: <strong className={viewingProfile.geminiKeyStatus.configured ? 'text-emerald-400 font-medium' : 'text-amber-400 font-medium'}>
                    {viewingProfile.geminiKeyStatus.configured ? 'User API Key Active' : 'Server Key / Unconfigured'}
                  </strong>
                  {viewingProfile.preferredModel && (
                    <span className="ml-2 text-slate-500">• Model: <span className="text-indigo-300 font-mono">{viewingProfile.preferredModel}</span></span>
                  )}
                </div>
                {viewingProfile.geminiKeyStatus.lastUsed && (
                  <div className="text-[11px] text-slate-500">
                    Last AI Activity: {new Date(viewingProfile.geminiKeyStatus.lastUsed).toLocaleString()}
                  </div>
                )}
              </div>
              <Badge variant={viewingProfile.geminiKeyStatus.configured ? 'emerald' : 'secondary'} className="self-start sm:self-center shrink-0">
                {viewingProfile.geminiKeyStatus.configured ? 'Custom Key Active' : 'Default / Unset'}
              </Badge>
            </div>

            {/* Connected Services List */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Connected Workspace Services</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {viewingProfile.connectors.map((c) => (
                  <div key={c.name} className="p-3 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{c.icon}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white">{c.title}</span>
                          <Badge variant={c.tokenStatus === 'CONNECTED' ? 'emerald' : 'secondary'} className="text-[9px] py-0 font-mono">
                            {c.tokenStatus}
                          </Badge>
                        </div>
                        <span className="text-slate-400 text-[11px] block mt-0.5">
                          {c.connected ? (c.email || 'Authorized') : 'Not authorized'}
                        </span>
                      </div>
                    </div>

                    {c.connected && (viewingProfile.id != null || viewingProfile.telegram?.telegramId != null) && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRevokeConnector(viewingProfile.id ?? viewingProfile.telegram!.telegramId, c.name)}
                        className="h-7 px-2.5 text-[11px]"
                      >
                        Revoke
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-white/5">
              <Button variant="outline" size="sm" onClick={() => setViewingProfile(null)}>
                Close Profile
              </Button>
            </div>
          </div>
        )}
      </Dialog>

      {/* EDIT USER DIALOG */}
      <Dialog
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        title={`Edit User #${editingUser?.id}`}
        description="Update user name, role (USER or ADMIN), or status."
      >
        {editingUser && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Name</label>
              <Input
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Role</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  value={editFormData.role}
                  onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Status</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  value={editFormData.status}
                  onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
                >
                  <option value="active">Active</option>
                  <option value="disabled">Disabled</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="ghost" size="sm" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="glow" size="sm">
                Save Changes
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      {/* DELETE USER CONFIRMATION DIALOG */}
      <Dialog
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        title="Confirm User Deletion"
        description="Destructive action: remove user and cascade delete connected records."
      >
        {userToDelete && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete user <strong className="text-white">"{userToDelete.name}"</strong> (ID: #{userToDelete.id}, Telegram ID: {userToDelete.telegram?.telegramId || 'None'})?
            </p>
            <p className="text-xs text-rose-300">
              ⚠️ This will remove their stored metadata, token records, and Google OAuth credentials from the database.
            </p>

            <div className="flex justify-end gap-2 pt-3">
              <Button variant="ghost" size="sm" onClick={() => setUserToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={handleExecuteDelete}>
                Delete Permanently
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  );
}
