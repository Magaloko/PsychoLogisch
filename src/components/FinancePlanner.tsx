import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  date: string; // YYYY-MM-DD
}

export interface SavingsGoal {
  name: string;
  target: number;
  saved: number;
}

interface FinanceData {
  transactions: Transaction[];
  savingsGoal: SavingsGoal;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FINANCE_KEY = 'psychologisch-finance-v1';

const EXPENSE_CATEGORIES = [
  'Miete & Wohnen',
  'Lebensmittel',
  'Transport',
  'Gesundheit',
  'Bildung',
  'Freizeit',
  'Kleidung',
  'Technik',
  'Versicherungen',
  'Sonstiges',
];

const INCOME_CATEGORIES = [
  'Gehalt',
  'Freelance',
  'Stipendium',
  'BAföG',
  'Nebenjob',
  'Zinsen & Kapital',
  'Sonstiges',
];

const CATEGORY_COLORS: Record<string, string> = {
  'Miete & Wohnen': '#6366f1',
  Lebensmittel: '#0d9488',
  Transport: '#f59e0b',
  Gesundheit: '#ec4899',
  Bildung: '#3b82f6',
  Freizeit: '#8b5cf6',
  Kleidung: '#f97316',
  Technik: '#06b6d4',
  Versicherungen: '#64748b',
  Sonstiges: '#94a3b8',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const loadData = (): FinanceData => {
  try {
    const saved = window.localStorage.getItem(FINANCE_KEY);
    if (saved) return JSON.parse(saved) as FinanceData;
  } catch {
    // ignore
  }
  return { transactions: [], savingsGoal: { name: 'Notgroschen', target: 1000, saved: 0 } };
};

const saveData = (data: FinanceData) => {
  window.localStorage.setItem(FINANCE_KEY, JSON.stringify(data));
};

const monthKey = (year: number, month: number) =>
  `${year}-${String(month + 1).padStart(2, '0')}`;

const monthLabel = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });

