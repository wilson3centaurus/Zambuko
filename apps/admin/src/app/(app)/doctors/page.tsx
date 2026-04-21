"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { toast } from "sonner";
import { format } from "date-fns";

// -- Zimbabwe reference data --
const ZIM_CITIES = [
  "Harare", "Bulawayo", "Chitungwiza", "Mutare", "Gweru", "Kwekwe",
  "Kadoma", "Masvingo", "Chinhoyi", "Norton", "Marondera", "Bindura",
  "Zvishavane", "Chegutu", "Redcliff", "Victoria Falls", "Kariba",
  "Hwange", "Beitbridge", "Plumtree", "Rusape",
];

const ZIM_PROVINCES = [
  "Harare", "Bulawayo", "Manicaland", "Mashonaland Central",
  "Mashonaland East", "Mashonaland West", "Masvingo",
  "Matabeleland North", "Matabeleland South", "Midlands",
];

const ZIM_HOSPITALS = [
  "Parirenyatwa Group of Hospitals", "Harare Central Hospital",
  "Chitungwiza Central Hospital", "Sally Mugabe Children's Hospital",
  "Avenues Clinic", "Westend Hospital", "St Anne's Hospital", "Trauma Centre",
  "Mpilo Central Hospital", "United Bulawayo Hospitals", "Mater Dei Hospital",
  "Mutare Provincial Hospital", "Gweru Provincial Hospital",
  "Masvingo Provincial Hospital", "Chinhoyi Provincial Hospital",
  "Bindura Provincial Hospital", "Marondera Provincial Hospital",
  "Victoria Falls Hospital", "Kariba District Hospital", "MARS Zimbabwe", "Other",
];

const SPECIALTIES = [
  { value: "general_practice", label: "General Practice" },
  { value: "pediatrics", label: "Paediatrics" },
  { value: "emergency_medicine", label: "Emergency Medicine" },
  { value: "obstetrics", label: "Obstetrics & Gynaecology" },
  { value: "cardiology", label: "Cardiology" },
  { value: "surgery", label: "General Surgery" },
  { value: "psychiatry", label: "Psychiatry" },
  { value: "dermatology", label: "Dermatology" },
  { value: "orthopedics", label: "Orthopaedics" },
  { value: "ophthalmology", label: "Ophthalmology" },
  { value: "ent", label: "ENT" },
  { value: "dentistry", label: "Dentistry" },
  { value: "neurology", label: "Neurology" },
  { value: "internal_medicine", label: "Internal Medicine" },
];

// -- Helpers --
function idToPassword(id: string) { return id.replace(/[-\s]/g, "").toLowerCase(); }

const INPUT = "w-full rounded-lg border border-gray-700 bg-gray-700/60 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const SELECT = "w-full rounded-lg border border-gray-700 bg-gray-700/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const LABEL = "block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1";

// SVG micro-icons
const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const StarIcon = () => (
  <svg className="w-3.5 h-3.5 text-amber-400 fill-amber-400" viewBox="0 0 20 20">
    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.176 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.063 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69l1.286-3.957z" />
  </svg>
);

const KeyIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const HospitalIcon = () => (
  <svg className="w-5 h-5 text-brand-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M3 21h18M9 8h1M9 12h1M9 16h1M14 8h1M14 12h1M14 16h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// -- Add Doctor Modal --
function AddDoctorModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", national_id: "",
    email: "", phone: "",
    specialty: "general_practice", medical_license_number: "",
    consultation_fee_usd: "5", city: "", province: "",
    hospital_affiliation: "", emergency_capable: false,
  });

  const autoPassword = idToPassword(form.national_id);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: (e.target as HTMLInputElement).type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.national_id.trim()) { toast.error("National ID is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: autoPassword, role: "doctor", full_name: form.full_name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create user");
      const userId: string = json.userId;

      await Promise.all([
        supabase.from("profiles").update({ city: form.city, province: form.province, phone: form.phone }).eq("id", userId),
        supabase.from("doctors").update({
          specialty: form.specialty,
          medical_license_number: form.medical_license_number,
          consultation_fee_usd: parseFloat(form.consultation_fee_usd) || 5,
          hospital_affiliation: form.hospital_affiliation,
          emergency_capable: form.emergency_capable,
        }).eq("id", userId),
      ]);

      toast.success(`Dr. ${form.full_name} account created!`);
      qc.invalidateQueries({ queryKey: ["admin-doctors"] });
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-gray-700">
          <HospitalIcon />
          <div className="flex-1">
            <h2 className="text-white font-bold text-lg leading-tight">Add New Doctor</h2>
            <p className="text-gray-400 text-xs mt-0.5">Login credentials are auto-generated from the National ID</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Full Name */}
          <div>
            <label className={LABEL}>Full Name *</label>
            <input type="text" required placeholder="Dr. Tendai Moyo" value={form.full_name} onChange={set("full_name")} className={INPUT} />
          </div>

          {/* DOB + National ID */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Date of Birth *</label>
              <input type="date" required value={form.date_of_birth} onChange={set("date_of_birth")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>National ID *</label>
              <input type="text" required placeholder="63-1234567-R-01" value={form.national_id} onChange={set("national_id")} className={INPUT} />
            </div>
          </div>

          {/* Credential Preview */}
          {(form.email || form.national_id) && (
            <div className="bg-gray-900/60 border border-gray-600/60 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-2.5">
                <KeyIcon />
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Auto-Generated Credentials Preview</p>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex items-center">
                  <span className="text-gray-500 w-24 flex-shrink-0">Username:</span>
                  <span className="text-brand-400 font-mono">{form.email || "-"}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 w-24 flex-shrink-0">Email:</span>
                  <span className="text-brand-400 font-mono">{form.email || "-"}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-gray-500 w-24 flex-shrink-0">Password:</span>
                  <span className="text-brand-400 font-mono">{autoPassword || "-"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Email */}
          <div>
            <label className={LABEL}>Email (used as username) *</label>
            <input type="email" required placeholder="tendai.moyo@example.com" value={form.email} onChange={set("email")} className={INPUT} />
          </div>

          {/* Phone */}
          <div>
            <label className={LABEL}>Phone</label>
            <input type="tel" placeholder="077 100 0000" value={form.phone} onChange={set("phone")} className={INPUT} />
          </div>

          {/* Specialty */}
          <div>
            <label className={LABEL}>Specialty *</label>
            <select value={form.specialty} onChange={set("specialty")} className={SELECT}>
              {SPECIALTIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          {/* City + Province */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>City</label>
              <select value={form.city} onChange={set("city")} className={SELECT}>
                <option value="">Select city...</option>
                {ZIM_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Province</label>
              <select value={form.province} onChange={set("province")} className={SELECT}>
                <option value="">Select province...</option>
                {ZIM_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          {/* Hospital */}
          <div>
            <label className={LABEL}>Hospital Affiliation</label>
            <select value={form.hospital_affiliation} onChange={set("hospital_affiliation")} className={SELECT}>
              <option value="">Select hospital (optional)...</option>
              {ZIM_HOSPITALS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          {/* License + Fee */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>License No. *</label>
              <input type="text" required placeholder="ZMC-12345" value={form.medical_license_number} onChange={set("medical_license_number")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Fee (USD)</label>
              <input type="number" min="0" step="0.5" value={form.consultation_fee_usd} onChange={set("consultation_fee_usd")} className={INPUT} />
            </div>
          </div>

          {/* Emergency Capable */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.emergency_capable}
              onChange={(e) => setForm((f) => ({ ...f, emergency_capable: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-gray-300 font-medium">Emergency Capable</span>
          </label>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 pb-6">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-600 text-sm font-semibold text-gray-400 hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? "Creating..." : "Create Account"}
          </button>
        </div>
      </form>
    </div>
  );
}

// -- Edit Doctor Modal --
function EditDoctorModal({ doc, onClose }: { doc: any; onClose: () => void }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [authSaving, setAuthSaving] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [form, setForm] = useState({
    full_name: doc.profiles?.full_name ?? "",
    phone: doc.profiles?.phone ?? "",
    city: doc.profiles?.city ?? "",
    province: doc.profiles?.province ?? "",
    specialty: doc.specialty ?? "general_practice",
    bio: doc.bio ?? "",
    medical_license_number: doc.medical_license_number ?? "",
    consultation_fee_usd: String(doc.consultation_fee_usd ?? "5"),
    hospital_affiliation: doc.hospital_affiliation ?? "",
    emergency_capable: doc.emergency_capable ?? false,
  });

  const { data: authUser } = useQuery({
    queryKey: ["admin-auth-user", doc.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/get-user?userId=${doc.id}`);
      if (!res.ok) return null;
      return res.json() as Promise<{ email: string | null; created_at: string | null; last_sign_in_at: string | null }>;
    },
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const [p, d] = await Promise.all([
        supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone, city: form.city, province: form.province }).eq("id", doc.id),
        supabase.from("doctors").update({
          specialty: form.specialty, bio: form.bio,
          medical_license_number: form.medical_license_number,
          consultation_fee_usd: parseFloat(form.consultation_fee_usd) || 5,
          hospital_affiliation: form.hospital_affiliation,
          emergency_capable: form.emergency_capable,
        }).eq("id", doc.id),
      ]);
      if (p.error) throw p.error;
      if (d.error) throw d.error;
      toast.success("Doctor updated!");
      qc.invalidateQueries({ queryKey: ["admin-doctors"] });
      onClose();
    } catch { toast.error("Update failed."); }
    finally { setSaving(false); }
  }

  async function handleAuthUpdate(field: "email" | "password") {
    const value = field === "email" ? newEmail.trim() : newPassword;
    if (!value) return;
    if (field === "password" && value.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    setAuthSaving(true);
    try {
      const res = await fetch("/api/admin/update-user", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: doc.id, [field]: value }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      toast.success(field === "email" ? "Email updated!" : "Password reset!");
      if (field === "email") setNewEmail(""); else setNewPassword("");
    } catch (err: any) { toast.error(err.message ?? "Update failed."); }
    finally { setAuthSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSave}
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-700">
          <h2 className="text-white font-bold text-lg">Edit Doctor</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { label: "Full Name", key: "full_name" as const, type: "text", placeholder: "Dr. Tendai Moyo" },
            { label: "Phone", key: "phone" as const, type: "tel", placeholder: "+263771000000" },
            { label: "License Number", key: "medical_license_number" as const, type: "text", placeholder: "ZMC-12345" },
            { label: "Fee (USD)", key: "consultation_fee_usd" as const, type: "number", placeholder: "5" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className={LABEL}>{label}</label>
              <input type={type} placeholder={placeholder} value={form[key] as string}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={INPUT} />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>City</label>
              <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={SELECT}>
                <option value="">Select city...</option>
                {ZIM_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL}>Province</label>
              <select value={form.province} onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))} className={SELECT}>
                <option value="">Select province...</option>
                {ZIM_PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className={LABEL}>Specialty</label>
            <select value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} className={SELECT}>
              {SPECIALTIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Hospital Affiliation</label>
            <select value={form.hospital_affiliation} onChange={(e) => setForm((f) => ({ ...f, hospital_affiliation: e.target.value }))} className={SELECT}>
              <option value="">None</option>
              {ZIM_HOSPITALS.map((h) => <option key={h} value={h}>{h}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Bio</label>
            <textarea value={form.bio} onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
              rows={3} placeholder="Doctor bio..."
              className="w-full rounded-lg border border-gray-700 bg-gray-700/60 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.emergency_capable}
              onChange={(e) => setForm((f) => ({ ...f, emergency_capable: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-brand-600 focus:ring-brand-500" />
            <span className="text-sm text-gray-300 font-medium">Emergency Capable</span>
          </label>

          {/* Auth section */}
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Account Credentials</p>
            <div className="rounded-xl bg-gray-700/40 border border-gray-600/50 px-3 py-2.5 flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Current email</p>
                <p className="text-sm font-mono text-gray-200">{authUser?.email ?? "-"}</p>
              </div>
              {authUser?.last_sign_in_at && (
                <span className="text-xs text-gray-500">Last login: {format(new Date(authUser.last_sign_in_at), "d MMM")}</span>
              )}
            </div>
            <div>
              <label className={LABEL}>Change Email</label>
              <div className="flex gap-2">
                <input type="email" placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={INPUT} />
                <button type="button" disabled={!newEmail || authSaving} onClick={() => handleAuthUpdate("email")}
                  className="px-3 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors shrink-0">
                  Update
                </button>
              </div>
            </div>
            <div>
              <label className={LABEL}>Reset Password</label>
              <div className="flex gap-2">
                <input type="password" placeholder="New password (8+ chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className={INPUT} />
                <button type="button" disabled={!newPassword || authSaving} onClick={() => handleAuthUpdate("password")}
                  className="px-3 rounded-lg bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-40 transition-colors shrink-0">
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-600 text-sm font-semibold text-gray-400 hover:bg-gray-700 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-50 transition-colors">
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// -- Page --
export default function DoctorsAdminPage() {
  const supabase = createClient();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "online">("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editDoc, setEditDoc] = useState<any | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const { data: doctors = [], isLoading } = useQuery({
    queryKey: ["admin-doctors", filter],
    queryFn: async () => {
      let q = supabase
        .from("doctors")
        .select("*, profiles!inner(full_name, phone, city, avatar_url, is_active, created_at)")
        .order("created_at", { referencedTable: "profiles", ascending: false });
      if (filter === "online") q = q.in("status", ["available", "in_session"]);
      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const suspendMutation = useMutation({
    mutationFn: async ({ profileId, suspend }: { profileId: string; suspend: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_active: !suspend }).eq("id", profileId);
      if (error) throw error;
    },
    onSuccess: (_, { suspend }) => {
      toast.success(suspend ? "Account suspended." : "Account restored.");
      qc.invalidateQueries({ queryKey: ["admin-doctors"] });
    },
    onError: () => toast.error("Update failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Delete failed");
    },
    onSuccess: () => {
      toast.success("Doctor deleted.");
      qc.invalidateQueries({ queryKey: ["admin-doctors"] });
      setConfirmDelete(null);
    },
    onError: (err: any) => toast.error(err.message ?? "Delete failed."),
  });

  const filtered = doctors.filter((d: any) => {
    if (!search) return true;
    const name = (d.profiles?.full_name ?? "").toLowerCase();
    return name.includes(search.toLowerCase()) || d.medical_license_number?.includes(search);
  });

  return (
    <div className="p-6 space-y-5">
      {showAdd && <AddDoctorModal onClose={() => setShowAdd(false)} />}
      {editDoc && <EditDoctorModal doc={editDoc} onClose={() => setEditDoc(null)} />}

      {/* Delete confirm */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-900/40 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-white">Delete Doctor?</h2>
            <p className="text-sm text-gray-400">
              Permanently delete <span className="font-semibold text-white">{confirmDelete.profiles?.full_name}</span> and all their data? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-600 text-sm font-semibold text-gray-400 hover:bg-gray-700 transition-colors">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(confirmDelete.id)} disabled={deleteMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors">
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Doctors</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage doctor accounts and profiles</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Add Doctor
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or license..."
            className="w-full pl-9 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
        </div>
        {(["all", "online"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${filter === f ? "bg-brand-600 text-white border-brand-600" : "bg-gray-800 text-gray-400 border-gray-700 hover:border-brand-500"}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1a1f35] rounded-2xl border border-blue-900/30 overflow-hidden ring-1 ring-blue-500/10">
        <table className="w-full">
          <thead className="bg-[#151929] border-b border-blue-900/30">
            <tr>
              {["#", "Doctor", "Specialty", "License", "Status", "Rating", "Fee", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-900/20">
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No doctors found.</td></tr>
            )}
            {filtered.map((doc: any, idx: number) => {
              const profile = doc.profiles;
              return (
                <tr key={doc.id} className="hover:bg-blue-900/10 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-brand-900/60 flex items-center justify-center font-bold text-brand-400 text-sm flex-shrink-0">
                        {profile?.full_name?.charAt(0) ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500">{profile?.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300 capitalize">{doc.specialty?.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-300">{doc.medical_license_number}</span>
                      {doc.license_verified ? (
                        <span className="inline-flex items-center gap-0.5 text-xs bg-green-900/50 text-green-400 px-1.5 py-0.5 rounded font-semibold border border-green-800">
                          <CheckIcon />
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-900/50 text-amber-400 px-1.5 py-0.5 rounded font-semibold border border-amber-800">Pending</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                      doc.status === "available" ? "bg-green-900/50 text-green-400" :
                      doc.status === "in_session" ? "bg-blue-900/50 text-blue-400" :
                      "bg-gray-700 text-gray-400"
                    }`}>{doc.status ?? "offline"}</span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <StarIcon />
                      <span className="text-gray-300">{doc.rating?.toFixed(1)}</span>
                      <span className="text-gray-600">({doc.rating_count})</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-white">${doc.consultation_fee_usd}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditDoc(doc)}
                        className="p-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button onClick={() => suspendMutation.mutate({ profileId: doc.id, suspend: profile?.is_active })}
                        disabled={suspendMutation.isPending}
                        className={`p-1.5 rounded-lg transition-colors ${profile?.is_active ? "bg-amber-900/40 text-amber-400 hover:bg-amber-900/70" : "bg-green-900/40 text-green-400 hover:bg-green-900/70"}`}
                        title={profile?.is_active ? "Suspend" : "Restore"}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" /><path d="M10 15V9M14 15V9" strokeLinecap="round" />
                        </svg>
                      </button>
                      <button onClick={() => setConfirmDelete(doc)}
                        className="p-1.5 rounded-lg bg-red-900/40 text-red-400 hover:bg-red-900/70 transition-colors" title="Delete">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500">{filtered.length} doctor{filtered.length !== 1 ? "s" : ""} shown</p>
    </div>
  );
}
