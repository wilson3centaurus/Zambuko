'use client';

import { useEffect, useState, createContext, useContext, ReactNode, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils/format';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastType, ReactNode> = {
  success: <CheckCircle className="text-green-500" size={20} />,
  error:   <XCircle className="text-red-500" size={20} />,
  warning: <AlertTriangle className="text-yellow-500" size={20} />,
  info:    <Info className="text-blue-500" size={20} />,
};

const bgStyles: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50',
  error:   'border-red-200 bg-red-50',
  warning: 'border-yellow-200 bg-yellow-50',
  info:    'border-blue-200 bg-blue-50',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = 'info', duration = 4000) => {
      const id = Math.random().toString(36).slice(2);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      if (duration > 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80 max-w-full" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              'flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg',
              'animate-in slide-in-from-right-full duration-300',
              bgStyles[t.type]
            )}
          >
            <div className="flex-shrink-0 mt-0.5">{icons[t.type]}</div>
            <p className="flex-1 text-sm font-medium text-gray-800">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
