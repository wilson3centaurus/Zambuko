"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@zambuko/database/client";
import { Button, Card, CardBody } from "@zambuko/ui";
import { toast } from "sonner";
import { addDays, format } from "date-fns";

type Medication = {
  id: string;
  name: string;
  dosage: string;
  frequency: string;
  duration_days: number;
  instructions: string;
};

const COMMON_MEDS = [
  "Amoxicillin", "Paracetamol", "Ibuprofen", "Metformin", "Amlodipine",
  "Ciprofloxacin", "Metronidazole", "Omeprazole", "Salbutamol", "Prednisolone",
  "Doxycycline", "Cotrimoxazole", "Chloroquine", "Artemether-Lumefantrine",
];

const FREQUENCIES = ["Once daily", "Twice daily", "Three times daily", "Four times daily", "Every 8 hours", "At night", "As needed"];

function NewPrescriptionContent() {
  const router = useRouter();
  const params = useSearchParams();
  const consultationId = params.get("consultation");
  const supabase = createClient();

  const [medications, setMedications] = useState<Medication[]>([
    { id: crypto.randomUUID(), name: "", dosage: "", frequency: "Twice daily", duration_days: 7, instructions: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState(30);
  const [loading, setLoading] = useState(false);

  function updateMed(id: string, field: keyof Medication, value: string | number) {
    setMedications((prev) => prev.map((m) => m.id === id ? { ...m, [field]: value } : m));
  }

  function addMedication() {
    setMedications((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: "", dosage: "", frequency: "Twice daily", duration_days: 5, instructions: "" },
    ]);
  }

  function removeMedication(id: string) {
    if (medications.length === 1) return;
    setMedications((prev) => prev.filter((m) => m.id !== id));
  }

  async function handleSubmit() {
    const incomplete = medications.find((m) => !m.name.trim() || !m.dosage.trim());
    if (incomplete) {
      toast.error("Please fill in all medication names and dosages.");
      return;
    }
    if (!consultationId) { toast.error("No consultation linked."); return; }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: consultation } = await supabase
        .from("consultations")
        .select("patient_id")
        .eq("id", consultationId)
        .single();

      if (!consultation) throw new Error("Consultation not found");

      const { error } = await supabase.from("prescriptions").insert({
        consultation_id: consultationId,
        patient_id: consultation.patient_id,
        doctor_id: user.id,
        medications: medications.map(({ id: _, ...m }) => m), // strip internal id
        doctor_notes: notes,
        valid_until: format(addDays(new Date(), validDays), "yyyy-MM-dd"),
        status: "issued",
      });

      if (error) throw error;
      toast.success("Prescription issued!");
      router.push(`/consultation/${consultationId}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not issue prescription.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-xl text-gray-500 hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">New Prescription</h1>
      </div>

      <div className="px-4 py-5 space-y-4 max-w-lg mx-auto pb-safe">
        {medications.map((med, index) => (
          <Card key={med.id}>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm">Medication {index + 1}</h3>
                {medications.length > 1 && (
                  <button onClick={() => removeMedication(med.id)}
                    className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>

              {/* Medication name with autocomplete suggestions */}
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Drug Name *</label>
                <input type="text" value={med.name} onChange={(e) => updateMed(med.id, "name", e.target.value)}
                  placeholder="e.g. Amoxicillin"
                  list={`meds-list-${med.id}`}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                <datalist id={`meds-list-${med.id}`}>
                  {COMMON_MEDS.map(m => <option key={m} value={m} />)}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Dosage *</label>
                  <input type="text" value={med.dosage} onChange={(e) => updateMed(med.id, "dosage", e.target.value)}
                    placeholder="e.g. 500mg"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 block mb-1">Duration (days)</label>
                  <input type="number" min={1} max={365} value={med.duration_days}
                    onChange={(e) => updateMed(med.id, "duration_days", Number(e.target.value))}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Frequency</label>
                <select value={med.frequency} onChange={(e) => updateMed(med.id, "frequency", e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm bg-white">
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Special Instructions</label>
                <input type="text" value={med.instructions} onChange={(e) => updateMed(med.id, "instructions", e.target.value)}
                  placeholder="e.g. Take with food. Avoid alcohol."
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm" />
              </div>
            </CardBody>
          </Card>
        ))}

        <button onClick={addMedication}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-medium text-sm hover:border-sky-400 hover:text-sky-600 transition-colors">
          + Add Another Medication
        </button>

        {/* Doctor notes & validity */}
        <Card>
          <CardBody className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Doctor's Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional instructions or counselling…"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500 text-sm resize-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">
                Valid for {validDays} days (until {format(addDays(new Date(), validDays), "d MMM yyyy")})
              </label>
              <input type="range" min={7} max={90} value={validDays} onChange={(e) => setValidDays(Number(e.target.value))}
                className="w-full accent-sky-600" />
            </div>
          </CardBody>
        </Card>

        <Button className="w-full" size="lg" loading={loading} onClick={handleSubmit}>
          Issue Prescription
        </Button>
      </div>
    </div>
  );
}

export default function NewPrescriptionPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <NewPrescriptionContent />
    </Suspense>
  );
}
