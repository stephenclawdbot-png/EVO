'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

/**
 * Lightweight error boundary for wrapping components that might crash at runtime
 * (e.g. EvoDetail when manifest data is unexpected). Prevents a single component
 * crash from blanking the entire page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack ?? null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const errText = this.state.error?.stack || this.state.error?.message || 'Unknown error';
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded border border-border bg-surface p-6 text-center">
          <p className="text-sm font-medium text-text-strong">Something went wrong</p>
          <p className="mt-1 text-xs text-dim">{this.state.error?.message || 'Unexpected error'}</p>
          <details className="mt-3 w-full text-left">
            <summary className="cursor-pointer text-[10px] text-dim hover:text-muted">Show error details</summary>
            <pre className="mt-2 max-h-48 overflow-auto rounded bg-bg p-2 text-[10px] text-muted whitespace-pre-wrap break-all">
{errText}
{this.state.componentStack}
            </pre>
          </details>
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => this.setState({ hasError: false, error: null, componentStack: null })}
              className="rounded border border-border-strong px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2"
            >
              Try again
            </button>
            <button
              onClick={() => { try { localStorage.setItem('evo_last_error', errText); } catch {} window.location.href = '/'; }}
              className="rounded border border-border px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-surface-2"
            >
              Back to home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}