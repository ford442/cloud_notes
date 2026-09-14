import { db, STORE_NOTES_LIST } from './db';

const PROGRESS_KEY = 'flashcard_progress';

interface FlashcardProgress {
  interval: number;
  repetition: number;
  efactor: number;
  nextReview: number;
}

type ProgressMap = Record<string, Record<string, FlashcardProgress>>;

export async function getDueFlashcardsCount(): Promise<number> {
  try {
    const savedProgress = await db.get<ProgressMap>(STORE_NOTES_LIST, PROGRESS_KEY) || {};
    const now = Date.now();
    let dueCount = 0;

    // We don't parse all notes here, we just count based on saved progress.
    // If a card was deleted but progress remains, it might over-count slightly,
    // but this is a fast approximation for the sidebar badge.
    for (const noteId of Object.keys(savedProgress)) {
      for (const cardHash of Object.keys(savedProgress[noteId])) {
         if (savedProgress[noteId][cardHash].nextReview <= now) {
            dueCount++;
         }
      }
    }
    return dueCount;
  } catch (e) {
    console.warn("Failed to get due flashcards count:", e);
    return 0;
  }
}
