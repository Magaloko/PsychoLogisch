import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Users, X } from 'lucide-react';
import type { FlashcardData } from './Flashcard';

interface PersonGalleryProps {
  cards: FlashcardData[];
  onSelectPerson: (cardId: string) => void;
}

interface PersonInfo {
  card: FlashcardData;
  name: string;
  initials: string;
  years: string | null;
  contribution: string;
  era: string;
  color: string;
}

// Curated psychologist whitelist (lowercase). Add new names here when introducing cards.
const PSYCHOLOGIST_NAMES = new Set([
  // Antike & Vormoderne
  'platon', 'aristoteles', 'hippokrates', 'galen', 'descartes', 'spinoza',
  // Frühe wissenschaftliche Psychologie
  'wundt', 'fechner', 'helmholtz', 'ebbinghaus', 'titchener', 'james',
  // Behavioristen
  'pawlow', 'thorndike', 'watson', 'skinner', 'tolman',
  // Tiefenpsychologie
  'freud', 'jung', 'adler', 'horney', 'fromm',
  // Gestalt & Wahrnehmung
  'wertheimer', 'köhler', 'koffka', 'lewin', 'gibson', 'marr',
  // Neurowissenschaft & klassische Fälle
  'broca', 'wernicke', 'gage', 'milner',
  // Kognitive Wende & Gedächtnis
  'miller', 'chomsky', 'newell', 'simon', 'broadbent', 'treisman',
  'atkinson', 'shiffrin', 'baddeley', 'tulving', 'craik', 'lockhart',
  'sperling', 'loftus',
  // Denken & Entscheidung
  'kahneman', 'tversky', 'wason',
  // Entwicklungspsychologie
  'piaget', 'vygotsky', 'kohlberg', 'erikson', 'marcia', 'bowlby',
  'ainsworth', 'harlow', 'bronfenbrenner', 'wimmer', 'perner',
  // Sozialpsychologie
  'asch', 'milgram', 'zimbardo', 'sherif', 'tajfel', 'moscovici',
  'festinger', 'janis', 'bargh', 'ross', 'batson', 'latane', 'darley',
  'dollard', 'berkowitz', 'bandura',
  // Persönlichkeit
  'allport', 'cattell', 'eysenck', 'costa', 'mccrae', 'mischel',
  'ashton', 'lee', 'rotter', 'maslow', 'rogers', 'murray', 'rorschach',
]);

// Color palette: deterministic per-name pick for consistent avatar tinting
const AVATAR_COLORS = [
  'from-rose-500 to-pink-600',
  'from-orange-500 to-red-600',
  'from-amber-500 to-orange-600',
  'from-yellow-500 to-amber-600',
  'from-lime-500 to-green-600',
  'from-emerald-500 to-teal-600',
  'from-teal-500 to-cyan-600',
  'from-sky-500 to-blue-600',
  'from-indigo-500 to-purple-600',
  'from-violet-500 to-fuchsia-600',
  'from-fuchsia-500 to-pink-600',
];

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
};

// Extract person name from "Wundt: ..." or "Erikson: ..." or "Patient 'Tan'..." patterns
const extractName = (card: FlashcardData): string => {
  // Try: First token before colon, special cases first
  const front = card.front;
  // "William James: ..." → "William James"
  const colon = front.match(/^([A-ZÄÖÜ][a-zäöüß'\-.]+(?:\s+[A-ZÄÖÜ][a-zäöüß'\-.]+){0,2})\s*[:(]/);
  if (colon) return colon[1].trim();
  // "Watson & Rayner (1920)" or "Bowlby/Ainsworth"
  const dual = front.match(/^([A-ZÄÖÜ][a-zäöüß'\-]+(?:\s*[&/]\s*[A-ZÄÖÜ][a-zäöüß'\-]+)+)/);
  if (dual) return dual[1].trim();
  // "Patient H.M. (Henry Molaison)..."
  const patient = front.match(/Patient\s+['"]?([A-ZÄÖÜa-z.\s]+?)['"]?\s*[(.,]/);
  if (patient) return `Patient ${patient[1].trim()}`;
  // Fallback: first 1-3 capitalized words
  const generic = front.match(/^([A-ZÄÖÜ][a-zäöüß'\-]+(?:\s+[A-ZÄÖÜ][a-zäöüß'\-]+){0,2})/);
  if (generic) return generic[1].trim();
  return card.chapter_title;
};

