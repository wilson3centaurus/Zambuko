// packages/triage/src/engine.ts
// Client-side triage — runs instantly offline, then validates with AI on server

export type TriageLevel = "low" | "moderate" | "high" | "emergency";

export interface TriageInput {
  symptoms: string[];
  age: number;
  chief_complaint?: string;
  gender?: "male" | "female" | "other";
  duration_hours?: number;
  vitals?: {
    spo2?: number;
    heart_rate?: number;
    respiratory_rate?: number;
    temperature_c?: number;
    systolic_bp?: number;
  };
  comorbidities?: string[];
}

export interface TriageOutput {
  level: TriageLevel;
  score: number;                    // 0–100
  color: "green" | "yellow" | "orange" | "red";
  label: string;
  recommendation: string;
  red_flags: string[];
  is_offline_result: boolean;       // true = client-side rule-based only
}

// Symptom weights — clinically ordered by severity
const SYMPTOM_WEIGHTS: Record<string, number> = {
  // Emergency (50+)
  chest_pain: 60,
  crushing_chest_pain: 70,
  not_breathing: 90,
  unconscious: 85,
  severe_bleeding: 70,
  stroke_symptoms: 75,
  seizure: 65,
  anaphylaxis: 70,
  severe_allergic_reaction: 60,
  suicidal_thoughts: 65,
  // High (25–49)
  shortness_of_breath: 40,
  difficulty_breathing: 38,
  high_fever: 30,
  altered_consciousness: 45,
  severe_pain: 35,
  persistent_vomiting: 28,
  severe_dehydration: 32,
  trauma_head: 40,
  pregnancy_bleeding: 50,
  preterm_labor: 45,
  // Moderate (10–24)
  fever: 15,
  vomiting: 12,
  diarrhea: 10,
  moderate_pain: 15,
  swollen_joints: 12,
  rash_spreading: 14,
  ear_pain: 10,
  eye_redness: 10,
  // Low (<10)
  mild_headache: 5,
  cough: 6,
  sore_throat: 5,
  runny_nose: 3,
  mild_pain: 4,
  fatigue: 5,
  skin_rash: 7,
  itching: 4,
};

const AGE_MULTIPLIER = (age: number): number => {
  if (age < 2) return 1.5;   // very young children
  if (age < 12) return 1.2;  // children
  if (age > 75) return 1.3;  // elderly
  if (age > 60) return 1.1;
  return 1.0;
};

const COMORBIDITY_WEIGHTS: Record<string, number> = {
  diabetes: 10,
  hypertension: 8,
  heart_disease: 15,
  hiv_aids: 12,
  copd: 12,
  asthma: 8,
  pregnancy: 10,
  cancer: 12,
  kidney_disease: 10,
  liver_disease: 10,
  immunocompromised: 14,
};

function checkVitalRedFlags(vitals: NonNullable<TriageInput["vitals"]>): string[] {
  const flags: string[] = [];
  if (vitals.spo2 !== undefined && vitals.spo2 < 94) flags.push(`Low oxygen saturation: ${vitals.spo2}%`);
  if (vitals.heart_rate !== undefined && (vitals.heart_rate > 120 || vitals.heart_rate < 50)) {
    flags.push(`Abnormal heart rate: ${vitals.heart_rate} bpm`);
  }
  if (vitals.respiratory_rate !== undefined && vitals.respiratory_rate > 25) {
    flags.push(`High respiratory rate: ${vitals.respiratory_rate}/min`);
  }
  if (vitals.temperature_c !== undefined && vitals.temperature_c > 39.5) {
    flags.push(`High fever: ${vitals.temperature_c}°C`);
  }
  if (vitals.systolic_bp !== undefined && vitals.systolic_bp > 180) {
    flags.push(`Hypertensive crisis: ${vitals.systolic_bp} mmHg`);
  }
  if (vitals.systolic_bp !== undefined && vitals.systolic_bp < 90) {
    flags.push(`Low blood pressure: ${vitals.systolic_bp} mmHg`);
  }
  return flags;
}

