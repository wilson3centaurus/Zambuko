"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { runClientTriage, SYMPTOM_OPTIONS, COMORBIDITY_OPTIONS, type TriageInput } from "@zambuko/triage";
import { Card, CardBody, CardHeader, Button, TriageBadge } from "@zambuko/ui";
import type { ConsultationType, MedicalSpecialty } from "@zambuko/database";

type Step = "complaint" | "symptoms" | "vitals" | "result";

const SPECIALTIES: { value: MedicalSpecialty; label: string }[] = [
  { value: "general_practice", label: "General Practice" },
  { value: "pediatrics", label: "Paediatrics (Children)" },
  { value: "obstetrics", label: "Obstetrics / Maternity" },
  { value: "cardiology", label: "Cardiology (Heart)" },
  { value: "dermatology", label: "Dermatology (Skin)" },
  { value: "psychiatry", label: "Mental Health" },
  { value: "orthopedics", label: "Orthopaedics (Bones & Joints)" },
  { value: "ophthalmology", label: "Ophthalmology (Eyes)" },
  { value: "ent", label: "ENT (Ear, Nose & Throat)" },
];

// Complaint category grid (Step 1)
const COMPLAINT_CATEGORIES: {
  label: string;
  emoji: string;
  preset: string;
  specialty: MedicalSpecialty;
  symptoms: string[];
}[] = [
  { label: "Fever / High Temp", emoji: "🌡️", preset: "Fever and high body temperature", specialty: "general_practice", symptoms: ["fever", "chills", "fatigue"] },
  { label: "Pain / Aches", emoji: "😣", preset: "Body pain or aches", specialty: "general_practice", symptoms: ["pain", "body_aches", "headache"] },
  { label: "Cold / Flu", emoji: "🤧", preset: "Cold or flu symptoms", specialty: "general_practice", symptoms: ["runny_nose", "sneezing", "sore_throat", "cough"] },
  { label: "Injury / Wound", emoji: "🩹", preset: "Injury or wound that needs attention", specialty: "orthopedics", symptoms: ["wound", "pain", "swelling"] },
  { label: "Stomach / Digestive", emoji: "🤢", preset: "Stomach pain, nausea or digestive issues", specialty: "general_practice", symptoms: ["nausea", "abdominal_pain", "diarrhea", "vomiting"] },
  { label: "Chest / Heart", emoji: "❤️", preset: "Chest pain or heart concerns", specialty: "cardiology", symptoms: ["chest_pain", "palpitations", "shortness_of_breath"] },
  { label: "Eye Problem", emoji: "👁️", preset: "Eye pain, redness or vision problem", specialty: "ophthalmology", symptoms: ["eye_pain", "blurred_vision", "discharge"] },
  { label: "Ear / Nose / Throat", emoji: "👂", preset: "Ear, nose or throat pain", specialty: "ent", symptoms: ["ear_pain", "hearing_loss", "sore_throat", "nasal_congestion"] },
  { label: "Skin / Rash", emoji: "🌸", preset: "Skin rash, itch or lesion", specialty: "dermatology", symptoms: ["rash", "itching", "skin_lesion"] },
  { label: "Mental Health", emoji: "🧠", preset: "Stress, anxiety or mental health concerns", specialty: "psychiatry", symptoms: ["anxiety", "depression", "sleep_problems"] },
  { label: "Maternity", emoji: "🤱", preset: "Pregnancy or maternity concern", specialty: "obstetrics", symptoms: ["abdominal_pain", "bleeding", "contractions"] },
  { label: "Child Health", emoji: "👶", preset: "Health concern for a child", specialty: "pediatrics", symptoms: ["fever", "rash", "crying", "feeding_problems"] },
  { label: "Breathing", emoji: "🫁", preset: "Difficulty breathing or shortness of breath", specialty: "general_practice", symptoms: ["shortness_of_breath", "wheezing", "cough"] },
  { label: "Sexual Health", emoji: "🏥", preset: "Sexual health or STI concern", specialty: "general_practice", symptoms: ["discharge", "pain", "sores"] },
  { label: "Dental", emoji: "🦷", preset: "Tooth pain or dental issue", specialty: "general_practice", symptoms: ["tooth_pain", "swelling", "bleeding_gums"] },
  { label: "Other", emoji: "➕", preset: "Something else", specialty: "general_practice", symptoms: [] },
];

const DURATION_OPTIONS = [
  { label: "Just now", value: 1 },
  { label: "Few hours", value: 6 },
  { label: "Today", value: 24 },
  { label: "Few days", value: 72 },
  { label: "Weeks+", value: 336 },
];

