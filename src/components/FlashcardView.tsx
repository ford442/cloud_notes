import { useState, useEffect, useMemo } from 'react';
import { db, STORE_NOTES_LIST } from '../utils/db';
import type { CloudItemMeta } from '../services/api';
import { StorageService } from '../services/api';

const SM2_MIN_EASE = 1.3;
const SM2_AGAIN_EASE_DECREMENT = 0.20;
const SM2_HARD_EASE_DECREMENT = 0.15;
const SM2_EASY_EASE_INCREMENT = 0.15;
const SM2_EASY_INTERVAL_MULTIPLIER = 1.3;

function encodeFlashcardIdLegacy(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function encodeFlashcardId(value: string): string {
  // Stable identity: strip punctuation and lower case for resilience against minor typos
  const stableValue = value.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const bytes = new TextEncoder().encode(stableValue);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

interface FlashcardViewProps {
  notes: CloudItemMeta[];
  onClose: () => void;
}

interface Flashcard {
  id: string; // Hash of question + noteId
  question: string;
  answer: string;
  noteId: string;
  noteTitle: string; // Used for Deck filtering
}

interface ReviewData {
  nextReview: number; // Timestamp
  interval: number; // Days
  easeFactor: number;
}

type ProgressMap = Record<string, ReviewData>;

const PROGRESS_KEY = 'flashcards_progress';

export const FlashcardView = ({ notes, onClose }: FlashcardViewProps) => {
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDeck, setSelectedDeck] = useState<string>('All Decks');

  // Load progress and cards
  useEffect(() => {
    const load = async () => {
      // 1. Load progress
      const savedProgress = await db.get<ProgressMap>(STORE_NOTES_LIST, PROGRESS_KEY) || {};

      let progressMigrated = false;

      // 2. Scan notes
      const foundCards: Flashcard[] = [];

      // Iterate all notes and load content to find flashcards
      const promises = notes.map(async (n) => {
         try {
           const note = await StorageService.getNoteContent(n.id); // Tries cache first
           if (!note || !note.content) return;

           const blocks = note.content.split(/\n\s*\n/);

           const registerCard = (legacyRawId: string, q: string, a: string) => {
             const legacyId = encodeFlashcardIdLegacy(legacyRawId);
             const id = encodeFlashcardId(legacyRawId); // New stable ID

             // Migration check
             if (!savedProgress[id] && savedProgress[legacyId]) {
                savedProgress[id] = savedProgress[legacyId];
                delete savedProgress[legacyId];
                progressMigrated = true;
             }

             foundCards.push({ id, question: q, answer: a, noteId: n.id, noteTitle: n.name });
           };

           blocks.forEach(block => {
             if (block.trim().startsWith('|')) return;

             // 1. Check for Multi-line Q & A (Q: ... A: ...)
             const qMatch = block.match(/(?:^|\n)[Qq]:\s*([\s\S]+?)\n[Aa]:\s*([\s\S]+)$/);
             if (qMatch) {
               const q = qMatch[1].trim();
               const a = qMatch[2].trim();
               if (q && a) {
                 registerCard(`${n.id}-Multiline-${q}`, q, a);
               }
               return; // Skip line-by-line parsing if block matches Q/A
             }

             // 2. Line-by-line parsing for single-line Q::A and Cloze
             const lines = block.split('\n');
             lines.forEach(line => {
               if (!line.trim() || line.trim().startsWith('|')) return;

               // Check for Cloze Deletions (e.g. {{c1::Answer}})
               const clozeRegex = /{{c(\d+)::(.*?)}}/g;
               let match;
               const clozeIndices = new Set<string>();
               let hasCloze = false;

               while ((match = clozeRegex.exec(line)) !== null) {
                 hasCloze = true;
                 clozeIndices.add(match[1]);
               }

               if (hasCloze) {
                 for (const idx of clozeIndices) {
                   let qText = line;
                   let aText = '';

                   // Target cloze becomes [...]
                   const specificClozeRegex = new RegExp(`{{c${idx}::(.*?)}}`, 'g');
                   qText = qText.replace(specificClozeRegex, (_m, ans) => {
                     if (!aText) aText = ans;
                     return '[...]';
                   });

                   // Other clozes are revealed
                   const otherClozeRegex = /{{c\d+::(.*?)}}/g;
                   qText = qText.replace(otherClozeRegex, '$1');

                   const cleanQ = qText.replace(/^[-*+]\s+/, '').trim();
                   if (cleanQ && aText) {
                     registerCard(`${n.id}-${cleanQ}-${idx}`, cleanQ, aText.trim());
                   }
                 }
               } else if (line.includes('::')) {
                 // Classic Single-line Q :: A
                 const parts = line.split('::');
                 if (parts.length >= 2) {
                   const q = parts[0].trim();
                   const a = parts.slice(1).join('::').trim();
                   const cleanQ = q.replace(/^[-*+]\s+/, '').trim();

                   if (cleanQ && a) {
                     registerCard(`${n.id}-${cleanQ}`, cleanQ, a);
                   }
                 }
               }
             });
           });
         } catch (e) {
           console.warn(`Failed to scan note ${n.name}`, e);
         }
      });

      await Promise.all(promises);

      if (progressMigrated) {
          await db.set(STORE_NOTES_LIST, PROGRESS_KEY, savedProgress);
      }

      setProgress(savedProgress);
      setCards(foundCards);
      setIsLoading(false);
    };

    load();
  }, [notes]);

  // Filter due cards
  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter(c => {
      // 1. Filter by deck
      if (selectedDeck !== 'All Decks' && c.noteTitle !== selectedDeck) {
        return false;
      }
      // 2. Filter by due date
      const p = progress[c.id];
      if (!p) return true; // New card
      return p.nextReview <= now;
    });
  }, [cards, progress, selectedDeck]);

  const currentCard = dueCards[currentIndex];

  // Available Decks
  const decks = useMemo(() => {
    const uniqueDecks = new Set<string>();
    cards.forEach(c => uniqueDecks.add(c.noteTitle));
    return ['All Decks', ...Array.from(uniqueDecks).sort()];
  }, [cards]);

  const handleRate = async (rating: 'again' | 'hard' | 'good' | 'easy') => {
     if (!currentCard) return;

     const prev = progress[currentCard.id] || { nextReview: 0, interval: 0, easeFactor: 2.5 };
     let nextInterval = 1;
     let nextEase = prev.easeFactor;

     // SM-2 Algorithm refinement
     if (rating === 'again') {
       nextInterval = 1; // Review again tomorrow
       nextEase = Math.max(SM2_MIN_EASE, prev.easeFactor - SM2_AGAIN_EASE_DECREMENT);
     } else if (rating === 'hard') {
       nextInterval = Math.max(1, prev.interval * 1.2);
       nextEase = Math.max(SM2_MIN_EASE, prev.easeFactor - SM2_HARD_EASE_DECREMENT);
     } else if (rating === 'good') {
       nextInterval = Math.max(1, (prev.interval === 0 ? 1 : prev.interval) * 2.5);
     } else if (rating === 'easy') {
       nextInterval = Math.max(1, (prev.interval === 0 ? 1 : prev.interval) * prev.easeFactor * SM2_EASY_INTERVAL_MULTIPLIER);
       nextEase = prev.easeFactor + SM2_EASY_EASE_INCREMENT;
     }

     // Round to 1 decimal place for interval
     nextInterval = Math.round(nextInterval * 10) / 10;

     const nextReview = Date.now() + (nextInterval * 24 * 60 * 60 * 1000);

     const newProgress = {
       ...progress,
       [currentCard.id]: {
         nextReview,
         interval: nextInterval,
         easeFactor: nextEase
       }
     };

     setProgress(newProgress);
     await db.set(STORE_NOTES_LIST, PROGRESS_KEY, newProgress);

     setIsFlipped(false);
     setCurrentIndex(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-500 font-medium">Scanning notes for flashcards...</p>
      </div>
    );
  }

  if (!currentCard) {
     const deckCards = selectedDeck === 'All Decks' ? cards : cards.filter(c => c.noteTitle === selectedDeck);
     const totalProgressItems = Object.keys(progress).length;

     return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-8 text-center animate-in fade-in zoom-in duration-300 relative">
        {/* Deck Selector */}
        <div className="absolute top-6 left-6 z-10">
          <select
            value={selectedDeck}
            onChange={(e) => {
              setSelectedDeck(e.target.value);
              setCurrentIndex(0);
              setIsFlipped(false);
            }}
            className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-medium shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/50 transition-all"
          >
            {decks.map(deck => (
              <option key={deck} value={deck}>{deck}</option>
            ))}
          </select>
        </div>

        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">All Caught Up!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          You have reviewed all due flashcards. Check back tomorrow to keep your streak alive!
        </p>

        {/* Stats Panel */}
        <div className="flex gap-6 mb-8 text-slate-600 dark:text-slate-400 text-sm bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-inner border border-slate-200 dark:border-slate-700">
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg text-slate-800 dark:text-slate-200">{deckCards.length}</span>
            <span>Cards in Deck</span>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg text-green-500">0</span>
            <span>Due Today</span>
          </div>
          <div className="w-px bg-slate-200 dark:bg-slate-700"></div>
          <div className="flex flex-col items-center">
            <span className="font-bold text-lg text-blue-500">{totalProgressItems}</span>
            <span>Cards Reviewed</span>
          </div>
        </div>

        <button onClick={onClose} className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-bold">
          Back to Notes
        </button>
      </div>
     );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-8 relative">
       <button onClick={onClose} className="absolute top-6 right-6 p-2 bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all z-10">
         <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
       </button>

       {/* Deck Selector */}
       <div className="absolute top-6 left-6 z-10">
         <select
           value={selectedDeck}
           onChange={(e) => {
             setSelectedDeck(e.target.value);
             setCurrentIndex(0);
             setIsFlipped(false);
           }}
           className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 font-medium shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-blue-500/50 transition-all"
         >
           {decks.map(deck => (
             <option key={deck} value={deck}>{deck}</option>
           ))}
         </select>
       </div>

       <div className="w-full max-w-2xl perspective-1000">
         <div
           className={`relative w-full min-h-[400px] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
           onClick={() => !isFlipped && setIsFlipped(true)}
           style={{ transformStyle: 'preserve-3d' }}
         >
            {/* Front */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 backface-hidden ${isFlipped ? 'invisible' : ''}`} style={{ backfaceVisibility: 'hidden' }}>
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Question</div>
                 <div className="text-3xl md:text-4xl font-serif text-slate-800 dark:text-slate-100 font-medium leading-relaxed whitespace-pre-wrap text-center w-full max-h-64 overflow-y-auto">
                   {currentCard.question}
                 </div>
                 <div className="absolute bottom-8 text-slate-400 text-sm animate-pulse">Click to Reveal</div>
            </div>

            {/* Back */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 backface-hidden rotate-y-180 ${!isFlipped ? 'invisible' : ''}`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                 <div className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-8">Answer</div>
                 <div className="text-2xl md:text-3xl font-serif text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap text-center w-full max-h-64 overflow-y-auto">
                   {currentCard.answer}
                 </div>
            </div>
         </div>
       </div>

       {isFlipped && (
         <div className="mt-12 flex gap-4 animate-in fade-in slide-in-from-bottom-4">
           <button onClick={() => handleRate('again')} className="px-6 py-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors">
             Again
           </button>
           <button onClick={() => handleRate('hard')} className="px-6 py-3 bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-xl font-semibold hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors">
             Hard
           </button>
           <button onClick={() => handleRate('good')} className="px-6 py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
             Good
           </button>
           <button onClick={() => handleRate('easy')} className="px-6 py-3 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-xl font-semibold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
             Easy
           </button>
         </div>
       )}

       <div className="absolute bottom-8 text-slate-400 text-sm">
         Card {currentIndex + 1} of {dueCards.length}
       </div>
    </div>
  );
};

export async function getDueFlashcardsCount(): Promise<number> {
  try {
    const savedProgress = await db.get<ProgressMap>(STORE_NOTES_LIST, PROGRESS_KEY) || {};
    const now = Date.now();
    let dueCount = 0;

    for (const key in savedProgress) {
      if (savedProgress[key].nextReview <= now) {
        dueCount++;
      }
    }

    return dueCount;
  } catch (e) {
    console.error("Failed to get due flashcards count", e);
    return 0;
  }
}
