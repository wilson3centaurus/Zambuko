"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { getPatientPrescriptions } from "@zambuko/database";
import { Card, CardBody } from "@zambuko/ui";
import { format, isAfter } from "date-fns";
import { toast } from "sonner";

type PrescriptionStatus = "issued" | "sent_to_pharmacy" | "dispensed" | "collected" | "cancelled" | "expired";

type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
};

type Pharmacy = {
  id: string;
  name: string;
  address: string;
  city: string;
  phone: string | null;
  operating_hours_from: string | null;
  operating_hours_to: string | null;
  delivery_available: boolean;
  delivery_radius_km: number | null;
};

type PrescriptionRecord = {
  id: string;
  status: PrescriptionStatus;
  medications: Medication[] | null;
  doctor_notes: string | null;
  valid_until: string;
  pdf_url: string | null;
  created_at: string;
  pharmacy: {
    id: string;
    name: string;
    address: string;
    phone: string | null;
  } | null;
};

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; color: string }> = {
  issued: { label: "Ready to send", color: "bg-blue-50 text-blue-800 border-blue-200" },
  sent_to_pharmacy: { label: "Pharmacy reviewing", color: "bg-amber-50 text-amber-800 border-amber-200" },
  dispensed: { label: "Ready for collection", color: "bg-green-50 text-green-800 border-green-200" },
  collected: { label: "Collected", color: "bg-slate-100 text-slate-600 border-slate-200" },
  cancelled: { label: "Cancelled", color: "bg-red-50 text-red-700 border-red-200" },
  expired: { label: "Expired", color: "bg-slate-100 text-slate-600 border-slate-200" },
};

