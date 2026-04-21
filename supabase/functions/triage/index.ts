// supabase/functions/triage/index.ts
// AI-powered symptom triage using OpenAI GPT-4o-mini
// Called from patient app after symptom entry

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TriageRequest {
  symptoms: string[];
  chief_complaint: string;
  age: number;
  gender?: string;
  vitals?: {
    spo2?: number;
    heart_rate?: number;
    respiratory_rate?: number;
    temperature?: number;
    systolic_bp?: number;
  };
  comorbidities?: string[];
  duration_hours?: number;
}

interface TriageResult {
  level: "low" | "moderate" | "high" | "emergency";
  score: number;
  reasoning: string;
  recommendation: string;
  recommended_specialties: string[];
  red_flags: string[];
  estimated_wait_ok_hours?: number;
}

// Rule-based emergency detection — runs BEFORE calling OpenAI
function detectImmediateEmergency(req: TriageRequest): TriageResult | null {
  const symptomSet = new Set(req.symptoms.map((s) => s.toLowerCase()));
  const vitals = req.vitals ?? {};

  const isEmergency =
    symptomSet.has("chest_pain") ||
    symptomSet.has("chest pain") ||
    symptomSet.has("unconscious") ||
    symptomSet.has("not breathing") ||
    symptomSet.has("severe_bleeding") ||
    symptomSet.has("stroke") ||
    symptomSet.has("seizure") ||
    (vitals.spo2 !== undefined && vitals.spo2 < 90) ||
    (vitals.heart_rate !== undefined && vitals.heart_rate > 150) ||
    (vitals.heart_rate !== undefined && vitals.heart_rate < 40) ||
    (vitals.systolic_bp !== undefined && vitals.systolic_bp > 180) ||
    (vitals.respiratory_rate !== undefined && vitals.respiratory_rate > 30);

  if (!isEmergency) return null;

  return {
    level: "emergency",
    score: 100,
    reasoning:
      "Critical vital signs or symptoms detected requiring immediate emergency intervention.",
    recommendation:
      "CALL EMERGENCY SERVICES IMMEDIATELY. Do not wait. If possible, have someone stay with the patient.",
    recommended_specialties: ["emergency_medicine"],
    red_flags: req.symptoms.filter((s) =>
      ["chest_pain", "unconscious", "severe_bleeding", "stroke", "seizure"].some((e) =>
        s.toLowerCase().includes(e)
      )
    ),
    estimated_wait_ok_hours: 0,
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Confirm user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: TriageRequest = await req.json();

    // Validate required fields
    if (!body.symptoms?.length || !body.chief_complaint || !body.age) {
      return new Response(
        JSON.stringify({ error: "symptoms, chief_complaint, and age are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fast-path: rule-based emergency detection
    const immediateResult = detectImmediateEmergency(body);
    if (immediateResult) {
      return new Response(JSON.stringify(immediateResult), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // AI triage via OpenAI
    const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

    const systemPrompt = `You are a medical triage AI assistant for Zambuko, a telehealth platform serving Zimbabwe. 
Your role is to assess patient symptoms and assign a triage priority level.
Context: Many patients are in rural areas with limited access to hospitals. 
Available medical specialties: general_practice, emergency_medicine, pediatrics, obstetrics, cardiology, dermatology, psychiatry, orthopedics, ophthalmology, ent, dentistry, neurology.
Always err on the side of caution. Respond ONLY with valid JSON.`;

    const userPrompt = `Assess this patient and return a JSON triage result.

Patient details:
- Age: ${body.age} years
- Gender: ${body.gender ?? "not specified"}
- Chief complaint: ${body.chief_complaint}
- Symptoms: ${body.symptoms.join(", ")}
- Duration: ${body.duration_hours ? `${body.duration_hours} hours` : "not specified"}
- Vitals: ${JSON.stringify(body.vitals ?? {})}
- Known conditions: ${(body.comorbidities ?? []).join(", ") || "none"}

Return ONLY this JSON structure:
{
  "level": "low|moderate|high|emergency",
  "score": <0-100 integer>,
  "reasoning": "<2-3 sentence clinical reasoning>",
  "recommendation": "<clear actionable advice for the patient>",
  "recommended_specialties": ["<specialty1>", "<specialty2>"],
  "red_flags": ["<symptom or sign>"],
  "estimated_wait_ok_hours": <number or null>
}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 500,
    });

    const content = response.choices[0].message.content;
    if (!content) throw new Error("Empty response from AI model");
    const result: TriageResult = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Triage error:", error);
    return new Response(
      JSON.stringify({ error: "Triage service unavailable. Please try again." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
