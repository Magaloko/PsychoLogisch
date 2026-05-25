import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  Flame,
  GraduationCap,
  HelpCircle,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { FlashcardData } from './Flashcard';
import type { ExamHistoryEntry } from './ExamSimulator';
import type { UserProgress } from '../learning';

interface ChapterStat {
  key: string;
  title: string;
  total: number;
  learned: number;
  weak: number;
  due: number;
}

interface StudyPlanProps {
  cards: FlashcardData[];
  progress: Record<string, UserProgress>;
  chapterStats: ChapterStat[];
  dueCount: number;
  weakCount: number;
  unseenCount: number;
  bookmarksSize: number;
  streakDays: number;
  streakToday: number;
  dailyGoal: number;
  onStartMode: (mode: 'all' | 'due' | 'weak' | 'unseen') => void;
  onStartBookmarks: () => void;
  onSetChapter: (key: string) => void;
  examHistory: ExamHistoryEntry[];
  onStartExam: () => void;
  examDate: string | null;
  onSetExamDate: () => void;
  onClearExamDate: () => void;
}

const TIPS = [
  'Kurze, regelmäßige Lerneinheiten sind effektiver als lange, seltene Sitzungen.',
  'Wiederhole Schwachstellen zuerst – dein Gehirn lernt am meisten aus Fehlern.',
  'Erkläre ein Konzept laut in eigenen Worten – das vertieft das Verständnis.',
  'Schreibe nach dem Lernen eine kurze Zusammenfassung aus dem Gedächtnis.',
  'Wechsle zwischen verschiedenen Themen – Interleaving verbessert den Abruf.',
  'Mache nach 25 Minuten eine 5-Minuten-Pause (Pomodoro-Technik).',
  'Verknüpfe neues Wissen mit etwas, das du bereits kennst.',
];

const getTodayTip = () => {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return TIPS[dayOfYear % TIPS.length];
};

