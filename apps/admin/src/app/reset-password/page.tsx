"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
      else {
        toast.error("Invalid or expired reset link.");
        router.push("/login");
      }
    });
  }, []);

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

  if (!ready) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Verifying reset link…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Set New Password</h1>
          <p className="text-gray-400 text-sm mt-1">Admin Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">New Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters" required autoFocus
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm placeholder-gray-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Confirm Password</label>
            <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat password" required
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm placeholder-gray-500" />
          </div>
          <button type="submit" disabled={loading || !password || !confirm}
            className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
            {loading ? "Updating…" : "Set New Password"}
          </button>
        </form>

        <div className="text-center">
          <a href="/login" className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">← Back to login</a>
        </div>
      </div>
    </div>
  );
}
