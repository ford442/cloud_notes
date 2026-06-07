import { StorageService } from './api';
import type { CloudItemMeta } from './api';

export class SyncBridge {
  /**
   * Safely fetches notes by merging the local cache with the remote response.
   * This is a "Safety Valve" - if the backend returns an empty list or fails,
   * we never discard notes that exist locally but are missing from the server.
   *
   * @param skipCacheUpdate Whether to skip updating the local cache inside api.ts (we handle it here instead).
   */
  static async safeGetNotes(skipCacheUpdate = false): Promise<{
    notes: CloudItemMeta[];
    protectedCount: number;
    synced: boolean;
  }> {
    // 1. Instant load from local cache
    const cachedNotes = await StorageService.getCachedNotes();

    let freshNotes: CloudItemMeta[] = [];
    let isRemoteFetchSuccessful = false;

    try {
      // 2. Fetch from the actual network (tell it to skip updating the cache so we can merge first)
      freshNotes = await StorageService.getNotes(true);

      // If the backend returned items (or we successfully reached the backend but it was intentionally empty)
      // We assume it's successful. Note: if the server is offline, getNotes catches and returns cachedNotes anyway.
      // But we can check if it returned a genuine fresh list.
      isRemoteFetchSuccessful = true;
    } catch (e) {
      console.warn('[SyncBridge] Failed to fetch fresh notes from server', e);
      freshNotes = [];
    }

    // 3. Merging logic (The Safety Valve)
    const mergedMap = new Map<string, CloudItemMeta>();
    let protectedCount = 0;

    // Start with the fresh server truth
    for (const fresh of freshNotes) {
      mergedMap.set(fresh.id, fresh);
    }

    // Now look at our local cache. If we have a note that the server doesn't,
    // protect it and keep it.
    for (const cached of cachedNotes) {
      if (!mergedMap.has(cached.id)) {
        // Protect this note! It exists locally but not on the server.
        // It could be an offline-created note, or the server is just glitching.
        mergedMap.set(cached.id, cached);
        protectedCount++;
      }
    }

    // Sort the merged notes (newest first, based on date)
    const mergedNotes = Array.from(mergedMap.values()).sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });

    // 4. If we didn't explicitly ask to skip cache updates, save this merged state
    // back to the local database to fix the flake.
    if (!skipCacheUpdate) {
        try {
            const { db, STORE_NOTES_LIST, CACHE_KEYS } = await import('../utils/db');
            await db.set(STORE_NOTES_LIST, CACHE_KEYS.ALL_NOTES, mergedNotes);
        } catch (e) {
            console.warn('[SyncBridge] Failed to write merged notes back to cache', e);
        }
    }

    return {
      notes: mergedNotes,
      protectedCount,
      synced: isRemoteFetchSuccessful
    };
  }
}
