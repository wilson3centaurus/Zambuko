"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";

// ── Theme ─────────────────────────────────────────────────────────────────────
function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    const saved = localStorage.getItem("zambuko-theme");
    const isDark = saved !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);
  function toggle() {
    setDark((d) => {
      const next = !d;
      localStorage.setItem("zambuko-theme", next ? "dark" : "light");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }
  return { dark, toggle };
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icons = {
  dashboard: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  ),
  doctors: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M12 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 10c-5 0-8 2.5-8 4v1h16v-1c0-1.5-3-4-8-4z" />
      <path d="M16 15v3m0 0h-2m2 0h2" strokeLinecap="round" />
    </svg>
  ),
  dispatchers: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M3 12h3m15 0h-3M12 3v3m0 15v-3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" strokeLinecap="round" />
    </svg>
  ),
  patients: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" />
    </svg>
  ),
  emergencies: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" strokeLinecap="round" />
    </svg>
  ),
  analytics: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  settings: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  sun: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" strokeLinecap="round" />
    </svg>
  ),
  moon: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  bell: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  chevron: (
    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

// ── Nav sections ──────────────────────────────────────────────────────────────
const NAV_SECTIONS = [
  {
    label: null,
    items: [{ href: "/dashboard", label: "Dashboard", icon: Icons.dashboard }],
  },
  {
    label: "MEDICAL",
    items: [
      { href: "/doctors", label: "Doctors", icon: Icons.doctors },
    ],
  },
  {
    label: "OPERATIONS",
    items: [
      { href: "/dispatchers", label: "Dispatchers", icon: Icons.dispatchers },
      { href: "/patients", label: "Patients", icon: Icons.patients },
      { href: "/emergencies", label: "Emergencies", icon: Icons.emergencies },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      { href: "/analytics", label: "Analytics", icon: Icons.analytics },
      { href: "/settings", label: "Settings", icon: Icons.settings },
    ],
  },
];

// ── Layout ────────────────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { dark, toggle } = useTheme();
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email ?? "",
          name: data.user.user_metadata?.full_name ?? data.user.email?.split("@")[0] ?? "Admin",
        });
      }
    });
  }, []);

  // Close user menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const pageName = NAV_SECTIONS
    .flatMap((s) => s.items)
    .find((i) => pathname.startsWith(i.href))?.label ?? "Dashboard";

  const initials = user?.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() ?? "A";

  return (
    <div className="flex min-h-screen">
      {/* ── Sidebar ── */}
      <aside className="w-60 bg-gray-950 flex flex-col fixed inset-y-0 left-0 z-50">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
              <svg className="w-4 h-4 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Hutano</p>
              <p className="text-gray-500 text-xs">Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.label ?? "__top"}>
              {section.label && (
                <p className="px-3 mb-1.5 text-[10px] font-bold text-gray-600 uppercase tracking-widest">
                  {section.label}
                </p>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <button
                      key={item.href}
                      onClick={() => router.push(item.href)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-white text-gray-900"
                          : "text-gray-400 hover:bg-gray-800 hover:text-white"
                      }`}
                    >
                      <span className={isActive ? "text-gray-900" : "text-gray-500"}>{item.icon}</span>
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Sign out */}
        <div className="px-3 py-4 border-t border-gray-800 space-y-0.5">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
          >
            <span className="text-gray-500">{Icons.logout}</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main column ── */}
      <div className="flex-1 ml-60 flex flex-col min-h-screen">
        {/* Top header */}
        <header className="h-14 bg-gray-900 border-b border-gray-800 flex items-center px-6 gap-4 sticky top-0 z-40">
          {/* Breadcrumb */}
          <div className="flex-1 flex items-center gap-2 text-sm">
            <span className="text-gray-500">Dashboard</span>
            {pageName !== "Dashboard" && (
              <>
                <span className="text-gray-700">/</span>
                <span className="text-white font-medium">{pageName}</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={dark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            >
              {dark ? Icons.sun : Icons.moon}
            </button>

            {/* Bell */}
            <button className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
              {Icons.bell}
            </button>

            {/* User dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  {initials}
                </div>
                <div className="text-left hidden sm:block">
                  <p className="text-white text-xs font-semibold leading-none">{user?.name ?? "Admin"}</p>
                  <p className="text-gray-500 text-[10px] mt-0.5">Super Admin</p>
                </div>
                <span className="text-gray-500">{Icons.chevron}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden py-1">
                  <div className="px-3 py-2 border-b border-gray-700">
                    <p className="text-white text-sm font-semibold">{user?.name ?? "Admin"}</p>
                    <p className="text-gray-400 text-xs">{user?.email ?? ""}</p>
                    <span className="mt-1 inline-block text-[10px] bg-brand-900 text-brand-300 px-1.5 py-0.5 rounded font-semibold">Super Admin</span>
                  </div>
                  <button
                    onClick={() => { setUserMenuOpen(false); router.push("/settings"); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    Profile & Settings
                  </button>
                  <button
                    onClick={() => { toggle(); setUserMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                  >
                    <span>{dark ? Icons.sun : Icons.moon}</span>
                    {dark ? "Light Mode" : "Dark Mode"}
                  </button>
                  <div className="border-t border-gray-700 my-1" />
                  <button
                    onClick={() => { setUserMenuOpen(false); signOut(); }}
                    className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2.5 transition-colors"
                  >
                    {Icons.logout}
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-900">
          {children}
        </main>
      </div>
    </div>
  );
}
        