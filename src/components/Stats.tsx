import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award, BarChart3, BookOpen, CalendarDays, Flame, TrendingUp } from 'lucide-react';
import type { FlashcardData } from './Flashcard';
import type { UserProgress } from '../learning';

interface ChapterStat {
  key: string;
  title: string;
  total: number;
  learned: number;
  weak: number;
  due: number;
}

interface StreakData {
  date: string;
  todayCount: number;
  days: number;
  history?: Record<string, number>;
}

interface StatsProps {
  progress: Record<string, UserProgress>;
  cards: FlashcardData[];
  chapterStats: ChapterStat[];
  streak: StreakData;
}

const TODAY = new Date().toISOString().slice(0, 10);

const addDays = (base: Date, n: number) => {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
};

const dateKey = (d: Date) => d.toISOString().slice(0, 10);

export default function Stats({ progress, cards, chapterStats, streak }: StatsProps) {
  // ── top-level numbers ────────────────────────────────────────────────────
  const learnedCount = Object.keys(progress).length;
  const learnedPct = cards.length > 0 ? Math.round((learnedCount / cards.length) * 100) : 0;
  const avgEase = learnedCount > 0
    ? (Object.values(progress).reduce((s, p) => s + p.ease_factor, 0) / learnedCount).toFixed(2)
    : '—';
  const totalLapses = Object.values(progress).reduce((s, p) => s + (p.lapses ?? 0), 0);
  const strongCount = Object.values(progress).filter(p => p.ease_factor >= 2.3 && p.repetitions >= 3).length;

  // ── 7-day forecast (cards newly due each day) ─────────────────────────────
  const forecast = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(now, i);
      const key = dateKey(d);
      const count = cards.filter(card => {
        const p = progress[card.id];
        return p && p.next_review.slice(0, 10) === key;
      }).length;
      const label = i === 0 ? 'Heute' : i === 1 ? 'Mo.' : d.toLocaleDateString('de-DE', { weekday: 'short' });
      return { label, count, key };
    });
  }, [cards, progress]);

  const forecastMax = Math.max(...forecast.map(d => d.count), 1);

  // ── activity heatmap (last 84 days = 12 weeks) ───────────────────────────
  const heatmap = useMemo(() => {
    const history = streak.history ?? {};
    const days: { key: string; count: number; weekday: number }[] = [];
    const now = new Date();

    // start from 83 days ago, aligned to Monday
    const startDay = addDays(now, -83);
    for (let i = 0; i < 84; i++) {
      const d = addDays(startDay, i);
      const key = dateKey(d);
      days.push({ key, count: history[key] ?? 0, weekday: d.getDay() });
    }

    // group into 12 columns (weeks), 7 rows (days Mon–Sun)
    const weeks: (typeof days[0])[][] = [];
    let week: typeof days = [];
    days.forEach((day, i) => {
      week.push(day);
      if ((i + 1) % 7 === 0) {
        weeks.push(week);
        week = [];
      }
    });
    if (week.length) weeks.push(week);
    return weeks;
  }, [streak.history]);

  const heatColor = (count: number) => {
    if (count === 0) return 'bg-slate-100';
    if (count < 4) return 'bg-teal-200';
    if (count < 10) return 'bg-teal-400';
    return 'bg-teal-600';
  };

  // ── top chapters by progress ──────────────────────────────────────────────
  const sortedChapters = [...chapterStats].sort((a, b) => (b.learned / b.total) - (a.learned / a.total));

  return (
    <div className="space-y-6">

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: 'Karten gesamt', value: cards.length, icon: BookOpen, color: 'text-slate-700' },
          { label: 'Gelernt', value: `${learnedPct}%`, icon: TrendingUp, color: 'text-teal-700' },
          { label: 'Ø Ease-Faktor', value: avgEase, icon: BarChart3, color: 'text-indigo-700' },
          { label: 'Fehlerhafte', value: totalLapses, icon: CalendarDays, color: 'text-red-600' },
          { label: 'Stark gelernt', value: strongCount, icon: Award, color: 'text-amber-600' },
          { label: 'Lerntage', value: streak.days, icon: Flame, color: 'text-orange-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
              <Icon className={`h-3.5 w-3.5 shrink-0 ${color}`} />
            </div>
            <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">

          {/* ── Heatmap ──────────────────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Lernaktivität</h3>
              <span className="text-xs text-slate-400">letzte 12 Wochen</span>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1">
              {heatmap.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1">
                  {week.map((day) => (
                    <div
                      key={day.key}
                      title={`${day.key}${day.count > 0 ? ` · ${day.count} Karten` : ''}`}
                      className={`h-3 w-3 rounded-sm ${heatColor(day.count)} ${day.key === TODAY ? 'ring-1 ring-teal-600 ring-offset-1' : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
              <span>Weniger</span>
              {['bg-slate-100', 'bg-teal-200', 'bg-teal-400', 'bg-teal-600'].map(c => (
                <div key={c} className={`h-3 w-3 rounded-sm ${c}`} />
              ))}
              <span>Mehr</span>
            </div>
          </div>

          {/* ── 7-day forecast ───────────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Fälligkeiten (nächste 7 Tage)</h3>
              <CalendarDays className="h-4 w-4 text-teal-600" />
            </div>
            <div className="flex items-end gap-2" style={{ height: '7rem' }}>
              {forecast.map((day, i) => (
                <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-slate-600">{day.count > 0 ? day.count : ''}</span>
                  <div className="flex w-full items-end" style={{ height: '5.5rem' }}>
                    <motion.div
                      className={`w-full rounded-t-md ${i === 0 ? 'bg-teal-500' : 'bg-teal-200'}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${(day.count / forecastMax) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 100, damping: 16, delay: i * 0.05 }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">{day.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Chapter mastery sidebar ─────────────────────────────────────── */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Kapitel-Fortschritt</h3>
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </div>
          <div className="space-y-4">
            {sortedChapters.map((ch) => {
              const pct = ch.total > 0 ? Math.round((ch.learned / ch.total) * 100) : 0;
              return (
                <div key={ch.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-slate-700">{ch.title}</span>
                    <span className="text-slate-400">
                      {pct}%
                      {ch.due > 0 && <span className="ml-1.5 text-amber-600">· {ch.due} fällig</span>}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className={`h-full rounded-full ${pct === 100 ? 'bg-emerald-500' : 'bg-teal-500'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                    />
                  </div>
                  {ch.weak > 0 && (
                    <p className="mt-0.5 text-[10px] text-red-400">{ch.weak} schwache Karten</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
