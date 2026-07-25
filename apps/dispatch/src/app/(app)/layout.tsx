"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@zambuko/database/client";
import { Toaster } from "sonner";

type DispatcherStatus = "available" | "en_route" | "on_scene" | "offline";

const STATUS_CONFIG: Record<DispatcherStatus, { label: string; color: string; dot: string }> = {
  available:  { label: "Available",  color: "bg-emerald-600", dot: "bg-emerald-400" },
  en_route:   { label: "En Route",   color: "bg-amber-600",   dot: "bg-amber-400"   },
  on_scene:   { label: "On Scene",   color: "bg-blue-600",    dot: "bg-blue-400"    },
  offline:    { label: "Offline",    color: "bg-slate-600",   dot: "bg-slate-500"   },
};

type NavIcon = "dashboard" | "history" | "profile";

function Icon({ name, className = "h-5 w-5" }: { name: NavIcon; className?: string }) {
  const paths = {
    dashboard: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 11.25 12 3l8.25 8.25M5.25 9.75v10.5h13.5V9.75M9.5 20.25v-6.5h5v6.5" />,
    history: <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12a8.25 8.25 0 1 0 2.42-5.83L3.75 8.6m0-4.85V8.6H8.6M12 7.5V12l3 1.75" />,
    profile: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function DispatchAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<DispatcherStatus>("offline");
  const [userId, setUserId] = useState<string | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const watchRef = useRef<number | null>(null);
  const latRef = useRef<number | null>(null);
  const lngRef = useRef<number | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) return;
      setUserId(data.user.id);
      supabase.from("dispatchers").select("status").eq("id", data.user.id).single()
        .then(({ data: d }) => { if (d) setStatus(d.status as DispatcherStatus); });
    });
  }, []);

  // GPS tracking
  useEffect(() => {
    if (!userId) return;
    if (!navigator.geolocation) return;

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        latRef.current = pos.coords.latitude;
        lngRef.current = pos.coords.longitude;
      },
      undefined,
      { enableHighAccuracy: true, maximumAge: 10_000 }
    );

    return () => {
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    };
  }, [userId]);

  // Heartbeat — sends GPS + status every 15 s
  useEffect(() => {
    if (!userId) return;

    const beat = async () => {
      await supabase.from("dispatchers").update({
        heartbeat_at: new Date().toISOString(),
        ...(latRef.current !== null && {
          location_lat: latRef.current,
          location_lng: lngRef.current,
        }),
      }).eq("id", userId);
    };

    beat();
    heartbeatRef.current = setInterval(beat, 15_000);

    const goOffline = () => {
      supabase.from("dispatchers").update({ status: "offline" }).eq("id", userId);
    };
    window.addEventListener("beforeunload", goOffline);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      window.removeEventListener("beforeunload", goOffline);
    };
  }, [userId]);

  async function changeStatus(next: DispatcherStatus) {
    if (!userId) return;
    await supabase.from("dispatchers").update({ status: next }).eq("id", userId);
    setStatus(next);
  }

  const cfg = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-700 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h11v10H3V7Zm11 3h3.5l3 3v4H14v-7ZM7 10v4m-2-2h4m-3 7a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm11 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
            </svg>
          </span>
          <div>
            <span className="block text-sm font-black tracking-wide text-white">HUTANO DISPATCH</span>
            <span className="block text-[10px] font-semibold text-slate-400">Emergency response</span>
          </div>
        </div>

        {/* Status pill */}
        <div className="relative group">
          <button aria-label={`Responder status: ${cfg.label}`} className={`flex min-h-10 items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold ${cfg.color}`}>
            <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </button>
          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-1 hidden group-focus-within:flex group-hover:flex flex-col w-36 bg-slate-700 rounded-2xl shadow-xl overflow-hidden z-50">
            {(Object.entries(STATUS_CONFIG) as [DispatcherStatus, typeof cfg][]).map(([key, c]) => (
              <button key={key} onClick={() => changeStatus(key)}
                className={`px-4 py-2.5 text-xs text-left font-semibold hover:bg-slate-600 flex items-center gap-2 ${status === key ? "text-white" : "text-slate-300"}`}>
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16">{children}</main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-800 border-t border-slate-700 flex z-40">
        {[
          { href: "/dashboard", label: "Dashboard", icon: "dashboard" as NavIcon },
          { href: "/history", label: "History", icon: "history" as NavIcon },
          { href: "/profile", label: "Profile", icon: "profile" as NavIcon },
        ].map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold transition-colors ${active ? "text-red-400" : "text-slate-500 hover:text-slate-300"}`}>
              <Icon name={icon} />
              {label}
            </Link>
          );
        })}
      </nav>

      <Toaster theme="dark" richColors position="top-center" />
    </div>
  );
}
