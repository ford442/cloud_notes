export interface Song {
  id: string;
  title: string;
  author: string;
  rating?: number;
  tags?: string[];
  play_count?: number;
}

export interface Playlist {
  id: string;
  title: string;
  description?: string;
  track_ids: string[];
  created_at: string;
  updated_at: string;
}

export function normalizeFlacApiUrl(rawUrl: string): string {
  const trimmed = rawUrl?.trim().replace(/\/+$|\/$/, '') || '';
  if (!trimmed) {
    if (typeof window !== 'undefined' && window.location.pathname.includes('/flac-player')) {
      return window.location.origin;
    }
    return '';
  }

  try {
    const url = new URL(trimmed);
    const cleanedPath = url.pathname.replace(/\/+$|\/$/, '');
    if (cleanedPath.toLowerCase().endsWith('/flac-player')) {
      url.pathname = '';
      url.search = '';
      url.hash = '';
    }
    return url.toString().replace(/\/$/, '');
  } catch {
    return trimmed;
  }
}

export function getFlacApiUrl(): string {
  const saved = localStorage.getItem('flac_api_url');
  if (saved) return normalizeFlacApiUrl(saved);
  return normalizeFlacApiUrl(localStorage.getItem('api_url') || 'https://storage.noahcohn.com');
}
