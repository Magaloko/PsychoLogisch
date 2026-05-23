import { describe, expect, it } from 'vitest';
import { calculateNextReview, createInitialProgress } from './learning';

describe('calculateNextReview', () => {
  it('schedules a new good card two days ahead', () => {
    const now = new Date('2026-05-23T10:00:00.000Z');
    const result = calculateNextReview('good', createInitialProgress('card-1', now), now);

    expect(result.card_id).toBe('card-1');
    expect(result.interval).toBe(2);
    expect(result.repetitions).toBe(1);
    expect(result.next_review).toBe('2026-05-25T10:00:00.000Z');
  });

  it('keeps the ease factor above the minimum', () => {
    const now = new Date('2026-05-23T10:00:00.000Z');
    const result = calculateNextReview(
      'again',
      {
        card_id: 'card-1',
        interval: 1,
        ease_factor: 1.31,
        repetitions: 4,
        next_review: now.toISOString()
      },
      now
    );

    expect(result.ease_factor).toBe(1.3);
    expect(result.interval).toBe(1);
  });
});
