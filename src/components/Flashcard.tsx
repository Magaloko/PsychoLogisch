
// ============================================================
// Flashcard.tsx - Kernkomponente der Lern-App
// ============================================================

import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Brain,
  Calculator,
  Image as ImageIcon,
  List,
  RotateCcw,
  User,
  X
} from 'lucide-react';
import type { Rating } from '../learning';

export interface FlashcardData {
  id: string;
  chapter_id: string;
  chapter_title: string;
  card_type: 'definition' | 'concept' | 'person' | 'formula' | 'image' | 'list';
  front: string;
  back: string;
  back_extended?: string;
  image_url?: string;
  image_labels?: Array<{ label: string; x: number; y: number }>;
  formula?: string;
  formula_explanation?: string;
  exam_relevant: boolean;
  difficulty: number;
  tags: string[];
}

interface FlashcardProps {
  card: FlashcardData;
  onRate: (cardId: string, rating: Rating) => void;
  onSkip: () => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({ card, onRate, onSkip }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExtended, setShowExtended] = useState(false);

  useEffect(() => {
    setIsFlipped(false);
    setShowExtended(false);
  }, [card.id]);

  const handleFlip = useCallback(() => {
    setIsFlipped((current) => !current);
  }, []);

  const handleRate = useCallback((rating: Rating) => {
    onRate(card.id, rating);
    setIsFlipped(false);
    setShowExtended(false);
  }, [card.id, onRate]);

  const TypeIcon = {
    definition: Brain,
    concept: Brain,
    person: User,
    formula: Calculator,
    image: ImageIcon,
    list: List
  }[card.card_type];

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 px-3 py-1 text-sm font-medium text-teal-700">
            {card.chapter_id}
          </span>
          {card.exam_relevant && (
            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700">
              PRÜFUNGSRELEVANT
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TypeIcon className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 capitalize">{card.card_type}</span>
        </div>
      </div>

      <div className="relative min-h-[30rem] [perspective:1000px]">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: 90 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8"
            >
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="mb-3 text-sm font-medium text-slate-400">{card.chapter_title}</p>
                  <h3 className="text-xl font-semibold leading-relaxed text-slate-800">
                    {card.front}
                  </h3>
                  {card.image_url && (
                    <p className="text-sm text-slate-400 mt-4">
                      (Tippen zum Aufdecken)
                    </p>
                  )}
                </div>
              </div>

              <button
                onClick={handleFlip}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-medium text-white transition-colors hover:bg-teal-700"
              >
                <RotateCcw className="w-5 h-5" />
                Aufdecken
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ rotateY: -90 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: -90 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-lg sm:p-8"
            >
              <div className="flex-1">
                <div className="whitespace-pre-line text-lg leading-relaxed text-slate-700">
                  {card.back}
                </div>

                {card.formula && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="font-mono text-lg text-slate-800">{card.formula}</div>
                    {card.formula_explanation && (
                      <p className="mt-2 text-sm text-slate-600">{card.formula_explanation}</p>
                    )}
                  </div>
                )}

                {card.image_url && (
                  <figure className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img src={card.image_url} alt={card.front} className="max-h-56 w-full object-contain" />
                    {card.image_labels && card.image_labels.length > 0 && (
                      <figcaption className="flex flex-wrap gap-2 p-3 text-xs text-slate-500">
                        {card.image_labels.map((label) => (
                          <span key={`${label.label}-${label.x}-${label.y}`} className="rounded bg-white px-2 py-1">
                            {label.label}
                          </span>
                        ))}
                      </figcaption>
                    )}
                  </figure>
                )}

                {card.back_extended && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowExtended(!showExtended)}
                      className="text-sm font-medium text-teal-700 hover:underline"
                    >
                      {showExtended ? 'Weniger anzeigen' : 'Mehr erfahren...'}
                    </button>
                    {showExtended && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600"
                      >
                        {card.back_extended}
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  onClick={() => handleRate('again')}
                  className="rounded-xl bg-red-100 py-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-200"
                >
                  <X className="w-4 h-4 mx-auto mb-1" />
                  Wieder
                </button>
                <button
                  onClick={() => handleRate('hard')}
                  className="rounded-xl bg-orange-100 py-3 text-sm font-medium text-orange-700 transition-colors hover:bg-orange-200"
                >
                  Schwer
                </button>
                <button
                  onClick={() => handleRate('good')}
                  className="rounded-xl bg-blue-100 py-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-200"
                >
                  Gut
                </button>
                <button
                  onClick={() => handleRate('easy')}
                  className="rounded-xl bg-green-100 py-3 text-sm font-medium text-green-700 transition-colors hover:bg-green-200"
                >
                  <Check className="w-4 h-4 mx-auto mb-1" />
                  Einfach
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex flex-wrap gap-1">
          {card.tags.map(tag => (
            <span key={tag} className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
              #{tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-slate-400">
          Schwierigkeit: {'⭐'.repeat(card.difficulty)}
        </span>
      </div>
      <div className="mt-4 flex justify-center">
        <button
          onClick={onSkip}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          Überspringen
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