export default function PrescriptionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const queryClient = useQueryClient();
  const [selectedPrescription, setSelectedPrescription] = useState<PrescriptionRecord | null>(null);
  const [selectedPharmacyId, setSelectedPharmacyId] = useState<string | null>(null);

  const { data: prescriptions = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("Not authenticated");
      return await getPatientPrescriptions(supabase, user.id) as PrescriptionRecord[];
    },
  });

  const { data: pharmacies = [], isLoading: pharmaciesLoading } = useQuery({
    queryKey: ["active-pharmacies"],
    enabled: Boolean(selectedPrescription),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pharmacies")
        .select("id, name, address, city, phone, operating_hours_from, operating_hours_to, delivery_available, delivery_radius_km")
        .eq("is_active", true)
        .order("city")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pharmacy[];
    },
  });

  const sendToPharmacy = useMutation({
    mutationFn: async () => {
      if (!selectedPrescription || !selectedPharmacyId) throw new Error("Choose a pharmacy first.");
      const response = await fetch(`/api/prescriptions/${selectedPrescription.id}/pharmacy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pharmacyId: selectedPharmacyId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send the prescription.");
      return result;
    },
    onSuccess: (result) => {
      toast.success(`Prescription sent to ${result.pharmacy.name}.`);
      setSelectedPrescription(null);
      setSelectedPharmacyId(null);
      queryClient.invalidateQueries({ queryKey: ["prescriptions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const active = prescriptions.filter((prescription) => !["collected", "cancelled", "expired"].includes(prescription.status));
  const past = prescriptions.filter((prescription) => ["collected", "cancelled", "expired"].includes(prescription.status));

  return (
    <div className="min-h-app bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Medication</p>
          <h1 className="mt-1 text-xl font-bold text-slate-950">Prescriptions</h1>
          <p className="mt-1 text-sm text-slate-500">Review instructions and securely send valid prescriptions to a registered pharmacy.</p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-5 lg:px-8">
        {isLoading && (
          <div className="grid gap-3 md:grid-cols-2">
            {[1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-xl bg-slate-200" />)}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-center">
            <h2 className="font-bold text-red-900">We couldn’t load your prescriptions</h2>
            <button type="button" onClick={() => refetch()} className="mt-4 min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white">Try again</button>
          </div>
        )}

        {!isLoading && !isError && prescriptions.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-700">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.5 15.5 7-7m-8.75.75 8 8a3.18 3.18 0 0 0 4.5-4.5l-8-8a3.18 3.18 0 1 0-4.5 4.5Zm0 0 4.5-4.5" />
              </svg>
            </div>
            <h2 className="mt-4 font-bold text-slate-900">No prescriptions yet</h2>
            <p className="mt-1 text-sm text-slate-500">Prescriptions issued by your Hutano doctor will appear here.</p>
          </div>
        )}

        {active.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Active prescriptions</h2>
              <span className="rounded-md bg-brand-50 px-2 py-1 text-xs font-bold text-brand-800">{active.length}</span>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {active.map((prescription) => (
                <PrescriptionCard key={prescription.id} prescription={prescription} onSelectPharmacy={() => {
                  setSelectedPrescription(prescription);
                  setSelectedPharmacyId(null);
                }} />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section className={active.length ? "mt-8" : ""}>
            <h2 className="mb-3 text-sm font-bold text-slate-900">Past prescriptions</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {past.map((prescription) => <PrescriptionCard key={prescription.id} prescription={prescription} past />)}
            </div>
          </section>
        )}
      </div>

      {selectedPrescription && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="pharmacy-title">
          <div className="max-h-[88dvh] w-full max-w-xl overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-xl">
            <div className="flex items-start justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
              <div>
                <h2 id="pharmacy-title" className="font-bold text-slate-950">Choose a registered pharmacy</h2>
                <p className="mt-1 text-xs text-slate-500">The pharmacy must confirm stock before fulfilment.</p>
              </div>
              <button type="button" aria-label="Close pharmacy selector" onClick={() => setSelectedPrescription(null)} className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">×</button>
            </div>

            <div className="max-h-[58dvh] space-y-2 overflow-y-auto px-4 py-4 sm:px-5">
              {pharmaciesLoading && [1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-slate-100" />)}
              {!pharmaciesLoading && pharmacies.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  No registered pharmacies are currently available. Keep the prescription and try again later.
                </div>
              )}
              {pharmacies.map((pharmacy) => (
                <label key={pharmacy.id} className={`block cursor-pointer rounded-xl border p-4 transition-colors ${
                  selectedPharmacyId === pharmacy.id ? "border-brand-600 bg-brand-50 ring-2 ring-brand-100" : "border-slate-200 hover:border-brand-200"
                }`}>
                  <div className="flex items-start gap-3">
                    <input type="radio" name="pharmacy" value={pharmacy.id} checked={selectedPharmacyId === pharmacy.id} onChange={() => setSelectedPharmacyId(pharmacy.id)} className="mt-1 h-4 w-4 accent-brand-700" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{pharmacy.name}</span>
                        {pharmacy.delivery_available && <span className="rounded-md bg-green-50 px-2 py-1 text-[11px] font-bold text-green-800">Delivery available</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{pharmacy.address}, {pharmacy.city}</p>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        {pharmacy.phone && <span>{pharmacy.phone}</span>}
                        {pharmacy.operating_hours_from && pharmacy.operating_hours_to && <span>{pharmacy.operating_hours_from.slice(0, 5)}–{pharmacy.operating_hours_to.slice(0, 5)}</span>}
                        {pharmacy.delivery_available && pharmacy.delivery_radius_km && <span>Delivery within {pharmacy.delivery_radius_km} km</span>}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-5">
              <button
                type="button"
                disabled={!selectedPharmacyId || sendToPharmacy.isPending}
                onClick={() => sendToPharmacy.mutate()}
                className="min-h-12 w-full rounded-lg bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendToPharmacy.isPending ? "Sending securely…" : "Send prescription"}
              </button>
              <p className="mt-2 text-center text-[11px] text-slate-500">Sending does not confirm stock, price, payment, or delivery.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PrescriptionCard({ prescription, past, onSelectPharmacy }: { prescription: PrescriptionRecord; past?: boolean; onSelectPharmacy?: () => void }) {
  const status = prescription.status as PrescriptionStatus;
  const statusConfig = STATUS_CONFIG[status] ?? STATUS_CONFIG.issued;
  const medications = (prescription.medications ?? []) as Medication[];
  const isExpired = prescription.valid_until && !isAfter(new Date(`${prescription.valid_until}T23:59:59`), new Date());

  return (
    <Card className={past ? "opacity-75" : ""}>
      <CardBody className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">{medications.length} medication{medications.length === 1 ? "" : "s"}</h3>
            <p className="mt-1 text-xs text-slate-500">Issued {format(new Date(prescription.created_at), "d MMM yyyy")}</p>
          </div>
          <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${statusConfig.color}`}>{isExpired && status === "issued" ? "Expired" : statusConfig.label}</span>
        </div>

        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-slate-50 px-3">
          {medications.map((medication, index) => (
            <div key={`${medication.name}-${index}`} className="py-3">
              <p className="text-sm font-bold text-slate-900">{medication.name} <span className="font-semibold text-slate-600">· {medication.dosage}</span></p>
              <p className="mt-1 text-xs text-slate-500">{medication.frequency} for {medication.duration_days} days</p>
              {medication.instructions && <p className="mt-2 rounded-md bg-amber-50 px-2 py-1.5 text-xs leading-5 text-amber-900">{medication.instructions}</p>}
            </div>
          ))}
        </div>

        {prescription.doctor_notes && (
          <div className="rounded-lg border-l-4 border-brand-400 bg-brand-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-brand-700">Doctor’s note</p>
            <p className="mt-1 text-xs leading-5 text-brand-900">{prescription.doctor_notes}</p>
          </div>
        )}

        <div className="mt-auto space-y-3">
          <p className={`text-xs font-semibold ${isExpired ? "text-red-700" : "text-slate-500"}`}>
            {isExpired ? "Expired" : "Valid until"} {format(new Date(`${prescription.valid_until}T12:00:00`), "d MMM yyyy")}
          </p>

          {prescription.pharmacy && (
            <div className="rounded-lg bg-slate-100 px-3 py-2 text-sm">
              <p className="font-bold text-slate-800">{prescription.pharmacy.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{prescription.pharmacy.address}</p>
            </div>
          )}

          {status === "issued" && !past && !isExpired && onSelectPharmacy && (
            <button type="button" onClick={onSelectPharmacy} className="min-h-11 w-full rounded-lg bg-brand-700 px-4 text-sm font-bold text-white hover:bg-brand-800">
              Choose pharmacy
            </button>
          )}

          {status === "dispensed" && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="text-sm font-bold text-green-900">Medication is ready</p>
              <p className="mt-1 text-xs text-green-700">Confirm collection details directly with the pharmacy.</p>
            </div>
          )}

          {prescription.pdf_url && (
            <a href={prescription.pdf_url} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center justify-center rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50">
              View prescription document
            </a>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
