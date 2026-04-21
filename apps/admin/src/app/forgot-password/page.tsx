"use client";

import { useState } from "react";
import { createClient } from "@zambuko/database/client";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) throw error;
      setSent(true);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
          <h1 className="text-2xl font-black text-white">Admin Password Reset</h1>
          <p className="text-gray-400 text-sm mt-1">Enter your email to receive a reset link</p>
        </div>

        {sent ? (
          <div className="bg-emerald-900/40 border border-emerald-700 rounded-2xl px-5 py-5 text-center space-y-2">
            <p className="text-emerald-300 font-semibold">Reset link sent</p>
            <p className="text-gray-400 text-sm">Check <span className="text-white font-medium">{email}</span> for the reset link.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                placeholder="admin@hutano.co.zw"
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm placeholder-gray-500" />
            </div>
            <button type="submit" disabled={loading || !email}
              className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors disabled:opacity-50">
              {loading ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        )}

        <div className="text-center">
          <a href="/login" className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">
            ← Back to login
          </a>
        </div>
      </div>
    </div>
  );
}
