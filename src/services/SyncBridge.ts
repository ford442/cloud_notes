import { StorageService } from './api';
import type { CloudItemMeta } from './api';
import { vpsStorageAPI } from './vpsStorageAPI';
import type { VpsNoteMeta } from './vpsStorageAPI';

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

    // 2. Fetch from the new VPS network and legacy network
    let vpsNotes: VpsNoteMeta[] = [];
    try {
      vpsNotes = await vpsStorageAPI.listNotes();
      isRemoteFetchSuccessful = true;
    } catch (e) {
      console.warn('[SyncBridge] Failed to fetch notes from VPS', e);
    }

    try {
      // Fetch from the actual network (legacy HF/FTP API) (tell it to skip updating the cache so we can merge first)
      const legacyNotes = await StorageService.getNotes(true);
      freshNotes = legacyNotes;
      if (legacyNotes.length > 0) isRemoteFetchSuccessful = true;
    } catch (e) {
      console.warn('[SyncBridge] Failed to fetch fresh notes from legacy server', e);
      // We don't overwrite freshNotes to [] if vpsNotes was successfully populated,
      // but freshNotes is already the legacy notes.
    }

    // 3. Merging logic (The Safety Valve)
    const mergedMap = new Map<string, CloudItemMeta>();
    let protectedCount = 0;

    // Start with the fresh server truth (legacy)
    for (const fresh of freshNotes) {
      mergedMap.set(fresh.id, fresh);
    }

    // Merge VPS notes on top (preferring them as they are the new source of truth)
    // VPS notes might have a different format, but we try to construct CloudItemMeta
    // Note: VpsNoteMeta doesn't have an ID. We will use the filename as an ID if needed,
    // but the best way is to map them or merge them carefully.
    for (const vpsNote of vpsNotes) {
        // vpsNote.name is the filename e.g., "my-note.md"
        // Let's try to find an existing note or synthesize one.
        const existingNoteId = Array.from(mergedMap.keys()).find(k => {
           const meta = mergedMap.get(k);
           return meta && (meta.id === vpsNote.name || meta.id === vpsNote.name.replace('.md', '') || meta.name === vpsNote.name.replace('.md', ''));
        });

        if (existingNoteId) {
            // Update existing
            const existing = mergedMap.get(existingNoteId)!;
            // Assuming VPS is newer or preferred
            mergedMap.set(existingNoteId, {
                ...existing,
                // Ideally we'd use updated_at, but we'll prefer VPS if present
                date: vpsNote.updated_at || existing.date
            });
        } else {
            // It's a completely new note from VPS not in legacy
            const newId = vpsNote.name.replace('.md', ''); // Fallback ID
            mergedMap.set(newId, {
                id: newId,
                name: vpsNote.name.replace('.md', ''),
                author: 'VPS', // Unknown
                date: vpsNote.updated_at,
                type: 'note',
                description: ''
            });
        }
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
