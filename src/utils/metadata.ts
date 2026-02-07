import { extractInternalLinks } from './backlinks';
import { extractKeywords } from './keywords';

export interface NoteMetadataInput {
  subject?: string;
  section?: string;
  tags?: string;
  content: string;
}

/**
 * Creates a packed description string for a note, containing:
 * Subject ::: Section ::: Tags ::: Links ::: Keywords
 *
 * This format allows the UI to efficiently parse metadata without loading full content.
 */
export const createPackedDescription = (note: NoteMetadataInput): string => {
  // Extract backlinks from content
  const links = extractInternalLinks(note.content);
  const linksStr = links.join('|');

  // Extract keywords from content
  const keywords = extractKeywords(note.content);
  const keywordsStr = keywords.join(' ');

  // Format: Subject ::: Section ::: Tags ::: Links ::: Keywords
  let packedDesc = `${note.subject || 'General'} ::: ${note.section || 'Inbox'} ::: ${note.tags || ''}`;

  packedDesc += ` ::: ${linksStr}`; // Index 3
  packedDesc += ` ::: ${keywordsStr}`; // Index 4

  return packedDesc;
};