const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};
const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export default function StudyPlan({
  cards,
  progress,
  chapterStats,
  dueCount,
  weakCount,
  unseenCount,
  bookmarksSize,
  streakDays,
  streakToday,
  dailyGoal,
  onStartMode,
  onStartBookmarks,
  onSetChapter,
  examHistory,
  onStartExam,
  examDate,
  onSetExamDate,
  onClearExamDate,
}: StudyPlanProps) {
  // 7-day due forecast
  const forecast = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(now, i);
      const key = dateKey(d);
      const count = cards.filter((card) => {
        const p = progress[card.id];
        return p && p.next_review.slice(0, 10) === key;
      }).length;
      const label =
        i === 0
          ? 'Heute'
          : i === 1
          ? 'Mo.'
          : d.toLocaleDateString('de-DE', { weekday: 'short' });
      return { label, count, key, isToday: i === 0 };
    });
  }, [cards, progress]);
  const forecastMax = Math.max(...forecast.map((d) => d.count), 1);

  // Chapter priority: due*3 + weak*2 + unseen*1
  const priorityChapters = useMemo(() => {
    return [...chapterStats]
      .map((ch) => ({
        ...ch,
        urgency: ch.due * 3 + ch.weak * 2 + (ch.total - ch.learned),
        pct: ch.total > 0 ? Math.round((ch.learned / ch.total) * 100) : 0,
      }))
      .filter((ch) => ch.urgency > 0 || ch.due > 0)
      .sort((a, b) => b.urgency - a.urgency)
      .slice(0, 6);
  }, [chapterStats]);

  const goalPct = Math.min(1, streakToday / dailyGoal);
  const goalDone = streakToday >= dailyGoal;

  // ── Klausur-Countdown ─────────────────────────────────────────────────────
  const examPlan = useMemo(() => {
    if (!examDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(examDate);
    target.setHours(0, 0, 0, 0);
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysLeft = Math.max(0, Math.round((target.getTime() - today.getTime()) / msPerDay));
    const unseen = cards.length - Object.keys(progress).length;
    const weak = chapterStats.reduce((s, ch) => s + ch.weak, 0);
    const cardsToCover = unseen + Math.ceil(weak * 0.5); // unseen + Hälfte der schwachen
    const perDay = daysLeft > 0 ? Math.ceil(cardsToCover / daysLeft) : cardsToCover;
    const examDateLabel = target.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' });
    return { daysLeft, unseen, weak, cardsToCover, perDay, examDateLabel };
  }, [examDate, cards.length, progress, chapterStats]);

  return (
    <div className="space-y-6">
      {/* ── Klausur-Countdown ────────────────────────────────────────────── */}
      {examPlan ? (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl border p-5 shadow-sm ${
            examPlan.daysLeft <= 3
              ? 'border-red-200 bg-gradient-to-br from-red-50 to-orange-50 dark:border-red-500/30 dark:from-red-500/10 dark:to-orange-500/10'
              : examPlan.daysLeft <= 14
              ? 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 dark:border-amber-500/30 dark:from-amber-500/10 dark:to-yellow-500/10'
              : 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-blue-50 dark:border-indigo-500/30 dark:from-indigo-500/10 dark:to-blue-500/10'
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-2xl text-white shadow-sm ${
                  examPlan.daysLeft <= 3
                    ? 'bg-red-500'
                    : examPlan.daysLeft <= 14
                    ? 'bg-amber-500'
                    : 'bg-indigo-500'
                }`}
              >
                <span className="text-2xl font-bold leading-none">{examPlan.daysLeft}</span>
                <span className="mt-0.5 text-[10px] uppercase tracking-wide opacity-90">Tage</span>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {examPlan.daysLeft === 0 ? '🚨 Heute ist Klausurtag' : 'Bis zur Klausur'}
                </p>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">
                  {examPlan.examDateLabel}
                </h2>
                {examPlan.daysLeft > 0 && (
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                    Empfehlung: <strong>{examPlan.perDay} Karten pro Tag</strong> ({examPlan.unseen} ungelernt
                    {examPlan.weak > 0 && `, ${examPlan.weak} schwach`})
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onSetExamDate}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                Datum ändern
              </button>
              <button
                onClick={onClearExamDate}
                className="rounded-lg bg-white/60 px-3 py-1.5 text-xs font-medium text-slate-500 transition-colors hover:bg-white dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800"
                title="Klausurdatum entfernen"
              >
                ✕
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <button
          onClick={onSetExamDate}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-4 text-sm font-medium text-slate-500 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400 dark:hover:border-indigo-500/50 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-300"
        >
          <CalendarDays className="h-4 w-4" />
          📅 Klausurtermin setzen für persönlichen Lernplan
        </button>
      )}

      {/* ── Hero: Tagesziel ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-indigo-50 p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {goalDone ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <Flame className="h-5 w-5 text-orange-500" />
              )}
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {goalDone ? 'Tagesziel erreicht! 🎉' : 'Dein heutiger Plan'}
              </h2>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {streakToday} von {dailyGoal} Karten heute bewertet
              {streakDays > 1 && (
                <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  🔥 {streakDays} Tage
                </span>
              )}
            </p>
          </div>
          {/* Goal progress arc */}
          <div className="flex shrink-0 items-center gap-3">
            <svg width="64" height="64" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#e2e8f0" strokeWidth="6" />
              <motion.circle
                cx="32" cy="32" r="26" fill="none"
                stroke={goalDone ? '#10b981' : '#0d9488'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={`${goalPct * 163.36} 163.36`}
                transform="rotate(-90 32 32)"
                initial={{ strokeDasharray: '0 163.36' }}
                animate={{ strokeDasharray: `${goalPct * 163.36} 163.36` }}
                transition={{ type: 'spring', stiffness: 80, damping: 16, delay: 0.1 }}
              />
              <text x="32" y="37" textAnchor="middle" fontSize="13" fill="#0f172a" fontWeight="700">
                {goalDone ? '✓' : `${Math.round(goalPct * 100)}%`}
              </text>
            </svg>
          </div>
        </div>

        {/* Today's tip */}
        <div className="mt-4 rounded-lg bg-white/70 p-3 text-sm text-slate-600 dark:text-slate-300 backdrop-blur-sm">
          <span className="mr-2 text-base">💡</span>
          {getTodayTip()}
        </div>
      </div>

      {/* ── Quick-Start cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          {
            label: 'Heute fällig',
            value: dueCount,
            icon: CalendarDays,
            color: 'text-teal-700',
            bg: 'bg-teal-50 dark:bg-teal-500/15 border-teal-200 hover:bg-teal-100',
            action: () => onStartMode('due'),
            cta: 'Jetzt lernen →',
            disabled: dueCount === 0,
          },
          {
            label: 'Schwächen',
            value: weakCount,
            icon: Target,
            color: 'text-orange-700',
            bg: 'bg-orange-50 dark:bg-orange-500/15 border-orange-200 hover:bg-orange-100',
            action: () => onStartMode('weak'),
            cta: 'Üben →',
            disabled: weakCount === 0,
          },
          {
            label: 'Neue Karten',
            value: unseenCount,
            icon: Zap,
            color: 'text-indigo-700',
            bg: 'bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200 hover:bg-indigo-100',
            action: () => onStartMode('unseen'),
            cta: 'Entdecken →',
            disabled: unseenCount === 0,
          },
          {
            label: 'Lesezeichen',
            value: bookmarksSize,
            icon: Star,
            color: 'text-amber-700',
            bg: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200 hover:bg-amber-100',
            action: onStartBookmarks,
            cta: 'Wiederholen →',
            disabled: bookmarksSize === 0,
          },
        ].map(({ label, value, icon: Icon, color, bg, action, cta, disabled }) => (
          <motion.button
            key={label}
            onClick={action}
            disabled={disabled}
            whileHover={disabled ? {} : { y: -2, scale: 1.02 }}
            whileTap={disabled ? {} : { scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            className={`flex flex-col rounded-xl border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${bg}`}
          >
            <Icon className={`h-5 w-5 ${color} mb-2`} />
            <p className="text-xs font-medium uppercase text-slate-400 dark:text-slate-500 dark:text-slate-400">{label}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
            {!disabled && (
              <p className={`mt-1.5 text-[11px] font-semibold ${color} opacity-70`}>{cta}</p>
            )}
          </motion.button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        {/* ── 7-day forecast ───────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Fällige Karten – nächste 7 Tage</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Plane deinen Lernrhythmus voraus</p>
            </div>
            <CalendarDays className="h-4 w-4 text-teal-600" />
          </div>
          <div className="flex items-end gap-2" style={{ height: '8rem' }}>
            {forecast.map((day, i) => (
              <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                  {day.count > 0 ? day.count : ''}
                </span>
                <div className="flex w-full items-end" style={{ height: '6rem' }}>
                  <motion.div
                    className={`w-full rounded-t-md ${day.isToday ? 'bg-teal-500' : 'bg-teal-200'}`}
                    initial={{ height: 0 }}
                    animate={{ height: `${(day.count / forecastMax) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 100, damping: 16, delay: i * 0.06 }}
                  />
                </div>
                <span className={`text-[10px] ${day.isToday ? 'font-bold text-teal-700' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'}`}>
                  {day.label}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3 text-xs text-slate-500 dark:text-slate-400">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-teal-600" />
            {dueCount > 0
              ? `${dueCount} Karten sind heute fällig – am besten jetzt beginnen!`
              : 'Keine Karten heute fällig. Nutze die Zeit für neue oder schwache Karten.'}
          </div>
        </div>

        {/* ── Chapter priority ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Kapitel-Priorität</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">Sortiert nach Dringlichkeit</p>
            </div>
            <AlertCircle className="h-4 w-4 text-orange-500" />
          </div>

          {priorityChapters.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-slate-400 dark:text-slate-500 dark:text-slate-400">
              <BookOpen className="h-8 w-8 opacity-30" />
              <p className="text-sm">Alle Kapitel auf dem neuesten Stand!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {priorityChapters.map((ch, i) => (
                <motion.button
                  key={ch.key}
                  onClick={() => onSetChapter(ch.key)}
                  whileHover={{ x: 2 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="block w-full rounded-lg p-3 text-left transition-colors hover:bg-slate-50 dark:bg-slate-700/50"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium text-slate-700 dark:text-slate-200">{ch.title}</span>
                        <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">{ch.pct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <motion.div
                          className={`h-full rounded-full ${ch.pct === 100 ? 'bg-emerald-500' : ch.due > 0 ? 'bg-teal-500' : 'bg-slate-400'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${ch.pct}%` }}
                          transition={{ type: 'spring', stiffness: 80, damping: 18, delay: i * 0.05 }}
                        />
                      </div>
                      <div className="mt-1 flex gap-3 text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                        {ch.due > 0 && <span className="text-teal-600">{ch.due} fällig</span>}
                        {ch.weak > 0 && <span className="text-orange-500">{ch.weak} schwach</span>}
                        {ch.total - ch.learned > 0 && (
                          <span>{ch.total - ch.learned} neu</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 dark:border-slate-700 pt-3">
            <button
              onClick={() => onStartMode('due')}
              disabled={dueCount === 0}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-40"
            >
              <HelpCircle className="h-4 w-4" />
              Heutigen Plan starten
            </button>
          </div>
        </div>
      </div>

      {/* ── Klausur-Historie ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Klausur-Verlauf</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                {examHistory.length === 0
                  ? 'Noch keine Klausur absolviert'
                  : `${examHistory.length} Klausur${examHistory.length === 1 ? '' : 'en'} bisher`}
              </p>
            </div>
          </div>
          <button
            onClick={onStartExam}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
          >
            + Neue Klausur
          </button>
        </div>

        {examHistory.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-center text-slate-400 dark:text-slate-500 dark:text-slate-400">
            <GraduationCap className="h-10 w-10 opacity-20" />
            <p className="text-sm">Starte deine erste Klausur und tracke deinen Fortschritt</p>
          </div>
        ) : (
          <>
            {/* Trend chart: last 10 exams */}
            {examHistory.length >= 2 && (
              <div className="mb-4">
                <div className="mb-1 flex justify-between text-[10px] text-slate-400 dark:text-slate-500 dark:text-slate-400">
                  <span>älter</span>
                  <span>neuer →</span>
                </div>
                <div className="flex h-16 items-end gap-1">
                  {examHistory
                    .slice(0, 10)
                    .reverse()
                    .map((ex, i) => {
                      const color =
                        ex.pct >= 75
                          ? 'bg-emerald-500'
                          : ex.pct >= 50
                          ? 'bg-amber-500'
                          : 'bg-red-500';
                      return (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${ex.pct}%` }}
                          transition={{ delay: i * 0.04, type: 'spring', stiffness: 90, damping: 18 }}
                          className={`flex-1 rounded-t ${color}`}
                          title={`${new Date(ex.date).toLocaleDateString('de-DE')} · ${ex.pct}% · Note ${ex.grade}`}
                        />
                      );
                    })}
                </div>
                {/* Trend indicator */}
                {examHistory.length >= 3 && (() => {
                  const recent = examHistory.slice(0, 3).reduce((s, e) => s + e.pct, 0) / 3;
                  const older = examHistory.slice(3, 6).reduce((s, e) => s + e.pct, 0) / Math.min(3, examHistory.length - 3);
                  if (!older) return null;
                  const diff = recent - older;
                  return (
                    <p
                      className={`mt-2 text-xs ${
                        diff > 5 ? 'text-emerald-600' : diff < -5 ? 'text-red-500' : 'text-slate-400 dark:text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {diff > 5 ? '↗' : diff < -5 ? '↘' : '→'} Trend: {recent.toFixed(0)}% (Ø letzte 3) vs.{' '}
                      {older.toFixed(0)}% (davor)
                    </p>
                  );
                })()}
              </div>
            )}

            {/* List recent exams */}
            <div className="space-y-2">
              {examHistory.slice(0, 5).map((ex, i) => {
                const color =
                  ex.pct >= 75
                    ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/15 ring-emerald-200'
                    : ex.pct >= 50
                    ? 'text-amber-600 bg-amber-50 dark:bg-amber-500/15 ring-amber-200'
                    : 'text-red-600 bg-red-50 dark:bg-red-500/15 ring-red-200';
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 dark:border-slate-700 p-2.5 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {new Date(ex.date).toLocaleDateString('de-DE', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
                        {ex.correct}/{ex.questions} · {ex.timeLimit} min
                        {ex.chapter !== 'all' && ` · Kapitel ${ex.chapter}`}
                      </p>
                    </div>
                    <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ring-1 ${color}`}>
                      {ex.pct}% · Note {ex.grade}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weak themes aggregated */}
            {(() => {
              const tagCounts: Record<string, number> = {};
              examHistory.slice(0, 5).forEach((ex) => {
                ex.weakTags.forEach((t) => (tagCounts[t] = (tagCounts[t] || 0) + 1));
              });
              const top = Object.entries(tagCounts)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5);
              if (top.length === 0) return null;
              return (
                <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-500/15 p-3 ring-1 ring-red-100">
                  <p className="mb-1 text-xs font-bold text-red-700">⚠ Wiederkehrende Schwachstellen</p>
                  <div className="flex flex-wrap gap-1">
                    {top.map(([tag, count]) => (
                      <span
                        key={tag}
                        className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-red-700 ring-1 ring-red-200"
                      >
                        #{tag} <span className="opacity-60">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
