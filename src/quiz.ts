import type { FlashcardData } from './components/Flashcard';

export type QuizMode = 'multipleChoice' | 'cloze' | 'matching';

export interface ClozeTask {
  prompt: string;
  answer: string;
}

const stopWords = new Set([
  'aber',
  'alle',
  'auch',
  'auf',
  'aus',
  'bei',
  'das',
  'dem',
  'den',
  'der',
  'des',
  'die',
  'durch',
  'eine',
  'einem',
  'einen',
  'einer',
  'eines',
  'für',
  'ist',
  'mit',
  'nicht',
  'oder',
  'sich',
  'und',
  'von',
  'werden',
  'wird',
  'zur'
]);

const hash = (value: string) =>
  value.split('').reduce((sum, char, index) => sum + char.charCodeAt(0) * (index + 1), 0);

export const deterministicPick = <T,>(items: T[], seed: string, count: number) =>
  [...items].sort((a, b) => hash(`${seed}-${String(a)}`) - hash(`${seed}-${String(b)}`)).slice(0, count);

export const getMultipleChoiceOptions = (currentCard: FlashcardData, allCards: FlashcardData[], count = 4) => {
  const sameType = allCards.filter((card) => card.id !== currentCard.id && card.card_type === currentCard.card_type);
  const fallback = allCards.filter((card) => card.id !== currentCard.id && card.card_type !== currentCard.card_type);
  const distractors = [
    ...deterministicPick(sameType, currentCard.id, count - 1),
    ...deterministicPick(fallback, `${currentCard.id}-fallback`, count - 1)
  ].slice(0, count - 1);

  return deterministicPick([currentCard, ...distractors], `${currentCard.id}-options`, count);
};

export const createClozeTask = (card: FlashcardData): ClozeTask => {
  const candidates = Array.from(card.back.matchAll(/\b[A-ZÄÖÜ][A-Za-zÄÖÜäöüß-]{5,}\b/g))
    .map((match) => match[0])
    .filter((word) => !stopWords.has(word.toLowerCase()));
  const answer = candidates.sort((a, b) => b.length - a.length)[0] ?? card.chapter_title.split(' ')[0] ?? '';

  return {
    answer,
    prompt: card.back.replace(answer, '_____')
  };
};

export const isCloseAnswer = (given: string, expected: string) => {
  const cleanGiven = given.trim().toLowerCase();
  const cleanExpected = expected.trim().toLowerCase();
  return cleanGiven.length > 0 && (cleanGiven === cleanExpected || cleanExpected.includes(cleanGiven));
};

export const getMatchingCards = (currentCard: FlashcardData, allCards: FlashcardData[], count = 4) => {
  const sameChapter = allCards.filter(
    (card) => card.id !== currentCard.id && String(card.chapter_id).split('.')[0] === String(currentCard.chapter_id).split('.')[0]
  );
  return [currentCard, ...deterministicPick(sameChapter, `${currentCard.id}-matching`, count - 1)].slice(0, count);
};
