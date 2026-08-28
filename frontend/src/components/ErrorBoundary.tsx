import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ShieldAlert, RefreshCw, Home } from 'lucide-react';
import { Button } from './ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from './ui/Card';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AskMyAgent] Uncaught React Error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050814] text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
          {/* Background ambient lighting */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-rose-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
          <div className="w-full max-w-md">
            <Card className="border-rose-500/20 bg-slate-900/90 shadow-2xl backdrop-blur-2xl text-center p-6">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <CardTitle className="text-xl font-bold text-white mb-2">Something went wrong</CardTitle>
              <CardDescription className="text-sm text-slate-400 mb-4">
                An unexpected interface error occurred. You can reload the page or return to the main dashboard.
              </CardDescription>
              {this.state.error && (
                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 text-xs font-mono text-rose-300 mb-6 text-left overflow-x-auto max-h-28">
                  {this.state.error.message}
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Button variant="outline" size="sm" onClick={this.handleReset} className="gap-1.5 text-xs">
                  <Home className="h-3.5 w-3.5 text-indigo-400" />
                  Return Home
                </Button>
                <Button variant="glow" size="sm" onClick={this.handleReload} className="gap-1.5 text-xs">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reload App
                </Button>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
