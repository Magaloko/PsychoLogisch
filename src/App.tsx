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
  HelpCircle,
  ListChecks,
  Network,
  Newspaper,
  RotateCcw,
  Search,
  Target,
  TextCursorInput,
  Upload
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Flashcard, type FlashcardData } from './components/Flashcard';
import FinancePlanner from './components/FinancePlanner';
import { LegalModal } from './components/LegalModal';
import { Logo } from './components/Logo';
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
type ViewMode = 'cards' | 'mindmap' | 'timeline' | 'quiz' | 'poster';
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
const TODAY = new Date().toISOString().slice(0, 10);

interface StreakData { date: string; todayCount: number; days: number; }

const loadStreak = (): StreakData => {
  try {
    const saved = window.localStorage.getItem(STREAK_KEY);
    if (!saved) return { date: TODAY, todayCount: 0, days: 0 };
    const data = JSON.parse(saved) as StreakData;
    if (data.date === TODAY) return data;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = data.date === yesterday.toISOString().slice(0, 10);
    return { date: TODAY, todayCount: 0, days: isYesterday ? data.days : 0 };
  } catch {
    return { date: TODAY, todayCount: 0, days: 0 };
  }
};

const cardTypeLabels: Record<CardTypeFilter, string> = {
  all: 'Alle Typen',
  definition: 'Definition',
  concept: 'Konzept',
  person: 'Person',
  formula: 'Formel',
  image: 'Bild',
  list: 'Liste'
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

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  useEffect(() => {
    window.localStorage.setItem(IMPORTED_CARDS_KEY, JSON.stringify(importedCards));
  }, [importedCards]);

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
          (studyMode === 'unseen' && !cardProgress))
      );
    });
  }, [cards, chapterFilter, examOnly, progress, searchQuery, sourceFilter, studyMode, typeFilter]);

  useEffect(() => {
    setCurrentIndex(0);
    setSelectedAnswer(null);
    setClozeAnswer('');
    setSelectedMatchPrompt(null);
    setMatchedIds([]);
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
    { key: 'cards', label: 'Karten', icon: BookOpen },
    { key: 'mindmap', label: 'Mindmap', icon: Network },
    { key: 'poster', label: 'Lernposter', icon: Newspaper },
    { key: 'timeline', label: 'Timeline', icon: Clock3 },
    { key: 'quiz', label: 'Quiz', icon: HelpCircle }
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

    const newStreak: StreakData = {
      date: TODAY,
      todayCount: streak.todayCount + 1,
      days: streak.todayCount === 0 ? streak.days + 1 : streak.days,
    };
    setStreak(newStreak);
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));

    const wasLastDue =
      studyMode === 'due' &&
      cards.filter((c) => isDue(newProgress[c.id])).length === 0;
    if (wasLastDue) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#0d9488', '#14b8a6', '#6366f1', '#f59e0b', '#ec4899'] });
    }

    goToNextCard();
  };

  const resetProgress = () => {
    setProgress({});
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
    <main className="min-h-screen bg-slate-50 py-6 pb-24 text-slate-900 sm:py-8 sm:pb-8">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <Logo size="lg" />
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-slate-500">Aufnahmeprüfungs-Trainer Psychologie</p>
              <AnimatePresence>
                {appModule === 'lernen' && streak.todayCount > 0 && (
                  <motion.span
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
                  >
                    🔥 {streak.todayCount} heute
                    {streak.days > 1 && <span className="opacity-70">· {streak.days} Tage</span>}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Module switcher — hidden on mobile (bottom tab bar handles it) */}
            <div className="hidden sm:flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
              {([
                { key: 'lernen', label: '🎓 Lernen' },
                { key: 'finanzen', label: '💰 Finanzen' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setAppModule(key)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    appModule === key ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Progress tools — only in lernen mode */}
            {appModule === 'lernen' && (
              <>
                <button
                  onClick={exportProgress}
                  disabled={learnedCount === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  title="Lernfortschritt als JSON herunterladen"
                >
                  <Download className="h-4 w-4" />
                  Exportieren
                </button>
                <button
                  onClick={() => importProgressRef.current?.click()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100"
                  title="Lernfortschritt aus JSON-Datei wiederherstellen"
                >
                  <Upload className="h-4 w-4" />
                  Importieren
                </button>
                <button
                  onClick={resetProgress}
                  disabled={learnedCount === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" />
                  Zurücksetzen
                </button>
                <input
                  ref={importProgressRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => importProgressFromFile(e.target.files?.[0])}
                />
              </>
            )}
          </div>
        </header>

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

        <nav className="mb-6 flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {viewItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

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
              <HelpCircle className="h-5 w-5 text-teal-600" />
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
                      onClick={() => handleRate(currentCard.id, selectedAnswer === currentCard.id ? 'good' : 'again')}
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
                    onClick={() => handleRate(currentCard.id, isCloseAnswer(clozeAnswer, clozeTask.answer) ? 'good' : 'again')}
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
                  <Flashcard card={currentCard} onRate={handleRate} onSkip={goToNextCard} flipTrigger={flipTrigger} />
                </motion.div>
              </AnimatePresence>

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
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-slate-100 bg-white/95 backdrop-blur-sm sm:hidden">
      {([
        { key: 'lernen', label: 'Lernen', emoji: '🎓' },
        { key: 'finanzen', label: 'Finanzen', emoji: '💰' },
      ] as const).map(({ key, label, emoji }) => (
        <button
          key={key}
          onClick={() => setAppModule(key)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
            appModule === key ? 'text-teal-700' : 'text-slate-400'
          }`}
        >
          {appModule === key && (
            <motion.div
              layoutId="mobile-tab-indicator"
              className="absolute inset-x-6 top-0 h-0.5 rounded-full bg-teal-600"
            />
          )}
          <span className="text-xl leading-none">{emoji}</span>
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
