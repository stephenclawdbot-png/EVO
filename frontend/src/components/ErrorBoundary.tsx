'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Lightweight error boundary for wrapping components that might crash at runtime
 * (e.g. EvoDetail when manifest data is unexpected). Prevents a single component
 * crash from blanking the entire page.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded border border-border bg-surface p-6 text-center">
          <p className="text-sm font-medium text-text-strong">Something went wrong</p>
          <p className="mt-1 text-xs text-dim">{this.state.error?.message || 'Unexpected error'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-3 rounded border border-border-strong px-3 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-2"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}