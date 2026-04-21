"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Queue", icon: "📋" },
  { href: "/schedule", label: "Schedule", icon: "📅" },
  { href: "/prescriptions", label: "Rx", icon: "💊" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export default function DoctorAppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Doctor heartbeat — keeps status as "available" while app is open
  useEffect(() => {
    async function sendHeartbeat() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from("doctors")
        .update({ heartbeat_at: new Date().toISOString() })
        .eq("id", user.id);
    }

    sendHeartbeat(); // Immediately on mount
    heartbeatRef.current = setInterval(sendHeartbeat, 30_000); // Every 30s

    // Go offline on unload
    const handleUnload = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("doctors").update({ status: "offline" }).eq("id", user.id);
      }
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [supabase]);

  async function handleSignOut() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("doctors").update({ status: "offline" }).eq("id", user.id);
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Main content */}
      <div className="flex-1 pb-20">{children}</div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 bg-slate-900 border-t border-slate-800 pb-safe z-50">
        <div className="flex items-center max-w-lg mx-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`flex-1 flex flex-col items-center py-2.5 gap-0.5 transition-colors ${isActive ? "text-sky-400" : "text-slate-500 hover:text-slate-300"}`}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={handleSignOut}
            className="flex-1 flex flex-col items-center py-2.5 gap-0.5 text-slate-500 hover:text-red-400 transition-colors"
          >
            <span className="text-xl">🚪</span>
            <span className="text-[10px] font-semibold">Sign Out</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
