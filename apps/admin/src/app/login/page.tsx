"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { toast } from "sonner";

function AdminLoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const error = params.get("error");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed. Check your credentials.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-brand-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🏥</span>
          </div>
          <h1 className="text-2xl font-black text-white">Admin Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Hutano Telehealth</p>
        </div>

        {error === "unauthorized" && (
          <div className="bg-red-900/50 border border-red-700 rounded-2xl px-4 py-3 text-red-300 text-sm text-center">
            Access denied. Admin accounts only.
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
              placeholder="admin@hutano.co.zw"
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm placeholder-gray-500" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-2xl px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
          </div>
          <button type="submit" disabled={loading || !email || !password}
            className="w-full py-3.5 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <div className="text-center">
            <a href="/forgot-password" className="text-xs text-gray-400 hover:text-gray-200 underline underline-offset-2">
              Forgot password?
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-gray-900" />}><AdminLoginContent /></Suspense>;
}
