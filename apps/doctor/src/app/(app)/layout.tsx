"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { cn } from "@zambuko/ui";

type NavIcon = "queue" | "schedule" | "prescriptions" | "profile";

const NAV_ITEMS: Array<{ href: string; label: string; shortLabel: string; icon: NavIcon }> = [
  { href: "/dashboard", label: "Consultation queue", shortLabel: "Queue", icon: "queue" },
  { href: "/schedule", label: "Schedule", shortLabel: "Schedule", icon: "schedule" },
  { href: "/prescriptions", label: "Prescriptions", shortLabel: "Rx", icon: "prescriptions" },
  { href: "/profile", label: "Professional profile", shortLabel: "Profile", icon: "profile" },
];

function Icon({ name, className = "h-5 w-5" }: { name: NavIcon; className?: string }) {
  const paths = {
    queue: <path strokeLinecap="round" strokeLinejoin="round" d="M7 4.5h10M7 9h10M7 13.5h6M5 2.75h14a2 2 0 0 1 2 2v14.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4.75a2 2 0 0 1 2-2Z" />,
    schedule: <path strokeLinecap="round" strokeLinejoin="round" d="M7 3v3m10-3v3M4 9h16M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 8h3v3H8v-3Z" />,
    prescriptions: <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 3.5h5a4 4 0 0 1 0 8h-5v-8Zm0 8L17 20m-4-4h7" />,
    profile: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function DoctorAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function sendHeartbeat() {
      if (document.visibilityState !== "visible") return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("doctors")
        .update({ heartbeat_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    void sendHeartbeat();
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000);
    document.addEventListener("visibilitychange", sendHeartbeat);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      document.removeEventListener("visibilitychange", sendHeartbeat);
    };
  }, [supabase]);

  async function handleSignOut() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("doctors").update({ status: "offline" }).eq("id", user.id);
    }
    await supabase.auth.signOut();
    router.replace("/login");
  }

  function active(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r border-slate-200 bg-white px-4 py-5 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <Link href="/dashboard" className="flex items-center gap-3 px-2">
          <Image src="/logo.svg" alt="Hutano" width={124} height={34} priority className="h-8 w-auto" />
        </Link>
        <p className="mt-1 px-2 text-xs font-semibold text-slate-400">Doctor portal</p>

        <nav aria-label="Doctor navigation" className="mt-7 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                active(item.href)
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto rounded-xl border border-brand-100 bg-brand-50 p-3">
          <p className="text-xs font-bold text-brand-800">Clinical privacy</p>
          <p className="mt-1 text-[11px] leading-4 text-brand-700">
            Access patient information only for consultations assigned to you.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-3 min-h-10 rounded-lg px-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-red-700"
        >
          Sign out
        </button>
      </aside>

      <main className="min-w-0 pb-20 lg:pb-0">{children}</main>

      <nav aria-label="Doctor navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 pb-safe backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-center">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active(item.href) ? "page" : undefined}
              className={cn(
                "flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold",
                active(item.href) ? "text-brand-700" : "text-slate-400"
              )}
            >
              <Icon name={item.icon} />
              <span>{item.shortLabel}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
