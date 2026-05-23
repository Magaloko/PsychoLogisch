import { describe, expect, it } from 'vitest';
import { findStudyChapter, type StudyContent } from './studyContent';

const content: StudyContent = {
  version: 1,
  generatedFrom: 'fixture',
  generatedAt: '2026-05-23T00:00:00.000Z',
  chapters: [
    {
      id: '1',
      title: 'Kapitel 1',
      summary: 'Grundlagen',
      sourcePages: [1, 2],
      keyTerms: [],
      highlights: [],
      definitions: [],
      people: [],
      theories: [],
      methods: [],
      formulas: [],
      examQuestions: []
    }
  ]
};

describe('findStudyChapter', () => {
  it('returns the matching chapter', () => {
    expect(findStudyChapter(content, '1')?.title).toBe('Kapitel 1');
  });

  it('returns null when the chapter is missing', () => {
    expect(findStudyChapter(content, '2')).toBeNull();
  });
});
