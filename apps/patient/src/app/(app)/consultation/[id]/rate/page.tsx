"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createClient } from "@zambuko/database/client";
import { rateConsultation } from "@zambuko/database";
import { Button, Card, CardBody } from "@zambuko/ui";
import { toast } from "sonner";

export default function RateConsultationPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = createClient();
  const [rating, setRating] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [review, setReview] = useState("");
  const [anonymous, setAnonymous] = useState(false);

  const { data: consultation, isLoading, isError } = useQuery({
    queryKey: ["rate-consultation", id],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("consultations")
        .select("id, patient_id, doctor_id, status, patient_rating, doctor:profiles!doctor_id(full_name)")
        .eq("id", id)
        .eq("patient_id", user.id)
        .single();
      if (error) throw error;
      return { ...data, currentUserId: user.id };
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!consultation?.doctor_id || !rating) throw new Error("Choose a rating before submitting.");
      await rateConsultation(supabase, {
        consultationId: id,
        doctorId: consultation.doctor_id,
        patientId: consultation.currentUserId,
        rating,
        review: review.trim() || undefined,
        isAnonymous: anonymous,
      });
    },
    onSuccess: () => {
      toast.success("Thank you. Your feedback was saved.");
      router.replace("/history?filter=completed");
    },
    onError: (error: Error) => toast.error(error.message || "Could not save your rating."),
  });

  if (isLoading) return <div className="min-h-app bg-slate-50 p-4"><div className="mx-auto mt-10 h-80 max-w-lg animate-pulse rounded-xl bg-slate-200" /></div>;

  if (isError || !consultation) {
    return (
      <div className="min-h-app bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <h1 className="font-bold text-red-900">Consultation unavailable</h1>
          <p className="mt-2 text-sm text-red-700">This visit could not be loaded or does not belong to your account.</p>
          <button type="button" onClick={() => router.replace("/history")} className="mt-5 min-h-10 rounded-lg bg-red-700 px-4 text-sm font-bold text-white">Back to history</button>
        </div>
      </div>
    );
  }

  const doctor = consultation.doctor as { full_name?: string | null } | null;
  const alreadyRated = Boolean(consultation.patient_rating);
  const cannotRate = consultation.status !== "completed" || !consultation.doctor_id;

  return (
    <div className="min-h-app bg-slate-50 px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-lg">
        <button type="button" onClick={() => router.back()} className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-slate-600 hover:bg-white">
          <span aria-hidden="true">←</span> Back
        </button>

        <Card>
          <CardBody className="p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-700">Quality of care</p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">How was your consultation?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Your feedback helps patients choose confidently and helps {doctor?.full_name ?? "your doctor"} improve care.
            </p>

            {alreadyRated ? (
              <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-center">
                <p className="font-bold text-green-900">Feedback already submitted</p>
                <p className="mt-1 text-sm text-green-700">You rated this consultation {consultation.patient_rating}/5.</p>
                <Button className="mt-5" onClick={() => router.replace("/history?filter=completed")}>Return to history</Button>
              </div>
            ) : cannotRate ? (
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5">
                <p className="font-bold text-amber-900">Rating becomes available after the consultation is completed.</p>
              </div>
            ) : (
              <>
                <fieldset className="mt-7">
                  <legend className="text-sm font-bold text-slate-800">Overall rating</legend>
                  <div className="mt-3 flex justify-between gap-2" role="radiogroup" aria-label="Overall rating">
                    {([1, 2, 3, 4, 5] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={rating === value}
                        aria-label={`${value} star${value === 1 ? "" : "s"}`}
                        onClick={() => setRating(value)}
                        className={`grid h-12 flex-1 place-items-center rounded-lg border text-2xl transition-colors ${
                          rating !== null && value <= rating
                            ? "border-amber-400 bg-amber-50 text-amber-500"
                            : "border-slate-200 bg-white text-slate-300 hover:border-amber-300"
                        }`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-center text-xs font-semibold text-slate-500">
                    {rating === null ? "Select a rating" : ["", "Poor", "Fair", "Good", "Very good", "Excellent"][rating]}
                  </p>
                </fieldset>

                <div className="mt-6">
                  <label htmlFor="review" className="text-sm font-bold text-slate-800">Tell us more <span className="font-normal text-slate-400">(optional)</span></label>
                  <textarea
                    id="review"
                    value={review}
                    maxLength={600}
                    rows={5}
                    onChange={(event) => setReview(event.target.value)}
                    placeholder="What went well? Was the doctor clear, respectful, and helpful?"
                    className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
                  />
                  <p className="mt-1 text-right text-xs text-slate-400">{review.length}/600</p>
                </div>

                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
                  <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="mt-0.5 h-4 w-4 accent-brand-700" />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Post anonymously</span>
                    <span className="block text-xs leading-5 text-slate-500">The care team can still link this review to the consultation for quality and safety purposes.</span>
                  </span>
                </label>

                <Button className="mt-6 w-full" size="lg" disabled={!rating} loading={submit.isPending} onClick={() => submit.mutate()}>
                  Submit feedback
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
