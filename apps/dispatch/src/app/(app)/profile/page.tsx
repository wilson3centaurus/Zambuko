"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { toast } from "sonner";

type ProfileData = {
  profile: { full_name?: string; phone?: string; city?: string } | null;
  dispatcher: Record<string, unknown> | null;
  email: string | undefined;
};

export default function DispatchProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const qc = useQueryClient();

  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", city: "" });
  const [pwForm, setPwForm] = useState({ newPassword: "", confirm: "" });

  const { data } = useQuery<ProfileData>({
    queryKey: ["dispatch-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const { data: dispatcher } = await supabase.from("dispatchers").select("*").eq("id", user.id).single();
      return { profile, dispatcher, email: user.email };
    },
  });

  useEffect(() => {
    if (!data) return;
    setForm({
      full_name: data.profile?.full_name ?? "",
      phone: data.profile?.phone ?? "",
      city: data.profile?.city ?? "",
    });
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();
      const { error } = await supabase.from("profiles").update({
        full_name: form.full_name,
        phone: form.phone,
        city: form.city,
      }).eq("id", user.id);
      if (error) throw error;
      toast.success("Profile updated!");
      qc.invalidateQueries({ queryKey: ["dispatch-profile"] });
    } catch {
      toast.error("Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (pwForm.newPassword !== pwForm.confirm) { toast.error("Passwords don't match."); return; }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword });
      if (error) throw error;
      toast.success("Password changed!");
      setPwForm({ newPassword: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-8 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-red-600 flex items-center justify-center text-xl font-black text-white">
            {form.full_name.charAt(0) || "D"}
          </div>
          <div>
            <h1 className="text-white font-bold text-lg">{form.full_name || "Dispatcher"}</h1>
            <p className="text-slate-400 text-sm">{data?.email}</p>
            <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full mt-1 inline-block">Dispatcher</span>
          </div>
        </div>
      </div>

      {/* Profile form */}
      <form onSubmit={handleSave} className="px-4 py-5 space-y-5">
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Info</h2>
          <div className="bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-800">
            {[
              { label: "Full Name", key: "full_name" as const, type: "text", placeholder: "Your name" },
              { label: "Phone", key: "phone" as const, type: "tel", placeholder: "+263771000000" },
              { label: "City", key: "city" as const, type: "text", placeholder: "Harare" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex items-center px-4 py-3 gap-3">
                <label className="text-slate-400 text-sm w-28 shrink-0">{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none text-right"
                />
              </div>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3.5 rounded-2xl bg-red-600 text-white font-semibold text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="px-4 space-y-5">
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Change Password</h2>
          <div className="bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-800">
            {[
              { label: "New Password", key: "newPassword" as const, placeholder: "8+ characters" },
              { label: "Confirm", key: "confirm" as const, placeholder: "Repeat password" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex items-center px-4 py-3 gap-3">
                <label className="text-slate-400 text-sm w-28 shrink-0">{label}</label>
                <input
                  type="password"
                  value={pwForm[key]}
                  onChange={(e) => setPwForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none text-right"
                />
              </div>
            ))}
          </div>
        </section>

        <button
          type="submit"
          disabled={pwSaving}
          className="w-full py-3.5 rounded-2xl bg-slate-700 text-white font-semibold text-sm hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          {pwSaving ? "Updating…" : "Update Password"}
        </button>
      </form>

      <div className="px-4 pt-6">
        <button
          onClick={signOut}
          className="w-full py-3.5 rounded-2xl border border-red-800 text-red-400 font-semibold text-sm hover:bg-red-900/20 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}
