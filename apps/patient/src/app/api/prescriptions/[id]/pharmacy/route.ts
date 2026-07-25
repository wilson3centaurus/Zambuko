import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerSideClient } from "@zambuko/database/client";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Prescription service is not configured." }, { status: 503 });
  }

  const userClient = createServerSideClient(cookies());
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { pharmacyId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!UUID_PATTERN.test(params.id) || !body.pharmacyId || !UUID_PATTERN.test(body.pharmacyId)) {
    return NextResponse.json({ error: "A valid prescription and pharmacy are required." }, { status: 400 });
  }

  const admin = createAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [{ data: prescription, error: prescriptionError }, { data: pharmacy, error: pharmacyError }] = await Promise.all([
    admin
      .from("prescriptions")
      .select("id, patient_id, status, valid_until")
      .eq("id", params.id)
      .single(),
    admin
      .from("pharmacies")
      .select("id, name, is_active")
      .eq("id", body.pharmacyId)
      .eq("is_active", true)
      .single(),
  ]);

  if (prescriptionError || !prescription || prescription.patient_id !== user.id) {
    return NextResponse.json({ error: "Prescription not found." }, { status: 404 });
  }
  if (pharmacyError || !pharmacy) {
    return NextResponse.json({ error: "This pharmacy is not currently available." }, { status: 404 });
  }
  if (prescription.status !== "issued") {
    return NextResponse.json({ error: "This prescription has already been sent or cannot be changed." }, { status: 409 });
  }
  if (new Date(`${prescription.valid_until}T23:59:59`) < new Date()) {
    return NextResponse.json({ error: "This prescription has expired." }, { status: 409 });
  }

  const { error: updateError } = await admin
    .from("prescriptions")
    .update({ pharmacy_id: pharmacy.id, status: "sent_to_pharmacy" })
    .eq("id", prescription.id)
    .eq("status", "issued");

  if (updateError) {
    return NextResponse.json({ error: "The pharmacy request could not be saved." }, { status: 500 });
  }

  return NextResponse.json({
    prescriptionId: prescription.id,
    status: "sent_to_pharmacy",
    pharmacy: { id: pharmacy.id, name: pharmacy.name },
  });
}