export default function TriagePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("complaint");

  // Form state
  const [selectedCategory, setSelectedCategory] = useState<typeof COMPLAINT_CATEGORIES[number] | null>(null);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const [age, setAge] = useState<number>(25);
  const [selectedComorbidities, setSelectedComorbidities] = useState<string[]>([]);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [severity, setSeverity] = useState<number>(5);
  const [spo2, setSpo2] = useState<string>("");
  const [heartRate, setHeartRate] = useState<string>("");
  const [consultType, setConsultType] = useState<ConsultationType>("chat");

  const [triageOutput, setTriageOutput] = useState<ReturnType<typeof runClientTriage> | null>(null);

  function selectCategory(cat: typeof COMPLAINT_CATEGORIES[number]) {
    setSelectedCategory(cat);
    setChiefComplaint(cat.preset);
    // Pre-select relevant symptoms
    setSelectedSymptoms(cat.symptoms.filter((s) => SYMPTOM_OPTIONS.some((o) => o.value === s)));
  }

  function toggleSymptom(value: string) {
    setSelectedSymptoms((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  function runTriage() {
    const input: TriageInput = {
      symptoms: selectedSymptoms,
      chief_complaint: chiefComplaint,
      age,
      comorbidities: selectedComorbidities,
      duration_hours: durationHours,
      vitals: {
        spo2: spo2 ? Number(spo2) : undefined,
        heart_rate: heartRate ? Number(heartRate) : undefined,
      },
    };
    const result = runClientTriage(input);
    setTriageOutput(result);
    setStep("result");
  }

  // Severity colour gradient
  const severityColor =
    severity <= 3 ? "bg-green-500" :
    severity <= 5 ? "bg-yellow-500" :
    severity <= 7 ? "bg-orange-500" : "bg-red-500";

  const severityEmoji = severity <= 2 ? "😊" : severity <= 4 ? "😐" : severity <= 6 ? "😟" : severity <= 8 ? "😣" : "😭";

  function goToBooking() {
    sessionStorage.setItem("zambuko_pending_triage", JSON.stringify({
      chiefComplaint,
      symptoms: selectedSymptoms,
      comorbidities: selectedComorbidities,
      age,
      durationHours,
      severity,
      consultType,
      triageOutput,
      recommendedSpecialty: selectedCategory?.specialty ?? "general_practice",
    }));
    router.push(`/book?specialty=${encodeURIComponent(selectedCategory?.specialty ?? "general_practice")}`);
  }

  const colorMap = {
    green: "bg-green-50 border-green-200",
    yellow: "bg-amber-50 border-amber-200",
    orange: "bg-orange-50 border-orange-200",
    red: "bg-red-50 border-red-200",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => step === "complaint" ? router.back() : setStep(step === "result" ? "vitals" : step === "vitals" ? "symptoms" : "complaint")}
          className="p-1.5 -ml-1.5 rounded-xl text-gray-500 hover:bg-gray-100 transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-gray-900">Symptom Check</h1>
        <div className="ml-auto flex gap-1">
          {(["complaint", "symptoms", "vitals", "result"] as Step[]).map((s, i) => (
            <div key={s} className={`w-6 h-1.5 rounded-full transition-colors ${step === s ? "bg-brand-600" : ["complaint", "symptoms", "vitals", "result"].indexOf(step) > i ? "bg-brand-300" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>

      <div className="px-4 py-5 max-w-lg mx-auto">
        {/* ── STEP 1: Category grid ─────────────────────────────────── */}
        {step === "complaint" && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="text-xl font-black text-gray-900">What's the matter?</h2>
              <p className="text-sm text-gray-500 mt-1">Choose the best description of your issue.</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {COMPLAINT_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  onClick={() => selectCategory(cat)}
                  className={`rounded-2xl p-4 text-left transition-all border-2 active:scale-[0.97] ${
                    selectedCategory?.label === cat.label
                      ? "bg-brand-600 border-brand-500 shadow-lg shadow-brand-200"
                      : "bg-white border-gray-100 hover:border-brand-200 hover:shadow-sm"
                  }`}
                >
                  <span className="text-2xl block mb-2">{cat.emoji}</span>
                  <p className={`font-bold text-sm leading-tight ${selectedCategory?.label === cat.label ? "text-white" : "text-gray-800"}`}>
                    {cat.label}
                  </p>
                </button>
              ))}
            </div>

            {selectedCategory && (
              <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-200">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Your Age</label>
                    <input type="number" min={1} max={120} value={age} onChange={(e) => setAge(Number(e.target.value))}
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Started</label>
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_OPTIONS.map((d) => (
                        <button
                          key={d.value}
                          onClick={() => setDurationHours(d.value)}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                            durationHours === d.value
                              ? "bg-brand-600 text-white border-brand-600"
                              : "bg-white text-gray-600 border-gray-200 hover:border-brand-300"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <Button className="w-full" size="lg" onClick={() => setStep("symptoms")}>
                  Next — Select Symptoms
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Symptoms + severity slider + duration ─────────── */}
        {step === "symptoms" && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="text-xl font-black text-gray-900">How are you feeling?</h2>
              <p className="text-sm text-gray-500 mt-1">Select all that apply. More detail = more accurate result.</p>
            </div>

            {/* Severity slider */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-gray-700">How severe is it?</p>
                <span className="text-2xl">{severityEmoji}</span>
              </div>
              <div className="relative">
                <div className="h-2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 via-orange-400 to-red-600 mb-1" />
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={severity}
                  onChange={(e) => setSeverity(Number(e.target.value))}
                  className="w-full accent-brand-600 -mt-2"
                  style={{ appearance: "auto" }}
                />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Mild</span>
                  <span className={`font-black text-sm ${severity <= 3 ? "text-green-600" : severity <= 6 ? "text-amber-500" : "text-red-500"}`}>
                    {severity}/10
                  </span>
                  <span>Severe</span>
                </div>
              </div>
            </div>

            {/* Symptom chips */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">Symptoms</p>
              <div className="flex flex-wrap gap-2">
                {SYMPTOM_OPTIONS.map((s) => (
                  <button key={s.value} onClick={() => toggleSymptom(s.value)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedSymptoms.includes(s.value) ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200 hover:border-brand-300"}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Known conditions */}
            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">Known Conditions <span className="text-gray-400 font-normal">(optional)</span></p>
              <div className="flex flex-wrap gap-2">
                {COMORBIDITY_OPTIONS.map((c) => (
                  <button key={c.value} onClick={() => setSelectedComorbidities((prev) => prev.includes(c.value) ? prev.filter((x) => x !== c.value) : [...prev, c.value])}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${selectedComorbidities.includes(c.value) ? "bg-amber-500 text-white border-amber-500" : "bg-white text-gray-700 border-gray-200 hover:border-amber-300"}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <Button className="w-full" size="lg" onClick={() => setStep("vitals")}>
              Get Assessment
            </Button>
          </div>
        )}

        {/* ── STEP 3: Vitals ────────────────────────────────────────── */}
        {step === "vitals" && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h2 className="text-xl font-black text-gray-900">Vitals <span className="text-gray-400 font-normal text-base">(optional)</span></h2>
              <p className="text-sm text-gray-500 mt-1">Add if you have a pulse oximeter or monitor. Skip if unsure.</p>
            </div>
            <Card>
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">SpO₂ (%)</label>
                    <input type="number" min={60} max={100} value={spo2} onChange={(e) => setSpo2(e.target.value)}
                      placeholder="e.g. 98"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 block mb-1">Heart Rate (bpm)</label>
                    <input type="number" min={30} max={200} value={heartRate} onChange={(e) => setHeartRate(e.target.value)}
                      placeholder="e.g. 72"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 text-gray-900" />
                  </div>
                </div>
              </CardBody>
            </Card>
            <div>
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Consultation Type</p>
              <div className="grid grid-cols-3 gap-2">
                {(["chat", "audio", "video"] as ConsultationType[]).map((t) => (
                  <button key={t} onClick={() => setConsultType(t)}
                    className={`py-2.5 rounded-xl text-sm font-semibold border transition-all capitalize ${consultType === t ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200"}`}>
                    {t === "chat" ? "💬 Chat" : t === "audio" ? "🎤 Audio" : "📹 Video"}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full" size="lg" onClick={runTriage}>
              Check My Symptoms
            </Button>
          </div>
        )}

        {/* ── STEP 4: Result ────────────────────────────────────────── */}
        {step === "result" && triageOutput && (
          <div className="space-y-4 animate-fade-in">
            <div className={`rounded-2xl border-2 p-4 ${colorMap[triageOutput.color]}`}>
              <div className="flex items-center justify-between mb-2">
                <TriageBadge level={triageOutput.level} />
                <span className="text-lg font-bold text-gray-700">Score: {triageOutput.score}/100</span>
              </div>
              <p className="text-gray-800 font-semibold mt-2">{triageOutput.recommendation}</p>
              {triageOutput.red_flags.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-red-700 mb-1">⚠️ Red Flags Detected:</p>
                  <ul className="space-y-0.5">
                    {triageOutput.red_flags.map((f) => (
                      <li key={f} className="text-xs text-red-600">• {f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {triageOutput.is_offline_result && (
                <p className="text-xs text-gray-500 mt-3 italic">
                  * Preliminary result. AI verification runs when you book.
                </p>
              )}
            </div>

            {triageOutput.level === "emergency" ? (
              <Button variant="emergency" size="lg" className="w-full" onClick={() => router.push("/emergency")}>
                🚨 Request Emergency Now
              </Button>
            ) : (
              <>
                <Button size="lg" className="w-full" onClick={goToBooking}>
                  Find a Doctor
                </Button>
                <Button variant="ghost" size="lg" className="w-full" onClick={() => setStep("symptoms")}>
                  Update Symptoms
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
