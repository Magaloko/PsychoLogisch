
// ============================================================
// Flashcard.tsx - Kernkomponente der Lern-App
// ============================================================

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Check,
  Brain,
  Calculator,
  Columns2,
  Image as ImageIcon,
  Lightbulb,
  List,
  RotateCcw,
  Star,
  User,
  X
} from 'lucide-react';
import { calculateNextReview, formatInterval } from '../learning';
import type { Rating, UserProgress } from '../learning';

export interface FlashcardData {
  id: string;
  chapter_id: string;
  chapter_title: string;
  card_type: 'definition' | 'concept' | 'person' | 'formula' | 'image' | 'list' | 'comparison';
  front: string;
  back: string;
  back_extended?: string;
  mnemonic?: string;
  exam_trap?: string;
  image_url?: string;
  image_labels?: Array<{ label: string; x: number; y: number }>;
  formula?: string;
  formula_explanation?: string;
  comparison?: {
    left_title: string;
    right_title: string;
    rows: Array<{ label: string; left: string; right: string }>;
  };
  exam_relevant: boolean;
  difficulty: number;
  tags: string[];
  source?: string;
  source_page?: number;
}

interface FlashcardProps {
  card: FlashcardData;
  onRate: (cardId: string, rating: Rating) => void;
  onSkip: () => void;
  flipTrigger?: number;
  userProgress?: UserProgress;
  isBookmarked?: boolean;
  onToggleBookmark?: (cardId: string) => void;
}

const ratingConfig: Record<Rating, { label: string; bg: string; text: string; hover: string; icon?: React.ReactNode }> = {
  again: {
    label: 'Wieder',
    bg: 'bg-red-100',
    text: 'text-red-700',
    hover: 'hover:bg-red-200',
    icon: <X className="w-4 h-4 mx-auto mb-1" />,
  },
  hard: {
    label: 'Schwer',
    bg: 'bg-orange-100',
    text: 'text-orange-700',
    hover: 'hover:bg-orange-200',
  },
  good: {
    label: 'Gut',
    bg: 'bg-blue-100',
    text: 'text-blue-700',
    hover: 'hover:bg-blue-200',
  },
  easy: {
    label: 'Einfach',
    bg: 'bg-green-100',
    text: 'text-green-700',
    hover: 'hover:bg-green-200',
    icon: <Check className="w-4 h-4 mx-auto mb-1" />,
  },
};

