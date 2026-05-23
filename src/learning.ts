export type Rating = 'again' | 'hard' | 'good' | 'easy';

export interface UserProgress {
  card_id: string;
  interval: number;
  ease_factor: number;
  repetitions: number;
  next_review: string;
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

  const nextEase = Math.max(1.3, current.ease_factor + easeMap[rating]);
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
    next_review: nextDate.toISOString()
  };
};
