import type { Metadata } from 'next';
import { PortalHeader } from '@/components/portal/PortalHeader';

export const metadata: Metadata = {
  title: 'Connect – Get Connected',
  description: 'Fast, affordable internet access in Zimbabwe',
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-blue-50 dark:bg-slate-950 transition-colors duration-300">
      <PortalHeader />

      <main className="flex-1 flex flex-col items-center py-6 px-4">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </main>

      <footer className="py-5 text-center border-t border-gray-200 dark:border-slate-800">
        <p className="text-xs text-gray-400 dark:text-slate-600">
          A Robokorda Africa initiative
        </p>
      </footer>
    </div>
  );
}
