import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Clock3,
  Download,
  FileUp,
  Filter,
  GitBranch,
  GraduationCap,
  HelpCircle,
  ListChecks,
  MoreHorizontal,
  Network,
  Newspaper,
  PenLine,
  Plus,
  RotateCcw,
  Search,
  Star,
  Target,
  TextCursorInput,
  Upload
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Flashcard, type FlashcardData } from './components/Flashcard';
import FinancePlanner from './components/FinancePlanner';
import { LegalModal } from './components/LegalModal';
import { Logo } from './components/Logo';
import Stats from './components/Stats';
import StudyPlan from './components/StudyPlan';
import CardCreator from './components/CardCreator';
import ExamSimulator, { type ExamHistoryEntry } from './components/ExamSimulator';
import cardsData from './data/psychologie_alle_karten.json';
import {
  calculateNextReview,
  createInitialProgress,
  type Rating,
  type UserProgress
} from './learning';
import {
  createClozeTask,
  getMatchingCards,
  getMultipleChoiceOptions,
  isCloseAnswer,
  type QuizMode
} from './quiz';
import { findStudyChapter, type StudyContent } from './studyContent';
import { createPosterSummary, getKeyTerms } from './studyVisuals';

type CardTypeFilter = FlashcardData['card_type'] | 'all';
type StudyMode = 'all' | 'due' | 'weak' | 'unseen';
type ViewMode = 'cards' | 'mindmap' | 'timeline' | 'quiz' | 'poster' | 'stats' | 'plan';
type SourceFilter = 'all' | 'starter' | 'script';

interface ChapterStat {
  key: string;
  title: string;
  total: number;
  learned: number;
  weak: number;
  due: number;
}

type DashboardItem = {
  label: string;
  value: number;
  icon: LucideIcon;
  mode?: StudyMode;
};

type ViewItem = {
  key: ViewMode;
  label: string;
  icon: LucideIcon;
};

const STORAGE_KEY = 'psychologisch-progress-v1';
const IMPORTED_CARDS_KEY = 'psychologisch-imported-cards-v1';
const STREAK_KEY = 'psychologisch-streak-v1';
const BOOKMARKS_KEY = 'psychologisch-bookmarks-v1';
const GOAL_KEY = 'psychologisch-goal-v1';
const NOTES_KEY = 'psychologisch-notes-v1';
const EXAM_HISTORY_KEY = 'psychologisch-exam-history-v1';

const loadExamHistory = (): ExamHistoryEntry[] => {
  try {
    const saved = window.localStorage.getItem(EXAM_HISTORY_KEY);
    return saved ? (JSON.parse(saved) as ExamHistoryEntry[]) : [];
  } catch { return []; }
};

const loadBookmarks = (): Set<string> => {
  try {
    const saved = window.localStorage.getItem(BOOKMARKS_KEY);
    return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
  } catch { return new Set(); }
};

const loadNotes = (): Record<string, string> => {
  try {
    const saved = window.localStorage.getItem(NOTES_KEY);
    return saved ? (JSON.parse(saved) as Record<string, string>) : {};
  } catch { return {}; }
};

const loadGoal = (): number => {
  try {
    const saved = window.localStorage.getItem(GOAL_KEY);
    const n = saved ? Number(saved) : 10;
    return Number.isFinite(n) && n > 0 ? n : 10;
  } catch { return 10; }
};
const TODAY = new Date().toISOString().slice(0, 10);

interface StreakData {
  date: string;
  todayCount: number;
  days: number;
  history?: Record<string, number>; // YYYY-MM-DD → cards reviewed
}

const pruneHistory = (h: Record<string, number>): Record<string, number> => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return Object.fromEntries(Object.entries(h).filter(([k]) => k >= cutoffStr));
};

const loadStreak = (): StreakData => {
  try {
    const saved = window.localStorage.getItem(STREAK_KEY);
    if (!saved) return { date: TODAY, todayCount: 0, days: 0, history: {} };
    const data = JSON.parse(saved) as StreakData;
    if (data.date === TODAY) return { history: {}, ...data };
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = data.date === yesterday.toISOString().slice(0, 10);
    return { date: TODAY, todayCount: 0, days: isYesterday ? data.days : 0, history: data.history ?? {} };
  } catch {
    return { date: TODAY, todayCount: 0, days: 0, history: {} };
  }
};

const cardTypeLabels: Record<CardTypeFilter, string> = {
  all: 'Alle Typen',
  definition: 'Definition',
  concept: 'Konzept',
  person: 'Person',
  formula: 'Formel',
  image: 'Bild',
  list: 'Liste',
  comparison: 'Vergleich'
};

const studyModeLabels: Record<StudyMode, string> = {
  all: 'Alle Karten',
  due: 'Heute fällig',
  weak: 'Schwächen',
  unseen: 'Neu'
};

const sourceLabels: Record<SourceFilter, string> = {
  all: 'Alle Quellen',
  starter: 'Starterkarten',
  script: 'Skriptkarten'
};

const quizModeLabels: Record<QuizMode, string> = {
  multipleChoice: 'Multiple Choice',
  cloze: 'Lückentext',
  matching: 'Matching',
  exam: 'Prüfungsfragen'
};

