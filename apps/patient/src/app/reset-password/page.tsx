"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  createClient,
  establishPasswordRecoverySession,
} from "@zambuko/database/client";
import { Button, PasswordInput } from "@zambuko/ui";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (active && session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN")) {
        setReady(true);
      }
    });

    void (async () => {
      const result = await establishPasswordRecoverySession(supabase);
      if (!active) return;
      if (result.session) {
        setReady(true);
      } else {
        setVerificationError(
          result.error?.message ??
            "This reset link is invalid or expired. Please request a new one."
        );
      }
    })();

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (password !== confirm) { toast.error("Passwords don't match."); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated!");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to reset password.");
    } finally {
      setLoading(false);
    }
  }

  if (verificationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900">
        <div className="mx-6 max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
          <h1 className="text-xl font-bold text-gray-900">Reset link unavailable</h1>
          <p className="mt-2 text-sm text-gray-600">{verificationError}</p>
          <a className="mt-5 inline-block font-semibold text-brand-600 hover:underline" href="/forgot-password">
            Send a new reset link
          </a>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900">
        <p className="text-brand-200">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-6 py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur mb-4">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Set New Password</h1>
        <p className="mt-1 text-brand-200">Choose a strong password</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">New Password</h2>
        <p className="text-sm text-gray-500 mb-6">Must be at least 8 characters.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pw" className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
            <PasswordInput
              id="pw"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 placeholder-gray-400 transition"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 placeholder-gray-400 transition"
            />
          </div>
          <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!password || !confirm}>
            Set New Password
          </Button>
        </form>
      </div>
    </div>
  );
}
