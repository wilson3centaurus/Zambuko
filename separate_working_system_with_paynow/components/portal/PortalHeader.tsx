'use client';

import { ConnectLogo } from '@/components/ConnectLogo';
import { useTheme } from '@/components/ThemeProvider';
import { Sun, Moon } from 'lucide-react';

export function PortalHeader() {
  const { theme, toggle } = useTheme();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-gradient-to-r from-blue-700 via-blue-800 to-indigo-900 px-5 py-4 shadow-lg">
      <ConnectLogo fontSize={26} inverse />
      <button
        onClick={toggle}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  );
}
