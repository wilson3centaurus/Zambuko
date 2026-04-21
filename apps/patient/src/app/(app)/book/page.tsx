"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { createConsultation } from "@zambuko/database";
import { Card, CardBody, Button } from "@zambuko/ui";
import { toast } from "sonner";

type DoctorMatch = {
  doctor_id: string;
  full_name: string;
  specialty: string;
  rating: number;
  rating_count: number;
  queue_length: number;
  distance_km: number;
  match_score: number;
  consultation_fee_usd: number;
  avatar_url: string | null;
  status: string;
  bio?: string;
};

type PendingTriage = {
  chiefComplaint: string;
  symptoms: string[];
  comorbidities: string[];
  age: number;
  durationHours: number;
  severity: number;
  consultType: string;
  triageOutput: { level: string; score: number; recommendation: string; red_flags: string[] };
  recommendedSpecialty: string;
};

type PaymentWaiting = {
  paymentId: string;
  consultationId: string;
  message: string;
};

type PaymentScreen = "waiting" | "failed" | "cancelled";

const CONSULT_TYPES = [
  { value: "chat",      label: "Chat",       icon: "💬" },
  { value: "audio",     label: "Voice Call", icon: "📞" },
  { value: "video",     label: "Video Call", icon: "🎥" },
  { value: "in_person", label: "In Person",  icon: "🏥" },
] as const;

