
// ============================================================
// Flashcard.tsx - Kernkomponente der Lern-App
// ============================================================

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RotateCcw, Check, X, Brain, Image as ImageIcon, Calculator } from 'lucide-react';

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
  onRate: (cardId: string, rating: 'again' | 'hard' | 'good' | 'easy') => void;
  onSkip: () => void;
}

export const Flashcard: React.FC<FlashcardProps> = ({ card, onRate, onSkip }) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showExtended, setShowExtended] = useState(false);

  const handleFlip = useCallback(() => {
    setIsFlipped(!isFlipped);
  }, [isFlipped]);

  const handleRate = useCallback((rating: 'again' | 'hard' | 'good' | 'easy') => {
    onRate(card.id, rating);
    setIsFlipped(false);
    setShowExtended(false);
  }, [card.id, onRate]);

  // Icon basierend auf Kartentyp
  const TypeIcon = {
    definition: Brain,
    concept: Brain,
    person: Brain,
    formula: Calculator,
    image: ImageIcon,
    list: Brain
  }[card.card_type];

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
            {card.chapter_id}
          </span>
          {card.exam_relevant && (
            <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
              PRÜFUNGSRELEVANT
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <TypeIcon className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400 capitalize">{card.card_type}</span>
        </div>
      </div>

      {/* Karte */}
      <div className="relative h-96 perspective-1000">
        <AnimatePresence mode="wait">
          {!isFlipped ? (
            <motion.div
              key="front"
              initial={{ rotateY: 0 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: 90 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-slate-200 p-8 flex flex-col"
            >
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-slate-800 leading-relaxed">
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
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium 
                         hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
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
              className="absolute inset-0 bg-white rounded-2xl shadow-lg border border-slate-200 p-8 flex flex-col overflow-y-auto"
            >
              <div className="flex-1">
                <div className="whitespace-pre-line text-lg text-slate-700 leading-relaxed">
                  {card.back}
                </div>

                {/* Erweiterte Erklärung */}
                {card.back_extended && (
                  <div className="mt-4">
                    <button
                      onClick={() => setShowExtended(!showExtended)}
                      className="text-sm text-indigo-600 font-medium hover:underline"
                    >
                      {showExtended ? 'Weniger anzeigen' : 'Mehr erfahren...'}
                    </button>
                    {showExtended && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-3 p-4 bg-slate-50 rounded-lg text-sm text-slate-600"
                      >
                        {card.back_extended}
                      </motion.div>
                    )}
                  </div>
                )}
              </div>

              {/* Bewertungs-Buttons */}
              <div className="grid grid-cols-4 gap-2 mt-6">
                <button
                  onClick={() => handleRate('again')}
                  className="py-3 bg-red-100 text-red-700 rounded-xl font-medium hover:bg-red-200 
                           transition-colors text-sm"
                >
                  <X className="w-4 h-4 mx-auto mb-1" />
                  Wieder
                </button>
                <button
                  onClick={() => handleRate('hard')}
                  className="py-3 bg-orange-100 text-orange-700 rounded-xl font-medium hover:bg-orange-200 
                           transition-colors text-sm"
                >
                  Schwer
                </button>
                <button
                  onClick={() => handleRate('good')}
                  className="py-3 bg-blue-100 text-blue-700 rounded-xl font-medium hover:bg-blue-200 
                           transition-colors text-sm"
                >
                  Gut
                </button>
                <button
                  onClick={() => handleRate('easy')}
                  className="py-3 bg-green-100 text-green-700 rounded-xl font-medium hover:bg-green-200 
                           transition-colors text-sm"
                >
                  <Check className="w-4 h-4 mx-auto mb-1" />
                  Einfach
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 px-2">
        <div className="flex gap-1">
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
    </div>
  );
};
