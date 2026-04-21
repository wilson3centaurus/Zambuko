"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@zambuko/database/client";
import { Toaster } from "sonner";

type DispatcherStatus = "available" | "en_route" | "on_scene" | "offline";

const STATUS_CONFIG: Record<DispatcherStatus, { label: string; color: string; dot: string }> = {
  available:  { label: "Available",  color: "bg-emerald-600", dot: "bg-emerald-400" },
  en_route:   { label: "En Route",   color: "bg-amber-600",   dot: "bg-amber-400"   },
  on_scene:   { label: "On Scene",   color: "bg-blue-600",    dot: "bg-blue-400"    },
  offline:    { label: "Offline",    color: "bg-slate-600",   dot: "bg-slate-500"   },
};

export default function DispatchAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
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
          <span className="text-xl">🚑</span>
          <span className="font-black text-red-400 tracking-wide text-sm">HUTANO DISPATCH</span>
        </div>

        {/* Status pill */}
        <div className="relative group">
          <button className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${cfg.color}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
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
          { href: "/dashboard", label: "Dashboard", icon: "🗺️" },
          { href: "/history", label: "History", icon: "📋" },
          { href: "/profile", label: "Profile", icon: "👤" },
        ].map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-2.5 text-xs font-semibold transition-colors ${active ? "text-red-400" : "text-slate-500 hover:text-slate-300"}`}>
              <span className="text-xl mb-0.5">{icon}</span>
              {label}
            </Link>
          );
        })}
      </nav>

      <Toaster theme="dark" richColors position="top-center" />
    </div>
  );
}
