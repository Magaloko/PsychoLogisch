import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  Target,
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
  recurringId?: string; // marks auto-generated transactions
}

export interface SavingsGoal {
  name: string;
  target: number;
  saved: number;
}

export interface Budget {
  category: string;
  monthlyLimit: number;
}

export interface RecurringTransaction {
  id: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  description: string;
  dayOfMonth: number; // 1-28 to keep simple
  active: boolean;
  startDate: string; // YYYY-MM-DD: do not generate before this
  lastApplied?: string; // YYYY-MM: latest month already booked
}

interface FinanceData {
  transactions: Transaction[];
  savingsGoal: SavingsGoal;
  budgets: Budget[];
  recurring: RecurringTransaction[];
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
  'Abos & Mitgliedschaften',
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
  'Abos & Mitgliedschaften': '#a855f7',
  Sonstiges: '#94a3b8',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });

const loadData = (): FinanceData => {
  try {
    const saved = window.localStorage.getItem(FINANCE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<FinanceData>;
      return {
        transactions: parsed.transactions ?? [],
        savingsGoal: parsed.savingsGoal ?? { name: 'Notgroschen', target: 1000, saved: 0 },
        budgets: parsed.budgets ?? [],
        recurring: parsed.recurring ?? [],
      };
    }
  } catch {
    // ignore
  }
  return {
    transactions: [],
    savingsGoal: { name: 'Notgroschen', target: 1000, saved: 0 },
    budgets: [],
    recurring: [],
  };
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

// Apply all due recurring transactions up to today (month + day)
const applyRecurring = (data: FinanceData): FinanceData => {
  const today = new Date();
  const newTxs: Transaction[] = [];
  const updatedRecurring = data.recurring.map((rec) => {
    if (!rec.active) return rec;
    let lastApplied = rec.lastApplied;
    const start = new Date(rec.startDate);
    let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    if (lastApplied) {
      const [ly, lm] = lastApplied.split('-').map(Number);
      cursor = new Date(ly, lm, 1); // month after last applied
    }
    while (cursor <= today) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      // Determine actual day (clamp to last day of month)
      const lastDayOfMonth = new Date(y, m + 1, 0).getDate();
      const day = Math.min(rec.dayOfMonth, lastDayOfMonth);
      const txDate = new Date(y, m, day);
      // Skip if booking date is still in the future
      if (txDate <= today) {
        const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        // Avoid duplicate if already exists (same recurringId + month)
        const mKey = monthKey(y, m);
        const exists = data.transactions.some(
          (t) => t.recurringId === rec.id && t.date.startsWith(mKey)
        );
        if (!exists) {
          newTxs.push({
            id: `tx-rec-${rec.id}-${mKey}`,
            type: rec.type,
            category: rec.category,
            amount: rec.amount,
            description: rec.description || `(Wiederkehrend) ${rec.category}`,
            date: dateStr,
            recurringId: rec.id,
          });
        }
        lastApplied = mKey;
      }
      cursor = new Date(y, m + 1, 1);
    }
    return { ...rec, lastApplied };
  });

  if (newTxs.length === 0) return data;
  return {
    ...data,
    transactions: [...data.transactions, ...newTxs],
    recurring: updatedRecurring,
  };
};

