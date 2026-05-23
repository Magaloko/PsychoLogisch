import type { FlashcardData } from './components/Flashcard';
import type { UserProgress } from './learning';

export interface KeyTerm {
  term: string;
  count: number;
}

export interface PosterSummary {
  total: number;
  learned: number;
  definitions: number;
  people: number;
  formulas: number;
  keyTerms: KeyTerm[];
  highlights: FlashcardData[];
}

const ignoredTags = new Set(['psyskript-2025', 'definition', 'grundbegriff']);

const cleanTerm = (term: string) => term.replace(/^#/, '').replace(/-/g, ' ').trim();

export const getKeyTerms = (cards: FlashcardData[], limit = 12): KeyTerm[] => {
  const counts = new Map<string, number>();

  cards.forEach((card) => {
    card.tags.forEach((tag) => {
      if (ignoredTags.has(tag) || tag.startsWith('seite-') || tag.startsWith('kapitel-')) {
        return;
      }
      const term = cleanTerm(tag);
      if (term.length >= 3) {
        counts.set(term, (counts.get(term) ?? 0) + 1);
      }
    });
  });

  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count || a.term.localeCompare(b.term))
    .slice(0, limit);
};

export const createPosterSummary = (
  cards: FlashcardData[],
  progress: Record<string, UserProgress>,
  limit = 6
): PosterSummary => ({
  total: cards.length,
  learned: cards.filter((card) => progress[card.id]).length,
  definitions: cards.filter((card) => card.card_type === 'definition').length,
  people: cards.filter((card) => card.card_type === 'person').length,
  formulas: cards.filter((card) => card.card_type === 'formula').length,
  keyTerms: getKeyTerms(cards),
  highlights: cards
    .filter((card) => card.exam_relevant || card.card_type === 'definition')
    .slice(0, limit)
});
