import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpen,
  Brain,
  CalendarDays,
  Clock3,
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
  TextCursorInput
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Flashcard, type FlashcardData } from './components/Flashcard';
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
    setSelectedAnswer(null);
    setClozeAnswer('');
    setSelectedMatchPrompt(null);
    setMatchedIds([]);
    setCurrentIndex((previous) => (filteredCards.length === 0 ? 0 : (previous + 1) % filteredCards.length));
  };

  const goToPreviousCard = () => {
    setSelectedAnswer(null);
    setClozeAnswer('');
    setSelectedMatchPrompt(null);
    setMatchedIds([]);
    setCurrentIndex((previous) =>
      filteredCards.length === 0 ? 0 : (previous - 1 + filteredCards.length) % filteredCards.length
    );
  };

  const handleRate = (cardId: string, rating: Rating) => {
    const current = progress[cardId] ?? createInitialProgress(cardId);
    setProgress((previous) => ({
      ...previous,
      [cardId]: calculateNextReview(rating, current)
    }));
    goToNextCard();
  };

  const resetProgress = () => {
    setProgress({});
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
    <main className="min-h-screen bg-slate-50 py-6 text-slate-900 sm:py-8">
      <div className="mx-auto max-w-6xl px-4">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-normal text-slate-900">PsychoLogisch</h1>
            <p className="mt-2 text-slate-500">Aufnahmeprüfungs-Trainer Psychologie</p>
          </div>
          <button
            onClick={resetProgress}
            disabled={learnedCount === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            Fortschritt zurücksetzen
          </button>
        </header>

        <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
          <div className="grid gap-3 lg:grid-cols-[1fr_9rem_9rem_10rem]">
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
              Nur prüfungsrelevant
            </label>
          </div>
        </section>

        <nav className="mb-6 flex flex-wrap gap-2">
          {viewItems.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                viewMode === key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 shadow-sm ring-1 ring-slate-200 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>

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
                        onClick={() => setSelectedMatchPrompt(card.id)}
                        disabled={matchedIds.includes(card.id)}
                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                          matchedIds.includes(card.id)
                            ? 'border-green-200 bg-green-50 text-green-800'
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
                          }
                          setSelectedMatchPrompt(null);
                        }}
                        disabled={matchedIds.includes(card.id)}
                        className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                          matchedIds.includes(card.id)
                            ? 'border-green-200 bg-green-50 text-green-800'
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
              <div className="mb-5 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
                <button
                  onClick={goToPreviousCard}
                  className="rounded-lg px-3 py-2 font-medium transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  Zurück
                </button>
                <span>
                  Karte {currentIndex + 1} von {filteredCards.length}
                </span>
                <button
                  onClick={goToNextCard}
                  className="rounded-lg px-3 py-2 font-medium transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  Weiter
                </button>
              </div>

              <Flashcard card={currentCard} onRate={handleRate} onSkip={goToNextCard} />
            </>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
              Keine Karten für diese Filterauswahl.
            </div>
          )
        )}
      </div>
    </main>
  );
}