const shortMonth = (year: number, month: number) =>
  new Date(year, month, 1).toLocaleDateString('de-DE', { month: 'short' });

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinancePlanner() {
  const today = new Date();
  const [data, setData] = useState<FinanceData>(loadData);
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(today.toISOString().slice(0, 10));
  const [goalName, setGoalName] = useState(data.savingsGoal.name);
  const [goalTarget, setGoalTarget] = useState(String(data.savingsGoal.target));
  const [editingGoal, setEditingGoal] = useState(false);

  const persist = useCallback((next: FinanceData) => {
    setData(next);
    saveData(next);
  }, []);

  // ── Navigation ──────────────────────────────────────────────────────────────

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

  const goBack = () => {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  };
  const goForward = () => {
    if (isCurrentMonth) return;
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  };

  // ── Filtered transactions ───────────────────────────────────────────────────

  const key = monthKey(year, month);
  const monthTransactions = useMemo(
    () => data.transactions.filter(t => t.date.startsWith(key)).sort((a, b) => b.date.localeCompare(a.date)),
    [data.transactions, key]
  );

  const totalIncome = useMemo(
    () => monthTransactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
    [monthTransactions]
  );
  const totalExpense = useMemo(
    () => monthTransactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    [monthTransactions]
  );
  const balance = totalIncome - totalExpense;

  // ── Category breakdown ──────────────────────────────────────────────────────

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthTransactions]);

  // ── Last 6 months chart data ────────────────────────────────────────────────

  const chartData = useMemo(() => {
    const months: { label: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(year, month - i, 1);
      const y2 = d.getFullYear();
      const m2 = d.getMonth();
      const k = monthKey(y2, m2);
      const txs = data.transactions.filter(t => t.date.startsWith(k));
      months.push({
        label: shortMonth(y2, m2),
        income: txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0),
        expense: txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
      });
    }
    return months;
  }, [data.transactions, year, month]);

  const chartMax = Math.max(...chartData.flatMap(d => [d.income, d.expense]), 1);

  // ── Add transaction ─────────────────────────────────────────────────────────

  const handleAddTransaction = () => {
    const amount = parseFloat(formAmount.replace(',', '.'));
    if (!amount || amount <= 0 || !formDate) return;
    const tx: Transaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: formType,
      category: formCategory,
      amount,
      description: formDesc.trim(),
      date: formDate,
    };
    persist({ ...data, transactions: [...data.transactions, tx] });
    setFormAmount('');
    setFormDesc('');
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    persist({ ...data, transactions: data.transactions.filter(t => t.id !== id) });
  };

  // ── Savings goal ────────────────────────────────────────────────────────────

  const addToSavings = (amount: number) => {
    const next = { ...data, savingsGoal: { ...data.savingsGoal, saved: Math.min(data.savingsGoal.saved + amount, data.savingsGoal.target) } };
    persist(next);
  };

  const saveGoalEdit = () => {
    const target = parseFloat(goalTarget.replace(',', '.'));
    if (!target || target <= 0) return;
    persist({ ...data, savingsGoal: { name: goalName.trim() || 'Sparziel', target, saved: data.savingsGoal.saved } });
    setEditingGoal(false);
  };

  const goalPercent = Math.min(100, Math.round((data.savingsGoal.saved / data.savingsGoal.target) * 100));

  // ── Form category sync when type changes ────────────────────────────────────

  const handleFormTypeChange = (type: 'income' | 'expense') => {
    setFormType(type);
    setFormCategory(type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0]);
  };

  return (
    <div className="space-y-6">

      {/* ── Header + month nav ─────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Monats-Finanzplaner</h2>
          <p className="text-sm text-slate-500">Überblick über Einnahmen und Ausgaben</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goBack}
            className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[9rem] sm:min-w-[11rem] text-center text-sm font-semibold text-slate-700">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={goForward}
            disabled={isCurrentMonth}
            className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: 'Einnahmen', value: totalIncome, icon: TrendingUp, color: 'text-teal-700', bg: 'bg-teal-50', border: 'border-teal-100' },
          { label: 'Ausgaben', value: totalExpense, icon: TrendingDown, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-100' },
          { label: 'Bilanz', value: balance, icon: Wallet, color: balance >= 0 ? 'text-indigo-700' : 'text-orange-700', bg: balance >= 0 ? 'bg-indigo-50' : 'bg-orange-50', border: balance >= 0 ? 'border-indigo-100' : 'border-orange-100' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`mt-2 text-xl sm:text-2xl font-bold ${color}`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* ── Add transaction ────────────────────────────────────────────────── */}
      <div>
        <AnimatePresence>
          {!showForm ? (
            <motion.button
              key="add-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Buchung hinzufügen
            </motion.button>
          ) : (
            <motion.div
              key="add-form"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800">Neue Buchung</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Type toggle */}
              <div className="mb-4 flex gap-2">
                {(['expense', 'income'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => handleFormTypeChange(t)}
                    className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
                      formType === t
                        ? t === 'expense' ? 'bg-red-100 text-red-700' : 'bg-teal-100 text-teal-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {t === 'expense' ? 'Ausgabe' : 'Einnahme'}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Kategorie</span>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  >
                    {(formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Betrag (€)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Beschreibung</span>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500">Datum</span>
                  <input
                    type="date"
                    value={formDate}
                    max={today.toISOString().slice(0, 10)}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <motion.button
                  onClick={handleAddTransaction}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Speichern
                </motion.button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Main grid: transactions + sidebar ──────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">

        {/* Transaction list */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-3">
            <h3 className="font-semibold text-slate-800">Buchungen</h3>
          </div>
          {monthTransactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-400">
              Noch keine Buchungen für {monthLabel(year, month)}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              <AnimatePresence initial={false}>
                {monthTransactions.map(tx => (
                  <motion.li
                    key={tx.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12, height: 0, overflow: 'hidden' }}
                    transition={{ duration: 0.16 }}
                    className="group flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: tx.type === 'income' ? '#0d9488' : (CATEGORY_COLORS[tx.category] ?? '#94a3b8') }}
                        />
                        <span className="truncate text-sm font-medium text-slate-700">
                          {tx.description || tx.category}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          {tx.category}
                        </span>
                      </div>
                      <p className="mt-0.5 pl-4 text-xs text-slate-400">
                        {new Date(tx.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold tabular-nums ${tx.type === 'income' ? 'text-teal-700' : 'text-red-700'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500"
                        title="Löschen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* Category breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 font-semibold text-slate-800">Ausgaben nach Kategorie</h3>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-slate-400">Keine Ausgaben diesen Monat.</p>
            ) : (
              <div className="space-y-3">
                {expenseByCategory.map(([cat, amt]) => {
                  const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-600">{cat}</span>
                        <span className="text-slate-400">{fmt(amt)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#94a3b8' }}
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Savings goal */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800">Sparziel</h3>
              <button
                onClick={() => setEditingGoal(v => !v)}
                className="text-xs text-teal-600 hover:underline"
              >
                {editingGoal ? 'Abbrechen' : 'Bearbeiten'}
              </button>
            </div>

            <AnimatePresence mode="wait">
              {editingGoal ? (
                <motion.div
                  key="goal-edit"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-2"
                >
                  <input
                    type="text"
                    value={goalName}
                    onChange={e => setGoalName(e.target.value)}
                    placeholder="Zielname"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-500"
                  />
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={e => setGoalTarget(e.target.value)}
                    placeholder="Zielbetrag (€)"
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-teal-500"
                  />
                  <button
                    onClick={saveGoalEdit}
                    className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Speichern
                  </button>
                </motion.div>
              ) : (
                <motion.div key="goal-view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <p className="text-sm font-medium text-slate-700">{data.savingsGoal.name}</p>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #0d9488, #4f46e5)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${goalPercent}%` }}
                      transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500">
                    <span>{fmt(data.savingsGoal.saved)} gespart</span>
                    <span>{goalPercent}% von {fmt(data.savingsGoal.target)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {[50, 100, 200].map(n => (
                      <button
                        key={n}
                        onClick={() => addToSavings(n)}
                        disabled={data.savingsGoal.saved >= data.savingsGoal.target}
                        className="flex-1 rounded-lg bg-teal-50 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        +{n}€
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
      </div>

      {/* ── 6-month bar chart ──────────────────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-slate-800">Verlauf (6 Monate)</h3>
        <div className="flex items-end gap-2" style={{ height: '10rem' }}>
          {chartData.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end gap-0.5" style={{ height: '8rem' }}>
                <motion.div
                  className="flex-1 rounded-t-sm bg-teal-400"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.income / chartMax) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 16, delay: i * 0.04 }}
                  title={`Einnahmen: ${fmt(d.income)}`}
                />
                <motion.div
                  className="flex-1 rounded-t-sm bg-red-400"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.expense / chartMax) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 16, delay: i * 0.04 + 0.02 }}
                  title={`Ausgaben: ${fmt(d.expense)}`}
                />
              </div>
              <span className="text-xs text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-400" /> Einnahmen</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Ausgaben</span>
        </div>
      </div>

    </div>
  );
}
