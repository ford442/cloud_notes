import { db, STORE_BACKLINKS } from '../utils/db';

export interface BacklinkEntry {
  sourceId: string;
  sourceName: string;
}

export const BacklinkService = {
  /**
   * Parse content for [[Note Name]] links and update the store.
   * targetIdentifier acts as the key in STORE_BACKLINKS, mapping to an array of BacklinkEntry.
   */
  async updateBacklinks(sourceId: string, sourceName: string, content: string) {
    if (content === undefined || content === null) return;

    // Find all links: [[Target Name]]
    const linkRegex = /(?:\[\[)([^\]]+)(?:\]\])/g;
    const targets = new Set<string>();
    let match;
    while ((match = linkRegex.exec(content)) !== null) {
      if (match[1] && match[1].trim()) {
        targets.add(match[1].trim());
      }
    }

    try {
      // For simplicity in MVP, we iterate over all current backlinks to remove old references from this source,
      // then we add the new references.
      const allBacklinks = await db.getAll<BacklinkEntry[]>(STORE_BACKLINKS);

      for (const item of allBacklinks) {
        const targetIdentifier = item.key;
        const entries = item.value;

        // Remove old entries from this source
        const updatedEntries = entries.filter(e => e.sourceId !== sourceId);
        let hasChanges = updatedEntries.length !== entries.length;

        // Add back if it's still a target (and use potentially updated sourceName)
        if (targets.has(targetIdentifier)) {
          updatedEntries.push({ sourceId, sourceName });
          targets.delete(targetIdentifier); // Mark as processed
          hasChanges = true;
        }

        if (hasChanges) {
          if (updatedEntries.length === 0) {
            await db.del(STORE_BACKLINKS, targetIdentifier);
          } else {
            await db.set(STORE_BACKLINKS, targetIdentifier, updatedEntries);
          }
        }
      }

      // Add remaining targets that didn't exist in the store yet
      for (const target of targets) {
        await db.set(STORE_BACKLINKS, target, [{ sourceId, sourceName }]);
      }
    } catch (e) {
      console.error('[BacklinkService] Failed to update backlinks:', e);
    }
  },

  async removeLinks(sourceId: string) {
    try {
      const allBacklinks = await db.getAll<BacklinkEntry[]>(STORE_BACKLINKS);
      for (const item of allBacklinks) {
        const entries = item.value;
        const updatedEntries = entries.filter(e => e.sourceId !== sourceId);
        if (updatedEntries.length !== entries.length) {
          if (updatedEntries.length === 0) {
            await db.del(STORE_BACKLINKS, item.key);
          } else {
            await db.set(STORE_BACKLINKS, item.key, updatedEntries);
          }
        }
      }
    } catch (e) {
      console.error('[BacklinkService] Failed to remove links:', e);
    }
  },

  async getBacklinks(targetNameOrId: string): Promise<BacklinkEntry[]> {
    try {
      const entries = await db.get<BacklinkEntry[]>(STORE_BACKLINKS, targetNameOrId);
      return entries || [];
    } catch (e) {
      console.error('[BacklinkService] Failed to get backlinks:', e);
      return [];
    }
  }
};
