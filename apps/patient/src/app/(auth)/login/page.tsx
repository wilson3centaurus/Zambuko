"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { Button } from "@zambuko/ui";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-brand-700 to-brand-900 px-6 py-12">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur mb-4">
          <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-white">Hutano</h1>
        <p className="mt-1 text-brand-200">Telehealth for Zimbabwe</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Sign in</h2>
        <p className="text-sm text-gray-500 mb-6">Enter your email and password to continue.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              autoFocus
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!email || !password}>
            Sign In
          </Button>

          <div className="text-center">
            <a href="/forgot-password" className="text-sm text-brand-600 hover:underline">
              Forgot password?
            </a>
          </div>
        </form>

        <p className="mt-5 text-sm text-center text-gray-500">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-brand-600 font-semibold hover:underline">
            Create account
          </a>
        </p>

        <p className="mt-3 text-xs text-center text-gray-400">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>

      <p className="mt-6 text-brand-200 text-sm">
        Are you a doctor?{" "}
        <a
          href={process.env.NEXT_PUBLIC_DOCTOR_APP_URL}
          className="text-white font-semibold underline underline-offset-2"
        >
          Sign in to Doctor App
        </a>
      </p>
    </div>
  );
}
