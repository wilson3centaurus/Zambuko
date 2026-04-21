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

const ZIM_EMS_ORGS = [
  "Hutano EMS", "MARS Zimbabwe", "EMRS Zimbabwe",
  "Red Cross Zimbabwe", "St John Ambulance Zimbabwe",
  "City of Harare Emergency Services", "City of Bulawayo Emergency Services",
  "Zimbabwe Republic Police EMS", "ZUPCO Emergency Services",
  "Harare City Ambulance", "Bulawayo City Ambulance",
  "Ministry of Health EMS", "Other",
];

const VEHICLE_TYPES = [
  { value: "ambulance", label: "Ambulance" },
  { value: "motorbike", label: "Motorbike" },
  { value: "car", label: "Car" },
  { value: "bicycle", label: "Bicycle" },
  { value: "boat", label: "Boat" },
];

// -- Helpers --
function idToPassword(id: string) { return id.replace(/[-\s]/g, "").toLowerCase(); }

const INPUT = "w-full rounded-lg border border-gray-700 bg-gray-700/60 px-3 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const SELECT = "w-full rounded-lg border border-gray-700 bg-gray-700/60 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition";
const LABEL = "block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1";

// SVG micro-icons
const KeyIcon = () => (
  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AmbulanceIcon = () => (
  <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
    <path d="M7 17a2 2 0 1 0 4 0 2 2 0 0 0-4 0zm10 0a2 2 0 1 0 4 0 2 2 0 0 0-4 0z" />
    <path d="M5 17H3V6a1 1 0 0 1 1-1h9v12M9 17h6m4 0h2v-6l-3-5h-4v11" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M14 8h2m-1-1v2" strokeLinecap="round" />
  </svg>
);

// -- Add Dispatcher Modal --
function AddDispatcherModal({ onClose }: { onClose: () => void }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "", date_of_birth: "", national_id: "",
    email: "", phone: "",
    organization: "", city: "",
    vehicle_type: "ambulance", vehicle_id: "", license_plate: "",
  });

  const autoPassword = idToPassword(form.national_id);

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.national_id.trim()) { toast.error("National ID is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, password: autoPassword, role: "dispatcher", full_name: form.full_name }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to create user");
      const userId: string = json.userId;

      await Promise.all([
        supabase.from("profiles").update({ city: form.city, phone: form.phone }).eq("id", userId),
        supabase.from("dispatchers").update({
          vehicle_id: form.vehicle_id,
          vehicle_type: form.vehicle_type,
          license_plate: form.license_plate,
          organization: form.organization,
        }).eq("id", userId),
      ]);

      toast.success(`${form.full_name} dispatcher account created!`);
      qc.invalidateQueries({ queryKey: ["admin-dispatchers"] });
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
          <AmbulanceIcon />
          <div className="flex-1">
            <h2 className="text-white font-bold text-lg leading-tight">Add New Dispatcher</h2>
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
            <input type="text" required placeholder="Simba Moyo" value={form.full_name} onChange={set("full_name")} className={INPUT} />
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
            <input type="email" required placeholder="simba.moyo@example.com" value={form.email} onChange={set("email")} className={INPUT} />
          </div>

          {/* Phone */}
          <div>
            <label className={LABEL}>Phone</label>
            <input type="tel" placeholder="077 200 0000" value={form.phone} onChange={set("phone")} className={INPUT} />
          </div>

          {/* Organization */}
          <div>
            <label className={LABEL}>Organization *</label>
            <select value={form.organization} onChange={set("organization")} required className={SELECT}>
              <option value="">Select EMS organization...</option>
              {ZIM_EMS_ORGS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          {/* City */}
          <div>
            <label className={LABEL}>City</label>
            <select value={form.city} onChange={set("city")} className={SELECT}>
              <option value="">Select city...</option>
              {ZIM_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* Vehicle Type */}
          <div>
            <label className={LABEL}>Vehicle Type</label>
            <select value={form.vehicle_type} onChange={set("vehicle_type")} className={SELECT}>
              {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>

          {/* Vehicle ID + License Plate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>Vehicle ID</label>
              <input type="text" placeholder="AMB-001" value={form.vehicle_id} onChange={set("vehicle_id")} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>License Plate</label>
              <input type="text" placeholder="ABC 1234" value={form.license_plate} onChange={set("license_plate")} className={INPUT} />
            </div>
          </div>
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

// -- Edit Dispatcher Modal --
function EditDispatcherModal({ disp, onClose }: { disp: any; onClose: () => void }) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: disp.profiles?.full_name ?? "",
    phone: disp.profiles?.phone ?? "",
    city: disp.profiles?.city ?? "",
    organization: disp.organization ?? "",
    vehicle_id: disp.vehicle_id ?? "",
    vehicle_type: disp.vehicle_type ?? "ambulance",
    license_plate: disp.license_plate ?? "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const [p, d] = await Promise.all([
        supabase.from("profiles").update({ full_name: form.full_name, phone: form.phone, city: form.city }).eq("id", disp.id),
        supabase.from("dispatchers").update({
          vehicle_id: form.vehicle_id,
          vehicle_type: form.vehicle_type,
          license_plate: form.license_plate,
          organization: form.organization,
        }).eq("id", disp.id),
      ]);
      if (p.error) throw p.error;
      if (d.error) throw d.error;
      toast.success("Dispatcher updated!");
      qc.invalidateQueries({ queryKey: ["admin-dispatchers"] });
      onClose();
    } catch { toast.error("Update failed."); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSave}
        className="bg-gray-800 border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-700">
          <h2 className="text-white font-bold text-lg">Edit Dispatcher</h2>
          <button type="button" onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {[
            { label: "Full Name", key: "full_name" as const, type: "text", placeholder: "Simba Moyo" },
            { label: "Phone", key: "phone" as const, type: "tel", placeholder: "+263771000000" },
            { label: "Vehicle ID", key: "vehicle_id" as const, type: "text", placeholder: "AMB-001" },
            { label: "License Plate", key: "license_plate" as const, type: "text", placeholder: "ABC 1234" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className={LABEL}>{label}</label>
              <input type={type} placeholder={placeholder} value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className={INPUT} />
            </div>
          ))}

          <div>
            <label className={LABEL}>Organization</label>
            <select value={form.organization} onChange={(e) => setForm((f) => ({ ...f, organization: e.target.value }))} className={SELECT}>
              <option value="">Select organization...</option>
              {ZIM_EMS_ORGS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>City</label>
            <select value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className={SELECT}>
              <option value="">Select city...</option>
              {ZIM_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label className={LABEL}>Vehicle Type</label>
            <select value={form.vehicle_type} onChange={(e) => setForm((f) => ({ ...f, vehicle_type: e.target.value }))} className={SELECT}>
              {VEHICLE_TYPES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
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
export default function DispatchersAdminPage() {
  const supabase = createClient();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editDisp, setEditDisp] = useState<any | null>(null);

  const { data: dispatchers = [], isLoading } = useQuery({
    queryKey: ["admin-dispatchers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("dispatchers")
        .select("*, profiles!inner(full_name, phone, city, is_active, created_at)")
        .order("created_at", { referencedTable: "profiles", ascending: false });
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
      qc.invalidateQueries({ queryKey: ["admin-dispatchers"] });
    },
    onError: () => toast.error("Update failed."),
  });

  const filtered = dispatchers.filter((d: any) => {
    if (!search) return true;
    const name = (d.profiles?.full_name ?? "").toLowerCase();
    return name.includes(search.toLowerCase()) || d.vehicle_id?.toLowerCase().includes(search.toLowerCase());
  });

  const STATUS_COLOR: Record<string, string> = {
    available: "bg-green-900/50 text-green-400",
    en_route: "bg-blue-900/50 text-blue-400",
    at_scene: "bg-orange-900/50 text-orange-400",
    offline: "bg-gray-700 text-gray-400",
  };

  return (
    <div className="p-6 space-y-5">
      {showAdd && <AddDispatcherModal onClose={() => setShowAdd(false)} />}
      {editDisp && <EditDispatcherModal disp={editDisp} onClose={() => setEditDisp(null)} />}

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dispatchers</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage ambulance dispatchers and vehicles</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg>
          Add Dispatcher
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" strokeLinecap="round" />
        </svg>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or vehicle ID..."
          className="w-full pl-9 rounded-xl border border-gray-700 bg-gray-800 text-white placeholder-gray-500 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm" />
      </div>

      {/* Table */}
      <div className="bg-[#1a1f35] rounded-2xl border border-blue-900/30 overflow-hidden ring-1 ring-blue-500/10">
        <table className="w-full">
          <thead className="bg-[#151929] border-b border-blue-900/30">
            <tr>
              {["#", "Dispatcher", "Organization", "Vehicle", "Status", "Location", "Actions"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-900/20">
            {isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No dispatchers found.</td></tr>
            )}
            {filtered.map((disp: any, idx: number) => {
              const profile = disp.profiles;
              return (
                <tr key={disp.id} className="hover:bg-blue-900/10 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-red-900/50 flex items-center justify-center font-bold text-red-400 text-sm flex-shrink-0">
                        {profile?.full_name?.charAt(0) ?? "?"}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-sm">{profile?.full_name}</p>
                        <p className="text-xs text-gray-500">{profile?.phone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">{disp.organization || "-"}</td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white">{disp.vehicle_id || "-"}</p>
                    <p className="text-xs text-gray-500 capitalize">{disp.vehicle_type} / {disp.license_plate || "-"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLOR[disp.status] ?? "bg-gray-700 text-gray-400"}`}>
                      {disp.status?.replace(/_/g, " ") ?? "offline"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {disp.location_lat && disp.location_lng
                      ? `${Number(disp.location_lat).toFixed(4)}, ${Number(disp.location_lng).toFixed(4)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button onClick={() => setEditDisp(disp)}
                        className="p-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors" title="Edit">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" strokeLinecap="round" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => suspendMutation.mutate({ profileId: disp.id, suspend: profile?.is_active })}
                        disabled={suspendMutation.isPending}
                        className={`p-1.5 rounded-lg transition-colors ${profile?.is_active ? "bg-amber-900/40 text-amber-400 hover:bg-amber-900/70" : "bg-green-900/40 text-green-400 hover:bg-green-900/70"}`}
                        title={profile?.is_active ? "Suspend" : "Restore"}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" /><path d="M10 15V9M14 15V9" strokeLinecap="round" />
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

      <p className="text-xs text-gray-500">{filtered.length} dispatcher{filtered.length !== 1 ? "s" : ""} shown</p>
    </div>
  );
}