export function runClientTriage(input: TriageInput): TriageOutput {
  const symptomSet = new Set(input.symptoms.map((s) => s.toLowerCase().replace(/\s+/g, "_")));
  const vitals = input.vitals ?? {};
  const red_flags: string[] = [];

  // ── Immediate emergency detection ──
  const emergencySymptoms = [
    "chest_pain", "crushing_chest_pain", "not_breathing", "unconscious",
    "severe_bleeding", "stroke_symptoms", "seizure", "anaphylaxis",
    "pregnancy_bleeding",
  ];
  const hasEmergencySymptom = emergencySymptoms.some((s) => symptomSet.has(s));
  const criticalVitals =
    (vitals.spo2 !== undefined && vitals.spo2 < 90) ||
    (vitals.heart_rate !== undefined && (vitals.heart_rate > 150 || vitals.heart_rate < 40)) ||
    (vitals.systolic_bp !== undefined && vitals.systolic_bp < 80);

  if (hasEmergencySymptom || criticalVitals) {
    return {
      level: "emergency",
      score: 100,
      color: "red",
      label: "Emergency",
      recommendation:
        "Seek emergency care immediately. Press the Emergency button to dispatch an ambulance.",
      red_flags: [...emergencySymptoms.filter((s) => symptomSet.has(s)), ...checkVitalRedFlags(vitals)],
      is_offline_result: true,
    };
  }

  // ── Calculate risk score ──
  let score = 0;

  // Symptoms
  for (const symptom of input.symptoms) {
    const normalized = symptom.toLowerCase().replace(/\s+/g, "_");
    score += SYMPTOM_WEIGHTS[normalized] ?? 3;
  }

  // Vitals
  const vitalFlags = checkVitalRedFlags(vitals);
  red_flags.push(...vitalFlags);
  score += vitalFlags.length * 8;

  // Age factor
  score *= AGE_MULTIPLIER(input.age);

  // Comorbidities
  for (const condition of input.comorbidities ?? []) {
    score += COMORBIDITY_WEIGHTS[condition.toLowerCase()] ?? 5;
  }

  // Duration adjustment (symptoms > 24h → slightly more concerning)
  if (input.duration_hours && input.duration_hours > 24) score += 5;
  if (input.duration_hours && input.duration_hours > 72) score += 10;

  score = Math.min(99, Math.round(score));

  // ── Classify ──
  if (score >= 60) {
    return {
      level: "high",
      score,
      color: "orange",
      label: "High Priority",
      recommendation: "See a doctor today. Your symptoms need prompt medical attention.",
      red_flags,
      is_offline_result: true,
    };
  }
  if (score >= 30) {
    return {
      level: "moderate",
      score,
      color: "yellow",
      label: "Moderate",
      recommendation: "Book a consultation within the next few hours.",
      red_flags,
      is_offline_result: true,
    };
  }

  return {
    level: "low",
    score,
    color: "green",
    label: "Low Priority",
    recommendation: "Your symptoms appear non-urgent. Book a routine consultation at your convenience.",
    red_flags,
    is_offline_result: true,
  };
}

// ── Constants for UI ──────────────────────────────────────────────────────────

export const SYMPTOM_OPTIONS = [
  { value: "chest_pain", label: "Chest Pain" },
  { value: "shortness_of_breath", label: "Shortness of Breath" },
  { value: "high_fever", label: "High Fever (>39°C)" },
  { value: "fever", label: "Fever" },
  { value: "cough", label: "Cough" },
  { value: "sore_throat", label: "Sore Throat" },
  { value: "vomiting", label: "Vomiting" },
  { value: "diarrhea", label: "Diarrhoea" },
  { value: "headache", label: "Headache" },
  { value: "mild_headache", label: "Mild Headache" },
  { value: "abdominal_pain", label: "Abdominal Pain" },
  { value: "severe_pain", label: "Severe Pain" },
  { value: "rash_spreading", label: "Spreading Rash" },
  { value: "skin_rash", label: "Skin Rash" },
  { value: "eye_redness", label: "Eye Redness / Discharge" },
  { value: "ear_pain", label: "Ear Pain" },
  { value: "difficulty_breathing", label: "Difficulty Breathing" },
  { value: "fatigue", label: "Fatigue / Weakness" },
  { value: "dizziness", label: "Dizziness" },
  { value: "unconscious", label: "Unconscious / Unresponsive" },
  { value: "seizure", label: "Seizure" },
  { value: "stroke_symptoms", label: "Stroke Symptoms (face drooping, arm weakness)" },
  { value: "severe_bleeding", label: "Severe Bleeding" },
  { value: "pregnancy_bleeding", label: "Bleeding in Pregnancy" },
  { value: "swollen_joints", label: "Swollen Joints" },
  { value: "back_pain", label: "Back Pain" },
  { value: "itching", label: "Itching" },
  { value: "runny_nose", label: "Runny Nose" },
];

export const COMORBIDITY_OPTIONS = [
  { value: "diabetes", label: "Diabetes" },
  { value: "hypertension", label: "High Blood Pressure" },
  { value: "heart_disease", label: "Heart Disease" },
  { value: "asthma", label: "Asthma" },
  { value: "copd", label: "COPD / Emphysema" },
  { value: "hiv_aids", label: "HIV/AIDS" },
  { value: "pregnancy", label: "Pregnant" },
  { value: "cancer", label: "Cancer" },
  { value: "kidney_disease", label: "Kidney Disease" },
  { value: "liver_disease", label: "Liver Disease" },
];
