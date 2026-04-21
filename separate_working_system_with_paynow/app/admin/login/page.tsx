'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, AlertCircle, Mail, Lock, Loader2 } from 'lucide-react';
import { RoboKordaLogo } from '@/components/RoboKordaLogo';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const json = await res.json();
      if (json.success) {
        router.push('/admin/dashboard');
      } else {
        setError(json.error || 'Login failed');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
      {/* Background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-blue-700/10 blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 rounded-full bg-violet-700/10 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <RoboKordaLogo size={76} />
          <h1 className="text-2xl font-black text-white mt-5 tracking-tight">Sign in to Connect</h1>
          <p className="text-sm text-gray-500 mt-1">RoboKorda Africa Management System</p>
        </div>

        {/* Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <form onSubmit={handleLogin} className="p-8 flex flex-col gap-5">

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-400">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@robokorda.co.zw"
                  className="w-full h-12 rounded-xl bg-gray-800 border border-gray-700 pl-10 pr-4 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-400">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 rounded-xl bg-gray-800 border border-gray-700 pl-10 pr-11 text-white text-sm placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300 transition"
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-400 bg-red-900/30 px-4 py-3 rounded-xl border border-red-800/60">
                <AlertCircle size={15} className="flex-shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-1"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                'Sign in →'
              )}
            </button>
          </form>

          <div className="px-8 pb-6 text-center">
            <p className="text-xs text-gray-700">
              Forgot your password? Contact your administrator.
            </p>
          </div>
        </div>

        <p className="text-xs text-gray-800 text-center mt-6">
          Contact your administrator if you need access or help.
        </p>
      </div>
    </div>
  );
}