const extractYears = (card: FlashcardData): string | null => {
  const text = `${card.front} ${card.back} ${card.back_extended ?? ''}`;
  // Lebensdaten: "Galen (129-199 n.Chr.)" or "(1822–1893)"
  const range = text.match(/\(?\s*(\d{3,4})\s*[-–—]\s*(\d{3,4})(?:\s*(v\.?\s*Chr\.?|n\.?\s*Chr\.?))?/);
  if (range) {
    return `${range[1]}–${range[2]}${range[3] ? ' ' + range[3] : ''}`;
  }
  // Einzelnes wichtiges Jahr "1879" oder "1956"
  const single = text.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  if (single) return single[1];
  return null;
};

const extractContribution = (card: FlashcardData): string => {
  // Take first sentence/clause of back, max 120 chars
  const text = card.back.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  const firstSentence = text.match(/^[^.!?•]+/);
  let s = (firstSentence ? firstSentence[0] : text).trim();
  if (s.length > 120) s = s.slice(0, 117).trim() + '…';
  return s;
};

const detectEra = (years: string | null): string => {
  if (!years) return 'Unbekannt';
  const yearMatch = years.match(/(\d{3,4})/);
  if (!yearMatch) return 'Unbekannt';
  const y = Number(yearMatch[1]);
  if (years.includes('v.Chr')) return 'Antike';
  if (y < 1700) return 'Vormodern';
  if (y < 1900) return '19. Jh.';
  if (y < 1950) return 'Frühes 20. Jh.';
  if (y < 2000) return 'Spätes 20. Jh.';
  return 'Gegenwart';
};

const buildPerson = (card: FlashcardData): PersonInfo => {
  const name = extractName(card);
  const initials = name
    .split(/\s+/)
    .filter((p) => p.length > 0)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const years = extractYears(card);
  return {
    card,
    name,
    initials,
    years,
    contribution: extractContribution(card),
    era: detectEra(years),
    color: AVATAR_COLORS[hashString(name) % AVATAR_COLORS.length],
  };
};

export default function PersonGallery({ cards, onSelectPerson }: PersonGalleryProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');

  // Extract person cards: explicit type 'person' + concept cards starting with a name
  // from our curated psychologist whitelist (robust against generic concept names like
  // "Aktionspotenzial:" or "Ruhepotenzial:").
  const persons = useMemo(() => {
    const personCards = cards.filter((c) => c.card_type === 'person');

    const conceptPersonCards = cards.filter((c) => {
      if (c.card_type !== 'concept') return false;
      // First token before colon, dash or paren
      const m = c.front.match(/^([A-ZÄÖÜ][a-zäöüß'\-.]+)/);
      if (!m) return false;
      const first = m[1].toLowerCase().replace(/\.$/, '');
      if (!PSYCHOLOGIST_NAMES.has(first)) return false;
      // Also require it really is a "Name:" / "Name (year):" / "Name & Other" pattern, not just
      // a sentence beginning with a name
      return /^[A-ZÄÖÜ][a-zäöüß'\-.]+(?:\s*[&/]\s*[A-ZÄÖÜ][a-zäöüß'\-.]+)?(?:\s+\(\d{4}\)?\)?)?\s*[:(]/.test(c.front);
    });

    const seen = new Set<string>();
    const all = [...personCards, ...conceptPersonCards].map(buildPerson).filter((p) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return all.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  }, [cards]);

  const eras = useMemo(() => {
    const set = new Set(persons.map((p) => p.era));
    return Array.from(set);
  }, [persons]);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return persons.filter((p) => {
      if (filter !== 'all' && p.era !== filter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.contribution.toLowerCase().includes(q) ||
        (p.card.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [persons, query, filter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-slate-100">
            <Users className="h-5 w-5 text-teal-600" />
            Wichtige Personen der Psychologie
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {persons.length} Persönlichkeiten · Klick öffnet die Karteikarte
          </p>
        </div>
      </div>

      {/* Search + era filter */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, Theorie oder Stichwort suchen…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-teal-400"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === 'all'
                ? 'bg-teal-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
            }`}
          >
            Alle
          </button>
          {eras.map((e) => (
            <button
              key={e}
              onClick={() => setFilter(e)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === e
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
              }`}
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
          Keine Treffer für „{query}".
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p, i) => (
            <motion.button
              key={p.card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.03, type: 'spring', stiffness: 200, damping: 24 }}
              whileHover={{ y: -3 }}
              onClick={() => onSelectPerson(p.card.id)}
              className="group flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-teal-500/40 dark:hover:bg-teal-500/5"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${p.color} text-base font-bold text-white shadow-md`}
              >
                {p.initials}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <h3 className="truncate font-bold text-slate-900 dark:text-slate-100 group-hover:text-teal-700 dark:group-hover:text-teal-300">
                    {p.name}
                  </h3>
                  {p.years && (
                    <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      {p.years}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {p.card.chapter_title}
                  {p.card.exam_relevant && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
                      ⭐ EXAM
                    </span>
                  )}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-slate-600 dark:text-slate-300 line-clamp-3">
                  {p.contribution}
                </p>
                {p.card.tags && p.card.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {p.card.tags.slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
}
