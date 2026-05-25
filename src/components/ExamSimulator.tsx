import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Award, CheckCircle2, Clock, GraduationCap, RotateCcw, Target, X, XCircle } from 'lucide-react';
import type { FlashcardData } from './Flashcard';

interface ExamSimulatorProps {
  cards: FlashcardData[];
  chapters: [string, string][];
  onClose: () => void;
}

export interface ExamHistoryEntry {
  date: string;
  questions: number;
  correct: number;
  pct: number;
  grade: string;
  timeLimit: number;
  chapter: string;
  weakTags: string[];
}

type Phase = 'setup' | 'active' | 'results';

interface Question {
  card: FlashcardData;
  options: string[];
  correct: string;
}

interface Answer {
  question: Question;
  picked: string | null;
  correct: boolean;
}

// Shuffle helper
const shuffle = <T,>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const getGrade = (pct: number): { grade: string; label: string; color: string } => {
  if (pct >= 92) return { grade: '1,0', label: 'sehr gut', color: 'text-emerald-600' };
  if (pct >= 85) return { grade: '1,3–1,7', label: 'sehr gut', color: 'text-emerald-600' };
  if (pct >= 75) return { grade: '2,0–2,3', label: 'gut', color: 'text-teal-600' };
  if (pct >= 65) return { grade: '2,7–3,0', label: 'befriedigend', color: 'text-blue-600' };
  if (pct >= 55) return { grade: '3,3–3,7', label: 'ausreichend', color: 'text-amber-600' };
  if (pct >= 50) return { grade: '4,0', label: 'ausreichend', color: 'text-orange-600' };
  return { grade: '5,0', label: 'nicht bestanden', color: 'text-red-600' };
};

