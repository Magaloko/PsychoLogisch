export type Rating = 'again' | 'hard' | 'good' | 'easy';

export const formatInterval = (days: number): string => {
  if (days === 0) return 'heute';
  if (days === 1) return 'morgen';
  if (days < 7) return `in ${days} Tagen`;
  if (days === 7) return 'in 1 Woche';
  if (days < 30) return `in ${Math.round(days / 7)} Wochen`;
  if (days < 60) return 'in 1 Monat';
  return `in ${Math.round(days / 30)} Monaten`;
};

export interface UserProgress {
  card_id: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string;
  last_rating?: Rating;
  lapses?: number;
}

export const createInitialProgress = (cardId: string, now = new Date()): UserProgress => ({
  card_id: cardId,
  interval: 0,
  ease_factor: 2.5,
  repetitions: 0,
  next_review: now.toISOString()
});

export const calculateNextReview = (
  rating: Rating,
  current: UserProgress,
  now = new Date()
): UserProgress => {
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

  const nextEase = Math.min(2.5, Math.max(1.3, current.ease_factor + easeMap[rating]));
  const nextInterval =
    rating === 'again'
      ? 1
      : current.repetitions === 0
        ? intervalMap[rating]
        : Math.max(1, Math.round(current.interval * nextEase));

  const nextDate = new Date(now);
  nextDate.setDate(nextDate.getDate() + nextInterval);

  return {
    card_id: current.card_id,
    interval: nextInterval,
    ease_factor: nextEase,
    repetitions: current.repetitions + 1,
    next_review: nextDate.toISOString(),
    last_rating: rating,
    lapses: (current.lapses ?? 0) + (rating === 'again' ? 1 : 0)
  };
};
