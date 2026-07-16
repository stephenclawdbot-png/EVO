'use client';

import { useTheme } from './ThemeProvider';
import { IconSun, IconMoon } from './Icons';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:text-text hover:border-border-strong ${className ?? ''}`}
    >
      {theme === 'dark' ? <IconSun className="h-4 w-4" /> : <IconMoon className="h-4 w-4" />}
    </button>
  );
}