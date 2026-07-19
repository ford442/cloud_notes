import { useState, useEffect, useMemo } from 'react';
import { db, STORE_NOTES_LIST } from '../utils/db';
import type { CloudItemMeta } from '../services/api';
import { StorageService } from '../services/api';

const SM2_MIN_EASE = 1.3;
const SM2_AGAIN_EASE_DECREMENT = 0.20;
const SM2_HARD_EASE_DECREMENT = 0.15;
const SM2_EASY_EASE_INCREMENT = 0.15;
const SM2_EASY_INTERVAL_MULTIPLIER = 1.3;

function encodeFlashcardId(value: string): string {
  const bytes = new TextEncoder().encode(value);
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

  // Load progress and cards
  useEffect(() => {
    const load = async () => {
      // 1. Load progress
      const savedProgress = await db.get<ProgressMap>(STORE_NOTES_LIST, PROGRESS_KEY) || {};
      setProgress(savedProgress);

      // 2. Scan notes
      const foundCards: Flashcard[] = [];

      // Iterate all notes and load content to find flashcards
      const promises = notes.map(async (n) => {
         try {
           const note = await StorageService.getNoteContent(n.id); // Tries cache first
           if (!note || !note.content) return;

           // Robust parser for Question :: Answer
           // Also handles basic multi-line answers if we eventually support them,
           // but for now sticks to robust single-line parsing that ignores markdown table separators.
           const lines = note.content.split('\n');
           lines.forEach(line => {
             // Skip markdown tables or empty lines
             if (!line.trim() || line.trim().startsWith('|')) return;

             if (line.includes('::')) {
               const parts = line.split('::');
               if (parts.length >= 2) {
                 const q = parts[0].trim();
                 // Rejoin remaining parts in case the answer contains "::"
                 const a = parts.slice(1).join('::').trim();

                 // Remove markdown list prefixes if present (e.g. "- Q :: A")
                 const cleanQ = q.replace(/^[-*+]\s+/, '').trim();

                 if (cleanQ && a) {
                   const id = encodeFlashcardId(`${n.id}-${cleanQ}`);
                   foundCards.push({ id, question: cleanQ, answer: a, noteId: n.id });
                 }
               }
             }
           });
         } catch (e) {
           console.warn(`Failed to scan note ${n.name}`, e);
         }
      });

      await Promise.all(promises);
      setCards(foundCards);
      setIsLoading(false);
    };

    load();
  }, [notes]);

  // Filter due cards
  const dueCards = useMemo(() => {
    const now = Date.now();
    return cards.filter(c => {
      const p = progress[c.id];
      if (!p) return true; // New card
      return p.nextReview <= now;
    });
  }, [cards, progress]);

  const currentCard = dueCards[currentIndex];

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
     return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 p-8 text-center animate-in fade-in zoom-in duration-300">
        <div className="text-6xl mb-6">🎉</div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">All Caught Up!</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          You have reviewed all due flashcards. Check back tomorrow to keep your streak alive!
        </p>
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

       <div className="w-full max-w-2xl perspective-1000">
         <div
           className={`relative w-full min-h-[400px] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-12 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-500 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}
           onClick={() => !isFlipped && setIsFlipped(true)}
           style={{ transformStyle: 'preserve-3d' }}
         >
            {/* Front */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 backface-hidden ${isFlipped ? 'invisible' : ''}`} style={{ backfaceVisibility: 'hidden' }}>
                 <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">Question</div>
                 <div className="text-3xl md:text-4xl font-serif text-slate-800 dark:text-slate-100 font-medium leading-relaxed">
                   {currentCard.question}
                 </div>
                 <div className="absolute bottom-8 text-slate-400 text-sm animate-pulse">Click to Reveal</div>
            </div>

            {/* Back */}
            <div className={`absolute inset-0 flex flex-col items-center justify-center p-12 backface-hidden rotate-y-180 ${!isFlipped ? 'invisible' : ''}`} style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                 <div className="text-xs font-bold text-purple-500 uppercase tracking-widest mb-8">Answer</div>
                 <div className="text-2xl md:text-3xl font-serif text-slate-700 dark:text-slate-200 leading-relaxed">
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
