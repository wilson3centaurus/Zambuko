"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { Button, cn } from "@zambuko/ui";
import { toast } from "sonner";
import { getMissingSetupFields, type PatientSetupData } from "@/lib/patient-setup";

type NavItem = {
  href: string;
  label: string;
  icon: "home" | "consult" | "emergency" | "learn" | "profile";
  emergency?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/triage", label: "Consult", icon: "consult" },
  { href: "/emergency", label: "Emergency", icon: "emergency", emergency: true },
  { href: "/learn", label: "Learn", icon: "learn" },
  { href: "/profile", label: "Profile", icon: "profile" },
];

function NavIcon({ name, className = "h-5 w-5" }: { name: NavItem["icon"]; className?: string }) {
  const paths = {
    home: <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.75 12 3l9 7.75M5.25 9.5v10.25h5v-6h3.5v6h5V9.5" />,
    consult: <path strokeLinecap="round" strokeLinejoin="round" d="M9 5.25h6M9 9h6m-6 3.75h3.75M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />,
    emergency: <path strokeLinecap="round" strokeLinejoin="round" d="M12 3.75v8.5m0 4v.1M10.3 2.9 2.5 17a2 2 0 0 0 1.75 3h15.5a2 2 0 0 0 1.75-3L13.7 2.9a1.95 1.95 0 0 0-3.4 0Z" />,
    learn: <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v18H7.5A3.5 3.5 0 0 0 4 23.5v-18Zm16 0A3.5 3.5 0 0 0 16.5 2H12v18h4.5a3.5 3.5 0 0 1 3.5 3.5v-18Z" />,
    profile: <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 7.5a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.5 20.25a7.5 7.5 0 0 1 15 0" />,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [setupPromptOpen, setSetupPromptOpen] = useState(false);

  const {
    data: setupData,
    isLoading: setupLoading,
    isError: setupCheckFailed,
    refetch: refetchSetup,
  } = useQuery({
    queryKey: ["patient-setup-status"],
    queryFn: async (): Promise<PatientSetupData> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { profile: null, patient: null };
      const [profileResult, patientResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name,phone,avatar_url,date_of_birth,gender,city,province")
          .eq("id", user.id)
          .single(),
        supabase
          .from("patients")
          .select("emergency_contact_name,emergency_contact_phone,emergency_contact_relation,legal_full_name,national_id,national_id_document_path,consent_given_at")
          .eq("id", user.id)
          .single(),
      ]);
      if (profileResult.error) throw profileResult.error;
      if (patientResult.error) throw patientResult.error;
      return { profile: profileResult.data, patient: patientResult.data };
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const missingSetup = getMissingSetupFields(setupData);
  const setupIncomplete = !setupLoading && !!setupData && missingSetup.length > 0;
  const setupBlocked = setupIncomplete || setupCheckFailed;
  const setupAllowedPath = pathname.startsWith("/profile") || pathname.startsWith("/emergency");
  const showSetupGate = setupBlocked && (!setupAllowedPath || setupPromptOpen);

  async function handleSignOut() {
    await supabase.auth.signOut();
    toast.success("Signed out securely");
    router.replace("/login");
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function canOpenDuringSetup(href: string) {
    return href === "/profile" || href === "/emergency";
  }

  function handleRestrictedNavigation(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (!setupBlocked || canOpenDuringSetup(href)) return;
    event.preventDefault();
    setSetupPromptOpen(true);
  }

  return (
    <div className="min-h-app bg-slate-50 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen lg:flex-col border-r border-slate-200 bg-white px-4 py-5">
        <Link href="/dashboard" onClick={(event) => handleRestrictedNavigation(event, "/dashboard")} className="flex items-center gap-3 rounded-lg px-2 py-1">
          <Image src="/logo.svg" alt="Hutano" width={132} height={36} priority className="h-9 w-auto" />
        </Link>

        <p className="mt-6 px-3 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Patient care</p>
        <nav aria-label="Patient navigation" className="mt-2 space-y-1">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleRestrictedNavigation(event, item.href)}
                aria-current={active ? "page" : undefined}
                aria-disabled={setupBlocked && !canOpenDuringSetup(item.href) ? true : undefined}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold transition-colors",
                  setupBlocked && !canOpenDuringSetup(item.href) && "opacity-45",
                  item.emergency
                    ? active ? "bg-red-50 text-red-700" : "text-red-700 hover:bg-red-50"
                    : active ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto rounded-xl border border-brand-100 bg-brand-50 p-3">
          <div className="flex items-center gap-2 text-brand-800">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 5.5 5.5v5.8c0 4.1 2.75 7.9 6.5 9.2 3.75-1.3 6.5-5.1 6.5-9.2V5.5L12 3Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m9.5 12 1.7 1.7 3.6-4" />
            </svg>
            <span className="text-xs font-bold">Private and secure</span>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-brand-700">Your medical activity is protected and only shared with authorised care teams.</p>
        </div>

        <button onClick={handleSignOut} className="mt-3 min-h-10 rounded-lg px-3 text-left text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
          Sign out
        </button>
      </aside>

      <main className="min-w-0 pb-24 lg:pb-0">{children}</main>

      <nav aria-label="Patient navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-safe shadow-[0_-8px_30px_-24px_rgba(15,23,42,0.5)] backdrop-blur lg:hidden">
        <div className="mx-auto flex h-16 max-w-lg items-end justify-around">
          {NAV.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(event) => handleRestrictedNavigation(event, item.href)}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                aria-disabled={setupBlocked && !canOpenDuringSetup(item.href) ? true : undefined}
                className={cn(
                  "flex h-full flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold",
                  setupBlocked && !canOpenDuringSetup(item.href) && "opacity-45",
                  item.emergency ? "relative -top-2" : active ? "text-brand-700" : "text-slate-400"
                )}
              >
                {item.emergency ? (
                  <>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-red-700 text-white shadow-lg ring-4 ring-white">
                      <NavIcon name="emergency" className="h-6 w-6" />
                    </span>
                    <span className="sr-only">{item.label}</span>
                  </>
                ) : (
                  <>
                    <NavIcon name={item.icon} className="h-5 w-5" />
                    <span>{item.label}</span>
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {showSetupGate && (
        <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-required-title"
            className="w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-950"
          >
            <div className="bg-gradient-to-br from-amber-400 to-orange-600 px-6 py-7 text-white">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/20 text-3xl shadow-lg" aria-hidden="true">!</span>
              <p className="mt-4 text-xs font-black uppercase tracking-[0.18em] text-white/80">Required before continuing</p>
              <h2 id="setup-required-title" className="mt-1 text-2xl font-black">
                {setupCheckFailed ? "We could not verify your setup" : "Complete your patient setup"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/90">
                {setupCheckFailed
                  ? "Check your connection and retry. Your care features stay protected until setup can be verified."
                  : "Doctors and emergency responders need this information to identify and assist you safely."}
              </p>
            </div>

            <div className="space-y-5 p-6">
              {!setupCheckFailed && <div>
                <p className="text-xs font-black uppercase tracking-wider text-slate-500">Still required</p>
                <ul className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-200">
                  {missingSetup.slice(0, 8).map((field) => (
                    <li key={field} className="flex items-start gap-2">
                      <span className="mt-1 text-amber-600" aria-hidden="true">*</span>
                      <span>{field}</span>
                    </li>
                  ))}
                </ul>
                {missingSetup.length > 8 && <p className="mt-2 text-xs font-semibold text-slate-500">And {missingSetup.length - 8} more required field{missingSetup.length - 8 === 1 ? "" : "s"}.</p>}
              </div>}

              {setupCheckFailed ? (
                <>
                  <Button autoFocus className="w-full" onClick={() => void refetchSetup()}>
                    Retry setup check
                  </Button>
                  <Link href="/profile?setup=1" className="block rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-black text-slate-700 dark:border-slate-700 dark:text-slate-200">
                    Open profile settings
                  </Link>
                </>
              ) : (
                <Button
                  autoFocus
                  className="w-full"
                  onClick={() => {
                    setSetupPromptOpen(false);
                    router.push("/profile?setup=1");
                  }}
                >
                  Go to profile settings
                </Button>
              )}
              <Link href="/emergency" className="block rounded-xl border border-red-200 px-4 py-3 text-center text-sm font-black text-red-700 dark:border-red-900 dark:text-red-300">
                Emergency? Open SOS
              </Link>
              <p className="text-center text-xs text-slate-500">SOS always remains available, even before setup is complete.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
