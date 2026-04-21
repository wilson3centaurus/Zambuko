"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { createEmergency, getPatientEmergencies } from "@zambuko/database";
import { Button, Card, CardBody } from "@zambuko/ui";
import { toast } from "sonner";
import type { EmergencyType } from "@zambuko/database";

const Map = dynamic(() => import("@/components/EmergencyMap"), { ssr: false, loading: () => <div className="w-full h-56 bg-gray-200 rounded-2xl animate-pulse" /> });

const EMERGENCY_TYPES: { value: EmergencyType; label: string; emoji: string; description: string }[] = [
  { value: "chest_pain", label: "Chest Pain / Heart", emoji: "❤️‍🔥", description: "Heart attack, severe chest pressure" },
  { value: "trauma", label: "Trauma / Accident", emoji: "🚗", description: "Road accident, fall, serious injury" },
  { value: "respiratory", label: "Breathing Problem", emoji: "🫁", description: "Cannot breathe, choking, asthma attack" },
  { value: "stroke", label: "Stroke Symptoms", emoji: "🧠", description: "Sudden weakness, facial drooping, speech loss" },
  { value: "maternity", label: "Maternity Emergency", emoji: "🤱", description: "Labour, pregnancy complication" },
  { value: "other", label: "Other Emergency", emoji: "🚨", description: "Any other life-threatening situation" },
];

type Coords = { lat: number; lng: number };

