"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { Button } from "@zambuko/ui";
import { toast } from "sonner";

export default function DoctorLoginPage() {
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
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="Hutano Telehealth" className="h-14 w-auto mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Doctor Portal</p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-lg p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="doctor@hutano.co.zw"
                required
                autoFocus
                autoComplete="email"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
              />
            </div>

            <Button type="submit" className="w-full" size="lg" loading={loading} disabled={!email || !password}>
              Sign In
            </Button>

            <div className="text-center">
              <a href="/forgot-password" className="text-xs text-orange-500 hover:text-orange-600 underline underline-offset-2">
                Forgot password?
              </a>
            </div>
          </form>
        </div>

        <p className="text-center text-xs text-gray-500 mt-6">
          This portal is only for verified Hutano doctors.<br />
          Contact <a href="mailto:support@hutano.co.zw" className="text-orange-500 underline">support@hutano.co.zw</a> to register.
        </p>
      </div>
    </div>
  );
}
