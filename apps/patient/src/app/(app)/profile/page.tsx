"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { Card, CardBody, Button } from "@zambuko/ui";
import { toast } from "sonner";
import { format } from "date-fns";

type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";

const BLOOD_TYPES: BloodType[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];

const COMMON_CONDITIONS = [
  "Diabetes", "Hypertension", "Asthma", "HIV/AIDS", "Heart Disease",
  "Kidney Disease", "Sickle Cell Disease", "Tuberculosis", "Epilepsy", "Arthritis",
];
const COMMON_ALLERGIES = [
  "Penicillin", "Aspirin", "Sulfa Drugs", "Ibuprofen", "Latex",
  "Peanuts", "Shellfish", "Bee Stings",
];

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const qc = useQueryClient();
  const [editSection, setEditSection] = useState<"personal" | "medical" | "emergency" | "password" | null>(null);
  const [pwForm, setPwForm] = useState({ newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);

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
      setEditSection(null);
    } catch (err: any) {
      toast.error(err.message ?? "Failed to change password.");
    } finally {
      setPwSaving(false);
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const [profileRes, patientRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("patients").select("*").eq("id", user.id).single(),
      ]);
      return { profile: profileRes.data, patient: patientRes.data, user };
    },
  });

  const [form, setForm] = useState({
    full_name: "",
    date_of_birth: "",
    gender: "",
    city: "",
    province: "",
    blood_type: "" as BloodType | "",
    allergies: [] as string[],
    chronic_conditions: [] as string[],
    emergency_contact_name: "",
    emergency_contact_phone: "",
    emergency_contact_relation: "",
    low_bandwidth_mode: false,
  });

  // Populate form once data loads
  useEffect(() => {
    if (!data) return;
    setForm({
      full_name: data.profile?.full_name ?? "",
      date_of_birth: data.profile?.date_of_birth ?? "",
      gender: data.profile?.gender ?? "",
      city: data.profile?.city ?? "",
      province: data.profile?.province ?? "",
      blood_type: (data.patient?.blood_type ?? "") as BloodType | "",
      allergies: data.patient?.allergies ?? [],
      chronic_conditions: data.patient?.chronic_conditions ?? [],
      emergency_contact_name: data.patient?.emergency_contact_name ?? "",
      emergency_contact_phone: data.patient?.emergency_contact_phone ?? "",
      emergency_contact_relation: data.patient?.emergency_contact_relation ?? "",
      low_bandwidth_mode: data.profile?.low_bandwidth_mode ?? false,
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await Promise.all([
        supabase.from("profiles").update({
          full_name: form.full_name,
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          city: form.city,
          province: form.province,
          low_bandwidth_mode: form.low_bandwidth_mode,
        }).eq("id", user.id),
        supabase.from("patients").update({
          blood_type: form.blood_type || null,
          allergies: form.allergies,
          chronic_conditions: form.chronic_conditions,
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_phone: form.emergency_contact_phone,
          emergency_contact_relation: form.emergency_contact_relation,
        }).eq("id", user.id),
      ]);
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      setEditSection(null);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Could not save changes. Please retry."),
  });

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggleItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter(a => a !== item) : [...arr, item]);
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-4 space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl p-4 animate-pulse h-28" />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <h1 className="font-bold text-gray-900">My Profile</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto pb-safe">
        {/* Avatar + name */}
        <div className="bg-white rounded-2xl p-4 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-100 flex items-center justify-center text-2xl font-bold text-brand-600">
            {data?.profile?.full_name?.charAt(0) ?? "?"}
          </div>
          <div>
            <p className="font-bold text-gray-900 text-lg">{data?.profile?.full_name ?? "—"}</p>
            <p className="text-sm text-gray-500">{data?.user?.phone ?? data?.user?.email ?? "No contact"}</p>
            <p className="text-xs text-brand-600 font-medium mt-0.5 capitalize">{data?.profile?.role ?? "patient"}</p>
          </div>
        </div>

        {/* Personal Info */}
        <SectionCard title="Personal Information" onEdit={() => setEditSection("personal")} isEditing={editSection === "personal"}>
          {editSection === "personal" ? (
            <div className="space-y-3">
              <LabeledInput label="Full Name" value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} />
              <LabeledInput label="Date of Birth" type="date" value={form.date_of_birth} onChange={(v) => setForm(f => ({ ...f, date_of_birth: v }))} />
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Gender</label>
                <div className="flex gap-2">
                  {["male", "female", "other"].map((g) => (
                    <button key={g} onClick={() => setForm(f => ({ ...f, gender: g }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition-all ${form.gender === g ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <LabeledInput label="City" value={form.city} onChange={(v) => setForm(f => ({ ...f, city: v }))} placeholder="e.g. Harare" />
              <LabeledInput label="Province" value={form.province} onChange={(v) => setForm(f => ({ ...f, province: v }))} placeholder="e.g. Mashonaland East" />
              <SaveButtons loading={saveMutation.isPending} onSave={() => saveMutation.mutate()} onCancel={() => setEditSection(null)} />
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <InfoRow label="Date of Birth" value={data?.profile?.date_of_birth ? format(new Date(data.profile.date_of_birth), "d MMM yyyy") : "—"} />
              <InfoRow label="Gender" value={data?.profile?.gender ?? "—"} capitalize />
              <InfoRow label="City" value={data?.profile?.city ?? "—"} />
              <InfoRow label="Province" value={data?.profile?.province ?? "—"} />
            </dl>
          )}
        </SectionCard>

        {/* Medical */}
        <SectionCard title="Medical History" onEdit={() => setEditSection("medical")} isEditing={editSection === "medical"}>
          {editSection === "medical" ? (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-2">Blood Type</label>
                <div className="flex flex-wrap gap-2">
                  {BLOOD_TYPES.map((bt) => (
                    <button key={bt} onClick={() => setForm(f => ({ ...f, blood_type: bt }))}
                      className={`px-3 py-1.5 rounded-full text-sm font-semibold border transition-all ${form.blood_type === bt ? "bg-red-600 text-white border-red-600" : "bg-white text-gray-700 border-gray-200"}`}>
                      {bt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-2">Chronic Conditions</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_CONDITIONS.map((c) => (
                    <button key={c} onClick={() => toggleItem(form.chronic_conditions, c, (v) => setForm(f => ({ ...f, chronic_conditions: v })))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${form.chronic_conditions.includes(c) ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-200"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-2">Allergies</label>
                <div className="flex flex-wrap gap-2">
                  {COMMON_ALLERGIES.map((a) => (
                    <button key={a} onClick={() => toggleItem(form.allergies, a, (v) => setForm(f => ({ ...f, allergies: v })))}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${form.allergies.includes(a) ? "bg-red-500 text-white border-red-500" : "bg-white text-gray-700 border-gray-200"}`}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>
              <SaveButtons loading={saveMutation.isPending} onSave={() => saveMutation.mutate()} onCancel={() => setEditSection(null)} />
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <InfoRow label="Blood Type" value={data?.patient?.blood_type ?? "—"} />
              <InfoRow label="Conditions" value={data?.patient?.chronic_conditions?.join(", ") || "None listed"} />
              <InfoRow label="Allergies" value={data?.patient?.allergies?.join(", ") || "None listed"} />
            </dl>
          )}
        </SectionCard>

        {/* Emergency Contact */}
        <SectionCard title="Emergency Contact" onEdit={() => setEditSection("emergency")} isEditing={editSection === "emergency"}>
          {editSection === "emergency" ? (
            <div className="space-y-3">
              <LabeledInput label="Name" value={form.emergency_contact_name} onChange={(v) => setForm(f => ({ ...f, emergency_contact_name: v }))} placeholder="Full name" />
              <LabeledInput label="Phone Number" type="tel" value={form.emergency_contact_phone} onChange={(v) => setForm(f => ({ ...f, emergency_contact_phone: v }))} placeholder="+263 7X XXX XXXX" />
              <LabeledInput label="Relationship" value={form.emergency_contact_relation} onChange={(v) => setForm(f => ({ ...f, emergency_contact_relation: v }))} placeholder="e.g. Spouse, Parent, Sibling" />
              <SaveButtons loading={saveMutation.isPending} onSave={() => saveMutation.mutate()} onCancel={() => setEditSection(null)} />
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <InfoRow label="Name" value={data?.patient?.emergency_contact_name ?? "—"} />
              <InfoRow label="Phone" value={data?.patient?.emergency_contact_phone ?? "—"} />
              <InfoRow label="Relationship" value={data?.patient?.emergency_contact_relation ?? "—"} />
            </dl>
          )}
        </SectionCard>

        {/* Settings */}
        <Card>
          <CardBody className="space-y-3">
            <h3 className="font-bold text-gray-900">Settings</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Low Bandwidth Mode</p>
                <p className="text-xs text-gray-500">Reduces data usage for slow connections</p>
              </div>
              <button onClick={async () => {
                const newVal = !form.low_bandwidth_mode;
                setForm(f => ({ ...f, low_bandwidth_mode: newVal }));
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  await supabase.from("profiles").update({ low_bandwidth_mode: newVal }).eq("id", user.id);
                }
              }} className={`relative w-11 h-6 rounded-full transition-colors ${form.low_bandwidth_mode ? "bg-brand-600" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.low_bandwidth_mode ? "translate-x-5.5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Change Password */}
        <SectionCard title="Change Password" onEdit={() => setEditSection("password")} isEditing={editSection === "password"}>
          {editSection === "password" ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <LabeledInput label="New Password" type="password" value={pwForm.newPassword} onChange={(v) => setPwForm(f => ({ ...f, newPassword: v }))} placeholder="8+ characters" />
              <LabeledInput label="Confirm Password" type="password" value={pwForm.confirm} onChange={(v) => setPwForm(f => ({ ...f, confirm: v }))} placeholder="Repeat new password" />
              <SaveButtons loading={pwSaving} onSave={() => handleChangePassword({ preventDefault: () => {} } as any)} onCancel={() => { setEditSection(null); setPwForm({ newPassword: "", confirm: "" }); }} />
            </form>
          ) : (
            <p className="text-sm text-gray-500">••••••••</p>
          )}
        </SectionCard>

        {/* Sign out */}
        <button onClick={signOut}
          className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors">
          Sign Out
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">Hutano v1.0.0 · University of Zimbabwe</p>
      </div>
    </div>
  );
}

function SectionCard({ title, onEdit, isEditing, children }: {
  title: string; onEdit: () => void; isEditing: boolean; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">{title}</h3>
          {!isEditing && (
            <button onClick={onEdit} className="text-xs font-semibold text-brand-600 hover:underline">Edit</button>
          )}
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

function InfoRow({ label, value, capitalize }: { label: string; value: string; capitalize?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium text-gray-900 text-right ${capitalize ? "capitalize" : ""}`}>{value}</span>
    </div>
  );
}

function LabeledInput({ label, value, onChange, type = "text", placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
    </div>
  );
}

function SaveButtons({ loading, onSave, onCancel }: { loading: boolean; onSave: () => void; onCancel: () => void; }) {
  return (
    <div className="flex gap-2 pt-1">
      <Button variant="ghost" size="sm" onClick={onCancel} disabled={loading} className="flex-1">Cancel</Button>
      <Button size="sm" loading={loading} onClick={onSave} className="flex-1">Save</Button>
    </div>
  );
}
