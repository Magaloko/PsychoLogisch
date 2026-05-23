import React, { useMemo, useState } from 'react';
import { Flashcard, type FlashcardData } from './components/Flashcard';
import cardsData from './data/psychologie_alle_karten.json';

type Rating = 'again' | 'hard' | 'good' | 'easy';

interface UserProgress {
  card_id: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string;
}

const calculateNextReview = (rating: Rating, current: UserProgress): UserProgress => {
  const easeMap: Record<Rating, number> = {
    again: -0.2,
    hard: -0.15,
    good: 0,
    easy: 0.15
  };
  const intervalMap: Record<Rating, number> = {
    again: 1,
    hard: 1,
    good: 2,
    easy: 3
  };

  const nextEase = Math.max(1.3, current.ease_factor + easeMap[rating]);
  const nextInterval =
    rating === 'again'
      ? 1
      : current.repetitions === 0
        ? intervalMap[rating]
        : Math.round(current.interval * nextEase);

  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);

  return {
    card_id: current.card_id,
    interval: nextInterval,
    ease_factor: nextEase,
    repetitions: current.repetitions + 1,
    next_review: nextDate.toISOString()
  };
};

export default function App() {
  const cards = useMemo(() => cardsData as FlashcardData[], []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState<Record<string, UserProgress>>({});

  const goToNextCard = () => {
    setCurrentIndex((previous) => (previous + 1) % cards.length);
  };

  const handleRate = (cardId: string, rating: Rating) => {
    const current = progress[cardId] ?? {
      card_id: cardId,
      interval: 0,
      ease_factor: 2.5,
      repetitions: 0,
      next_review: new Date().toISOString()
    };

    setProgress((previous) => ({
      ...previous,
      [cardId]: calculateNextReview(rating, current)
    }));
    goToNextCard();
  };

  const learnedCount = Object.keys(progress).length;
  const currentCard = cards[currentIndex];

  return (
    <main className="min-h-screen bg-slate-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        <header className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-slate-800">PsychoLogisch</h1>
          <p className="mt-2 text-slate-500">Aufnahmeprüfungs-Trainer Psychologie</p>
        </header>

        <div className="mb-5 flex items-center justify-center gap-4 text-sm text-slate-500">
          <span>
            Karte {currentIndex + 1} von {cards.length}
          </span>
          <span>Bewertet: {learnedCount}</span>
        </div>

        <Flashcard card={currentCard} onRate={handleRate} onSkip={goToNextCard} />
      </div>
    </main>
  );
}