function BookContent() {
  const router = useRouter();
  const params = useSearchParams();
  const specialtyParam = (params.get("specialty") ?? "general_practice") as string;
  const supabase = createClient();

  const [triageData] = useState<PendingTriage | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem("zambuko_pending_triage");
      return stored ? (JSON.parse(stored) as PendingTriage) : null;
    } catch { return null; }
  });

  const [bookingDoctorId, setBookingDoctorId] = useState<string | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<"ecocash" | "onemoney" | "telecash">("ecocash");
  const [phone, setPhone] = useState("");
  const [showPayModal, setShowPayModal] = useState<DoctorMatch | null>(null);
  const [paymentWaiting, setPaymentWaiting] = useState<PaymentWaiting | null>(null);
  const [paymentScreen, setPaymentScreen] = useState<PaymentScreen>("waiting");
  // Consultation type — default from triage or chat
  const [consultType, setConsultType] = useState<"chat" | "audio" | "video" | "in_person">(
    () => (triageData?.consultType ?? "chat") as "chat" | "audio" | "video" | "in_person"
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll payment status every 5s
  useEffect(() => {
    if (!paymentWaiting) return;
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 72) {
        clearInterval(pollRef.current!);
        pollRef.current = null;
        setPaymentScreen("failed");
        return;
      }
      try {
        const res = await fetch(`/api/payments/status/${paymentWaiting.paymentId}`);
        const data = await res.json();
        if (data.status === "paid") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          toast.success("Payment confirmed! Connecting you to your doctor.");
          router.push(`/consultation/${paymentWaiting.consultationId}`);
        } else if (data.status === "failed") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setPaymentScreen("failed");
        }
      } catch { /* continue polling */ }
    }, 5000);
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [paymentWaiting, router]);

  const resolvedSpecialty: string = triageData?.recommendedSpecialty ?? specialtyParam;
  const STATUS_ORDER: Record<string, number> = { available: 0, in_session: 1, offline: 2 };

  const { data: doctors, isLoading: loadingDoctors } = useQuery<DoctorMatch[]>({
    queryKey: ["doctors", resolvedSpecialty],
    queryFn: async () => {
      const cols = "id, specialty, status, rating, rating_count, queue_length, consultation_fee_usd, bio, location_name, emergency_capable, profiles!inner(full_name, avatar_url)";
      function mapRow(d: Record<string, unknown>): DoctorMatch {
        return {
          doctor_id: d.id as string,
          full_name: (d.profiles as { full_name: string })?.full_name ?? "Doctor",
          specialty: d.specialty as string,
          status: d.status as string,
          rating: (d.rating as number) ?? 0,
          rating_count: (d.rating_count as number) ?? 0,
          queue_length: (d.queue_length as number) ?? 0,
          distance_km: 0,
          match_score: 0,
          consultation_fee_usd: (d.consultation_fee_usd as number) ?? 0,
          avatar_url: (d.profiles as { avatar_url: string | null })?.avatar_url ?? null,
          bio: (d.bio as string) ?? "",
        };
      }
      function sortByStatus(list: DoctorMatch[]) {
        return [...list].sort((a, b) =>
          (STATUS_ORDER[a.status] ?? 3) - (STATUS_ORDER[b.status] ?? 3) || b.rating - a.rating
        );
      }
      const { data: specialtyDoctors } = await supabase
        .from("doctors").select(cols).eq("specialty", resolvedSpecialty)
        .order("rating", { ascending: false }).limit(30);
      if ((specialtyDoctors ?? []).length > 0)
        return sortByStatus((specialtyDoctors as Record<string, unknown>[]).map(mapRow));
      if (resolvedSpecialty !== "general_practice") {
        const { data: gpDoctors } = await supabase
          .from("doctors").select(cols).eq("specialty", "general_practice")
          .order("rating", { ascending: false }).limit(30);
        if ((gpDoctors ?? []).length > 0)
          return sortByStatus((gpDoctors as Record<string, unknown>[]).map(mapRow));
      }
      const { data: allDoctors } = await supabase
        .from("doctors").select(cols).order("rating", { ascending: false }).limit(30);
      return sortByStatus((allDoctors ?? [] as Record<string, unknown>[]).map(mapRow));
    },
  });

  const usingGpFallback =
    resolvedSpecialty !== "general_practice" &&
    (doctors ?? []).length > 0 &&
    doctors?.every((d) => d.specialty === "general_practice");
  const specialtyLabel = resolvedSpecialty.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  async function createAndAssignConsultation(doctor: DoctorMatch, paymentMethod: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); throw new Error("Not logged in"); }

    const consultation = await createConsultation(supabase, {
      patientId: user.id,
      chiefComplaint: triageData?.chiefComplaint ?? "Consultation",
      symptoms: triageData?.symptoms ?? [],
      type: consultType === "in_person" ? "chat" : consultType, // DB fallback for in_person
      triageLevel: triageData?.triageOutput?.level as "low" | "moderate" | "high" | "emergency" | undefined,
      triageScore: triageData?.triageOutput?.score,
      triageData: triageData?.triageOutput as never,
    });

    await supabase.from("consultations").update({
      doctor_id: doctor.doctor_id,
      payment_method: paymentMethod, // cash / ecocash / onemoney / telecash
      ...(consultType === "in_person" ? { type: "in_person" as never } : {}),
    }).eq("id", consultation.id);

    return { consultation, user };
  }

  async function confirmMobilePayment() {
    if (!showPayModal) return;
    setBookingDoctorId(showPayModal.doctor_id);
    try {
      const { consultation, user } = await createAndAssignConsultation(showPayModal, selectedProvider);

      const { data: { session } } = await supabase.auth.getSession();
      const payResp = await fetch("/api/payments/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          consultation_id: consultation.id,
          doctor_id: showPayModal.doctor_id,
          amount: showPayModal.consultation_fee_usd,
          provider: selectedProvider,
          phone_number: phone,
        }),
      });

      const paymentData = await payResp.json();
      sessionStorage.removeItem("zambuko_pending_triage");

      if (!payResp.ok) throw new Error(paymentData?.error ?? "Payment failed to initiate");

      setShowPayModal(null);
      setPaymentScreen("waiting");
      setPaymentWaiting({
        paymentId: paymentData.payment_id,
        consultationId: consultation.id,
        message: paymentData.message ?? "Check your phone for a payment prompt.",
      });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not complete booking.");
    } finally {
      setBookingDoctorId(null);
    }
  }

  async function confirmCashPayment() {
    if (!showPayModal) return;
    setBookingDoctorId(showPayModal.doctor_id);
    try {
      const { consultation } = await createAndAssignConsultation(showPayModal, "cash");
      sessionStorage.removeItem("zambuko_pending_triage");
      setShowPayModal(null);
      toast.success("Appointment booked! Pay your doctor on arrival.");
      router.push(`/consultation/${consultation.id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not complete booking.");
    } finally {
      setBookingDoctorId(null);
    }
  }

  // --- Payment waiting / failed screens ---
  if (paymentWaiting) {
    if (paymentScreen === "failed") {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Payment Failed</h2>
              <p className="text-sm text-gray-500 mt-2">The payment was not completed or was cancelled. No charge was made.</p>
            </div>
            <Button className="w-full" onClick={() => { stopPolling(); setPaymentWaiting(null); setPaymentScreen("waiting"); }}>
              Try Again
            </Button>
            <button
              onClick={() => { stopPolling(); setPaymentWaiting(null); setPaymentScreen("waiting"); router.push("/dashboard"); }}
              className="text-xs text-gray-400 underline block w-full text-center"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    if (paymentScreen === "cancelled") {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
          <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-amber-50 flex items-center justify-center mx-auto">
              <span className="text-4xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Payment Cancelled</h2>
              <p className="text-sm text-gray-500 mt-2">You cancelled the payment. Your booking was not confirmed.</p>
            </div>
            <Button className="w-full" onClick={() => { setPaymentWaiting(null); setPaymentScreen("waiting"); }}>
              Try Again
            </Button>
            <button
              onClick={() => { setPaymentWaiting(null); setPaymentScreen("waiting"); router.push("/dashboard"); }}
              className="text-xs text-gray-400 underline block w-full text-center"
            >
              Back to Home
            </button>
          </div>
        </div>
      );
    }

    // Default: waiting
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
        <div className="bg-white rounded-3xl shadow-sm p-8 max-w-sm w-full text-center space-y-5">
          <div className="w-20 h-20 rounded-full bg-brand-50 flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-brand-600 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Waiting for Payment</h2>
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{paymentWaiting.message}</p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Checking payment status…
          </div>
          <button
            onClick={() => { stopPolling(); setPaymentScreen("cancelled"); }}
            className="text-xs text-gray-400 underline"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.back()} className="p-1.5 -ml-1.5 rounded-xl text-gray-500 hover:bg-gray-100">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="font-bold text-gray-900">Choose Your Doctor</h1>
          {triageData?.chiefComplaint && <p className="text-xs text-gray-500">{triageData.chiefComplaint}</p>}
        </div>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* Consultation type selector */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Appointment Type</p>
          <div className="grid grid-cols-4 gap-2">
            {CONSULT_TYPES.map(({ value, label, icon }) => (
              <button
                key={value}
                onClick={() => setConsultType(value)}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium border transition-all ${
                  consultType === value
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                <span className="text-base">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {consultType === "in_person" && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5">
            <span className="text-blue-500 mt-0.5 flex-shrink-0">🏥</span>
            <p className="text-xs text-blue-700">
              <strong>In-person visit:</strong> You will visit the doctor&apos;s clinic. The doctor will be notified and can confirm the appointment.
            </p>
          </div>
        )}

        {/* Specialty context */}
        {resolvedSpecialty !== "general_practice" && (
          <div className="flex items-center gap-2 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2">
            <span className="text-brand-600">🩺</span>
            <span className="text-sm text-brand-700 font-medium">
              {usingGpFallback
                ? `No ${specialtyLabel} specialists nearby — showing General Practitioners`
                : `Showing ${specialtyLabel} specialists near you`}
            </span>
          </div>
        )}

        {/* Triage badge */}
        {triageData?.triageOutput?.level && (
          <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-gray-100">
            <span className="text-sm font-medium text-gray-600">Triage level:</span>
            <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded-full ${
              triageData.triageOutput.level === "emergency" ? "bg-red-100 text-red-700" :
              triageData.triageOutput.level === "high" ? "bg-orange-100 text-orange-700" :
              triageData.triageOutput.level === "moderate" ? "bg-amber-100 text-amber-700" :
              "bg-green-100 text-green-700"
            }`}>{triageData.triageOutput.level}</span>
          </div>
        )}

        <p className="text-xs text-gray-500 font-medium">
          {loadingDoctors ? "Finding doctors near you…" : `${doctors?.length ?? 0} doctor${(doctors?.length ?? 0) === 1 ? "" : "s"} found`}
        </p>

        {loadingDoctors && <LoadingSkeleton />}

        {doctors?.map((doctor) => (
          <Card key={doctor.doctor_id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-14 h-14 rounded-2xl bg-brand-100 flex items-center justify-center overflow-hidden">
                  {doctor.avatar_url ? (
                    <img src={doctor.avatar_url} alt={doctor.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl font-bold text-brand-600">{doctor.full_name.charAt(0)}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Dr. {doctor.full_name}</h3>
                      <p className="text-xs text-gray-500 capitalize">{doctor.specialty.replace(/_/g, " ")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-gray-900">${doctor.consultation_fee_usd}</p>
                      <p className="text-xs text-gray-400">per consult</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-0.5">
                      <span className="text-amber-400">★</span>
                      <span className="font-semibold text-gray-700">{doctor.rating.toFixed(1)}</span>
                      <span>({doctor.rating_count})</span>
                    </span>
                    <span>•</span>
                    <span>{doctor.queue_length} in queue</span>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                      doctor.status === "available" ? "bg-green-100 text-green-700" :
                      doctor.status === "in_session" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        doctor.status === "available" ? "bg-green-500" :
                        doctor.status === "in_session" ? "bg-amber-500" : "bg-gray-400"
                      }`} />
                      {doctor.status === "available" ? "Available Now" : doctor.status === "in_session" ? "In Session" : "Offline"}
                    </span>
                    <Button
                      size="sm"
                      variant={doctor.status === "offline" ? "ghost" : undefined}
                      disabled={bookingDoctorId === doctor.doctor_id}
                      loading={bookingDoctorId === doctor.doctor_id}
                      onClick={() => setShowPayModal(doctor)}
                    >
                      {doctor.status === "offline" ? "Book anyway" : "Book"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        ))}

        {!loadingDoctors && doctors?.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">😔</p>
            <h3 className="font-bold text-gray-800">No doctors available</h3>
            <p className="text-sm text-gray-500 mt-1">Please try again in a few minutes or contact support.</p>
            <Button variant="ghost" className="mt-4" onClick={() => router.push("/dashboard")}>Back to Home</Button>
          </div>
        )}
      </div>

      {/* Payment / Booking Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowPayModal(null)}>
          <div className="bg-white rounded-t-3xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto" />

            {/* Summary */}
            <div className="bg-gray-50 rounded-2xl p-4">
              <p className="text-sm text-gray-600">
                Consultation with <strong>Dr. {showPayModal.full_name}</strong>
                <span className="ml-2 text-xs text-gray-400 capitalize">
                  ({CONSULT_TYPES.find(t => t.value === consultType)?.icon} {CONSULT_TYPES.find(t => t.value === consultType)?.label})
                </span>
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">${showPayModal.consultation_fee_usd}</p>
            </div>

            {showPayModal.status === "offline" && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
                <span className="text-amber-500 mt-0.5 flex-shrink-0">⏳</span>
                <p className="text-xs text-amber-700">
                  <strong>Dr. {showPayModal.full_name} is currently offline.</strong> Your booking will be held and they will be notified when they come online.
                </p>
              </div>
            )}

            {/* Cash / In-Person option */}
            {consultType === "in_person" ? (
              /* In-person: only cash makes sense */
              <div className="space-y-3">
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                  <span className="text-blue-500 mt-0.5">🏥</span>
                  <p className="text-xs text-blue-700">
                    You are booking an <strong>in-person visit</strong>. The doctor will be notified to expect you. Payment will be made at the clinic.
                  </p>
                </div>
                <Button className="w-full" size="lg"
                  loading={bookingDoctorId === showPayModal.doctor_id}
                  onClick={confirmCashPayment}>
                  Confirm Appointment — Pay at Clinic
                </Button>
              </div>
            ) : (
              /* Remote: mobile money or cash */
              <div className="space-y-4">
                {/* Mobile money section */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Pay with Mobile Money</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {(["ecocash", "onemoney", "telecash"] as const).map((p) => (
                      <button key={p} onClick={() => setSelectedProvider(p)}
                        className={`py-2.5 rounded-xl text-sm font-semibold border transition-all capitalize ${selectedProvider === p ? "bg-brand-600 text-white border-brand-600" : "bg-white text-gray-700 border-gray-200"}`}>
                        {p === "ecocash" ? "EcoCash" : p === "onemoney" ? "OneMoney" : "TeleCash"}
                      </button>
                    ))}
                  </div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Mobile Number</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+263 77X XXX XXXX"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  <Button className="w-full mt-3" size="lg"
                    loading={bookingDoctorId === showPayModal.doctor_id}
                    disabled={!phone || phone.length < 9}
                    onClick={confirmMobilePayment}>
                    Pay ${showPayModal.consultation_fee_usd} via {selectedProvider === "ecocash" ? "EcoCash" : selectedProvider === "onemoney" ? "OneMoney" : "TeleCash"}
                  </Button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400 font-medium">or</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Cash option */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Pay in Person (Cash)</p>
                  <div className="flex items-start gap-2 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-3">
                    <span className="text-gray-400 mt-0.5">💵</span>
                    <p className="text-xs text-gray-600">
                      Your appointment will be confirmed and the doctor will be notified to <strong>expect cash payment</strong> at the time of the consultation.
                    </p>
                  </div>
                  <Button variant="ghost" className="w-full" size="lg"
                    loading={bookingDoctorId === showPayModal.doctor_id}
                    onClick={confirmCashPayment}>
                    Book &amp; Pay Cash in Person
                  </Button>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-400">
              {consultType === "in_person" ? "Your appointment will be held pending doctor confirmation." : "Secure payment via Paynow Zimbabwe"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white rounded-2xl p-4 space-y-3 animate-pulse">
          <div className="flex gap-3">
            <div className="w-14 h-14 bg-gray-200 rounded-2xl" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-2/3" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BookPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center"><LoadingSkeleton /></div>}>
      <BookContent />
    </Suspense>
  );
}
