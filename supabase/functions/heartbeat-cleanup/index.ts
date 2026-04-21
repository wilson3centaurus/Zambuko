// supabase/functions/heartbeat-cleanup/index.ts
// Runs every 2 minutes via Supabase cron to mark stale doctors/dispatchers offline
// Set up in Supabase Dashboard → Edge Functions → Schedule

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Allow internal cron calls only (no JWT required, but we check a secret header)
  const cronSecret = req.headers.get("x-cron-secret");
  if (cronSecret !== Deno.env.get("CRON_SECRET")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Mark stale doctors offline
  const { data: doctorCount } = await supabase.rpc("mark_stale_doctors_offline");

  // Mark stale dispatchers offline
  const { data: dispatcherCount } = await supabase.rpc("mark_stale_dispatchers_offline");

  // Expire pending consultations older than 30 minutes (no doctor responded)
  const { count: expiredCount } = await supabase
    .from("consultations")
    .update({ status: "cancelled" })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
    .select("id", { count: "exact", head: true });

  // Expire pending payments older than 2 hours (Paynow payment window)
  await supabase
    .from("payments")
    .update({ status: "expired", failure_reason: "Payment window expired" })
    .eq("status", "pending")
    .lt("created_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

  const result = {
    doctors_marked_offline: doctorCount ?? 0,
    dispatchers_marked_offline: dispatcherCount ?? 0,
    consultations_expired: expiredCount ?? 0,
    timestamp: new Date().toISOString(),
  };

  console.log("Heartbeat cleanup:", result);

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json" },
  });
});
