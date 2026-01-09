import type { CloudItemMeta } from '../services/api';

// Extract [Title](UUID) links from Markdown content
export const extractInternalLinks = (content: string): string[] => {
  if (!content) return [];

  // Regex to match [Title](UUID)
  const regex = /\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match;

  while ((match = regex.exec(content)) !== null) {
    const href = match[2];
    // Filter out external links (http/https)
    // We assume anything else is an internal ID
    if (!href.startsWith('http://') && !href.startsWith('https://')) {
       links.push(href);
    }
  }

  // Return unique IDs
  return [...new Set(links)];
};

export const getBacklinks = (allNotes: CloudItemMeta[], currentId: string): CloudItemMeta[] => {
  if (!currentId) return [];

  return allNotes.filter(note => {
    // Description format: Subject ::: Section ::: Tags ::: Link1|Link2
    const parts = (note.description || '').split(' ::: ');
    if (parts.length < 4) return false;

    const linksStr = parts[3];
    if (!linksStr) return false;

    const links = linksStr.split('|');
    return links.includes(currentId);
  });
};
