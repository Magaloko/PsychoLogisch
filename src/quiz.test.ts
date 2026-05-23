import { describe, expect, it } from 'vitest';
import { createClozeTask, getMatchingCards, getMultipleChoiceOptions, isCloseAnswer } from './quiz';
import type { FlashcardData } from './components/Flashcard';

const makeCard = (id: string, back: string, cardType: FlashcardData['card_type'] = 'concept'): FlashcardData => ({
  id,
  chapter_id: '1.1',
  chapter_title: 'Testkapitel',
  card_type: cardType,
  front: `Frage ${id}`,
  back,
  exam_relevant: true,
  difficulty: 2,
  tags: ['test']
});

describe('quiz helpers', () => {
  it('creates deterministic multiple-choice options including the current card', () => {
    const current = makeCard('a', 'Antwort A');
    const options = getMultipleChoiceOptions(current, [
      current,
      makeCard('b', 'Antwort B'),
      makeCard('c', 'Antwort C'),
      makeCard('d', 'Antwort D')
    ]);

    expect(options).toHaveLength(4);
    expect(options.some((card) => card.id === 'a')).toBe(true);
  });

  it('creates a cloze task and accepts close answers', () => {
    const task = createClozeTask(makeCard('a', 'Die Psychologie untersucht Verhalten und Erleben.'));

    expect(task.prompt).toContain('_____');
    expect(isCloseAnswer(task.answer, task.answer)).toBe(true);
  });

  it('builds a matching set from the same chapter', () => {
    const current = makeCard('a', 'Antwort A');
    const matching = getMatchingCards(current, [
      current,
      makeCard('b', 'Antwort B'),
      makeCard('c', 'Antwort C'),
      { ...makeCard('d', 'Antwort D'), chapter_id: '2.1' }
    ]);

    expect(matching.map((card) => card.id)).toContain('a');
    expect(matching.map((card) => card.id)).not.toContain('d');
  });
});
