export type ExamQuestionType = 'multipleChoice' | 'trueFalse' | 'matching';

export interface StudyFact {
  id: string;
  prompt: string;
  answer: string;
  sourcePage?: number;
  type?: string;
}

export interface StudyKeyTerm {
  term: string;
  count: number;
}

export interface ExamQuestion {
  id: string;
  type: ExamQuestionType;
  prompt: string;
  correctAnswer?: string;
  options?: string[];
  explanation?: string;
  sourcePage?: number;
  pairs?: Array<{ left: string; right: string; sourcePage?: number }>;
}

export interface StudyChapter {
  id: string;
  title: string;
  summary: string;
  sourcePages: number[];
  keyTerms: StudyKeyTerm[];
  highlights: StudyFact[];
  definitions: StudyFact[];
  people: StudyFact[];
  theories: StudyFact[];
  methods: StudyFact[];
  formulas: StudyFact[];
  examQuestions: ExamQuestion[];
}

export interface StudyContent {
  version: number;
  generatedFrom: string;
  generatedAt: string;
  chapters: StudyChapter[];
}

export const findStudyChapter = (content: StudyContent | null, chapterId: string) =>
  content?.chapters.find((chapter) => chapter.id === chapterId) ?? null;