export default function ExamSimulator({ cards, chapters, onClose }: ExamSimulatorProps) {
  const [phase, setPhase] = useState<Phase>('setup');
  const [numQuestions, setNumQuestions] = useState(15);
  const [timeLimit, setTimeLimit] = useState(10); // Minuten
  const [chapterFilter, setChapterFilter] = useState<string>('all');
  const [examRelevantOnly, setExamRelevantOnly] = useState(true);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);

  // Timer
  useEffect(() => {
    if (phase !== 'active') return;
    if (timeLeft <= 0) {
      finishExam();
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, timeLeft]);

  // Pool of eligible cards
  const eligibleCards = useMemo(() => {
    return cards.filter((c) => {
      if (!c.back || c.back.length < 5) return false;
      if (examRelevantOnly && !c.exam_relevant) return false;
      if (chapterFilter !== 'all') {
        const root = String(c.chapter_id).split('.')[0];
        if (root !== chapterFilter) return false;
      }
      return true;
    });
  }, [cards, examRelevantOnly, chapterFilter]);

  const maxAvailable = Math.min(eligibleCards.length, 30);

  const startExam = () => {
    const pool = shuffle(eligibleCards).slice(0, numQuestions);
    const otherBacks = cards
      .filter((c) => !pool.includes(c))
      .map((c) => c.back.slice(0, 200))
      .filter((b) => b.length > 10);

    const qs: Question[] = pool.map((card) => {
      const correctBack = card.back.slice(0, 200);
      const distractors = shuffle(
        otherBacks.filter((b) => b !== correctBack && b.length > 20)
      ).slice(0, 3);
      const options = shuffle([correctBack, ...distractors]);
      return { card, options, correct: correctBack };
    });

    setQuestions(qs);
    setCurrentIdx(0);
    setSelected(null);
    setAnswers([]);
    setTimeLeft(timeLimit * 60);
    setPhase('active');
  };

  const submitAnswer = () => {
    if (!selected) return;
    const q = questions[currentIdx];
    const isCorrect = selected === q.correct;
    setAnswers((prev) => [...prev, { question: q, picked: selected, correct: isCorrect }]);
    setSelected(null);

    if (currentIdx + 1 >= questions.length) {
      finishExam([...answers, { question: q, picked: selected, correct: isCorrect }]);
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const finishExam = (finalAnswers?: Answer[]) => {
    const list = finalAnswers ?? answers;
    setPhase('results');
    const correctCount = list.filter((a) => a.correct).length;
    const pct = (correctCount / questions.length) * 100;
    // Persist exam result to history
    try {
      const HISTORY_KEY = 'psychologisch-exam-history-v1';
      const prev: ExamHistoryEntry[] = JSON.parse(window.localStorage.getItem(HISTORY_KEY) ?? '[]');
      const wrongTags = list
        .filter((a) => !a.correct)
        .flatMap((a) => a.question.card.tags ?? [])
        .filter(Boolean);
      const entry: ExamHistoryEntry = {
        date: new Date().toISOString(),
        questions: questions.length,
        correct: correctCount,
        pct: Math.round(pct),
        grade: getGrade(pct).grade,
        timeLimit,
        chapter: chapterFilter,
        weakTags: Array.from(new Set(wrongTags)).slice(0, 6),
      };
      const next = [entry, ...prev].slice(0, 50); // keep last 50
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore persistence errors
    }
    if (pct >= 75) {
      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ['#0d9488', '#10b981', '#6366f1', '#f59e0b'],
      });
    }
  };

  const correctCount = answers.filter((a) => a.correct).length;
  const pct = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
  const grade = getGrade(pct);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/80 p-2 sm:p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className="my-2 w-full max-w-2xl rounded-2xl bg-white shadow-2xl sm:my-8"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 p-4 sm:p-5">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-teal-600" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Klausur-Simulator</h2>
            {phase === 'active' && (
              <span
                className={`ml-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                  timeLeft < 60
                    ? 'bg-red-100 text-red-700 animate-pulse'
                    : timeLeft < 180
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                <Clock className="h-3 w-3" />
                {formatTime(timeLeft)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 dark:text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:bg-slate-700 hover:text-slate-700 dark:text-slate-200"
            title="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6">
          {/* ─────────────── SETUP ─────────────── */}
          {phase === 'setup' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Simuliere eine echte Klausursituation mit Zeitlimit und Multiple-Choice-Fragen. Am Ende gibt es Punkte,
                Note und eine Auswertung deiner Fehler.
              </p>

              {/* Number of questions */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Anzahl Fragen
                </label>
                <div className="flex gap-2">
                  {[10, 15, 20, 30].map((n) => (
                    <button
                      key={n}
                      disabled={n > maxAvailable}
                      onClick={() => setNumQuestions(n)}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors disabled:opacity-30 ${
                        numQuestions === n
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">{maxAvailable} Karten im aktuellen Filter verfügbar</p>
              </div>

              {/* Time limit */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Zeitlimit
                </label>
                <div className="flex gap-2">
                  {[5, 10, 15, 20].map((n) => (
                    <button
                      key={n}
                      onClick={() => setTimeLimit(n)}
                      className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                        timeLimit === n
                          ? 'bg-teal-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                      }`}
                    >
                      {n} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Chapter filter */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Kapitel
                </label>
                <select
                  value={chapterFilter}
                  onChange={(e) => setChapterFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2.5 text-sm outline-none focus:border-teal-500"
                >
                  <option value="all">Alle Kapitel</option>
                  {chapters.map(([k, title]) => (
                    <option key={k} value={k}>
                      {title}
                    </option>
                  ))}
                </select>
              </div>

              {/* Exam-relevant toggle */}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-500/15 p-3 ring-1 ring-amber-200">
                <input
                  type="checkbox"
                  checked={examRelevantOnly}
                  onChange={(e) => setExamRelevantOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span className="text-sm font-medium text-amber-900">
                  Nur prüfungsrelevante Karten
                </span>
              </label>

              {/* Action */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <motion.button
                  onClick={startExam}
                  disabled={eligibleCards.length < 4}
                  whileTap={{ scale: 0.97 }}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-teal-700 disabled:opacity-40"
                >
                  <GraduationCap className="h-4 w-4" />
                  Klausur starten ({Math.min(numQuestions, maxAvailable)} Fragen ·{' '}
                  {timeLimit} min)
                </motion.button>
              </div>
            </div>
          )}

          {/* ─────────────── ACTIVE ─────────────── */}
          {phase === 'active' && questions[currentIdx] && (
            <div>
              {/* Progress */}
              <div className="mb-4">
                <div className="mb-2 flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                  <span>
                    Frage {currentIdx + 1} von {questions.length}
                  </span>
                  <span>
                    {answers.filter((a) => a.correct).length} richtig
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <motion.div
                    className="h-full bg-teal-500"
                    animate={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 120, damping: 22 }}
                  />
                </div>
              </div>

              {/* Question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="mb-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 p-4">
                    <p className="mb-1 text-xs font-medium uppercase text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      {questions[currentIdx].card.chapter_title}
                    </p>
                    <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                      {questions[currentIdx].card.front}
                    </p>
                  </div>

                  <div className="grid gap-2.5">
                    {questions[currentIdx].options.map((opt, i) => (
                      <motion.button
                        key={i}
                        onClick={() => setSelected(opt)}
                        whileTap={{ scale: 0.99 }}
                        className={`flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                          selected === opt
                            ? 'border-teal-400 bg-teal-50 dark:bg-teal-500/15 text-teal-900'
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-700/50'
                        }`}
                      >
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${
                            selected === opt
                              ? 'border-teal-500 bg-teal-500 text-white'
                              : 'border-slate-300 text-slate-400 dark:text-slate-500 dark:text-slate-400'
                          }`}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1 leading-snug whitespace-pre-line">{opt}</span>
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              <div className="mt-5 flex gap-2">
                <button
                  onClick={submitAnswer}
                  disabled={!selected}
                  className="flex-1 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
                >
                  {currentIdx + 1 >= questions.length ? 'Klausur beenden' : 'Antwort bestätigen'}
                </button>
              </div>
            </div>
          )}

          {/* ─────────────── RESULTS ─────────────── */}
          {phase === 'results' && (
            <div>
              {/* Score circle */}
              <div className="mb-6 flex flex-col items-center">
                <div className="relative">
                  <svg width="140" height="140" viewBox="0 0 140 140">
                    <circle cx="70" cy="70" r="60" fill="none" stroke="#e2e8f0" strokeWidth="10" />
                    <motion.circle
                      cx="70" cy="70" r="60" fill="none"
                      stroke={pct >= 75 ? '#10b981' : pct >= 50 ? '#0d9488' : '#ef4444'}
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={`${(pct / 100) * 377} 377`}
                      transform="rotate(-90 70 70)"
                      initial={{ strokeDasharray: '0 377' }}
                      animate={{ strokeDasharray: `${(pct / 100) * 377} 377` }}
                      transition={{ duration: 1.2, ease: 'easeOut' }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-bold ${grade.color}`}>{Math.round(pct)}%</span>
                    <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                      {correctCount} / {questions.length}
                    </span>
                  </div>
                </div>
                <p className={`mt-3 text-2xl font-bold ${grade.color}`}>Note {grade.grade}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{grade.label}</p>
              </div>

              {pct >= 75 && (
                <div className="mb-5 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 p-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                  🎉 <strong>Glückwunsch!</strong> Du wärst durch die Klausur gekommen. Achte aber besonders auf
                  deine Fehler unten.
                </div>
              )}
              {pct < 75 && pct >= 50 && (
                <div className="mb-5 rounded-lg bg-amber-50 dark:bg-amber-500/15 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
                  💪 Knapp bestanden. Wiederhole die falschen Karten und versuche es nochmal.
                </div>
              )}
              {pct < 50 && (
                <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-500/15 p-3 text-sm text-red-800 ring-1 ring-red-200">
                  ⚠️ Noch nicht ausreichend. Lerne die markierten Themen gezielt nach.
                </div>
              )}

              {/* Wrong answers */}
              {answers.filter((a) => !a.correct).length > 0 && (
                <div className="mb-5">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                    <XCircle className="h-4 w-4 text-red-500" />
                    Falsch beantwortet ({answers.filter((a) => !a.correct).length})
                  </h3>
                  <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
                    {answers
                      .filter((a) => !a.correct)
                      .map((a, i) => (
                        <div key={i} className="rounded-lg bg-white p-3 ring-1 ring-slate-100">
                          <p className="mb-1 text-xs font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">
                            {a.question.card.chapter_title}
                          </p>
                          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                            {a.question.card.front}
                          </p>
                          <p className="mt-2 text-xs text-red-600">
                            <strong>Deine Antwort:</strong>{' '}
                            {a.picked ? a.picked.slice(0, 100) + '…' : '(nicht beantwortet)'}
                          </p>
                          <p className="mt-1 text-xs text-emerald-700">
                            <strong>Richtig:</strong> {a.question.correct.slice(0, 150)}
                            {a.question.correct.length > 150 ? '…' : ''}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {answers.filter((a) => !a.correct).length === 0 && (
                <div className="mb-5 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 p-4 text-sm font-medium text-emerald-800">
                  <Award className="h-5 w-5" />
                  Alle Fragen richtig! Du bist klausurfit. 🏆
                </div>
              )}

              <div className="flex gap-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                <button
                  onClick={() => {
                    setPhase('setup');
                    setAnswers([]);
                    setCurrentIdx(0);
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200"
                >
                  <RotateCcw className="h-4 w-4" />
                  Neue Klausur
                </button>
                <button
                  onClick={onClose}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-teal-600 py-3 text-sm font-bold text-white hover:bg-teal-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Fertig
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