export const Flashcard: React.FC<FlashcardProps> = ({ card, onRate, onSkip, flipTrigger, userProgress, isBookmarked, onToggleBookmark }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExtended, setShowExtended] = useState(false);

  const intervalPreviews = useMemo<Record<Rating, string>>(() => {
    const base = userProgress ?? { card_id: card.id, interval: 0, ease_factor: 2.5, repetitions: 0, next_review: new Date().toISOString() };
    return {
      again: formatInterval(calculateNextReview('again', base).interval),
      hard: formatInterval(calculateNextReview('hard', base).interval),
      good: formatInterval(calculateNextReview('good', base).interval),
      easy: formatInterval(calculateNextReview('easy', base).interval),
    };
  }, [card.id, userProgress]);

  useEffect(() => {
    setIsFlipped(false);
    setShowExtended(false);
  }, [card.id]);

  useEffect(() => {
    if (flipTrigger) setIsFlipped((f) => !f);
  }, [flipTrigger]);

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
    list: List,
    comparison: Columns2,
  }[card.card_type];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Meta row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-teal-50 dark:bg-teal-500/15 px-3 py-1 text-sm font-medium text-teal-700">
            {card.chapter_id}
          </span>
          {card.exam_relevant && (
            <motion.span
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-700"
            >
              PRÜFUNGSRELEVANT
            </motion.span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
          <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 capitalize">{card.card_type}</span>
          {onToggleBookmark && (
            <motion.button
              onClick={() => onToggleBookmark(card.id)}
              whileTap={{ scale: 0.8 }}
              whileHover={{ scale: 1.15 }}
              className="ml-1"
              title={isBookmarked ? 'Lesezeichen entfernen' : 'Als Lesezeichen markieren'}
            >
              <Star className={`w-4 h-4 transition-colors ${isBookmarked ? 'fill-amber-400 text-amber-400' : 'text-slate-300 hover:text-amber-400'}`} />
            </motion.button>
          )}
        </div>
      </div>

      {/* Card body */}
      <div className="relative min-h-[22rem] sm:min-h-[30rem] [perspective:1200px]">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ rotateY: -90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: 90, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              style={{ transformOrigin: 'center' }}
              className="absolute inset-0 flex flex-col rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-800 sm:p-6 lg:p-8"
            >
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <p className="mb-3 text-sm font-medium text-slate-400 dark:text-slate-500 dark:text-slate-400">{card.chapter_title}</p>
                  <h3 className="text-lg sm:text-xl font-semibold leading-relaxed text-slate-800 dark:text-slate-100">
                    {card.front}
                  </h3>
                  {card.image_url && (
                    <p className="text-sm text-slate-400 dark:text-slate-500 dark:text-slate-400 mt-4">(Tippen zum Aufdecken)</p>
                  )}
                </div>
              </div>

              <motion.button
                onClick={handleFlip}
                whileTap={{ scale: 0.97 }}
                whileHover={{ scale: 1.01 }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 py-3 font-medium text-white transition-colors hover:bg-teal-700"
              >
                <RotateCcw className="w-5 h-5" />
                Aufdecken
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="back"
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              exit={{ rotateY: -90, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              style={{ transformOrigin: 'center' }}
              className="absolute inset-0 flex flex-col overflow-y-auto rounded-2xl border border-teal-200 bg-white p-4 shadow-lg dark:border-teal-700/50 dark:bg-slate-800 sm:p-6 lg:p-8"
            >
              <div className="flex-1">
                <div className="whitespace-pre-line text-base sm:text-lg leading-relaxed text-slate-700 dark:text-slate-200">
                  {card.back}
                </div>

                {card.formula && (
                  <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-4">
                    <div className="font-mono text-sm sm:text-base text-slate-800 dark:text-slate-100 break-all">{card.formula}</div>
                    {card.formula_explanation && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{card.formula_explanation}</p>
                    )}
                  </div>
                )}

                {card.mnemonic && (
                  <div className="mt-4 rounded-lg border border-purple-200 bg-purple-50 dark:bg-purple-500/15 p-3">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-purple-600" />
                      <span className="text-xs font-bold uppercase tracking-wide text-purple-700">Eselsbrücke</span>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-purple-900 leading-snug">{card.mnemonic}</p>
                  </div>
                )}

                {card.exam_trap && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-500/15 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-base">⚠️</span>
                      <span className="text-xs font-bold uppercase tracking-wide text-amber-800">Klausurfalle</span>
                    </div>
                    <p className="mt-1.5 text-sm text-amber-900 leading-snug">{card.exam_trap}</p>
                  </div>
                )}

                {card.image_url && (
                  <figure className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                    <img src={card.image_url} alt={card.front} className="max-h-56 w-full object-contain" />
                    {card.image_labels && card.image_labels.length > 0 && (
                      <figcaption className="flex flex-wrap gap-2 p-3 text-xs text-slate-500 dark:text-slate-400">
                        {card.image_labels.map((label) => (
                          <span key={`${label.label}-${label.x}-${label.y}`} className="rounded bg-white px-2 py-1">
                            {label.label}
                          </span>
                        ))}
                      </figcaption>
                    )}
                  </figure>
                )}

                {card.comparison && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-[8rem_1fr_1fr] sm:grid-cols-[10rem_1fr_1fr] divide-x divide-slate-200 bg-slate-50 dark:bg-slate-700/50 text-xs font-bold uppercase tracking-wide">
                      <div className="px-2 py-2 text-slate-400 dark:text-slate-500 dark:text-slate-400" />
                      <div className="px-3 py-2 text-teal-700 break-words">{card.comparison.left_title}</div>
                      <div className="px-3 py-2 text-indigo-700 break-words">{card.comparison.right_title}</div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700">
                      {card.comparison.rows.map((row, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[8rem_1fr_1fr] sm:grid-cols-[10rem_1fr_1fr] divide-x divide-slate-100 dark:divide-slate-700"
                        >
                          <div className="bg-slate-50 dark:bg-slate-700/50 px-2 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 break-words">{row.label}</div>
                          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200 break-words whitespace-pre-line">{row.left}</div>
                          <div className="px-3 py-2 text-sm text-slate-700 dark:text-slate-200 break-words whitespace-pre-line">{row.right}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {card.back_extended && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowExtended(!showExtended)}
                      className="text-sm font-medium text-teal-700 hover:underline"
                    >
                      {showExtended ? 'Weniger anzeigen' : 'Mehr erfahren...'}
                    </button>
                    <AnimatePresence>
                      {showExtended && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 p-4 text-sm text-slate-600 dark:text-slate-300 overflow-hidden"
                        >
                          {card.back_extended}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Rating buttons */}
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['again', 'hard', 'good', 'easy'] as Rating[]).map((rating) => {
                  const cfg = ratingConfig[rating];
                  return (
                    <motion.button
                      key={rating}
                      onClick={() => handleRate(rating)}
                      whileTap={{ scale: 0.92 }}
                      whileHover={{ scale: 1.04, y: -2 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                      className={`rounded-xl ${cfg.bg} py-2 sm:py-3 text-xs sm:text-sm font-medium ${cfg.text} transition-colors ${cfg.hover} flex flex-col items-center`}
                    >
                      {cfg.icon}
                      <span>{cfg.label}</span>
                      <span className="mt-0.5 text-[10px] opacity-60 font-normal leading-none">
                        {intervalPreviews[rating]}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer meta */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex flex-wrap gap-1">
          {card.tags.map((tag) => (
            <span key={tag} className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
              #{tag}
            </span>
          ))}
        </div>
        <span className="text-xs text-slate-400 dark:text-slate-500 dark:text-slate-400">
          {'⭐'.repeat(card.difficulty)}
          {card.source_page ? ` · S. ${card.source_page}` : ''}
        </span>
      </div>
      <div className="mt-4 flex justify-center">
        <motion.button
          onClick={onSkip}
          whileTap={{ scale: 0.97 }}
          className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-100 dark:bg-slate-700 hover:text-slate-700 dark:text-slate-200"
        >
          Überspringen
          <ArrowRight className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
};