const downloadCSV = (transactions: Transaction[]) => {
  const header = 'Datum;Typ;Kategorie;Beschreibung;Betrag\n';
  const rows = transactions
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(
      (t) =>
        `${t.date};${t.type === 'income' ? 'Einnahme' : 'Ausgabe'};${t.category};"${(t.description ?? '').replace(/"/g, "'")}";${(t.type === 'income' ? '' : '-') + t.amount.toFixed(2).replace('.', ',')}`
    )
    .join('\n');
  // BOM for Excel UTF-8 detection
  const blob = new Blob(['﻿' + header + rows], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `psychologisch-finanzen-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function FinancePlanner() {
  const today = new Date();
  const [data, setData] = useState<FinanceData>(() => applyRecurring(loadData()));
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [showForm, setShowForm] = useState(false);
  const [showRecurringPanel, setShowRecurringPanel] = useState(false);
  const [showBudgetPanel, setShowBudgetPanel] = useState(false);
  const [formType, setFormType] = useState<'income' | 'expense'>('expense');
  const [formCategory, setFormCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [formAmount, setFormAmount] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formDate, setFormDate] = useState(today.toISOString().slice(0, 10));
  const [formRecurring, setFormRecurring] = useState(false);
  const [goalName, setGoalName] = useState(data.savingsGoal.name);
  const [goalTarget, setGoalTarget] = useState(String(data.savingsGoal.target));
  const [editingGoal, setEditingGoal] = useState(false);

  const persist = useCallback((next: FinanceData) => {
    setData(next);
    saveData(next);
  }, []);

  // Save initial recurring application
  useEffect(() => {
    saveData(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const savingsRate = totalIncome > 0 ? Math.max(0, (balance / totalIncome) * 100) : 0;

  // ── Category breakdown ──────────────────────────────────────────────────────

  const expenseByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => { map[t.category] = (map[t.category] ?? 0) + t.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [monthTransactions]);

  // ── Budgets with progress ──────────────────────────────────────────────────
  const budgetProgress = useMemo(() => {
    const expenses: Record<string, number> = {};
    monthTransactions
      .filter((t) => t.type === 'expense')
      .forEach((t) => { expenses[t.category] = (expenses[t.category] ?? 0) + t.amount; });
    return data.budgets.map((b) => {
      const spent = expenses[b.category] ?? 0;
      const pct = b.monthlyLimit > 0 ? (spent / b.monthlyLimit) * 100 : 0;
      return { ...b, spent, pct, over: spent > b.monthlyLimit };
    });
  }, [data.budgets, monthTransactions]);

  const overBudget = budgetProgress.filter((b) => b.over).length;

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
    const txId = `tx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tx: Transaction = {
      id: txId,
      type: formType,
      category: formCategory,
      amount,
      description: formDesc.trim(),
      date: formDate,
    };

    let next: FinanceData = { ...data, transactions: [...data.transactions, tx] };

    // Optional: make it recurring (monthly)
    if (formRecurring) {
      const day = Number(formDate.split('-')[2]);
      const recId = `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const rec: RecurringTransaction = {
        id: recId,
        type: formType,
        category: formCategory,
        amount,
        description: formDesc.trim(),
        dayOfMonth: Math.min(day, 28),
        active: true,
        startDate: formDate,
        lastApplied: formDate.slice(0, 7),
      };
      // Mark this tx as part of the recurring series so future months don't duplicate it
      next.transactions = next.transactions.map((t) => (t.id === txId ? { ...t, recurringId: recId } : t));
      next.recurring = [...next.recurring, rec];
    }

    persist(next);
    setFormAmount('');
    setFormDesc('');
    setFormRecurring(false);
    setShowForm(false);
  };

  const handleDelete = (id: string) => {
    persist({ ...data, transactions: data.transactions.filter(t => t.id !== id) });
  };

  // ── Recurring management ───────────────────────────────────────────────────
  const toggleRecurring = (recId: string) => {
    persist({
      ...data,
      recurring: data.recurring.map((r) => (r.id === recId ? { ...r, active: !r.active } : r)),
    });
  };

  const deleteRecurring = (recId: string) => {
    if (!window.confirm('Diese wiederkehrende Buchung dauerhaft entfernen? Bereits angelegte Transaktionen bleiben erhalten.')) return;
    persist({
      ...data,
      recurring: data.recurring.filter((r) => r.id !== recId),
    });
  };

  // ── Budget management ──────────────────────────────────────────────────────
  const upsertBudget = (category: string, amount: number) => {
    const existing = data.budgets.find((b) => b.category === category);
    const next: Budget[] = existing
      ? data.budgets.map((b) => (b.category === category ? { ...b, monthlyLimit: amount } : b))
      : [...data.budgets, { category, monthlyLimit: amount }];
    persist({ ...data, budgets: next });
  };

  const removeBudget = (category: string) => {
    persist({ ...data, budgets: data.budgets.filter((b) => b.category !== category) });
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

      {/* ── Header + month nav + actions ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Monats-Finanzplaner</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Überblick über Einnahmen und Ausgaben</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Recurring & Budget shortcuts */}
          <button
            onClick={() => setShowRecurringPanel((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
              showRecurringPanel
                ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
            title="Wiederkehrende Buchungen verwalten"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Wiederkehrend</span>
            {data.recurring.filter(r => r.active).length > 0 && (
              <span className="rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] text-white">
                {data.recurring.filter(r => r.active).length}
              </span>
            )}
          </button>

          <button
            onClick={() => setShowBudgetPanel((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition-colors ${
              showBudgetPanel
                ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
            title="Budgets pro Kategorie"
          >
            <Target className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Budgets</span>
            {overBudget > 0 && (
              <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                {overBudget}
              </span>
            )}
          </button>

          <button
            onClick={() => downloadCSV(data.transactions)}
            disabled={data.transactions.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            title="Alle Buchungen als CSV herunterladen"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>

          <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />

          <button
            onClick={goBack}
            className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <ChevronLeft className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </button>
          <span className="min-w-[9rem] sm:min-w-[11rem] text-center text-sm font-semibold text-slate-700 dark:text-slate-200">
            {monthLabel(year, month)}
          </span>
          <button
            onClick={goForward}
            disabled={isCurrentMonth}
            className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
          >
            <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* ── Summary cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Einnahmen', value: fmt(totalIncome), icon: TrendingUp, color: 'text-teal-700 dark:text-teal-300', bg: 'bg-teal-50 dark:bg-teal-500/10', border: 'border-teal-100 dark:border-teal-500/20' },
          { label: 'Ausgaben', value: fmt(totalExpense), icon: TrendingDown, color: 'text-red-700 dark:text-red-300', bg: 'bg-red-50 dark:bg-red-500/10', border: 'border-red-100 dark:border-red-500/20' },
          { label: 'Bilanz', value: fmt(balance), icon: Wallet, color: balance >= 0 ? 'text-indigo-700 dark:text-indigo-300' : 'text-orange-700 dark:text-orange-300', bg: balance >= 0 ? 'bg-indigo-50 dark:bg-indigo-500/10' : 'bg-orange-50 dark:bg-orange-500/10', border: balance >= 0 ? 'border-indigo-100 dark:border-indigo-500/20' : 'border-orange-100 dark:border-orange-500/20' },
          { label: 'Sparquote', value: `${savingsRate.toFixed(0)}%`, icon: Target, color: savingsRate >= 20 ? 'text-emerald-700 dark:text-emerald-300' : savingsRate > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400', bg: savingsRate >= 20 ? 'bg-emerald-50 dark:bg-emerald-500/10' : savingsRate > 0 ? 'bg-amber-50 dark:bg-amber-500/10' : 'bg-slate-50 dark:bg-slate-800', border: savingsRate >= 20 ? 'border-emerald-100 dark:border-emerald-500/20' : savingsRate > 0 ? 'border-amber-100 dark:border-amber-500/20' : 'border-slate-200 dark:border-slate-700' },
        ].map(({ label, value, icon: Icon, color, bg, border }) => (
          <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
              <Icon className={`h-4 w-4 ${color}`} />
            </div>
            <p className={`mt-2 text-xl sm:text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Budget warnings ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {overBudget > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
            <span>
              <strong>{overBudget}</strong> Budget{overBudget === 1 ? '' : 's'} überschritten:{' '}
              {budgetProgress.filter((b) => b.over).map((b) => b.category).join(', ')}.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Budget panel (collapsible) ──────────────────────────────────────── */}
      <AnimatePresence>
        {showBudgetPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                    <Target className="h-4 w-4 text-amber-600" />
                    Monats-Budgets
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Setze ein monatliches Limit pro Kategorie. Du wirst gewarnt, wenn überschritten.
                  </p>
                </div>
                <button
                  onClick={() => setShowBudgetPanel(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Existing budgets with progress */}
              {budgetProgress.length > 0 && (
                <div className="mb-4 space-y-3">
                  {budgetProgress.map((b) => (
                    <div key={b.category}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CATEGORY_COLORS[b.category] ?? '#94a3b8' }}
                          />
                          <span className="font-medium text-slate-700 dark:text-slate-200">{b.category}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`tabular-nums ${b.over ? 'font-bold text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                            {fmt(b.spent)} / {fmt(b.monthlyLimit)}
                          </span>
                          <button
                            onClick={() => removeBudget(b.category)}
                            className="text-slate-300 transition-colors hover:text-red-500 dark:text-slate-500"
                            title="Budget entfernen"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <motion.div
                          className={`h-full rounded-full ${b.over ? 'bg-red-500' : b.pct > 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, b.pct)}%` }}
                          transition={{ type: 'spring', stiffness: 120, damping: 18 }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add budget form */}
              <BudgetForm
                onAdd={upsertBudget}
                existingCategories={data.budgets.map((b) => b.category)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Recurring panel (collapsible) ────────────────────────────────────── */}
      <AnimatePresence>
        {showRecurringPanel && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                    <Repeat className="h-4 w-4 text-purple-600" />
                    Wiederkehrende Buchungen
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Wird automatisch am jeweiligen Tag jeden Monat angelegt.
                  </p>
                </div>
                <button
                  onClick={() => setShowRecurringPanel(false)}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {data.recurring.length === 0 ? (
                <p className="rounded-lg bg-slate-50 p-4 text-center text-sm text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
                  Noch keine wiederkehrenden Buchungen. Erstelle eine neue Buchung und setze das Häkchen „Monatlich wiederholen".
                </p>
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.recurring.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: r.type === 'income' ? '#0d9488' : (CATEGORY_COLORS[r.category] ?? '#94a3b8') }}
                          />
                          <span className={`truncate text-sm font-medium ${r.active ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 line-through dark:text-slate-500'}`}>
                            {r.description || r.category}
                          </span>
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                            {r.category}
                          </span>
                        </div>
                        <p className="mt-0.5 pl-4 text-xs text-slate-400 dark:text-slate-500">
                          jeden {r.dayOfMonth}. · {fmt(r.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold tabular-nums ${r.type === 'income' ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-300'}`}>
                          {r.type === 'income' ? '+' : '-'}{fmt(r.amount)}
                        </span>
                        <button
                          onClick={() => toggleRecurring(r.id)}
                          className={`rounded p-1 transition-colors ${r.active ? 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700' : 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'}`}
                          title={r.active ? 'Pausieren' : 'Aktivieren'}
                        >
                          {r.active ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                        </button>
                        <button
                          onClick={() => deleteRecurring(r.id)}
                          className="rounded p-1 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500 dark:text-slate-500 dark:hover:bg-red-500/10"
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">Neue Buchung</h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
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
                        ? t === 'expense' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                    }`}
                  >
                    {t === 'expense' ? 'Ausgabe' : 'Einnahme'}
                  </button>
                ))}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Kategorie</span>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-teal-400"
                  >
                    {(formType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Betrag (€)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formAmount}
                    onChange={e => setFormAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-teal-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Beschreibung</span>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-teal-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Datum</span>
                  <input
                    type="date"
                    value={formDate}
                    max={today.toISOString().slice(0, 10)}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:border-teal-400"
                  />
                </label>
              </div>

              <label className="mt-3 flex cursor-pointer items-center gap-2 rounded-lg bg-purple-50 px-3 py-2 ring-1 ring-purple-200 dark:bg-purple-500/10 dark:ring-purple-500/30">
                <input
                  type="checkbox"
                  checked={formRecurring}
                  onChange={(e) => setFormRecurring(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <Repeat className="h-3.5 w-3.5 text-purple-600 dark:text-purple-300" />
                <span className="text-sm font-medium text-purple-900 dark:text-purple-200">
                  Monatlich wiederholen (auto-Buchung)
                </span>
              </label>

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
                  className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
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
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 px-5 py-3 dark:border-slate-700">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Buchungen</h3>
          </div>
          {monthTransactions.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
              Noch keine Buchungen für {monthLabel(year, month)}.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-700">
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
                        <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                          {tx.description || tx.category}
                        </span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                          {tx.category}
                        </span>
                        {tx.recurringId && (
                          <span title="Wiederkehrende Buchung" className="shrink-0">
                            <Repeat className="h-3 w-3 text-purple-400" />
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 pl-4 text-xs text-slate-500 dark:text-slate-400">
                        {new Date(tx.date).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold tabular-nums ${tx.type === 'income' ? 'text-teal-700 dark:text-teal-300' : 'text-red-700 dark:text-red-300'}`}>
                        {tx.type === 'income' ? '+' : '-'}{fmt(tx.amount)}
                      </span>
                      <button
                        onClick={() => handleDelete(tx.id)}
                        className="text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-500 dark:text-slate-500"
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">Ausgaben nach Kategorie</h3>
            {expenseByCategory.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Keine Ausgaben diesen Monat.</p>
            ) : (
              <div className="space-y-3">
                {expenseByCategory.map(([cat, amt]) => {
                  const pct = totalExpense > 0 ? (amt / totalExpense) * 100 : 0;
                  const budget = data.budgets.find((b) => b.category === cat);
                  const overBudgetForCat = budget && amt > budget.monthlyLimit;
                  return (
                    <div key={cat}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{cat}</span>
                        <span className={overBudgetForCat ? 'font-bold text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'}>
                          {fmt(amt)}
                          {budget && (
                            <span className="ml-1 text-[10px] opacity-70">/ {fmt(budget.monthlyLimit)}</span>
                          )}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: overBudgetForCat ? '#ef4444' : (CATEGORY_COLORS[cat] ?? '#94a3b8') }}
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
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">Sparziel</h3>
              <button
                onClick={() => setEditingGoal(v => !v)}
                className="text-xs text-teal-600 hover:underline dark:text-teal-400"
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
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <input
                    type="number"
                    value={goalTarget}
                    onChange={e => setGoalTarget(e.target.value)}
                    placeholder="Zielbetrag (€)"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
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
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{data.savingsGoal.name}</p>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: 'linear-gradient(90deg, #0d9488, #4f46e5)' }}
                      initial={{ width: 0 }}
                      animate={{ width: `${goalPercent}%` }}
                      transition={{ type: 'spring', stiffness: 80, damping: 18 }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{fmt(data.savingsGoal.saved)} gespart</span>
                    <span>{goalPercent}% von {fmt(data.savingsGoal.target)}</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {[50, 100, 200].map(n => (
                      <button
                        key={n}
                        onClick={() => addToSavings(n)}
                        disabled={data.savingsGoal.saved >= data.savingsGoal.target}
                        className="flex-1 rounded-lg bg-teal-50 py-1.5 text-xs font-semibold text-teal-700 transition-colors hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-teal-500/15 dark:text-teal-300 dark:hover:bg-teal-500/25"
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
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h3 className="mb-4 font-semibold text-slate-800 dark:text-slate-100">Verlauf (6 Monate)</h3>
        <div className="flex items-end gap-2" style={{ height: '10rem' }}>
          {chartData.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end gap-0.5" style={{ height: '8rem' }}>
                <motion.div
                  className="flex-1 rounded-t-sm bg-teal-400 dark:bg-teal-500"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.income / chartMax) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 16, delay: i * 0.04 }}
                  title={`Einnahmen: ${fmt(d.income)}`}
                />
                <motion.div
                  className="flex-1 rounded-t-sm bg-red-400 dark:bg-red-500"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.expense / chartMax) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 80, damping: 16, delay: i * 0.04 + 0.02 }}
                  title={`Ausgaben: ${fmt(d.expense)}`}
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">{d.label}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-teal-400" /> Einnahmen</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Ausgaben</span>
        </div>
      </div>

    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

interface BudgetFormProps {
  existingCategories: string[];
  onAdd: (category: string, amount: number) => void;
}

function BudgetForm({ existingCategories, onAdd }: BudgetFormProps) {
  const available = EXPENSE_CATEGORIES.filter((c) => !existingCategories.includes(c));
  const [category, setCategory] = useState(available[0] ?? EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState('');

  // sync category if available list changes
  useEffect(() => {
    if (!available.includes(category)) {
      setCategory(available[0] ?? EXPENSE_CATEGORIES[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingCategories.join('|')]);

  const submit = () => {
    const n = parseFloat(amount.replace(',', '.'));
    if (!n || n <= 0) return;
    onAdd(category, n);
    setAmount('');
  };

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-600">
      <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Neues Budget</p>
      <div className="flex gap-2">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c} disabled={existingCategories.includes(c)}>
              {c} {existingCategories.includes(c) ? '· gesetzt' : ''}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          step="1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Limit €"
          className="w-28 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        <button
          onClick={submit}
          disabled={!amount}
          className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-600 disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}
