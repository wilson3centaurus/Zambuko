'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, Ticket, CreditCard, Network, FileText, LogOut,
  Users, Shield, Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils/format';
import { ConnectLogo } from '@/components/ConnectLogo';

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ href: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, exact: true }],
  },
  {
    label: 'MANAGEMENT',
    items: [
      { href: '/admin/dashboard/vouchers',  label: 'Vouchers',  icon: Ticket     },
      { href: '/admin/dashboard/payments',  label: 'Payments',  icon: CreditCard },
      { href: '/admin/dashboard/sessions',  label: 'Sessions',  icon: Users      },
    ],
  },
  {
    label: 'CONFIGURE',
    items: [
      { href: '/admin/dashboard/network', label: 'Packages', icon: Network },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { href: '/admin/dashboard/users',    label: 'Admin Users', icon: Shield    },
      { href: '/admin/dashboard/logs',     label: 'Logs',        icon: FileText  },
      { href: '/admin/dashboard/settings', label: 'Settings',    icon: Settings  },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
  }

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-slate-900 border-r border-slate-800">
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-800">
        <ConnectLogo fontSize={20} inverse />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label ?? 'root'} className="mb-4">
            {section.label && (
              <p className="px-3 mb-1.5 text-[10px] font-bold tracking-widest text-slate-600 uppercase select-none">
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const { href, label, icon: Icon } = item;
              const exact = 'exact' in item ? item.exact : false;
              const active = exact
                ? pathname === href
                : pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-0.5',
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                  )}
                >
                  <Icon size={16} className={active ? 'text-white' : 'text-slate-500'} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="px-2 py-3 border-t border-slate-800">
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
        <p className="text-[10px] text-slate-700 text-center mt-3 select-none">
          A Robokorda Africa initiative
        </p>
      </div>
    </aside>
  );
}