const loadProgress = (): Record<string, UserProgress> => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const loadImportedCards = (): FlashcardData[] => {
  try {
    const saved = window.localStorage.getItem(IMPORTED_CARDS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const normalize = (value: string) => value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const getChapterRoot = (card: FlashcardData) => String(card.chapter_id).split('.')[0];

const isDue = (progress: UserProgress | undefined) =>
  Boolean(progress && new Date(progress.next_review).getTime() <= Date.now());

const isWeak = (progress: UserProgress | undefined) =>
  Boolean(progress && (progress.last_rating === 'again' || progress.last_rating === 'hard' || (progress.lapses ?? 0) > 0));

const getSource = (card: FlashcardData): Exclude<SourceFilter, 'all'> =>
  card.source?.includes('psyskript') || card.id.startsWith('psyskript-') ? 'script' : 'starter';

const getTimelineYear = (card: FlashcardData) => {
  const match = `${card.front} ${card.back}`.match(/\b(1[5-9]\d{2}|20[0-2]\d)\b/);
  return match ? Number(match[1]) : null;
};

export default function App() {
  const baseCards = useMemo(() => cardsData as FlashcardData[], []);
  const [importedCards, setImportedCards] = useState<FlashcardData[]>(loadImportedCards);
  const cards = useMemo(() => [...baseCards, ...importedCards], [baseCards, importedCards]);
  const [chapterFilter, setChapterFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<CardTypeFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [studyMode, setStudyMode] = useState<StudyMode>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [searchQuery, setSearchQuery] = useState('');
  const [examOnly, setExamOnly] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState<Record<string, UserProgress>>(loadProgress);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [quizMode, setQuizMode] = useState<QuizMode>('multipleChoice');
  const [clozeAnswer, setClozeAnswer] = useState('');
  const [selectedMatchPrompt, setSelectedMatchPrompt] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [studyContent, setStudyContent] = useState<StudyContent | null>(null);
  const [showImpressum, setShowImpressum] = useState(false);
  const [showDatenschutz, setShowDatenschutz] = useState(false);
  const [flipTrigger, setFlipTrigger] = useState(0);
  const [wrongMatch, setWrongMatch] = useState<{ prompt: string; answer: string } | null>(null);
  const [cardDirection, setCardDirection] = useState(0);
  const [streak, setStreak] = useState<StreakData>(loadStreak);
  const importProgressRef = useRef<HTMLInputElement>(null);
  const [appModule, setAppModule] = useState<'lernen' | 'finanzen'>('lernen');
  const [showFilters, setShowFilters] = useState(false);
  const [sessionRatings, setSessionRatings] = useState<Record<Rating, number>>({ again: 0, hard: 0, good: 0, easy: 0 });
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const [bookmarks, setBookmarks] = useState<Set<string>>(loadBookmarks);
  const [bookmarkOnly, setBookmarkOnly] = useState(false);
  const [dailyGoal, setDailyGoal] = useState<number>(loadGoal);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [showCardCreator, setShowCardCreator] = useState(false);
  const [showActionsMenu, setShowActionsMenu] = useState(false);
  const [showExamSimulator, setShowExamSimulator] = useState(false);
  const [examHistory, setExamHistory] = useState<ExamHistoryEntry[]>(loadExamHistory);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });
  const [notes, setNotes] = useState<Record<string, string>>(loadNotes);
  const [showNote, setShowNote] = useState(false);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    window.localStorage.setItem(IMPORTED_CARDS_KEY, JSON.stringify(importedCards));
  }, [importedCards]);

  useEffect(() => {
    window.localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    setQuizScore({ correct: 0, total: 0 });
  }, [viewMode, quizMode]);

  useEffect(() => {
    fetch('/psyskript_cards.json')
      .then((response) => (response.ok ? response.json() : []))
      .then((cardsFromFile: FlashcardData[]) => {
        if (!Array.isArray(cardsFromFile) || cardsFromFile.length === 0) {
          return;
        }
        setImportedCards((current) => {
          const existingIds = new Set(current.map((card) => card.id));
          const freshCards = cardsFromFile.filter((card) => card.id && !existingIds.has(card.id));
          return freshCards.length === 0 ? current : [...current, ...freshCards];
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    fetch('/study_content.json')
      .then((response) => (response.ok ? response.json() : null))
      .then((content: StudyContent | null) => {
        if (content?.chapters?.length) {
          setStudyContent(content);
        }
      })
      .catch(() => undefined);
  }, []);

  const chapters = useMemo(() => {
    const grouped = new Map<string, string>();
    cards.forEach((card) => {
      const root = getChapterRoot(card);
      if (!grouped.has(root)) {
        grouped.set(root, `Kapitel ${root}`);
      }
    });
    return Array.from(grouped.entries()).sort((a, b) => Number(a[0]) - Number(b[0]));
  }, [cards]);

  const cardTypes = useMemo(
    () => Array.from(new Set(cards.map((card) => card.card_type))) as FlashcardData['card_type'][],
    [cards]
  );

  const filteredCards = useMemo(() => {
    const query = normalize(searchQuery.trim());
    return cards.filter((card) => {
      const source = getSource(card);
      const cardProgress = progress[card.id];
      const searchable = normalize(`${card.chapter_id} ${card.chapter_title} ${card.front} ${card.back} ${card.tags.join(' ')}`);
      return (
        (chapterFilter === 'all' || getChapterRoot(card) === chapterFilter) &&
        (typeFilter === 'all' || card.card_type === typeFilter) &&
        (sourceFilter === 'all' || source === sourceFilter) &&
        (!examOnly || card.exam_relevant) &&
        (!query || searchable.includes(query)) &&
        (studyMode === 'all' ||
          (studyMode === 'due' && isDue(cardProgress)) ||
          (studyMode === 'weak' && isWeak(cardProgress)) ||
          (studyMode === 'unseen' && !cardProgress)) &&
        (!bookmarkOnly || bookmarks.has(card.id))
      );
    });
  }, [bookmarkOnly, bookmarks, cards, chapterFilter, examOnly, progress, searchQuery, sourceFilter, studyMode, typeFilter]);

  useEffect(() => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setClozeAnswer('');
    setSelectedMatchPrompt(null);
    setMatchedIds([]);
    setShowNote(false);
  }, [chapterFilter, examOnly, searchQuery, sourceFilter, studyMode, typeFilter, viewMode]);

  const chapterStats = useMemo(() => {
    const stats = new Map<string, ChapterStat>();
    cards.forEach((card) => {
      const key = getChapterRoot(card);
      const existing = stats.get(key) ?? {
        key,
        title: `Kapitel ${key}`,
        total: 0,
        learned: 0,
        weak: 0,
        due: 0
      };
      const cardProgress = progress[card.id];
      existing.total += 1;
      existing.learned += cardProgress ? 1 : 0;
      existing.weak += isWeak(cardProgress) ? 1 : 0;
      existing.due += isDue(cardProgress) ? 1 : 0;
      stats.set(key, existing);
    });
    return Array.from(stats.values()).sort((a, b) => Number(a.key) - Number(b.key));
  }, [cards, progress]);

  const timelineCards = useMemo(
    () =>
      filteredCards
        .map((card) => ({ card, year: getTimelineYear(card) }))
        .filter((item): item is { card: FlashcardData; year: number } => item.year !== null)
        .sort((a, b) => a.year - b.year)
        .slice(0, 40),
    [filteredCards]
  );
  const keyTerms = useMemo(() => getKeyTerms(filteredCards, 16), [filteredCards]);

  useEffect(() => {
    if (viewMode !== 'cards') return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') {
        e.preventDefault();
        setFlipTrigger((t) => t + 1);
      } else if (e.code === 'ArrowRight') {
        goToNextCard();
      } else if (e.code === 'ArrowLeft') {
        goToPreviousCard();
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const cardId = filteredCards[currentIndex]?.id;
        if (!cardId) return;
        const ratings: Rating[] = ['again', 'hard', 'good', 'easy'];
        handleRate(cardId, ratings[Number(e.key) - 1]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, filteredCards, currentIndex]);
  const posterSummary = useMemo(
    () => createPosterSummary(filteredCards, progress),
    [filteredCards, progress]
  );
  const selectedStudyChapter = useMemo(
    () => (chapterFilter === 'all' ? null : findStudyChapter(studyContent, chapterFilter)),
    [chapterFilter, studyContent]
  );
  const visualKeyTerms = selectedStudyChapter?.keyTerms ?? keyTerms;
  const examQuizQuestions = useMemo(
    () =>
      selectedStudyChapter?.examQuestions.filter(
        (question) =>
          (question.type === 'multipleChoice' && question.options?.length && question.correctAnswer) ||
          (question.type === 'trueFalse' && question.correctAnswer) ||
          (question.type === 'matching' && question.pairs?.length)
      ) ?? [],
    [selectedStudyChapter]
  );
  const currentExamQuestion =
    examQuizQuestions.length > 0 ? examQuizQuestions[currentIndex % examQuizQuestions.length] : null;

  const learnedCount = Object.keys(progress).length;
  const dueCount = cards.filter((card) => isDue(progress[card.id])).length;
  const weakCount = cards.filter((card) => isWeak(progress[card.id])).length;
  const unseenCount = cards.length - learnedCount;
  const currentCard = filteredCards[currentIndex];
  const activeFilterCount = [
    chapterFilter !== 'all',
    typeFilter !== 'all',
    sourceFilter !== 'all',
    studyMode !== 'all',
    examOnly,
    bookmarkOnly,
    searchQuery.trim() !== '',
  ].filter(Boolean).length;
  const dashboardItems: DashboardItem[] = [
    { label: 'Karten', value: cards.length, icon: Brain },
    { label: 'Bewertet', value: learnedCount, icon: BarChart3 },
    { label: 'Heute fällig', value: dueCount, icon: CalendarDays, mode: 'due' },
    { label: 'Schwächen', value: weakCount, icon: Target, mode: 'weak' },
    { label: 'Neu', value: unseenCount, icon: Clock3, mode: 'unseen' }
  ];
  const viewItems: ViewItem[] = [
    { key: 'plan', label: 'Lernplan', icon: CalendarDays },
    { key: 'cards', label: 'Karten', icon: BookOpen },
    { key: 'mindmap', label: 'Mindmap', icon: Network },
    { key: 'poster', label: 'Lernposter', icon: Newspaper },
    { key: 'timeline', label: 'Timeline', icon: Clock3 },
    { key: 'quiz', label: 'Quiz', icon: HelpCircle },
    { key: 'stats', label: 'Statistik', icon: BarChart3 },
  ];

  const quizOptions = useMemo(() => (currentCard ? getMultipleChoiceOptions(currentCard, cards) : []), [cards, currentCard]);
  const clozeTask = useMemo(() => (currentCard ? createClozeTask(currentCard) : null), [currentCard]);
  const matchingCards = useMemo(() => (currentCard ? getMatchingCards(currentCard, cards) : []), [cards, currentCard]);
  const matchingAnswers = useMemo(() => [...matchingCards].sort((a, b) => b.id.localeCompare(a.id)), [matchingCards]);

  const goToNextCard = () => {
    setCardDirection(1);
    setSelectedAnswer(null);
    setClozeAnswer('');
    setSelectedMatchPrompt(null);
    setMatchedIds([]);
    setWrongMatch(null);
    setCurrentIndex((previous) => (filteredCards.length === 0 ? 0 : (previous + 1) % filteredCards.length));
  };

  const goToPreviousCard = () => {
    setCardDirection(-1);
    setSelectedAnswer(null);
    setClozeAnswer('');
    setSelectedMatchPrompt(null);
    setMatchedIds([]);
    setWrongMatch(null);
    setCurrentIndex((previous) =>
      filteredCards.length === 0 ? 0 : (previous - 1 + filteredCards.length) % filteredCards.length
    );
  };

  const handleRate = (cardId: string, rating: Rating) => {
    const current = progress[cardId] ?? createInitialProgress(cardId);
    const newProgress = { ...progress, [cardId]: calculateNextReview(rating, current) };
    setProgress(newProgress);

    const newSessionRatings = { ...sessionRatings, [rating]: sessionRatings[rating] + 1 };
    setSessionRatings(newSessionRatings);

    const newHistory = pruneHistory({ ...(streak.history ?? {}), [TODAY]: (streak.history?.[TODAY] ?? 0) + 1 });
    const newStreak: StreakData = {
      date: TODAY,
      todayCount: streak.todayCount + 1,
      days: streak.todayCount === 0 ? streak.days + 1 : streak.days,
      history: newHistory,
    };
    setStreak(newStreak);
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));

    const wasLastDue =
      studyMode === 'due' &&
      cards.filter((c) => isDue(newProgress[c.id])).length === 0;
    if (wasLastDue) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#0d9488', '#14b8a6', '#6366f1', '#f59e0b', '#ec4899'] });
      setShowSessionSummary(true);
    }

    goToNextCard();
  };

  const resetProgress = () => {
    setProgress({});
  };

  const toggleBookmark = (cardId: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(cardId) ? next.delete(cardId) : next.add(cardId);
      window.localStorage.setItem(BOOKMARKS_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const saveGoal = (val: string) => {
    const n = parseInt(val, 10);
    if (Number.isFinite(n) && n > 0) {
      setDailyGoal(n);
      window.localStorage.setItem(GOAL_KEY, String(n));
    }
    setEditingGoal(false);
  };

  const exportProgress = () => {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psychologisch-fortschritt-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importProgressFromFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        setProgress(parsed as Record<string, UserProgress>);
      }
    } catch {
      // ungültiges JSON — ignorieren
    }
  };

  const importCardsFromFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }
    const parsed = JSON.parse(await file.text()) as FlashcardData[];
    if (!Array.isArray(parsed)) {
      return;
    }
    setImportedCards((current) => {
      const existingIds = new Set([...baseCards, ...current].map((card) => card.id));
      const freshCards = parsed.filter((card) => card.id && card.front && card.back && !existingIds.has(card.id));
      return freshCards.length === 0 ? current : [...current, ...freshCards];
    });
  };

  return (
    <>
    {/* ══ Sticky top navigation ══════════════════════════════════════════ */}
    <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto max-w-6xl px-4">

        {/* Primary row ─────────────────────────────────────────────────── */}
        <div className="flex h-14 items-center gap-2">
          <Logo size="sm" />

          {/* Module tabs (desktop) */}
          <div className="ml-2 hidden sm:flex">
            {([
              { key: 'lernen',   emoji: '🎓', label: 'Lernen'   },
              { key: 'finanzen', emoji: '💰', label: 'Finanzen' },
            ] as const).map(({ key, emoji, label }) => (
              <button
                key={key}
                onClick={() => setAppModule(key)}
                className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  appModule === key ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {appModule === key && (
                  <motion.div
                    layoutId="nav-active-module"
                    className="absolute inset-0 -z-10 rounded-lg bg-slate-100"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span>{emoji}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {/* ── Right-side tools (lernen mode) ─────────────────────────── */}
          {appModule === 'lernen' && (
            <>
              {/* Streak pill */}
              <AnimatePresence>
                {streak.todayCount > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="hidden items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700 sm:inline-flex"
                  >
                    🔥 {streak.todayCount}
                    {streak.days > 1 && <span className="opacity-70">· {streak.days}d</span>}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Daily goal ring */}
              <button
                onClick={() => { setGoalInput(String(dailyGoal)); setEditingGoal(true); }}
                title="Tagesziel anpassen"
                className="flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 ring-1 ring-slate-200 transition-all hover:ring-teal-400"
              >
                {(() => {
                  const r = 11;
                  const circ = 2 * Math.PI * r;
                  const pct = Math.min(1, streak.todayCount / dailyGoal);
                  return (
                    <svg width="28" height="28" viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
                      <motion.circle
                        cx="14" cy="14" r={r} fill="none"
                        stroke={pct >= 1 ? '#10b981' : '#0d9488'} strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeDasharray={`${pct * circ} ${circ}`}
                        transform="rotate(-90 14 14)"
                        animate={{ strokeDasharray: `${pct * circ} ${circ}` }}
                        transition={{ type: 'spring', stiffness: 80, damping: 16 }}
                      />
                      <text x="14" y="18" textAnchor="middle" fontSize="7" fill="#0f172a" fontWeight="700">
                        {pct >= 1 ? '✓' : `${streak.todayCount}`}
                      </text>
                    </svg>
                  );
                })()}
                <span className="hidden text-xs font-medium text-slate-600 sm:inline">/ {dailyGoal}</span>
              </button>

              {/* Exam simulator */}
              <button
                onClick={() => setShowExamSimulator(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-sm font-semibold text-indigo-700 shadow-sm transition-colors hover:bg-indigo-100"
                title="Klausur-Simulator starten"
              >
                <GraduationCap className="h-4 w-4" />
                <span className="hidden md:inline">Klausur</span>
              </button>

              {/* Create card */}
              <button
                onClick={() => setShowCardCreator(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-teal-700"
                title="Eigene Karte erstellen"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Neue Karte</span>
              </button>
            </>
          )}

          {/* Actions overflow ⋮ */}
          {appModule === 'lernen' && (
            <div className="relative">
              <button
                onClick={() => setShowActionsMenu(m => !m)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg border text-slate-600 transition-colors ${
                  showActionsMenu ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white shadow-sm hover:bg-slate-50'
                }`}
                title="Weitere Aktionen"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              <AnimatePresence>
                {showActionsMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowActionsMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl"
                    >
                      <button
                        onClick={() => { exportProgress(); setShowActionsMenu(false); }}
                        disabled={learnedCount === 0}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <Download className="h-4 w-4 text-slate-400" />
                        Fortschritt exportieren
                      </button>
                      <button
                        onClick={() => { importProgressRef.current?.click(); setShowActionsMenu(false); }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Upload className="h-4 w-4 text-slate-400" />
                        Fortschritt importieren
                      </button>
                      <div className="my-1 h-px bg-slate-100" />
                      <button
                        onClick={() => { resetProgress(); setShowActionsMenu(false); }}
                        disabled={learnedCount === 0}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Zurücksetzen
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
              <input
                ref={importProgressRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) => importProgressFromFile(e.target.files?.[0])}
              />
            </div>
          )}
        </div>

        {/* View-mode tab row (lernen only) ─────────────────────────────── */}
        {appModule === 'lernen' && (
          <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {viewItems.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setViewMode(key)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  viewMode === key
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {viewMode === key && (
                  <motion.div
                    layoutId="nav-view-indicator"
                    className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-teal-600"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>

    <main className="min-h-screen bg-slate-50 pb-24 pt-4 text-slate-900 sm:pb-8 sm:pt-6">
      <div className="mx-auto max-w-6xl px-4">
        {appModule === 'finanzen' && <FinancePlanner />}

        {appModule === 'lernen' && <>
        <section className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {dashboardItems.map(({ label, value, icon: Icon, mode }) => (
            <button
              key={label}
              onClick={() => {
                if (mode) setStudyMode(mode);
              }}
              className="rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-200 hover:bg-teal-50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase text-slate-400">{label}</p>
                <Icon className="h-4 w-4 text-teal-600" />
              </div>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
            </button>
          ))}
        </section>

        <section className="mb-6 flex flex-col gap-3 rounded-lg border border-teal-100 bg-teal-50 p-4 text-sm text-teal-900 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">Skript-Lernkarten</p>
            <p className="mt-1 text-teal-700">
              {importedCards.length > 0
                ? `${importedCards.length} zusätzliche Karten aus deinem Skript geladen.`
                : 'Die Karten aus dem Skript werden automatisch geladen, sobald die Datei verfügbar ist.'}
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 font-medium text-teal-700 shadow-sm ring-1 ring-teal-100 transition-colors hover:bg-teal-100">
            <FileUp className="h-4 w-4" />
            Karten importieren
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                void importCardsFromFile(event.target.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </label>
        </section>

        <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          {/* Mobile toggle */}
          <button
            onClick={() => setShowFilters(f => !f)}
            className="mb-3 flex w-full items-center justify-between sm:hidden"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Filter className="h-4 w-4 text-teal-600" />
              Filter &amp; Lernmodus
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-teal-600 px-2 py-0.5 text-xs font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </span>
            <span className="text-xs text-teal-600">{showFilters ? 'Einklappen ▲' : 'Anzeigen ▼'}</span>
          </button>

          <div className={showFilters ? '' : 'hidden sm:block'}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_9rem_9rem_10rem]">
            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                <Search className="h-4 w-4" />
                Suche
              </span>
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Begriff, Seite, Tag oder Definition suchen"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal-500"
              />
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                <BookOpen className="h-4 w-4" />
                Kapitel
              </span>
              <select
                value={chapterFilter}
                onChange={(event) => setChapterFilter(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal-500"
              >
                <option value="all">Alle</option>
                {chapters.map(([key, title]) => (
                  <option key={key} value={key}>
                    {title}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                <Filter className="h-4 w-4" />
                Typ
              </span>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as CardTypeFilter)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal-500"
              >
                <option value="all">{cardTypeLabels.all}</option>
                {cardTypes.map((type) => (
                  <option key={type} value={type}>
                    {cardTypeLabels[type]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
                <GitBranch className="h-4 w-4" />
                Quelle
              </span>
              <select
                value={sourceFilter}
                onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-teal-500"
              >
                {Object.entries(sourceLabels).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {Object.entries(studyModeLabels).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setStudyMode(key as StudyMode)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  studyMode === key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
            <button
              onClick={() => setBookmarkOnly(b => !b)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                bookmarkOnly ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${bookmarkOnly ? 'fill-white' : ''}`} />
              Lesezeichen
              {bookmarks.size > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${bookmarkOnly ? 'bg-white/30 text-white' : 'bg-amber-100 text-amber-700'}`}>
                  {bookmarks.size}
                </span>
              )}
            </button>
            <label className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                checked={examOnly}
                onChange={(event) => setExamOnly(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <span className="text-xs sm:text-sm">Nur prüfungsrelevant</span>
            </label>
          </div>
          </div>{/* end collapsible */}
        </section>

        <AnimatePresence mode="wait">
        <motion.div
          key={viewMode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >

        {viewMode === 'mindmap' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Kapitel-Mindmap</h2>
                <p className="text-sm text-slate-500">Kapitel und Begriffe anklicken, um gezielt darin weiterzulernen.</p>
              </div>
              <Network className="h-5 w-5 text-teal-600" />
            </div>
            <div className="mb-5 rounded-lg border border-teal-100 bg-teal-50 p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="rounded-full bg-teal-600 px-5 py-3 text-center font-semibold text-white shadow-sm">
                  PsychoLogisch
                </div>
                <div className="flex flex-wrap gap-2">
                  {visualKeyTerms.length > 0 ? (
                    visualKeyTerms.map((term) => (
                      <button
                        key={term.term}
                        onClick={() => {
                          setSearchQuery(term.term);
                          setViewMode('cards');
                        }}
                        className="rounded-full border border-teal-200 bg-white px-3 py-2 text-sm font-medium text-teal-800 shadow-sm hover:bg-teal-100"
                      >
                        {term.term}
                        <span className="ml-2 text-xs text-teal-500">{term.count}</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-teal-700">Für diese Filterauswahl wurden noch keine starken Begriffe gefunden.</p>
                  )}
                </div>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {chapterStats.map((chapter) => {
                const learnedPercent = Math.round((chapter.learned / chapter.total) * 100);
                return (
                  <button
                    key={chapter.key}
                    onClick={() => {
                      setChapterFilter(chapter.key);
                      setViewMode('cards');
                    }}
                    className="rounded-lg border border-slate-200 p-4 text-left transition-colors hover:border-teal-200 hover:bg-teal-50"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-slate-800">{chapter.title}</p>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">{chapter.total}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-500" style={{ width: `${learnedPercent}%` }} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-slate-500">
                      <span>{learnedPercent}%</span>
                      <span>{chapter.due} fällig</span>
                      <span>{chapter.weak} schwer</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {viewMode === 'poster' && (
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Lernposter</h2>
                <p className="text-sm text-slate-500">
                  {selectedStudyChapter
                    ? `${selectedStudyChapter.title}: ${selectedStudyChapter.summary}`
                    : 'Kompakte Übersicht zur aktuellen Filterauswahl.'}
                </p>
              </div>
              <Newspaper className="h-5 w-5 text-teal-600" />
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {[
                ['Karten', posterSummary.total],
                ['Gelernt', posterSummary.learned],
                ['Definitionen', posterSummary.definitions],
                ['Personen', posterSummary.people],
                ['Formeln', posterSummary.formulas]
              ].map(([label, value]) => (
                <div key={label as string} className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs font-medium uppercase text-slate-400">{label as string}</p>
                  <p className="mt-1 text-xl font-semibold text-slate-900">{value as number}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[18rem_1fr]">
              <div>
                <h3 className="mb-2 font-semibold text-slate-800">Schlüsselbegriffe</h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedStudyChapter?.keyTerms ?? posterSummary.keyTerms).length > 0 ? (
                    (selectedStudyChapter?.keyTerms ?? posterSummary.keyTerms).map((term) => (
                      <button
                        key={term.term}
                        onClick={() => {
                          setSearchQuery(term.term);
                          setViewMode('cards');
                        }}
                        className="rounded-full bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100"
                      >
                        {term.term}
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">Noch keine Schlüsselbegriffe für diese Auswahl.</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-slate-800">Kernaussagen</h3>
                <div className="grid gap-3">
                  {(selectedStudyChapter?.highlights ?? posterSummary.highlights).length > 0 ? (
                    (selectedStudyChapter?.highlights ?? posterSummary.highlights).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          const nextIndex = filteredCards.findIndex((card) => card.id === item.id);
                          setCurrentIndex(Math.max(0, nextIndex));
                          setViewMode('cards');
                        }}
                        className="rounded-lg border border-slate-200 p-3 text-left hover:border-teal-200 hover:bg-teal-50"
                      >
                        <span className="block text-sm font-semibold text-slate-800">
                          {'front' in item ? item.front : item.prompt}
                        </span>
                        <span className="mt-1 line-clamp-2 block text-sm text-slate-500">
                          {'back' in item ? item.back : item.answer}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Keine Kernaussagen für diese Auswahl.</p>
                  )}
                </div>
              </div>
            </div>
            {selectedStudyChapter && (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ['Definitionen', selectedStudyChapter.definitions.length],
                  ['Theorien/Modelle', selectedStudyChapter.theories.length],
                  ['Prüfungsfragen', selectedStudyChapter.examQuestions.length]
                ].map(([label, value]) => (
                  <div key={label as string} className="rounded-lg border border-slate-200 p-3">
                    <p className="text-xs font-medium uppercase text-slate-400">{label as string}</p>
                    <p className="mt-1 text-xl font-semibold text-slate-900">{value as number}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {viewMode === 'timeline' && (
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Historische Timeline</h2>
                <p className="text-sm text-slate-500">Automatisch aus Jahreszahlen in den aktuellen Karten extrahiert.</p>
              </div>
              <Clock3 className="h-5 w-5 text-teal-600" />
            </div>
            <div className="space-y-3">
              {timelineCards.length > 0 ? (
                timelineCards.map(({ card, year }) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      const nextIndex = filteredCards.findIndex((item) => item.id === card.id);
                      setCurrentIndex(Math.max(0, nextIndex));
                      setViewMode('cards');
                    }}
                    className="grid w-full gap-2 rounded-lg border border-slate-200 p-3 text-left transition-colors hover:border-teal-200 hover:bg-teal-50 sm:grid-cols-[5rem_1fr]"
                  >
                    <span className="font-semibold text-teal-700">{year}</span>
                    <span>
                      <span className="block font-medium text-slate-800">{card.chapter_title}</span>
                      <span className="mt-1 block text-sm text-slate-500">{card.front}</span>
                    </span>
                  </button>
                ))
              ) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Für diese Filterauswahl wurden keine Jahreszahlen gefunden.</p>
              )}
            </div>
          </section>
        )}

        {viewMode === 'quiz' && currentCard && (
          <section className="mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Interaktives Quiz</h2>
                <p className="text-sm text-slate-500">Trainiere dieselbe Karte mit verschiedenen Aufgabenformen.</p>
              </div>
              <div className="flex items-center gap-3">
                <AnimatePresence>
                  {quizScore.total > 0 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-sm font-semibold ring-1 ring-slate-200"
                    >
                      <span className="text-emerald-600">{quizScore.correct}✓</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-red-500">{quizScore.total - quizScore.correct}✗</span>
                      <span className="ml-1 text-xs font-normal text-slate-400">
                        {Math.round((quizScore.correct / quizScore.total) * 100)}%
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
                <HelpCircle className="h-5 w-5 text-teal-600" />
              </div>
            </div>

            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(quizModeLabels).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => {
                    setQuizMode(key as QuizMode);
                    setSelectedAnswer(null);
                    setClozeAnswer('');
                    setSelectedMatchPrompt(null);
                    setMatchedIds([]);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    quizMode === key ? 'bg-teal-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {key === 'multipleChoice' && <HelpCircle className="h-4 w-4" />}
                  {key === 'cloze' && <TextCursorInput className="h-4 w-4" />}
                  {key === 'matching' && <ListChecks className="h-4 w-4" />}
                  {key === 'exam' && <Target className="h-4 w-4" />}
                  {label}
                </button>
              ))}
            </div>

            {quizMode === 'multipleChoice' && (
              <>
                <p className="rounded-lg bg-slate-50 p-4 font-medium text-slate-800">{currentCard.front}</p>
                <div className="mt-4 grid gap-3">
                  {quizOptions.map((option) => {
                    const isSelected = selectedAnswer === option.id;
                    const isCorrect = option.id === currentCard.id;
                    return (
                      <button
                        key={option.id}
                        onClick={() => setSelectedAnswer(option.id)}
                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                          !selectedAnswer
                            ? 'border-slate-200 hover:border-teal-200 hover:bg-teal-50'
                            : isCorrect
                              ? 'border-green-200 bg-green-50 text-green-800'
                              : isSelected
                                ? 'border-red-200 bg-red-50 text-red-800'
                                : 'border-slate-200 bg-slate-50 text-slate-500'
                        }`}
                      >
                        {option.back}
                      </button>
                    );
                  })}
                </div>
                {selectedAnswer && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const isCorrect = selectedAnswer === currentCard.id;
                        setQuizScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
                        handleRate(currentCard.id, isCorrect ? 'good' : 'again');
                      }}
                      className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      Bewerten und weiter
                    </button>
                    <button
                      onClick={goToNextCard}
                      className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Nur weiter
                    </button>
                  </div>
                )}
              </>
            )}

            {quizMode === 'cloze' && clozeTask && (
              <div>
                <p className="rounded-lg bg-slate-50 p-4 leading-relaxed text-slate-800">{clozeTask.prompt}</p>
                <label className="mt-4 block">
                  <span className="mb-1 block text-sm font-medium text-slate-600">Fehlender Begriff</span>
                  <input
                    value={clozeAnswer}
                    onChange={(event) => setClozeAnswer(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500"
                    placeholder="Antwort eingeben"
                  />
                </label>
                {clozeAnswer && (
                  <div
                    className={`mt-3 rounded-lg p-3 text-sm ${
                      isCloseAnswer(clozeAnswer, clozeTask.answer)
                        ? 'bg-green-50 text-green-800'
                        : 'bg-amber-50 text-amber-800'
                    }`}
                  >
                    Lösung: <span className="font-semibold">{clozeTask.answer}</span>
                  </div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      const isCorrect = isCloseAnswer(clozeAnswer, clozeTask.answer);
                      setQuizScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
                      handleRate(currentCard.id, isCorrect ? 'good' : 'again');
                    }}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Bewerten und weiter
                  </button>
                </div>
              </div>
            )}

            {quizMode === 'matching' && (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600">Begriffe</p>
                  <div className="grid gap-2">
                    {matchingCards.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => !matchedIds.includes(card.id) && setSelectedMatchPrompt(card.id)}
                        disabled={matchedIds.includes(card.id)}
                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                          matchedIds.includes(card.id)
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : wrongMatch?.prompt === card.id
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : selectedMatchPrompt === card.id
                                ? 'border-teal-300 bg-teal-50 text-teal-800'
                                : 'border-slate-200 hover:border-teal-200 hover:bg-teal-50'
                        }`}
                      >
                        {card.front}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium text-slate-600">Antworten</p>
                  <div className="grid gap-2">
                    {matchingAnswers.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => {
                          if (!selectedMatchPrompt) return;
                          if (selectedMatchPrompt === card.id) {
                            setMatchedIds((current) => [...current, card.id]);
                          } else {
                            setWrongMatch({ prompt: selectedMatchPrompt, answer: card.id });
                            setTimeout(() => setWrongMatch(null), 700);
                          }
                          setSelectedMatchPrompt(null);
                        }}
                        disabled={matchedIds.includes(card.id)}
                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                          matchedIds.includes(card.id)
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : wrongMatch?.answer === card.id
                              ? 'border-red-300 bg-red-50 text-red-800'
                              : 'border-slate-200 hover:border-teal-200 hover:bg-teal-50'
                        }`}
                      >
                        {card.back}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-sm text-slate-500">
                    Zuordnungen: {matchedIds.length} von {matchingCards.length}
                  </p>
                  {matchedIds.length === matchingCards.length && (
                    <button
                      onClick={() => handleRate(currentCard.id, 'good')}
                      className="mt-3 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                    >
                      Aufgabe abschließen
                    </button>
                  )}
                </div>
              </div>
            )}

            {quizMode === 'exam' && (
              <div>
                {currentExamQuestion ? (
                  <>
                    <div className="rounded-lg bg-slate-50 p-4">
                      <p className="text-xs font-medium uppercase text-slate-400">
                        {selectedStudyChapter?.title}
                        {currentExamQuestion.sourcePage ? ` · Seite ${currentExamQuestion.sourcePage}` : ''}
                      </p>
                      <p className="mt-2 font-medium leading-relaxed text-slate-800">{currentExamQuestion.prompt}</p>
                    </div>

                    {(currentExamQuestion.type === 'multipleChoice' || currentExamQuestion.type === 'trueFalse') && (
                      <>
                        <div className="mt-4 grid gap-3">
                          {(currentExamQuestion.type === 'trueFalse'
                            ? ['Richtig', 'Falsch']
                            : currentExamQuestion.options ?? []
                          ).map((option) => {
                            const isSelected = selectedAnswer === option;
                            const isCorrect = currentExamQuestion.correctAnswer === option;
                            return (
                              <button
                                key={option}
                                onClick={() => setSelectedAnswer(option)}
                                className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                                  !selectedAnswer
                                    ? 'border-slate-200 hover:border-teal-200 hover:bg-teal-50'
                                    : isCorrect
                                      ? 'border-green-200 bg-green-50 text-green-800'
                                      : isSelected
                                        ? 'border-red-200 bg-red-50 text-red-800'
                                        : 'border-slate-200 bg-slate-50 text-slate-500'
                                }`}
                              >
                                {option}
                              </button>
                            );
                          })}
                        </div>
                        {selectedAnswer && (
                          <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                            Lösung: <span className="font-semibold text-slate-800">{currentExamQuestion.correctAnswer}</span>
                            {currentExamQuestion.explanation ? (
                              <span className="mt-1 block">{currentExamQuestion.explanation}</span>
                            ) : null}
                          </div>
                        )}
                      </>
                    )}

                    {currentExamQuestion.type === 'matching' && (
                      <div className="mt-4 grid gap-2">
                        {currentExamQuestion.pairs?.map((pair) => (
                          <div key={`${pair.left}-${pair.right}`} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_1.4fr]">
                            <span className="font-medium text-slate-800">{pair.left}</span>
                            <span className="text-sm text-slate-600">{pair.right}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedAnswer(null);
                          goToNextCard();
                        }}
                        className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                      >
                        Nächste Prüfungsfrage
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    Wähle oben ein einzelnes Kapitel, um kuratierte Prüfungsfragen aus dem PDF-Material zu trainieren.
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {viewMode === 'plan' && (
          <StudyPlan
            cards={cards}
            progress={progress}
            chapterStats={chapterStats}
            dueCount={dueCount}
            weakCount={weakCount}
            unseenCount={unseenCount}
            bookmarksSize={bookmarks.size}
            streakDays={streak.days}
            streakToday={streak.todayCount}
            dailyGoal={dailyGoal}
            onStartMode={(mode) => { setStudyMode(mode); setViewMode('cards'); }}
            onStartBookmarks={() => { setBookmarkOnly(true); setViewMode('cards'); }}
            onSetChapter={(key) => { setChapterFilter(key); setViewMode('cards'); }}
            examHistory={examHistory}
            onStartExam={() => setShowExamSimulator(true)}
          />
        )}

        {viewMode === 'stats' && (
          <Stats
            progress={progress}
            cards={cards}
            chapterStats={chapterStats}
            streak={streak}
          />
        )}

        {viewMode === 'cards' && (
          currentCard ? (
            <>
              {/* Progress bar */}
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <motion.div
                  className="h-full rounded-full bg-teal-500"
                  animate={{ width: `${filteredCards.length > 0 ? ((currentIndex + 1) / filteredCards.length) * 100 : 0}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </div>

              <div className="mb-5 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
                <motion.button
                  onClick={goToPreviousCard}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg px-3 py-2 font-medium transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  Zurück
                </motion.button>
                <span>
                  Karte {currentIndex + 1} von {filteredCards.length}
                </span>
                <motion.button
                  onClick={goToNextCard}
                  whileTap={{ scale: 0.95 }}
                  className="rounded-lg px-3 py-2 font-medium transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  Weiter
                </motion.button>
              </div>

              <AnimatePresence mode="wait" custom={cardDirection}>
                <motion.div
                  key={currentCard.id}
                  custom={cardDirection}
                  variants={{
                    enter: (dir: number) => ({ x: dir * 80, opacity: 0 }),
                    center: { x: 0, opacity: 1 },
                    exit: (dir: number) => ({ x: dir * -80, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.12}
                  whileDrag={{ cursor: 'grabbing', scale: 0.98 }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x < -60) goToNextCard();
                    else if (info.offset.x > 60) goToPreviousCard();
                  }}
                >
                  <Flashcard
                    card={currentCard}
                    onRate={handleRate}
                    onSkip={goToNextCard}
                    flipTrigger={flipTrigger}
                    userProgress={progress[currentCard.id]}
                    isBookmarked={bookmarks.has(currentCard.id)}
                    onToggleBookmark={toggleBookmark}
                  />
                </motion.div>
              </AnimatePresence>

              {/* ── Card notes ────────────────────────────────────────────── */}
              <div className="mx-auto mt-4 max-w-2xl">
                <button
                  onClick={() => setShowNote((v) => !v)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    notes[currentCard.id]
                      ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                      : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                  }`}
                >
                  <PenLine className="h-3.5 w-3.5" />
                  {notes[currentCard.id]
                    ? showNote ? 'Notiz einklappen' : 'Notiz ansehen'
                    : showNote ? 'Notiz schließen' : 'Notiz hinzufügen'}
                </button>
                <AnimatePresence>
                  {showNote && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <textarea
                        value={notes[currentCard.id] ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNotes((prev) => {
                            const next = { ...prev };
                            if (val.trim()) next[currentCard.id] = val;
                            else delete next[currentCard.id];
                            return next;
                          });
                        }}
                        rows={3}
                        placeholder="Deine persönliche Notiz zu dieser Karte…"
                        className="mt-2 w-full resize-none rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-amber-400"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <p className="mt-2 text-center text-xs text-slate-400 sm:hidden">
                Karte wischen zum Navigieren · Tippen zum Aufdecken
              </p>
              <p className="mt-2 hidden text-center text-xs text-slate-400 sm:block">
                <kbd className="rounded border border-slate-200 bg-slate-100 px-1">Space</kbd> umdrehen ·{' '}
                <kbd className="rounded border border-slate-200 bg-slate-100 px-1">←</kbd>{' '}
                <kbd className="rounded border border-slate-200 bg-slate-100 px-1">→</kbd> navigieren ·{' '}
                <kbd className="rounded border border-slate-200 bg-slate-100 px-1">1</kbd>–<kbd className="rounded border border-slate-200 bg-slate-100 px-1">4</kbd> bewerten
              </p>
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              Keine Karten für diese Filterauswahl.
            </div>
          )
        )}

        </motion.div>
        </AnimatePresence>
        </>}
      </div>
    </main>

    {/* ── Mobile bottom tab bar ──────────────────────────────────────── */}
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-200 bg-white/95 backdrop-blur-md sm:hidden">
      {([
        { key: 'lernen',   label: 'Lernen',   emoji: '🎓' },
        { key: 'finanzen', label: 'Finanzen', emoji: '💰' },
      ] as const).map(({ key, label, emoji }) => (
        <button
          key={key}
          onClick={() => setAppModule(key)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
            appModule === key ? 'text-teal-700' : 'text-slate-400 hover:text-slate-600'
          }`}
        >
          {appModule === key && (
            <motion.div
              layoutId="mobile-tab-indicator"
              className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-teal-600"
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
          )}
          <span className={`text-xl leading-none transition-transform ${appModule === key ? 'scale-110' : 'scale-100'}`}>{emoji}</span>
          <span>{label}</span>
        </button>
      ))}
    </nav>

    <footer className="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
      <button
        onClick={() => setShowImpressum(true)}
        className="mx-3 hover:text-slate-600 underline-offset-2 hover:underline"
      >
        Impressum
      </button>
      <button
        onClick={() => setShowDatenschutz(true)}
        className="mx-3 hover:text-slate-600 underline-offset-2 hover:underline"
      >
        Datenschutz
      </button>
    </footer>

    {/* Daily goal edit modal */}
    <AnimatePresence>
      {editingGoal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          onClick={() => setEditingGoal(false)}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xs rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="mb-4 font-bold text-slate-900">Tagesziel anpassen</h3>
            <input
              type="number"
              min={1}
              max={500}
              value={goalInput}
              onChange={e => setGoalInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveGoal(goalInput)}
              autoFocus
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-2xl font-bold outline-none focus:border-teal-500"
            />
            <p className="mt-1 text-center text-xs text-slate-400">Karten pro Tag</p>
            <div className="mt-4 flex gap-2">
              <button onClick={() => saveGoal(goalInput)}
                className="flex-1 rounded-xl bg-teal-600 py-2.5 text-sm font-semibold text-white hover:bg-teal-700">
                Speichern
              </button>
              <button onClick={() => setEditingGoal(false)}
                className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-200">
                Abbrechen
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Card creator modal */}
    <AnimatePresence>
      {showCardCreator && (
        <CardCreator
          chapters={chapters}
          existingIds={new Set(cards.map(c => c.id))}
          onClose={() => setShowCardCreator(false)}
          onSave={(card) => {
            setImportedCards(prev => [...prev, card]);
          }}
        />
      )}
    </AnimatePresence>

    {/* Exam simulator modal */}
    <AnimatePresence>
      {showExamSimulator && (
        <ExamSimulator
          cards={cards}
          chapters={chapters}
          onClose={() => {
            setShowExamSimulator(false);
            setExamHistory(loadExamHistory());
          }}
        />
      )}
    </AnimatePresence>

    {/* Session summary modal */}
    <AnimatePresence>
      {showSessionSummary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowSessionSummary(false)}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 16 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mb-4 text-center">
              <span className="text-5xl">🎉</span>
              <h2 className="mt-3 text-xl font-bold text-slate-900">Alle fälligen Karten erledigt!</h2>
              <p className="mt-1 text-sm text-slate-500">
                {streak.todayCount} Karten heute bewertet · {streak.days} Tage Streak
              </p>
            </div>

            <div className="mb-5 grid grid-cols-4 gap-2 text-center">
              {([
                { key: 'again', label: 'Wieder', bg: 'bg-red-50', text: 'text-red-700' },
                { key: 'hard', label: 'Schwer', bg: 'bg-orange-50', text: 'text-orange-700' },
                { key: 'good', label: 'Gut', bg: 'bg-blue-50', text: 'text-blue-700' },
                { key: 'easy', label: 'Einfach', bg: 'bg-green-50', text: 'text-green-700' },
              ] as const).map(({ key, label, bg, text }) => (
                <div key={key} className={`rounded-xl ${bg} p-3`}>
                  <p className={`text-xl font-bold ${text}`}>{sessionRatings[key]}</p>
                  <p className={`text-xs ${text} opacity-80`}>{label}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowSessionSummary(false); setViewMode('stats'); }}
                className="w-full rounded-xl bg-teal-600 py-3 text-sm font-semibold text-white hover:bg-teal-700"
              >
                Statistiken ansehen
              </button>
              <button
                onClick={() => { setShowSessionSummary(false); setStudyMode('all'); setSessionRatings({ again: 0, hard: 0, good: 0, easy: 0 }); }}
                className="w-full rounded-xl bg-slate-100 py-3 text-sm font-medium text-slate-600 hover:bg-slate-200"
              >
                Alle Karten weiterüben
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {showImpressum && (
      <LegalModal title="Impressum" onClose={() => setShowImpressum(false)}>
        <p><strong>Angaben gemäß § 5 TMG</strong></p>
        <p className="mt-2">[Name]<br />[Straße Hausnummer]<br />[PLZ Ort]</p>
        <p className="mt-3"><strong>Kontakt</strong></p>
        <p>E-Mail: [deine@email.de]</p>
        <p className="mt-4 text-xs text-slate-400">
          Bitte ersetze die Platzhalter mit deinen vollständigen Angaben.
        </p>
      </LegalModal>
    )}

    {showDatenschutz && (
      <LegalModal title="Datenschutzerklärung" onClose={() => setShowDatenschutz(false)}>
        <p><strong>1. Verantwortlicher</strong></p>
        <p className="mt-1">[Name, Adresse] — siehe Impressum.</p>
        <p className="mt-3"><strong>2. Hosting</strong></p>
        <p className="mt-1">
          Diese Website wird gehostet bei Vercel Inc., 340 Pine Street, San Francisco, CA 94104, USA.
          Beim Aufruf der Seite werden Server-Logs mit IP-Adresse, Browser-Typ und Zugriffszeit
          verarbeitet (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p className="mt-3"><strong>3. Lokale Speicherung</strong></p>
        <p className="mt-1">
          Die App speichert deinen Lernfortschritt ausschließlich im localStorage deines Browsers.
          Keine Daten werden an Server übertragen.
        </p>
        <p className="mt-3"><strong>4. Keine Tracking-Cookies</strong></p>
        <p className="mt-1">
          Diese Website verwendet keine Tracking-Cookies und keine Analyse-Dienste.
        </p>
        <p className="mt-3"><strong>5. Deine Rechte</strong></p>
        <p className="mt-1">
          Du hast das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung
          (Art. 15–18 DSGVO). Kontakt: [deine@email.de]
        </p>
      </LegalModal>
    )}
    </>
  );
}
