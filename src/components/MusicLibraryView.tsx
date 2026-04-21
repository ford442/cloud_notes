import { useState, useEffect } from 'react';
import { useToast } from './Toast';

interface Song {
  id: string;
  title: string;
  author: string;
  rating: number;
  tags: string[];
  play_count: number;
}

interface MusicLibraryViewProps {
  onClose: () => void;
}

function normalizeFlacApiUrl(rawUrl: string): string {
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

function getFlacApiUrl(): string {
  return normalizeFlacApiUrl(localStorage.getItem('flac_api_url') || '');
}

export const MusicLibraryView = ({ onClose }: MusicLibraryViewProps) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Song>>({});
  const { addToast } = useToast();

  const flacApiUrl = getFlacApiUrl();

  useEffect(() => {
    fetchSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchSongs = async () => {
    if (!flacApiUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${flacApiUrl}/api/songs?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setSongs(Array.isArray(data) ? data : []);
      } else {
        addToast('Failed to fetch songs from FLAC backend', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch songs:', error);
      addToast('Failed to connect to FLAC backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (song: Song) => {
    setEditingId(song.id);
    setEditForm({ ...song });
  };

  const saveEdit = async (id: string) => {
    if (!flacApiUrl) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/songs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          author: editForm.author,
          rating: editForm.rating,
          tags: editForm.tags,
        })
      });

      if (res.ok) {
        setSongs(songs.map(s => s.id === id ? { ...s, ...editForm } : s));
        setEditingId(null);
        addToast('Song updated successfully', 'success');
      } else {
        addToast('Failed to update song', 'error');
      }
    } catch (error) {
      console.error('Failed to update song:', error);
      addToast('Failed to update song', 'error');
    }
  };

  const deleteSong = async (id: string) => {
    if (!flacApiUrl) return;
    if (!confirm('Are you sure you want to delete this track?')) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/songs/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSongs(songs.filter(s => s.id !== id));
        addToast('Song deleted', 'success');
      } else {
        addToast('Failed to delete song', 'error');
      }
    } catch (error) {
      console.error('Failed to delete song:', error);
      addToast('Failed to delete song', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-500 font-medium">Loading Music Library...</p>
      </div>
    );
  }

  if (!flacApiUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 text-center">
        <div className="text-6xl mb-6">🎵</div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Music Library</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md mx-auto">
          Please configure your FLAC Player API URL in Settings → Integrations to manage your music library.
        </p>
        <button
          onClick={onClose}
          className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl shadow-xl hover:shadow-2xl hover:scale-105 transition-all font-bold"
        >
          Back to Notes
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-8 overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <span className="text-blue-500">🎵</span> Music Library Manager
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Managing <strong>{songs.length}</strong> tracks from your FLAC backend.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchSongs}
            className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-500 hover:text-blue-500 transition-all"
            title="Refresh"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={onClose}
            className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-all"
            title="Close"
          >
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        {songs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="text-6xl mb-4">🎶</div>
            <p className="text-xl">No tracks found.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Title</th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Artist</th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 w-24">Rating</th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Tags</th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((song) => (
                <tr
                  key={song.id}
                  className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  {editingId === song.id ? (
                    <>
                      <td className="p-4">
                        <input
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-full text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={editForm.title || ''}
                          onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                        />
                      </td>
                      <td className="p-4">
                        <input
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-full text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={editForm.author || ''}
                          onChange={e => setEditForm({ ...editForm, author: e.target.value })}
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          min={0}
                          max={10}
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-20 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={editForm.rating || 0}
                          onChange={e => setEditForm({ ...editForm, rating: parseInt(e.target.value) || 0 })}
                        />
                      </td>
                      <td className="p-4">
                        <input
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-full text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          value={editForm.tags?.join(', ') || ''}
                          onChange={e => setEditForm({ ...editForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })}
                          placeholder="chill, upbeat..."
                        />
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => saveEdit(song.id)}
                          className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium mr-3"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {song.title || 'Unknown Title'}
                      </td>
                      <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                        {song.author || 'Unknown Artist'}
                      </td>
                      <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                        {song.rating ? `${song.rating}/10` : '-'}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {song.tags?.map(tag => (
                            <span
                              key={tag}
                              className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => startEdit(song)}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium mr-3"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => deleteSong(song.id)}
                          className="inline-flex items-center gap-1 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm font-medium"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
