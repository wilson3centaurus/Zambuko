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
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-6 py-12">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur mb-4">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Forgot Password?</h1>
        <p className="mt-1 text-brand-200">We&apos;ll send you a recovery link</p>
      </div>

      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
        {sent ? (
          <div className="py-4 text-center space-y-3">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="font-bold text-gray-900">Check your inbox</h2>
            <p className="text-sm text-gray-500">
              A password reset link has been sent to <span className="font-semibold text-gray-800">{email}</span>.
            </p>
            <a href="/login" className="block mt-4 text-sm text-brand-600 font-semibold hover:underline">← Back to login</a>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold text-gray-900 mb-1">Reset your password</h2>
            <p className="text-sm text-gray-500 mb-6">Enter your email and we&apos;ll send a reset link.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900 placeholder-gray-400 transition"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition disabled:opacity-50"
              >
                {loading ? "Sending…" : "Send Reset Link"}
              </button>
            </form>

            <p className="mt-4 text-sm text-center text-gray-500">
              <a href="/login" className="text-brand-600 font-semibold hover:underline">← Back to login</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
