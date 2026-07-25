"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TOPICS = [
  { icon: "🦷", title: "Tooth & mouth", text: "Pain relief, brushing skills, and when swelling is urgent.", tone: "bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100" },
  { icon: "🧠", title: "Head & headaches", text: "Triggers, hydration, warning signs, and a symptom diary.", tone: "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100" },
  { icon: "🌿", title: "Stress & sleep", text: "Breathing games, grounding exercises, and better rest.", tone: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" },
  { icon: "💛", title: "Love & relationships", text: "Consent, boundaries, communication, and emotional safety.", tone: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100" },
  { icon: "🩹", title: "First aid basics", text: "Small cuts, burns, sprains, and knowing when to call for help.", tone: "bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100" },
  { icon: "💊", title: "Medicine safety", text: "Labels, missed doses, sharing risks, and safe storage.", tone: "bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100" },
];

const QUESTIONS = [
  { q: "A toothache with facial swelling and trouble breathing can wait until next week.", answer: false, why: "Breathing difficulty or spreading facial swelling needs urgent care now." },
  { q: "Drinking water and resting in a quiet room may help some mild headaches.", answer: true, why: "That can help a mild headache, but sudden severe pain or weakness needs urgent assessment." },
  { q: "Antibiotics can be shared when two people have similar symptoms.", answer: false, why: "Never share antibiotics. The cause, medicine, dose, and allergy risk may differ." },
];

export default function LearnPage() {
  const [breathing, setBreathing] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [question, setQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);

  useEffect(() => {
    const saved = Number(localStorage.getItem("hutano-learning-progress") ?? "0");
    setCompleted(Number.isFinite(saved) ? saved : 0);
  }, []);

  useEffect(() => {
    if (!breathing || seconds <= 0) return;
    const timer = window.setInterval(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [breathing, seconds]);

  useEffect(() => {
    if (breathing && seconds === 0) {
      setBreathing(false);
      setCompleted((value) => {
        const next = Math.max(value, 1);
        localStorage.setItem("hutano-learning-progress", String(next));
        return next;
      });
    }
  }, [breathing, seconds]);

  const breathingWord = useMemo(() => {
    const phase = Math.floor((60 - seconds) / 4) % 3;
    return phase === 0 ? "Breathe in" : phase === 1 ? "Hold gently" : "Breathe out";
  }, [seconds]);

  function answer(value: boolean) {
    if (feedback) return;
    const item = QUESTIONS[question]!;
    if (value === item.answer) setScore((current) => current + 1);
    setFeedback(`${value === item.answer ? "Correct. " : "Not quite. "}${item.why}`);
  }

  function nextQuestion() {
    if (question === QUESTIONS.length - 1) {
      setCompleted((value) => {
        const next = Math.max(value, 2);
        localStorage.setItem("hutano-learning-progress", String(next));
        return next;
      });
      setQuestion(0);
      setScore(0);
    } else {
      setQuestion((value) => value + 1);
    }
    setFeedback(null);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-8 dark:bg-[#071419]">
      <header className="px-4 pb-4 pt-6 sm:px-6 lg:px-8">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700 dark:text-brand-300">Hutano everyday</p>
        <h1 className="mt-1 text-2xl font-black text-slate-950 dark:text-white">Play, learn, feel better</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Small, practical health skills for days when you are well—and support when something feels off.</p>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-4 sm:px-6 lg:px-8">
        <section className="relative min-h-[270px] overflow-hidden rounded-[2rem] bg-brand-950 text-white shadow-xl">
          <Image src="/health-learning-hero.png" alt="People learning hydration, breathing, dental care and first aid together" fill priority className="data-heavy-visual object-cover object-center opacity-80" sizes="(max-width: 1024px) 100vw, 1200px" />
          <div className="absolute inset-0 bg-gradient-to-r from-brand-950 via-brand-950/75 to-transparent" />
          <div className="relative z-10 max-w-md p-6 sm:p-8">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">{completed}/2 activities completed</span>
            <h2 className="mt-4 text-3xl font-black leading-tight">Your body gives clues. Learn how to notice them.</h2>
            <p className="mt-3 text-sm leading-6 text-brand-50">These activities teach general self-care. They do not diagnose illness or replace a qualified clinician.</p>
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-end justify-between">
            <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Explore</p><h2 className="text-xl font-black text-slate-900 dark:text-white">What would help today?</h2></div>
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">6 visual guides</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {TOPICS.map((topic) => (
              <button key={topic.title} className={`min-h-44 rounded-3xl p-4 text-left transition hover:-translate-y-1 hover:shadow-lg ${topic.tone}`}>
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/75 text-3xl shadow-sm dark:bg-white/10" aria-hidden="true">{topic.icon}</span>
                <h3 className="mt-4 font-black">{topic.title}</h3>
                <p className="mt-1 text-xs leading-5 opacity-75">{topic.text}</p>
              </button>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">Calm minute</p>
            <div className="mt-4 flex items-center gap-5">
              <div className={`grid h-28 w-28 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-300 to-brand-700 text-center text-white shadow-lg ${breathing ? "animate-pulse" : ""}`}>
                <span><strong className="block text-sm">{breathing ? breathingWord : "Ready?"}</strong><small>{breathing ? `${seconds}s` : "1 minute"}</small></span>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Guided breathing</h2>
                <p className="mt-1 text-sm text-slate-500">Sit safely. Stop if you feel dizzy or uncomfortable.</p>
                <button onClick={() => { setSeconds(60); setBreathing((value) => !value); }} className="mt-4 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">
                  {breathing ? "Stop" : seconds === 0 ? "Do it again" : "Start exercise"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex justify-between"><p className="text-xs font-bold uppercase tracking-wider text-orange-600">Myth buster</p><span className="text-xs font-bold text-slate-400">{question + 1}/{QUESTIONS.length}</span></div>
            <h2 className="mt-4 min-h-14 text-lg font-black text-slate-900 dark:text-white">{QUESTIONS[question]!.q}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button onClick={() => answer(true)} className="rounded-xl border border-emerald-300 bg-emerald-50 py-3 font-bold text-emerald-800">True</button>
              <button onClick={() => answer(false)} className="rounded-xl border border-rose-300 bg-rose-50 py-3 font-bold text-rose-800">False</button>
            </div>
            {feedback && <div role="status" className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">{feedback}<button onClick={nextQuestion} className="mt-2 block font-bold text-brand-700 dark:text-brand-300">{question === QUESTIONS.length - 1 ? `Finish · ${score + (feedback.startsWith("Correct") ? 1 : 0)}/${QUESTIONS.length}` : "Next →"}</button></div>}
          </section>
        </div>

        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          <h2 className="font-black">Do not play through an emergency</h2>
          <p className="mt-1 text-sm">Severe trouble breathing, chest pain, fainting, heavy bleeding, a seizure, sudden weakness, or thoughts of immediate self-harm need urgent help.</p>
          <div className="mt-3 flex flex-wrap gap-3"><Link href="/emergency" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Open SOS</Link><Link href="/triage" className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold">Check symptoms</Link></div>
        </section>
      </main>
    </div>
  );
}
