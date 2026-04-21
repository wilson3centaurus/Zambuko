"use client";

import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { getPatientPrescriptions } from "@zambuko/database";
import { Card, CardBody, Badge } from "@zambuko/ui";
import { format, isAfter } from "date-fns";

type PrescriptionStatus = "issued" | "sent_to_pharmacy" | "dispensed" | "collected" | "cancelled";

const STATUS_CONFIG: Record<PrescriptionStatus, { label: string; color: string }> = {
  issued: { label: "Issued", color: "bg-blue-100 text-blue-700" },
  sent_to_pharmacy: { label: "At Pharmacy", color: "bg-amber-100 text-amber-700" },
  dispensed: { label: "Ready for Collection", color: "bg-green-100 text-green-700" },
  collected: { label: "Collected", color: "bg-gray-100 text-gray-500" },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-600" },
};

export default function PrescriptionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const { data: prescriptions = [], isLoading } = useQuery({
    queryKey: ["prescriptions"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      return getPatientPrescriptions(supabase, user.id);
    },
  });

  const active = prescriptions.filter(p => !["collected", "cancelled"].includes(p.status));
  const past = prescriptions.filter(p => ["collected", "cancelled"].includes(p.status));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 sticky top-0 z-10">
        <h1 className="font-bold text-gray-900">Prescriptions</h1>
        <p className="text-xs text-gray-500 mt-0.5">{prescriptions.length} total</p>
      </div>

      <div className="px-4 py-4 space-y-5 max-w-lg mx-auto">
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-3" />
                <div className="h-8 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && prescriptions.length === 0 && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">💊</p>
            <h3 className="font-bold text-gray-800">No prescriptions yet</h3>
            <p className="text-sm text-gray-500 mt-2">Prescriptions from your doctors will appear here.</p>
          </div>
        )}

        {active.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Active</h2>
            <div className="space-y-3">
              {active.map(p => (
                <PrescriptionCard key={p.id} prescription={p} />
              ))}
            </div>
          </section>
        )}

        {past.length > 0 && (
          <section>
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Past</h2>
            <div className="space-y-3">
              {past.map(p => (
                <PrescriptionCard key={p.id} prescription={p} past />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

type Medication = {
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions?: string;
};

function PrescriptionCard({ prescription, past }: { prescription: any; past?: boolean }) {
  const { supabase } = { supabase: createClient() };
  const status = prescription.status as PrescriptionStatus;
  const statusCfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.issued;
  const meds = (prescription.medications ?? []) as Medication[];
  const isExpired = prescription.valid_until && !isAfter(new Date(prescription.valid_until), new Date());

  async function selectPharmacy() {
    // TODO: open pharmacy selection sheet
    alert("Pharmacy selection coming soon! For now, take your prescription to any registered pharmacy.");
  }

  return (
    <Card className={past ? "opacity-70" : ""}>
      <CardBody className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-sm">
              {meds.length} medication{meds.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              Issued {format(new Date(prescription.created_at), "d MMM yyyy")}
            </p>
          </div>
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </div>

        {/* Medications list */}
        <div className="bg-gray-50 rounded-xl p-3 space-y-2">
          {meds.map((med, i) => (
            <div key={i} className={`${i > 0 ? "border-t border-gray-100 pt-2" : ""}`}>
              <p className="font-semibold text-gray-900 text-sm">{med.name} — {med.dosage}</p>
              <p className="text-xs text-gray-500 mt-0.5">{med.frequency} for {med.duration_days} days</p>
              {med.instructions && (
                <p className="text-xs text-amber-700 mt-0.5 bg-amber-50 px-2 py-1 rounded-lg">
                  ⚠️ {med.instructions}
                </p>
              )}
            </div>
          ))}
        </div>

        {prescription.doctor_notes && (
          <p className="text-xs text-gray-600 italic bg-blue-50 px-3 py-2 rounded-xl">
            📋 Doctor's note: {prescription.doctor_notes}
          </p>
        )}

        {/* Valid until */}
        {prescription.valid_until && (
          <p className={`text-xs ${isExpired ? "text-red-600" : "text-gray-500"}`}>
            Valid until: {format(new Date(prescription.valid_until), "d MMM yyyy")}
            {isExpired && " — EXPIRED"}
          </p>
        )}

        {/* Actions */}
        {status === "issued" && !past && (
          <button onClick={selectPharmacy}
            className="w-full py-2.5 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors">
            Send to Pharmacy
          </button>
        )}

        {status === "dispensed" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-green-700 font-semibold text-sm">✅ Ready at pharmacy!</p>
            {prescription.pharmacies?.name && (
              <p className="text-green-600 text-xs mt-0.5">{prescription.pharmacies.name}</p>
            )}
          </div>
        )}

        {prescription.pdf_url && (
          <a href={prescription.pdf_url} target="_blank" rel="noopener noreferrer"
            className="block w-full py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm text-center hover:bg-gray-50 transition-colors">
            📄 Download PDF
          </a>
        )}
      </CardBody>
    </Card>
  );
}
