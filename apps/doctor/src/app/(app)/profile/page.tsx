"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { Button } from "@zambuko/ui";
import { toast } from "sonner";

const SPECIALTIES = [
  { value: "general_practice", label: "General Practice" },
  { value: "pediatrics", label: "Pediatrics" },
  { value: "emergency_medicine", label: "Emergency Medicine" },
  { value: "obstetrics", label: "Obstetrics & Gynaecology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "surgery", label: "Surgery" },
  { value: "psychiatry", label: "Psychiatry" },
  { value: "dermatology", label: "Dermatology" },
];

export default function DoctorProfilePage() {
  const supabase = createClient();
  const router = useRouter();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwForm, setPwForm] = useState({ newPassword: "", confirm: "" });

  const { data, isLoading } = useQuery({
    queryKey: ["doctor-profile-edit"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      const { data: doctor } = await supabase.from("doctors").select("*").eq("id", user.id).single();
      return { profile, doctor, email: user.email };
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    city: "",
    province: "",
    bio: "",
    specialty: "",
    years_experience: "",
    consultation_fee_usd: "",
    hospital_affiliation: "",
    emergency_capable: false,
  });

  // Populate form once data loads
  useEffect(() => {
    if (!data || form.full_name !== "") return;
    setForm({
      full_name: data.profile?.full_name ?? "",
      phone: data.profile?.phone ?? "",
      city: data.profile?.city ?? "",
      province: data.profile?.province ?? "",
      bio: data.doctor?.bio ?? "",
      specialty: data.doctor?.specialty ?? "",
      years_experience: String(data.doctor?.years_experience ?? ""),
      consultation_fee_usd: String(data.doctor?.consultation_fee_usd ?? ""),
      hospital_affiliation: data.doctor?.hospital_affiliation ?? "",
      emergency_capable: data.doctor?.emergency_capable ?? false,
    });
  }, [data]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error();

      const [profileRes, doctorRes] = await Promise.all([
        supabase.from("profiles").update({
          full_name: form.full_name,
          phone: form.phone,
          city: form.city,
          province: form.province,
        }).eq("id", user.id),
        supabase.from("doctors").update({
          bio: form.bio,
          specialty: form.specialty,
          years_experience: parseInt(form.years_experience) || 0,
          consultation_fee_usd: parseFloat(form.consultation_fee_usd) || 0,
          hospital_affiliation: form.hospital_affiliation,
          emergency_capable: form.emergency_capable,
        }).eq("id", user.id),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (doctorRes.error) throw doctorRes.error;

      toast.success("Profile updated!");
      qc.invalidateQueries({ queryKey: ["doctor-profile"] });
    } catch {
      toast.error("Failed to save. Please try again.");
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
      toast.success("Password changed successfully!");
      setPwForm({ newPassword: "", confirm: "" });
    } catch (err: any) {
      toast.error(err.message ?? "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-slate-950"><p className="text-slate-400">Loading…</p></div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 px-5 pt-12 pb-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-sky-600 flex items-center justify-center text-2xl font-black text-white">
            {form.full_name.charAt(0) || "D"}
          </div>
          <div>
            <h1 className="text-white font-black text-lg">{form.full_name || "Your Profile"}</h1>
            <p className="text-slate-400 text-sm">{data?.email}</p>
            {data?.doctor?.license_verified ? (
              <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full">✓ Verified</span>
            ) : (
              <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full">⏳ Pending verification</span>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="px-4 py-5 space-y-5">
        {/* Personal Info */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Personal Info</h2>
          <div className="bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-800">
            {[
              { label: "Full Name", key: "full_name", type: "text", placeholder: "Dr. Your Name" },
              { label: "Phone", key: "phone", type: "tel", placeholder: "+263771000000" },
              { label: "City", key: "city", type: "text", placeholder: "Harare" },
              { label: "Province", key: "province", type: "text", placeholder: "Harare" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex items-center px-4 py-3 gap-3">
                <label className="text-slate-400 text-sm w-28 shrink-0">{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none text-right"
                />
              </div>
            ))}
          </div>
        </section>

        {/* Professional Info */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Professional Info</h2>
          <div className="bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-800">
            <div className="flex items-center px-4 py-3 gap-3">
              <label className="text-slate-400 text-sm w-28 shrink-0">Specialty</label>
              <select
                value={form.specialty}
                onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))}
                className="flex-1 bg-transparent text-white text-sm focus:outline-none text-right appearance-none"
              >
                {SPECIALTIES.map((s) => (
                  <option key={s.value} value={s.value} className="bg-slate-900">{s.label}</option>
                ))}
              </select>
            </div>
            {[
              { label: "Experience (yrs)", key: "years_experience", type: "number", placeholder: "5" },
              { label: "Fee (USD)", key: "consultation_fee_usd", type: "number", placeholder: "5.00" },
              { label: "Hospital", key: "hospital_affiliation", type: "text", placeholder: "Avenues Clinic" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} className="flex items-center px-4 py-3 gap-3">
                <label className="text-slate-400 text-sm w-28 shrink-0">{label}</label>
                <input
                  type={type}
                  value={(form as any)[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="flex-1 bg-transparent text-white text-sm placeholder-slate-600 focus:outline-none text-right"
                />
              </div>
            ))}
            <div className="flex items-center justify-between px-4 py-3">
              <label className="text-slate-400 text-sm">Emergency Capable</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, emergency_capable: !f.emergency_capable }))}
                className={`w-12 h-6 rounded-full transition-colors relative ${form.emergency_capable ? "bg-sky-500" : "bg-slate-700"}`}
              >
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${form.emergency_capable ? "left-7" : "left-1"}`} />
              </button>
            </div>
          </div>
        </section>

        {/* Bio */}
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Bio</h2>
          <textarea
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            rows={4}
            placeholder="Tell patients about your experience and approach…"
            className="w-full bg-slate-900 text-white rounded-2xl px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
          />
        </section>

        <Button type="submit" className="w-full" size="lg" loading={saving}>
          Save Changes
        </Button>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3 text-red-400 text-sm font-semibold hover:text-red-300 transition-colors"
        >
          Sign Out
        </button>
      </form>

      {/* Change Password */}
      <form onSubmit={handleChangePassword} className="px-4 py-5 space-y-4">
        <section>
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Change Password</h2>
          <div className="bg-slate-900 rounded-2xl overflow-hidden divide-y divide-slate-800">
            {[
              { label: "New Password", key: "newPassword" as const, placeholder: "8+ characters" },
              { label: "Confirm Password", key: "confirm" as const, placeholder: "Repeat password" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="flex items-center px-4 py-3 gap-3">
                <label className="text-slate-400 text-sm w-32 shrink-0">{label}</label>
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
        <Button type="submit" className="w-full" size="lg" loading={pwSaving} variant="secondary">
          Update Password
        </Button>
      </form>
    </div>
  );
}
