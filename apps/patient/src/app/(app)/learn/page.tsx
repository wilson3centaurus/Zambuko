"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const TOPICS = [
  {
    icon: "\u{1F9B7}",
    title: "Tooth & mouth",
    text: "Pain relief, brushing skills, and when swelling is urgent.",
    accent: "from-sky-500 to-cyan-700",
    tone: "bg-sky-50 text-sky-900 dark:bg-sky-950/50 dark:text-sky-100",
    steps: [
      { icon: "\u{1F4A7}", title: "Soothe gently", text: "Rinse with warm water, keep brushing gently, and avoid placing aspirin directly on the tooth or gum." },
      { icon: "\u{1F9CA}", title: "Protect the area", text: "Choose soft foods and avoid very hot, cold, or sugary foods. A wrapped cold pack can go outside the cheek." },
      { icon: "\u{1F3E5}", title: "Arrange dental care", text: "Pain that persists, interrupts sleep, or is getting worse needs assessment by a dental professional." },
    ],
    warning: "Use SOS now for spreading face or neck swelling, trouble breathing or swallowing, or swelling that is closing an eye.",
  },
  {
    icon: "\u{1F9E0}",
    title: "Head & headaches",
    text: "Triggers, hydration, warning signs, and a symptom diary.",
    accent: "from-violet-500 to-indigo-700",
    tone: "bg-violet-50 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100",
    steps: [
      { icon: "\u{1F4A7}", title: "Water first", text: "Sip water and eat something light if you have missed a meal. Avoid alcohol while you feel unwell." },
      { icon: "\u{1F311}", title: "Reduce stimulation", text: "Rest somewhere quiet and dim. Relax your jaw, shoulders, and screen focus for a few minutes." },
      { icon: "\u{1F4DD}", title: "Notice the pattern", text: "Record when it began, sleep, food, stress, medicines, and other symptoms to discuss with a clinician." },
    ],
    warning: "Use SOS for a sudden extremely painful headache, new weakness or facial droop, confusion, fainting, a seizure, or severe head injury.",
  },
  {
    icon: "\u{1F33F}",
    title: "Stress & sleep",
    text: "Breathing games, grounding exercises, and better rest.",
    accent: "from-emerald-500 to-teal-700",
    tone: "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100",
    steps: [
      { icon: "\u{1F440}", title: "Ground your senses", text: "Name 5 things you see, 4 you feel, 3 you hear, 2 you smell, and 1 you taste." },
      { icon: "\u{1F32C}\u{FE0F}", title: "Slow the breath", text: "Breathe gently without forcing it. Use the one-minute activity below and stop if you feel dizzy." },
      { icon: "\u{1F319}", title: "Prepare for sleep", text: "Dim lights, reduce stimulating content, and choose one small routine you can repeat at the same time nightly." },
    ],
    warning: "If you may harm yourself, cannot stay safe, or are in immediate danger, move toward another person and use SOS now.",
  },
  {
    icon: "\u{1F49B}",
    title: "Love & relationships",
    text: "Consent, boundaries, communication, and emotional safety.",
    accent: "from-amber-400 to-orange-600",
    tone: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-100",
    steps: [
      { icon: "\u{1F91D}", title: "Check for consent", text: "Consent should be informed, freely given, specific, and reversible. Silence or pressure is not agreement." },
      { icon: "\u{1F6D1}", title: "Name your boundary", text: "Use a clear sentence: \"I am not comfortable with that\" or \"I need us to stop now.\" You do not owe access to your body." },
      { icon: "\u{1F4AC}", title: "Choose support", text: "Talk to someone trustworthy. If a conversation feels unsafe, plan it in public or with support nearby." },
    ],
    warning: "Threats, stalking, forced sexual activity, or physical violence are not normal conflict. Go to a safer place and use SOS if danger is immediate.",
  },
  {
    icon: "\u{1FA79}",
    title: "First aid basics",
    text: "Small cuts, burns, sprains, and knowing when to call for help.",
    accent: "from-rose-500 to-red-700",
    tone: "bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-100",
    steps: [
      { icon: "\u{1FA79}", title: "Small cut", text: "Wash your hands, rinse the cut with clean running water, and apply steady pressure with clean material if it is bleeding." },
      { icon: "\u{1F6BF}", title: "Small burn", text: "Cool it under cool running water for 20 minutes. Do not use ice, butter, toothpaste, creams, or anything stuck to the skin." },
      { icon: "\u{1F9CA}", title: "Sprain or strain", text: "Protect and rest the area. Use a wrapped cold pack for short periods; never place ice directly on skin." },
    ],
    warning: "Use SOS for heavy bleeding, breathing difficulty, unconsciousness, a serious burn, major injury, or a limb that looks deformed.",
  },
  {
    icon: "\u{1F48A}",
    title: "Medicine safety",
    text: "Labels, missed doses, sharing risks, and safe storage.",
    accent: "from-orange-500 to-red-600",
    tone: "bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-100",
    steps: [
      { icon: "\u{1F50E}", title: "Read before taking", text: "Check the person's name, medicine, dose, time, expiry date, and whether it should be taken with food." },
      { icon: "\u{23F0}", title: "Missed a dose?", text: "Check the leaflet or ask a pharmacist. Do not double the next dose unless a qualified prescriber specifically tells you to." },
      { icon: "\u{1F512}", title: "Do not share", text: "Keep medicines in their original packaging, away from children, heat, and moisture. Never share prescriptions." },
    ],
    warning: "Use SOS for trouble breathing, collapse, severe facial or tongue swelling, or another sudden serious reaction after taking medicine.",
  },
] as const;

