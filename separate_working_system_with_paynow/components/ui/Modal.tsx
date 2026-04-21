'use client';

import { useEffect, useCallback, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/format';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'relative w-full sm:max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl z-10',
          'max-h-[90vh] overflow-y-auto',
          className
        )}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-800">
          {title && <h2 className="text-base font-bold text-slate-100">{title}</h2>}
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-xl text-slate-600 hover:text-slate-300 hover:bg-slate-800 transition"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}
