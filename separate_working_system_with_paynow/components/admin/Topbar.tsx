'use client';

import { useEffect, useState } from 'react';
import { Bell, Search } from 'lucide-react';

interface AdminInfo {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
}

export function AdminTopbar() {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => { if (j.success) setAdmin(j.data); })
      .catch(() => {});
  }, []);

  const initials = admin?.name
    ? admin.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-5 bg-slate-950 border-b border-slate-800">
      {/* Left: search */}
      <div className="flex items-center gap-2 flex-1 max-w-xs">
        <Search size={14} className="text-slate-600 shrink-0" />
        <input
          type="search"
          placeholder="Search..."
          className="w-full bg-transparent text-sm text-slate-400 placeholder:text-slate-700 focus:outline-none"
        />
      </div>

      {/* Right: bell + user */}
      <div className="flex items-center gap-3">
        <button className="relative p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition">
          <Bell size={17} />
        </button>

        <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
          {admin?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={admin.avatar_url}
              alt={admin.name}
              className="w-7 h-7 rounded-full object-cover ring-2 ring-slate-700"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-[11px] font-bold text-white">
              {initials}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-semibold text-slate-200 leading-none">{admin?.name ?? '...'}</p>
            <p className="text-[11px] text-slate-500 mt-0.5 capitalize">{admin?.role ?? ''}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
