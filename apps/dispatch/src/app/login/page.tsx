"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { toast } from "sonner";

export default function DispatchLoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🚑</span>
          </div>
          <h1 className="text-2xl font-black text-white">Dispatcher Login</h1>
          <p className="text-slate-400 text-sm mt-1">Hutano Emergency Services</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dispatch@hutano.co.zw"
              required
              autoFocus
              autoComplete="email"
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide block mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>

          <div className="text-center">
            <a href="/forgot-password" className="text-xs text-slate-400 hover:text-slate-300 underline underline-offset-2">
              Forgot password?
            </a>
          </div>
        </form>

        <p className="text-center text-xs text-slate-500">
          Contact <a href="mailto:support@hutano.co.zw" className="text-red-400 underline">support@hutano.co.zw</a> to register.
        </p>
      </div>
    </div>
  );
}
