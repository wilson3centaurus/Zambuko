// packages/offline/src/sync.ts
// Bi-directional sync engine between local Dexie DB and Supabase
// Strategy: optimistic local writes → background sync to server

import { getLocalDB } from "./schema";

// Minimal type for the Supabase client methods we use
type SupabaseClient = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
};

// ─── Pull from server → local ─────────────────────────────────────────────────

/**
 * Pull the current user's data from Supabase into local Dexie DB.
 * Called on app load and when connectivity is restored.
 */
export async function pullUserData(supabase: SupabaseClient, userId: string): Promise<void> {
  const db = getLocalDB();
  if (!db) return;

  try {
    // Pull consultations
    const { data: consultations } = await supabase
      .from("consultations")
      .select("id, patient_id, doctor_id, status, type, triage_level, chief_complaint, symptoms, doctor_notes, diagnosis, started_at, ended_at, created_at, updated_at")
      .or(`patient_id.eq.${userId},doctor_id.eq.${userId}`)
      .order("updated_at", { ascending: false })
      .limit(100);

    if (consultations?.length) {
      await db.consultations.bulkPut(
        consultations.map((c: any) => ({ ...c, _is_dirty: false, _sync_error: null }))
      );
    }

    // Pull messages for active consultations
    const activeIds = (consultations ?? [])
      .filter((c: any) => ["accepted", "active"].includes(c.status))
      .map((c: any) => c.id);

    if (activeIds.length) {
      const { data: messages } = await supabase
        .from("messages")
        .select("id, consultation_id, sender_id, type, content, file_url, is_read, created_at")
        .in("consultation_id", activeIds)
        .order("created_at", { ascending: true });

      if (messages?.length) {
        await db.messages.bulkPut(
          messages.map((m: any) => ({ ...m, _is_pending: false }))
        );
      }
    }

    // Pull prescriptions
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select("id, consultation_id, patient_id, doctor_id, medications, status, valid_until, created_at, updated_at")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (prescriptions?.length) {
      await db.prescriptions.bulkPut(prescriptions);
    }

    // Pull available doctors (for offline browse)
    const { data: doctors } = await supabase
      .from("doctors")
      .select(`
        id, specialty, status, rating, queue_length,
        location_lat, location_lng, consultation_fee_usd,
        heartbeat_at, updated_at,
        profiles!inner(id, full_name, avatar_url, bio)
      `)
      .eq("status", "available")
      .limit(50);

    if (doctors?.length) {
      await db.doctors.bulkPut(
        doctors.map((d: Record<string, unknown>) => {
          const profile = d.profiles as Record<string, unknown>;
          return {
            ...d,
            full_name: profile.full_name as string,
            avatar_url: profile.avatar_url as string | null,
            bio: profile.bio as string | null,
            profiles: undefined,
          };
        })
      );
    }
  } catch (err) {
    console.warn("Sync pull failed (continuing offline):", err);
  }
}

// ─── Push local queue → server ────────────────────────────────────────────────

/**
 * Process the local sync queue and push pending changes to Supabase.
 * Called when connectivity is restored.
 */
export async function flushSyncQueue(supabase: SupabaseClient): Promise<void> {
  const db = getLocalDB();
  if (!db) return;

  const pending = await db.sync_queue
    .orderBy("created_at")
    .filter((entry) => entry.retry_count < 5)
    .toArray();

  for (const entry of pending) {
    try {
      let error: unknown = null;

      if (entry.operation === "INSERT" || entry.operation === "UPDATE") {
        const result = await supabase.from(entry.table).upsert(entry.payload);
        error = result.error;
      } else if (entry.operation === "DELETE") {
        const result = await supabase.from(entry.table).delete().eq("id", entry.record_id);
        error = result.error;
      }

      if (error) {
        throw error;
      }

      // Success — remove from queue
      if (entry.id !== undefined) {
        await db.sync_queue.delete(entry.id);
      }
    } catch (err) {
      // Increment retry count
      if (entry.id !== undefined) {
        await db.sync_queue.update(entry.id, {
          retry_count: entry.retry_count + 1,
          last_error: String(err),
        });
      }
    }
  }
}

/**
 * Queue a local write operation for later sync.
 * Call this immediately after writing to local DB optimistically.
 */
export async function enqueueSync(
  operation: "INSERT" | "UPDATE" | "DELETE",
  table: string,
  recordId: string,
  payload: Record<string, unknown>
): Promise<void> {
  const db = getLocalDB();
  if (!db) return;

  await db.sync_queue.add({
    operation,
    table,
    record_id: recordId,
    payload,
    created_at: new Date().toISOString(),
    retry_count: 0,
    last_error: null,
  });
}

// ─── Connectivity listener ────────────────────────────────────────────────────

let _supabase: SupabaseClient | null = null;

/**
 * Set up automatic sync when browser comes back online.
 * Call once at app initialization.
 */
export function setupConnectivitySync(supabase: SupabaseClient, userId: string): () => void {
  _supabase = supabase;

  const handleOnline = async () => {
    console.log("[Zambuko Sync] Back online — syncing...");
    await flushSyncQueue(supabase);
    await pullUserData(supabase, userId);
  };

  window.addEventListener("online", handleOnline);
  return () => window.removeEventListener("online", handleOnline);
}

export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}
