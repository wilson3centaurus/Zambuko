"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { Button } from "@zambuko/ui";
import { toast } from "sonner";

function VerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const phone = params.get("phone") ?? "";
  const supabase = createClient();

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleChange(index: number, value: string) {
    if (!/^\d?$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();

    // Auto-submit when all 6 digits entered
    if (value && newOtp.every((d) => d !== "") && newOtp.join("").length === 6) {
      verifyOtp(newOtp.join(""));
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  async function verifyOtp(token: string) {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone,
        token,
        type: "sms",
      });
      if (error) throw error;
      toast.success("Signed in successfully!");
      router.push("/dashboard");
    } catch (err: unknown) {
      toast.error("Invalid code. Please try again.");
      setOtp(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  async function resendOtp() {
    if (resendCooldown > 0) return;
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone, options: { channel: "sms" } });
      if (error) throw error;
      toast.success("New code sent!");
      setResendCooldown(60);
    } catch {
      toast.error("Could not resend code.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <div className="w-16 h-16 bg-sky-600 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h1 className="text-xl font-black text-white">Enter your code</h1>
          <p className="text-slate-400 text-sm mt-1">
            Sent to <span className="font-semibold text-white">{phone}</span>
          </p>
        </div>

        <div className="flex justify-center gap-2.5">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              className="w-11 h-14 bg-slate-800 border border-slate-700 rounded-xl text-center text-white text-xl font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 transition-all"
            />
          ))}
        </div>

        <Button
          className="w-full"
          size="lg"
          loading={loading}
          disabled={otp.join("").length < 6}
          onClick={() => verifyOtp(otp.join(""))}
        >
          Verify Code
        </Button>

        <button
          onClick={resendOtp}
          disabled={resendCooldown > 0}
          className="text-sm text-slate-400 hover:text-sky-400 disabled:text-slate-600 disabled:cursor-not-allowed transition-colors"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900" />}>
      <VerifyContent />
    </Suspense>
  );
}