export default function EmergencyPage() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState<"type" | "confirm" | "dispatched">("type");
  const [selectedType, setSelectedType] = useState<EmergencyType | null>(null);
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeEmergencyId, setActiveEmergencyId] = useState<string | null>(null);

  // Get GPS location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError("GPS not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        // Default to Harare if GPS denied
        setCoords({ lat: -17.8292, lng: 31.0522 });
        setLocationError("Could not get exact location. Using approximate location.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  // Restore active emergency from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem("zambuko_active_emergency");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as { id: string; type: EmergencyType };
        setActiveEmergencyId(parsed.id);
        setSelectedType(parsed.type);
        setStep("dispatched");
      } catch {
        localStorage.removeItem("zambuko_active_emergency");
      }
    }
  }, []);

  // Subscribe to active emergency updates (with dispatcher contact)
  const { data: activeEmergency } = useQuery({
    queryKey: ["active-emergency", activeEmergencyId],
    queryFn: async () => {
      if (!activeEmergencyId) return null;
      const { data } = await supabase
        .from("emergencies")
        .select("*, dispatchers(unit_id, vehicle_type, location_lat, location_lng, profiles(full_name, phone))")
        .eq("id", activeEmergencyId)
        .single();
      return data;
    },
    enabled: !!activeEmergencyId,
    refetchInterval: 5000,
  });

  // Clear localStorage when emergency is resolved or declined
  useEffect(() => {
    if (!activeEmergency) return;
    if (activeEmergency.status === "resolved" || activeEmergency.status === "cancelled") {
      localStorage.removeItem("zambuko_active_emergency");
    }
  }, [activeEmergency?.status]);

  const handleSOS = useCallback(async () => {
    if (!selectedType || !coords) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      const emergency = await createEmergency(supabase, {
        patientId: user.id,
        type: selectedType,
        description: description || `Emergency: ${selectedType}`,
        lat: coords.lat,
        lng: coords.lng,
        priority: selectedType === "chest_pain" || selectedType === "stroke" || selectedType === "respiratory" ? 5 : 3,
      });

      // Dispatch nearest responder
      await supabase.rpc("dispatch_nearest_responder", {
        p_emergency_id: emergency.id,
        p_patient_lat: coords.lat,
        p_patient_lng: coords.lng,
      });

      setActiveEmergencyId(emergency.id);
      localStorage.setItem(
        "zambuko_active_emergency",
        JSON.stringify({ id: emergency.id, type: selectedType })
      );
      setStep("dispatched");
      toast.success("Emergency services alerted!");
    } catch (err) {
      toast.error("Could not send SOS. Please call 994 directly.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedType, coords, description, supabase, router]);

  return (
    <div className="min-h-screen bg-red-950 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-safe py-3 flex items-center gap-3">
        <button onClick={() => step === "type" ? router.back() : setStep("type")}
          className="p-1.5 rounded-xl text-red-300 hover:bg-red-900">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="font-bold text-white text-lg">Emergency</h1>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
          <span className="text-red-300 text-sm font-medium">LIVE</span>
        </div>
      </div>

      <div className="flex-1 px-4 space-y-4">
        {/* Step 1: Choose type */}
        {step === "type" && (
          <>
            <div className="text-center py-4">
              <p className="text-red-300 text-sm font-medium uppercase tracking-wider">SELECT EMERGENCY TYPE</p>
              <p className="text-white text-lg font-bold mt-1">What is happening?</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {EMERGENCY_TYPES.map((type) => (
                <button key={type.value} onClick={() => setSelectedType(type.value)}
                  className={`rounded-2xl p-4 text-left transition-all border-2 ${
                    selectedType === type.value
                      ? "bg-red-600 border-red-400 scale-[1.02]"
                      : "bg-red-900/50 border-red-800 hover:bg-red-900"
                  }`}>
                  <span className="text-3xl block mb-2">{type.emoji}</span>
                  <p className="font-bold text-white text-sm leading-tight">{type.label}</p>
                  <p className="text-red-300 text-xs mt-0.5 leading-tight">{type.description}</p>
                </button>
              ))}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional details (optional)…"
              rows={2}
              className="w-full bg-red-900/50 border border-red-800 text-white placeholder-red-400 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none text-sm"
            />

            <button
              disabled={!selectedType || !coords || loading}
              onClick={() => setStep("confirm")}
              className={`w-full py-5 rounded-3xl font-black text-2xl tracking-wider transition-all ${
                selectedType && coords
                  ? "bg-red-600 text-white shadow-lg shadow-red-900 active:scale-[0.97] hover:bg-red-500"
                  : "bg-red-900 text-red-600 cursor-not-allowed"
              }`}>
              🚨 SOS
            </button>

            {locationError && (
              <p className="text-center text-xs text-red-400">{locationError}</p>
            )}
            {!coords && !locationError && (
              <p className="text-center text-xs text-red-400 animate-pulse">Getting your location…</p>
            )}

            <p className="text-center text-xs text-red-500 pb-4">
              Or call Zimbabwe Emergency Services directly: <a href="tel:994" className="font-bold underline text-red-300">994</a> / <a href="tel:999" className="font-bold underline text-red-300">999</a>
            </p>
          </>
        )}

        {/* Step 2: Confirm */}
        {step === "confirm" && selectedType && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center py-4">
              <span className="text-6xl block mb-3">{EMERGENCY_TYPES.find(t => t.value === selectedType)?.emoji}</span>
              <p className="text-white font-bold text-xl">{EMERGENCY_TYPES.find(t => t.value === selectedType)?.label}</p>
              <p className="text-red-300 text-sm mt-1">Confirm your location and send SOS</p>
            </div>

            {coords && <Map lat={coords.lat} lng={coords.lng} />}

            <Card className="bg-red-900/50 border-red-800">
              <CardBody className="space-y-2">
                <p className="text-red-300 text-xs font-semibold uppercase tracking-wide">YOUR LOCATION</p>
                <p className="text-white text-sm">
                  {coords ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}` : "Detecting..."}
                </p>
                {locationError && <p className="text-red-400 text-xs">{locationError}</p>}
              </CardBody>
            </Card>

            <button
              disabled={loading}
              onClick={handleSOS}
              className="w-full py-5 rounded-3xl bg-red-600 hover:bg-red-500 text-white font-black text-2xl tracking-wider shadow-lg shadow-red-900 active:scale-[0.97] transition-all disabled:opacity-60">
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                  Sending SOS…
                </span>
              ) : "🚨 CONFIRM & SEND SOS"}
            </button>
          </div>
        )}

        {/* Step 3: Dispatched */}
        {step === "dispatched" && (
          <div className="space-y-4 animate-fade-in">
            {/* Status-aware header */}
            {activeEmergency?.status === "en_route" ? (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl">🚑</span>
                </div>
                <p className="text-white font-black text-2xl">Help is on the way!</p>
                <p className="text-blue-300 text-sm mt-2">A responder is driving to your location.</p>
              </div>
            ) : activeEmergency?.status === "arrived" ? (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-white font-black text-2xl">Responder Arrived!</p>
                <p className="text-green-300 text-sm mt-2">Help has arrived at your location.</p>
              </div>
            ) : activeEmergency?.status === "dispatched" ? (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl">📡</span>
                </div>
                <p className="text-white font-black text-2xl">Dispatched!</p>
                <p className="text-amber-300 text-sm mt-2">A responder has been assigned and is preparing.</p>
              </div>
            ) : (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <span className="text-4xl">🚨</span>
                </div>
                <p className="text-white font-black text-2xl">SOS Sent!</p>
                <p className="text-red-300 text-sm mt-2">Finding a nearby responder…</p>
              </div>
            )}

            {/* Always show map */}
            {coords && <Map lat={coords.lat} lng={coords.lng} dispatcherLat={activeEmergency?.dispatchers?.location_lat} dispatcherLng={activeEmergency?.dispatchers?.location_lng} />}

            {activeEmergency && (
              <Card className="bg-red-900/50 border-red-800">
                <CardBody className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-red-300 text-xs font-semibold uppercase tracking-wide">RESPONDER STATUS</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${
                      activeEmergency.status === "dispatched" ? "bg-amber-700 text-amber-200" :
                      activeEmergency.status === "en_route" ? "bg-blue-700 text-blue-200" :
                      activeEmergency.status === "arrived" ? "bg-green-700 text-green-200" :
                      "bg-gray-700 text-gray-300"
                    }`}>{activeEmergency.status.replace("_", " ")}</span>
                  </div>
                  {activeEmergency.estimated_arrival_minutes && (
                    <div className="text-center">
                      <p className="text-white text-3xl font-black">{activeEmergency.estimated_arrival_minutes} min</p>
                      <p className="text-red-300 text-sm">estimated arrival</p>
                    </div>
                  )}

                  {/* Dispatcher contact card */}
                  {activeEmergency.dispatchers?.profiles && (
                    <div className="border-t border-red-800 pt-3 space-y-2">
                      <p className="text-red-300 text-xs font-semibold uppercase tracking-wide">Your Responder</p>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-bold">
                            {activeEmergency.dispatchers.profiles.full_name ?? "Dispatcher"}
                          </p>
                          {activeEmergency.dispatchers.unit_id && (
                            <p className="text-red-300 text-xs">
                              Unit {activeEmergency.dispatchers.unit_id}
                              {activeEmergency.dispatchers.vehicle_type ? ` · ${activeEmergency.dispatchers.vehicle_type}` : ""}
                            </p>
                          )}
                        </div>
                        {activeEmergency.dispatchers.profiles.phone && (
                          <a
                            href={`tel:${activeEmergency.dispatchers.profiles.phone}`}
                            className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl"
                          >
                            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.58.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.01L6.6 10.8z"/>
                            </svg>
                            Call
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            )}

            {/* If emergency was declined, show re-declare option */}
            {activeEmergency?.status === "declined" && (
              <div className="bg-amber-900/50 border border-amber-700 rounded-2xl p-4 space-y-3">
                <p className="text-amber-300 font-semibold text-sm">⚠️ Responder Declined</p>
                <p className="text-amber-200 text-xs">The nearest unit was unavailable. The system is finding the next closest responder.</p>
                <button
                  onClick={() => {
                    localStorage.removeItem("zambuko_active_emergency");
                    setStep("type");
                    setActiveEmergencyId(null);
                  }}
                  className="w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-sm"
                >
                  Re-Declare Emergency
                </button>
              </div>
            )}

            <div className="bg-red-900/30 border border-red-800 rounded-2xl p-4 space-y-2">
              <p className="text-white font-semibold text-sm">While you wait:</p>
              <ul className="space-y-1 text-red-300 text-sm">
                <li>• Stay on the line if asked to call</li>
                <li>• Unlock doors or gates for the responder</li>
                <li>• Keep the patient still and calm</li>
                <li>• Do not give food or water unless instructed</li>
              </ul>
            </div>

            <a href="tel:994" className="block w-full py-3.5 rounded-2xl bg-white text-red-700 font-bold text-center">
              📞 Call 994 Directly
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
