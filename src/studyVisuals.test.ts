import { describe, expect, it } from 'vitest';
import { createPosterSummary, getKeyTerms } from './studyVisuals';
import type { FlashcardData } from './components/Flashcard';

const makeCard = (id: string, tags: string[], cardType: FlashcardData['card_type'] = 'concept'): FlashcardData => ({
  id,
  chapter_id: '1.1',
  chapter_title: 'Test',
  card_type: cardType,
  front: `Frage ${id}`,
  back: `Antwort ${id}`,
  exam_relevant: true,
  difficulty: 2,
  tags
});

describe('study visuals', () => {
  it('extracts key terms from meaningful tags', () => {
    const terms = getKeyTerms([
      makeCard('a', ['gedächtnis', 'seite-1']),
      makeCard('b', ['gedächtnis', 'kapitel-1']),
      makeCard('c', ['wahrnehmung'])
    ]);

    expect(terms[0]).toEqual({ term: 'gedächtnis', count: 2 });
    expect(terms.map((item) => item.term)).not.toContain('seite 1');
  });

  it('creates a poster summary', () => {
    const cards = [
      makeCard('a', ['gedächtnis'], 'definition'),
      makeCard('b', ['person'], 'person'),
      makeCard('c', ['formel'], 'formula')
    ];
    const summary = createPosterSummary(cards, { a: { card_id: 'a', interval: 1, ease_factor: 2.5, repetitions: 1, next_review: '2026-05-24T00:00:00.000Z' } });

    expect(summary.total).toBe(3);
    expect(summary.learned).toBe(1);
    expect(summary.definitions).toBe(1);
    expect(summary.people).toBe(1);
    expect(summary.formulas).toBe(1);
  });
});
