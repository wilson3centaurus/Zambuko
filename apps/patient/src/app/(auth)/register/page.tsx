"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { Button } from "@zambuko/ui";
import { toast } from "sonner";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    confirm_password: "",
  });

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (form.password !== form.confirm_password) {
      toast.error("Passwords do not match.");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // Use server route so the account is confirmed immediately (no verification email)
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: form.password, full_name: form.full_name }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Registration failed.");
        return;
      }

      // Sign in immediately after account is created
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      });
      if (signInError) {
        toast.error("Account created but sign-in failed. Please go to login.");
        router.push("/login");
        return;
      }

      toast.success("Account created! Welcome to Hutano.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
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
        <h2 className="text-xl font-bold text-gray-900 mb-1">Create account</h2>
        <p className="text-sm text-gray-500 mb-6">Register to access telehealth services.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
            <input
              id="full_name"
              type="text"
              value={form.full_name}
              onChange={set("full_name")}
              autoFocus
              required
              placeholder="Chiedza Moyo"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input
              id="email"
              type="email"
              value={form.email}
              onChange={set("email")}
              autoComplete="email"
              required
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
            <input
              id="password"
              type="password"
              value={form.password}
              onChange={set("password")}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          <div>
            <label htmlFor="confirm_password" className="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password</label>
            <input
              id="confirm_password"
              type="password"
              value={form.confirm_password}
              onChange={set("confirm_password")}
              autoComplete="new-password"
              required
              placeholder="Re-enter password"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent text-gray-900 placeholder-gray-400 transition"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            loading={loading}
            disabled={!form.full_name || !form.email || !form.password || !form.confirm_password}
          >
            Create Account
          </Button>
        </form>

        <p className="mt-5 text-sm text-center text-gray-500">
          Already have an account?{" "}
          <a href="/login" className="text-brand-600 font-semibold hover:underline">
            Sign in
          </a>
        </p>

        <p className="mt-3 text-xs text-center text-gray-400">
          By registering, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