const QUESTIONS = [
  { q: "A toothache with facial swelling and trouble breathing can wait until next week.", answer: false, why: "Breathing difficulty or spreading facial swelling needs urgent care now." },
  { q: "Drinking water and resting in a quiet room may help some mild headaches.", answer: true, why: "That can help a mild headache, but sudden severe pain or weakness needs urgent assessment." },
  { q: "Antibiotics can be shared when two people have similar symptoms.", answer: false, why: "Never share antibiotics. The cause, medicine, dose, and allergy risk may differ." },
];

type Topic = (typeof TOPICS)[number];

export default function LearnPage() {
  const [breathing, setBreathing] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [question, setQuestion] = useState(0);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [completed, setCompleted] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem("hutano-learning-progress") ?? "0");
    setCompleted(Number.isFinite(saved) ? saved : 0);
  }, []);

  useEffect(() => {
    if (!selectedTopic) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedTopic(null);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedTopic]);

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
        <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-300">Small, practical health skills for days when you are well - and support when something feels off.</p>
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
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Explore</p>
              <h2 className="text-xl font-black text-slate-900 dark:text-white">What would help today?</h2>
            </div>
            <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">6 visual guides</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {TOPICS.map((topic) => (
              <button
                key={topic.title}
                type="button"
                onClick={() => setSelectedTopic(topic)}
                aria-haspopup="dialog"
                className={`group min-h-44 rounded-3xl p-4 text-left transition hover:-translate-y-1 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-300 ${topic.tone}`}
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/75 text-3xl shadow-sm transition group-hover:scale-110 dark:bg-white/10" aria-hidden="true">{topic.icon}</span>
                <h3 className="mt-4 font-black">{topic.title}</h3>
                <p className="mt-1 text-xs leading-5 opacity-75">{topic.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-black">Open guide <span aria-hidden="true">&rarr;</span></span>
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
                <button type="button" onClick={() => { setSeconds(60); setBreathing((value) => !value); }} className="mt-4 rounded-xl bg-brand-700 px-4 py-2 text-sm font-bold text-white">
                  {breathing ? "Stop" : seconds === 0 ? "Do it again" : "Start exercise"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-orange-600">Myth buster</p>
              <span className="text-xs font-bold text-slate-400">{question + 1}/{QUESTIONS.length}</span>
            </div>
            <h2 className="mt-4 min-h-14 text-lg font-black text-slate-900 dark:text-white">{QUESTIONS[question]!.q}</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button type="button" onClick={() => answer(true)} className="rounded-xl border border-emerald-300 bg-emerald-50 py-3 font-bold text-emerald-800">True</button>
              <button type="button" onClick={() => answer(false)} className="rounded-xl border border-rose-300 bg-rose-50 py-3 font-bold text-rose-800">False</button>
            </div>
            {feedback && (
              <div role="status" className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {feedback}
                <button type="button" onClick={nextQuestion} className="mt-2 block font-bold text-brand-700 dark:text-brand-300">
                  {question === QUESTIONS.length - 1 ? `Finish - ${score}/${QUESTIONS.length}` : "Next \u2192"}
                </button>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-3xl border border-red-200 bg-red-50 p-5 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          <h2 className="font-black">Do not play through an emergency</h2>
          <p className="mt-1 text-sm">Severe trouble breathing, chest pain, fainting, heavy bleeding, a seizure, sudden weakness, or thoughts of immediate self-harm need urgent help.</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/emergency" className="rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white">Open SOS</Link>
            <Link href="/triage" className="rounded-xl border border-red-300 px-4 py-2 text-sm font-bold">Check symptoms</Link>
          </div>
        </section>
      </main>

      {selectedTopic && (
        <div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onClick={() => setSelectedTopic(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="visual-guide-title"
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-[2rem] bg-white shadow-2xl dark:bg-slate-950 sm:rounded-[2rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className={`relative overflow-hidden bg-gradient-to-br ${selectedTopic.accent} px-5 pb-8 pt-5 text-white sm:px-7`}>
              <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
              <div className="absolute right-20 top-20 h-16 w-16 rounded-full bg-white/10" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <span className="grid h-16 w-16 place-items-center rounded-3xl bg-white/20 text-4xl shadow-lg backdrop-blur" aria-hidden="true">{selectedTopic.icon}</span>
                  <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-white/75">Visual health guide</p>
                  <h2 id="visual-guide-title" className="mt-1 text-3xl font-black">{selectedTopic.title}</h2>
                  <p className="mt-2 max-w-lg text-sm leading-6 text-white/85">{selectedTopic.text}</p>
                </div>
                <button
                  type="button"
                  autoFocus
                  onClick={() => setSelectedTopic(null)}
                  aria-label="Close visual guide"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-950/25 text-2xl font-light transition hover:bg-slate-950/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/60"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-7">
              <div className="grid gap-3 sm:grid-cols-3">
                {selectedTopic.steps.map((step, index) => (
                  <article key={step.title} className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <span className="absolute right-3 top-2 text-5xl font-black text-slate-200/70 dark:text-slate-800" aria-hidden="true">{index + 1}</span>
                    <span className="relative grid h-11 w-11 place-items-center rounded-2xl bg-white text-2xl shadow-sm dark:bg-slate-800" aria-hidden="true">{step.icon}</span>
                    <h3 className="relative mt-4 font-black text-slate-950 dark:text-white">{step.title}</h3>
                    <p className="relative mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{step.text}</p>
                  </article>
                ))}
              </div>

              <aside className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-red-100 text-xl dark:bg-red-900/60" aria-hidden="true">!</span>
                  <div>
                    <h3 className="font-black">Know the urgent signs</h3>
                    <p className="mt-1 text-sm leading-6">{selectedTopic.warning}</p>
                  </div>
                </div>
              </aside>

              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">General education only. This guide cannot diagnose you or replace advice from a qualified healthcare professional.</p>

              <div className="grid grid-cols-2 gap-3">
                <Link href="/triage" className="rounded-xl border border-brand-300 px-4 py-3 text-center text-sm font-black text-brand-800 dark:border-brand-700 dark:text-brand-200">Check symptoms</Link>
                <Link href="/emergency" className="rounded-xl bg-red-700 px-4 py-3 text-center text-sm font-black text-white">Open SOS</Link>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
