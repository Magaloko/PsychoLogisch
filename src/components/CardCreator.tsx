import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import type { FlashcardData } from './Flashcard';

interface CardCreatorProps {
  chapters: [string, string][];      // [key, title]
  existingIds: Set<string>;
  onClose: () => void;
  onSave: (card: FlashcardData) => void;
}

const CARD_TYPES: FlashcardData['card_type'][] = ['definition', 'concept', 'person', 'formula', 'image', 'list', 'comparison'];
const TYPE_LABELS: Record<FlashcardData['card_type'], string> = {
  definition: 'Definition', concept: 'Konzept', person: 'Person',
  formula: 'Formel', image: 'Bild', list: 'Liste', comparison: 'Vergleich',
};

export default function CardCreator({ chapters, existingIds, onClose, onSave }: CardCreatorProps) {
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [backExtended, setBackExtended] = useState('');
  const [chapterKey, setChapterKey] = useState(chapters[0]?.[0] ?? '1');
  const [cardType, setCardType] = useState<FlashcardData['card_type']>('definition');
  const [difficulty, setDifficulty] = useState(2);
  const [examRelevant, setExamRelevant] = useState(false);
  const [tagsRaw, setTagsRaw] = useState('');
  const [formula, setFormula] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const chapterTitle = chapters.find(([k]) => k === chapterKey)?.[1] ?? `Kapitel ${chapterKey}`;

  const handleSave = () => {
    if (!front.trim()) { setError('Die Vorderseite darf nicht leer sein.'); return; }
    if (!back.trim())  { setError('Die Rückseite darf nicht leer sein.'); return; }

    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    let id = `custom-${Date.now()}`;
    while (existingIds.has(id)) id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const card: FlashcardData = {
      id,
      chapter_id: chapterKey,
      chapter_title: chapterTitle,
      card_type: cardType,
      front: front.trim(),
      back: back.trim(),
      back_extended: backExtended.trim() || undefined,
      formula: formula.trim() || undefined,
      exam_relevant: examRelevant,
      difficulty,
      tags,
      source: 'Eigene Karte',
    };

    onSave(card);
    setSaved(true);
    setTimeout(() => {
      setFront(''); setBack(''); setBackExtended(''); setFormula('');
      setTagsRaw(''); setExamRelevant(false); setDifficulty(2); setSaved(false); setError('');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50"
      onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 dark:border-slate-700 bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-teal-600" />
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Eigene Karte erstellen</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:text-slate-300">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Chapter + Type */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Kapitel</span>
              <select value={chapterKey} onChange={e => setChapterKey(e.target.value)}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-teal-500">
                {chapters.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Typ</span>
              <select value={cardType} onChange={e => setCardType(e.target.value as FlashcardData['card_type'])}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-teal-500">
                {CARD_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
              </select>
            </label>
          </div>

          {/* Front */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Vorderseite <span className="text-red-400">*</span>
            </span>
            <textarea
              value={front} onChange={e => setFront(e.target.value)} rows={2}
              placeholder="Begriff, Frage oder Konzept…"
              className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          {/* Back */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Rückseite <span className="text-red-400">*</span>
            </span>
            <textarea
              value={back} onChange={e => setBack(e.target.value)} rows={3}
              placeholder="Antwort, Definition oder Erklärung…"
              className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          {/* Back Extended (collapsible) */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Erweiterte Erklärung (optional)</span>
            <textarea
              value={backExtended} onChange={e => setBackExtended(e.target.value)} rows={2}
              placeholder="Zusätzlicher Kontext, erscheint hinter 'Mehr erfahren'…"
              className="w-full resize-none rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          {/* Formula — only shown for formula type */}
          <AnimatePresence>
            {cardType === 'formula' && (
              <motion.label
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="block overflow-hidden"
              >
                <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Formel</span>
                <input
                  type="text" value={formula} onChange={e => setFormula(e.target.value)}
                  placeholder="z. B. y = mx + b"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 font-mono text-sm outline-none focus:border-teal-500"
                />
              </motion.label>
            )}
          </AnimatePresence>

          {/* Tags */}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Tags (kommagetrennt)</span>
            <input
              type="text" value={tagsRaw} onChange={e => setTagsRaw(e.target.value)}
              placeholder="z. B. gedächtnis, lernen, klassiker"
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          {/* Difficulty + Exam relevant */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Schwierigkeit</p>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button" onClick={() => setDifficulty(n)}
                    className={`text-lg leading-none transition-transform hover:scale-110 ${n <= difficulty ? 'opacity-100' : 'opacity-25'}`}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={examRelevant} onChange={e => setExamRelevant(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Prüfungsrelevant</span>
            </label>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-lg bg-red-50 dark:bg-red-500/15 px-3 py-2 text-sm text-red-700">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <motion.button
              onClick={handleSave}
              whileTap={{ scale: 0.97 }}
              className={`flex-1 rounded-xl py-3 text-sm font-semibold transition-colors ${
                saved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-teal-600 text-white hover:bg-teal-700'
              }`}
            >
              {saved ? '✓ Karte gespeichert!' : 'Karte speichern'}
            </motion.button>
            <button onClick={onClose}
              className="rounded-xl bg-slate-100 dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200">
              Fertig
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
