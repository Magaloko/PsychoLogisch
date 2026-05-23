import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, Filter, RotateCcw } from 'lucide-react';
import { Flashcard, type FlashcardData } from './components/Flashcard';
import cardsData from './data/psychologie_alle_karten.json';
import {
  calculateNextReview,
  createInitialProgress,
  type Rating,
  type UserProgress
} from './learning';

type CardTypeFilter = FlashcardData['card_type'] | 'all';

const STORAGE_KEY = 'psychologisch-progress-v1';

const cardTypeLabels: Record<CardTypeFilter, string> = {
  all: 'Alle Typen',
  definition: 'Definition',
  concept: 'Konzept',
  person: 'Person',
  formula: 'Formel',
  image: 'Bild',
  list: 'Liste'
};

const loadProgress = (): Record<string, UserProgress> => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export default function App() {
  const cards = useMemo(() => cardsData as FlashcardData[], []);
  const chapters = useMemo(
    () => Array.from(new Set(cards.map((card) => `${card.chapter_id} ${card.chapter_title}`))),
    [cards]
  );
  const cardTypes = useMemo(
    () => Array.from(new Set(cards.map((card) => card.card_type))) as FlashcardData['card_type'][],
    [cards]
  );

  const [chapterFilter, setChapterFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<CardTypeFilter>('all');
  const [examOnly, setExamOnly] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState<Record<string, UserProgress>>(loadProgress);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const filteredCards = useMemo(
    () =>
      cards.filter((card) => {
        const chapterKey = `${card.chapter_id} ${card.chapter_title}`;
        return (
          (chapterFilter === 'all' || chapterKey === chapterFilter) &&
          (typeFilter === 'all' || card.card_type === typeFilter) &&
          (!examOnly || card.exam_relevant)
        );
      }),
    [cards, chapterFilter, examOnly, typeFilter]
  );

  useEffect(() => {
    setCurrentIndex(0);
  }, [chapterFilter, examOnly, typeFilter]);

  const dueCount = useMemo(() => {
    const now = Date.now();
    return Object.values(progress).filter((item) => new Date(item.next_review).getTime() <= now).length;
  }, [progress]);

  const learnedCount = Object.keys(progress).length;
  const currentCard = filteredCards[currentIndex];

  const goToNextCard = () => {
    setCurrentIndex((previous) => (filteredCards.length === 0 ? 0 : (previous + 1) % filteredCards.length));
  };

  const goToPreviousCard = () => {
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

  return (
    <main className="min-h-screen bg-slate-50 py-6 text-slate-900 sm:py-8">
      <div className="mx-auto max-w-5xl px-4">
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

        <section className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-400">Karten</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{filteredCards.length}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-400">Bewertet</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{learnedCount}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase text-slate-400">Heute fällig</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{dueCount}</p>
          </div>
        </section>

        <section className="mb-6 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_12rem_auto]">
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
              <option value="all">Alle Kapitel</option>
              {chapters.map((chapter) => (
                <option key={chapter} value={chapter}>
                  {chapter}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-600">
              <Filter className="h-4 w-4" />
              Kartentyp
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

          <label className="flex items-end gap-2 pb-2 text-sm font-medium text-slate-600">
            <input
              type="checkbox"
              checked={examOnly}
              onChange={(event) => setExamOnly(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            Nur prüfungsrelevant
          </label>
        </section>

        {currentCard ? (
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
        )}
      </div>
    </main>
  );
}
