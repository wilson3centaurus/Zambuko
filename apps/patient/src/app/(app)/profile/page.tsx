"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { Card, CardBody, Button, PasswordInput, ImageUpload } from "@zambuko/ui";
import Link from "next/link";
import { toast } from "sonner";
import { format } from "date-fns";
import { getMissingSetupFields } from "@/lib/patient-setup";

type BloodType = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "unknown";
type EditableSection = "personal" | "medical" | "emergency" | "password";

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
  const supabase = useMemo(() => createClient(), []);
  const qc = useQueryClient();
  const [editSection, setEditSection] = useState<EditableSection | null>(null);
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentAcknowledged, setConsentAcknowledged] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const earliestDob = `${new Date().getFullYear() - 120}-01-01`;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword.length < 8) { toast.error("Password must be at least 8 characters."); return; }
    if (pwForm.newPassword !== pwForm.confirm) { toast.error("Passwords don't match."); return; }
    setPwSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) throw new Error("Your signed-in email could not be verified.");
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: pwForm.currentPassword,
      });
      if (reauthError) throw new Error("Your current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: pwForm.newPassword });
      if (error) throw error;
      toast.success("Password changed!");
      setPwForm({ currentPassword: "", newPassword: "", confirm: "" });
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
    phone: "",
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
    legal_full_name: "",
    national_id: "",
    national_id_document_path: "",
  });

  // Populate form once data loads
  useEffect(() => {
    if (!data) return;
    setForm({
      full_name: data.profile?.full_name ?? "",
      phone: data.profile?.phone ?? "",
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
      legal_full_name: data.patient?.legal_full_name ?? "",
      national_id: data.patient?.national_id ?? "",
      national_id_document_path: data.patient?.national_id_document_path ?? "",
    });
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (section: Exclude<EditableSection, "password">) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (section === "personal") {
        if (form.full_name.trim().length < 3) throw new Error("Full name is required.");
        const phoneDigits = form.phone.replace(/\D/g, "");
        if (phoneDigits.length < 7 || phoneDigits.length > 15) throw new Error("Enter a valid phone number.");
        if (!form.date_of_birth || form.date_of_birth > today || form.date_of_birth < earliestDob) throw new Error("Enter a valid date of birth.");
        if (!form.gender) throw new Error("Select your gender.");
        if (!form.city.trim()) throw new Error("City is required.");
        if (!form.province.trim()) throw new Error("Province is required.");
        const { error } = await supabase.from("profiles").update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          date_of_birth: form.date_of_birth || null,
          gender: form.gender || null,
          city: form.city.trim(),
          province: form.province.trim(),
          low_bandwidth_mode: form.low_bandwidth_mode,
        }).eq("id", user.id);
        if (error) throw error;
      }

      if (section === "medical") {
        const { error } = await supabase.from("patients").update({
          blood_type: form.blood_type || null,
          allergies: form.allergies,
          chronic_conditions: form.chronic_conditions,
        }).eq("id", user.id);
        if (error) throw error;
      }

      if (section === "emergency") {
        if (form.emergency_contact_name.trim().length < 3) throw new Error("Emergency contact name is required.");
        const phoneDigits = form.emergency_contact_phone.replace(/\D/g, "");
        if (phoneDigits.length < 7 || phoneDigits.length > 15) throw new Error("Enter a valid emergency contact phone number.");
        if (!form.emergency_contact_relation.trim()) throw new Error("Emergency contact relationship is required.");
        const { error } = await supabase.from("patients").update({
          emergency_contact_name: form.emergency_contact_name.trim(),
          emergency_contact_phone: form.emergency_contact_phone.trim(),
          emergency_contact_relation: form.emergency_contact_relation.trim(),
        }).eq("id", user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Profile updated!");
      setEditSection(null);
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["patient-setup-status"] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save changes. Please retry."),
  });

  async function uploadAvatar(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in again.");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/profile.${extension}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (uploadError) throw uploadError;
    const { data: publicUrl } = supabase.storage.from("avatars").getPublicUrl(path);
    const avatarUrl = `${publicUrl.publicUrl}?v=${Date.now()}`;
    const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
    if (error) throw error;
    toast.success("Profile photo updated everywhere.");
    qc.invalidateQueries({ queryKey: ["profile"] });
    qc.invalidateQueries({ queryKey: ["patient-setup-status"] });
  }

  async function uploadIdentityDocument(file: File) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Please sign in again.");
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${user.id}/national-id.${extension}`;
    const { error } = await supabase.storage.from("identity-documents").upload(path, file, {
      upsert: true,
      contentType: file.type,
    });
    if (error) throw error;
    setForm((current) => ({ ...current, national_id_document_path: path }));
    toast.success("ID image uploaded privately.");
  }

  async function recordConsent() {
    if (form.legal_full_name.trim().length < 3) {
      toast.error("Enter your full legal name as shown on your identity document.");
      return;
    }
    if (!/^[A-Za-z0-9 ./-]{5,30}$/.test(form.national_id.trim())) {
      toast.error("Enter a valid national ID number.");
      return;
    }
    if (!form.national_id_document_path) {
      toast.error("Upload a clear image of your identity document.");
      return;
    }
    if (!consentAcknowledged) {
      toast.error("Read and tick the consent acknowledgement.");
      return;
    }
    setConsentSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Please sign in again.");
      const consentTime = new Date().toISOString();
      const { error } = await supabase.from("patients").update({
        legal_full_name: form.legal_full_name.trim(),
        national_id: form.national_id.trim().toUpperCase(),
        national_id_document_path: form.national_id_document_path,
        consent_version: "2026-07-25",
        consent_given_at: consentTime,
      }).eq("id", session.user.id);
      if (error) throw error;
      const response = await fetch("/api/consent-confirmation", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();
      toast.success(result.emailSent
        ? "Consent recorded. A confirmation email has been sent."
        : "Consent recorded. Confirmation is available in Notifications.");
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["patient-setup-status"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not record consent.");
    } finally {
      setConsentSaving(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function toggleItem(arr: string[], item: string, setter: (v: string[]) => void) {
    setter(arr.includes(item) ? arr.filter(a => a !== item) : [...arr, item]);
  }

  const missingSetup = getMissingSetupFields(data
    ? { profile: data.profile, patient: data.patient }
    : null);

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
        {missingSetup.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
            <p className="font-black">Complete your required setup</p>
            <p className="mt-1 text-xs leading-5">Fields marked with <strong>*</strong> are required before other care and learning features unlock.</p>
            <p className="mt-2 text-xs font-semibold">Still missing: {missingSetup.join(", ")}.</p>
          </div>
        )}

        {/* Avatar + name */}
        <div className="rounded-2xl bg-white p-4 dark:bg-slate-900">
          <ImageUpload
            label="Upload patient photo *"
            imageUrl={data?.profile?.avatar_url}
            initials={data?.profile?.full_name}
            onUpload={uploadAvatar}
            shape="rounded"
          />
          <div className="mt-3">
            <p className="font-bold text-gray-900 text-lg">{data?.profile?.full_name ?? "—"}</p>
            <p className="text-sm text-gray-500">{data?.profile?.phone ?? data?.user?.email ?? "No contact"}</p>
            <p className="text-xs text-brand-600 font-medium mt-0.5 capitalize">{data?.profile?.role ?? "patient"}</p>
          </div>
        </div>

        {/* Personal Info */}
        <SectionCard title="Personal Information" onEdit={() => setEditSection("personal")} isEditing={editSection === "personal"}>
          {editSection === "personal" ? (
            <div className="space-y-3">
              <LabeledInput required label="Full Name" value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} />
              <LabeledInput required label="Phone Number" type="tel" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} placeholder="+263 7X XXX XXXX" />
              <LabeledInput required label="Date of Birth" type="date" value={form.date_of_birth} onChange={(v) => setForm(f => ({ ...f, date_of_birth: v }))} min={earliestDob} max={today} />
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Gender <span className="text-red-600">*</span></label>
                <div className="flex gap-2">
                  {["male", "female", "other"].map((g) => (
                    <button type="button" key={g} onClick={() => setForm(f => ({ ...f, gender: g }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize border transition-all ${form.gender === g ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200"}`}>
                      {g}
                    </button>
                  ))}
                </div>
              </div>
              <LabeledInput required label="City" value={form.city} onChange={(v) => setForm(f => ({ ...f, city: v }))} placeholder="e.g. Harare" />
              <LabeledInput required label="Province" value={form.province} onChange={(v) => setForm(f => ({ ...f, province: v }))} placeholder="e.g. Mashonaland East" />
              <SaveButtons loading={saveMutation.isPending} onSave={() => saveMutation.mutate("personal")} onCancel={() => setEditSection(null)} />
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <InfoRow label="Phone Number *" value={data?.profile?.phone ?? "—"} />
              <InfoRow label="Date of Birth *" value={data?.profile?.date_of_birth ? format(new Date(data.profile.date_of_birth), "d MMM yyyy") : "—"} />
              <InfoRow label="Gender *" value={data?.profile?.gender ?? "—"} capitalize />
              <InfoRow label="City *" value={data?.profile?.city ?? "—"} />
              <InfoRow label="Province *" value={data?.profile?.province ?? "—"} />
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
              <SaveButtons loading={saveMutation.isPending} onSave={() => saveMutation.mutate("medical")} onCancel={() => setEditSection(null)} />
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
              <LabeledInput required label="Name" value={form.emergency_contact_name} onChange={(v) => setForm(f => ({ ...f, emergency_contact_name: v }))} placeholder="Full name" />
              <LabeledInput required label="Phone Number" type="tel" value={form.emergency_contact_phone} onChange={(v) => setForm(f => ({ ...f, emergency_contact_phone: v }))} placeholder="+263 7X XXX XXXX" />
              <LabeledInput required label="Relationship" value={form.emergency_contact_relation} onChange={(v) => setForm(f => ({ ...f, emergency_contact_relation: v }))} placeholder="e.g. Spouse, Parent, Sibling" />
              <SaveButtons loading={saveMutation.isPending} onSave={() => saveMutation.mutate("emergency")} onCancel={() => setEditSection(null)} />
            </div>
          ) : (
            <dl className="space-y-2 text-sm">
              <InfoRow label="Name *" value={data?.patient?.emergency_contact_name ?? "—"} />
              <InfoRow label="Phone *" value={data?.patient?.emergency_contact_phone ?? "—"} />
              <InfoRow label="Relationship *" value={data?.patient?.emergency_contact_relation ?? "—"} />
            </dl>
          )}
        </SectionCard>

        {/* Settings */}
        <Card className="border-brand-200">
          <CardBody className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-brand-700">Identity & informed consent</p>
              <h3 className="mt-1 font-black text-slate-950 dark:text-white">Understand and approve health-data use</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                Hutano uses your information to provide consultations, prescriptions, emergency response, and account support. Access is limited by account roles and protected in transit. No digital system is risk-free; you may ask support about access, correction, or deletion where applicable.
              </p>
            </div>
            {data?.patient?.consent_given_at ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100">
                <strong>Consent recorded</strong>
                <p className="mt-1 text-xs">Version {data.patient.consent_version} · {format(new Date(data.patient.consent_given_at), "d MMM yyyy, HH:mm")}</p>
              </div>
            ) : (
              <>
                <LabeledInput required label="Full legal name" value={form.legal_full_name} onChange={(value) => setForm((current) => ({ ...current, legal_full_name: value }))} placeholder="As written on national documents" />
                <LabeledInput required label="National ID number" value={form.national_id} onChange={(value) => setForm((current) => ({ ...current, national_id: value }))} placeholder="e.g. 63-123456-A-12" />
                <ImageUpload label={`${form.national_id_document_path ? "Replace ID image" : "Take/upload ID image"} *`} initials="ID" onUpload={uploadIdentityDocument} shape="rounded" />
                {form.national_id_document_path && <p className="text-xs font-semibold text-emerald-700">ID image securely uploaded and ready.</p>}
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                  <input type="checkbox" checked={consentAcknowledged} onChange={(event) => setConsentAcknowledged(event.target.checked)} className="mt-1 h-4 w-4 accent-brand-700" />
                  <span className="text-xs leading-5 text-slate-700 dark:text-slate-200"><strong className="text-red-600">*</strong> I confirm this identity is mine, the information is accurate, and I consent to Hutano processing my health and location information for the care and emergency purposes described above.</span>
                </label>
                <Button onClick={recordConsent} loading={consentSaving} className="w-full">Confirm consent</Button>
              </>
            )}
          </CardBody>
        </Card>

        {/* Settings */}
        <Card>
          <CardBody className="space-y-3">
            <h3 className="font-bold text-gray-900">Settings</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Low Bandwidth Mode</p>
                <p className="text-xs text-gray-500">Reduces data usage for slow connections</p>
              </div>
              <button role="switch" aria-checked={form.low_bandwidth_mode} onClick={async () => {
                const newVal = !form.low_bandwidth_mode;
                setForm(f => ({ ...f, low_bandwidth_mode: newVal }));
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                  const { error } = await supabase.from("profiles").update({ low_bandwidth_mode: newVal }).eq("id", user.id);
                  if (error) {
                    setForm(f => ({ ...f, low_bandwidth_mode: !newVal }));
                    toast.error("Could not change low bandwidth mode.");
                    return;
                  }
                  localStorage.setItem("hutano-low-bandwidth", String(newVal));
                  document.documentElement.classList.toggle("low-bandwidth", newVal);
                  toast.success(newVal ? "Low bandwidth mode is on." : "Full quality mode is on.");
                }
              }} className={`relative h-6 w-11 rounded-full transition-colors ${form.low_bandwidth_mode ? "bg-brand-600" : "bg-gray-200"}`}>
                <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.low_bandwidth_mode ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>
          </CardBody>
        </Card>

        {/* Change Password */}
        <SectionCard title="Change Password" onEdit={() => setEditSection("password")} isEditing={editSection === "password"}>
          {editSection === "password" ? (
            <form onSubmit={handleChangePassword} className="space-y-3">
              <LabeledInput label="Current Password" type="password" value={pwForm.currentPassword} onChange={(v) => setPwForm(f => ({ ...f, currentPassword: v }))} placeholder="Required to verify it is you" />
              <LabeledInput label="New Password" type="password" value={pwForm.newPassword} onChange={(v) => setPwForm(f => ({ ...f, newPassword: v }))} placeholder="8+ characters" />
              <LabeledInput label="Confirm Password" type="password" value={pwForm.confirm} onChange={(v) => setPwForm(f => ({ ...f, confirm: v }))} placeholder="Repeat new password" />
              <SaveButtons loading={pwSaving} onSave={() => handleChangePassword({ preventDefault: () => {} } as any)} onCancel={() => { setEditSection(null); setPwForm({ currentPassword: "", newPassword: "", confirm: "" }); }} />
            </form>
          ) : (
            <p className="text-sm text-gray-500">••••••••</p>
          )}
        </SectionCard>

        <Link href="/history" className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900">
          <p className="font-bold text-slate-900 dark:text-white">Consultation & emergency history</p>
          <p className="mt-1 text-sm text-slate-500">View previous care, prescriptions, and SOS requests →</p>
        </Link>

        {/* Sign out */}
        <button onClick={signOut}
          className="w-full py-3.5 rounded-2xl border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors">
          Sign Out
        </button>

        <p className="text-center text-xs text-gray-400 pb-4">Hutano v1.0.0 · Reformed Church University</p>
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

function LabeledInput({ label, value, onChange, type = "text", placeholder, min, max, required = false }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; min?: string; max?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-500 block mb-1">
        {label} {required && <span className="text-red-600">*</span>}
      </label>
      {type === "password" ? (
        <PasswordInput required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm dark:border-slate-700 dark:bg-slate-900" />
      ) : (
        <input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} min={min} max={max}
          className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm dark:border-slate-700 dark:bg-slate-900" />
      )}
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
