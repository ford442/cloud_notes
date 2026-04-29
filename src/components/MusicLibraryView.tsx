import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from './Toast';
import { getFlacApiUrl } from '../utils/flac';
import type { Song } from '../utils/flac';
import { PluginRegistry } from '../services/plugin';

interface MusicLibraryViewProps {
  onClose: () => void;
}

export const MusicLibraryView = ({ onClose }: MusicLibraryViewProps) => {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Song>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Song | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [newTagInput, setNewTagInput] = useState('');
  const { addToast } = useToast();

  const flacApiUrl = getFlacApiUrl();

  const fetchSongs = useCallback(async () => {
    if (!flacApiUrl) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${flacApiUrl}/api/songs?type=song&limit=500`);
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
  }, [flacApiUrl, addToast]);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  const filteredSongs = useMemo(() => {
    let result = songs;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(song =>
        song.title?.toLowerCase().includes(query) ||
        song.author?.toLowerCase().includes(query) ||
        song.tags?.some(tag => tag?.toLowerCase().includes(query))
      );
    }

    if (sortField) {
      result = [...result].sort((a, b) => {
        const aVal = a[sortField] ?? '';
        const bVal = b[sortField] ?? '';
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortAsc ? aVal - bVal : bVal - aVal;
        }
        return 0;
      });
    }
    return result;
  }, [songs, searchQuery, sortField, sortAsc]);

  const handleSort = (field: keyof Song) => {
    if (sortField === field) {
      if (!sortAsc) {
        setSortField(null);
        setSortAsc(true);
      } else {
        setSortAsc(false);
      }
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const startEdit = (song: Song) => {
    setEditingId(song.id);
    setEditForm({ ...song, tags: song.tags ? [...song.tags] : [] });
    setNewTagInput('');
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !editForm.tags?.includes(trimmed)) {
      setEditForm(prev => ({ ...prev, tags: [...(prev.tags || []), trimmed] }));
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditForm(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tagToRemove) }));
  };

  const saveEdit = async (id: string) => {
    if (!flacApiUrl) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/songs/${id}?type=song`, {
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
    if (!(await PluginRegistry.confirm('Are you sure you want to delete this track?'))) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/songs/${id}?type=song`, { method: 'DELETE' });
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
            {searchQuery && <span className="ml-2 text-blue-500">({filteredSongs.length} matching)</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <svg className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
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
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('title')}>
                  Title {sortField === 'title' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('author')}>
                  Artist {sortField === 'author' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 w-24 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('rating')}>
                  Rating {sortField === 'rating' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 w-24 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800" onClick={() => handleSort('play_count')}>
                  Plays {sortField === 'play_count' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Tags</th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 text-right w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSongs.map((song) => (
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
                      <td className="p-4 text-sm text-slate-500">
                        {song.play_count || 0}
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {editForm.tags?.map(tag => (
                              <span
                                key={tag}
                                className="flex items-center gap-1 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-md border border-blue-200 dark:border-blue-800"
                              >
                                {tag}
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200"
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input
                              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 flex-1 min-w-0"
                              value={newTagInput}
                              onChange={e => setNewTagInput(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddTag();
                                }
                              }}
                              placeholder="Add tag..."
                            />
                            <button
                              onClick={handleAddTag}
                              className="px-2 py-1 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 text-sm font-medium"
                            >
                              Add
                            </button>
                          </div>
                        </div>
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
                      <td className="p-4 text-sm text-slate-500">
                        {song.play_count || 0}
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
                        <a
                          href={`${flacApiUrl}/api/music/${song.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 text-sm font-medium mr-3"
                        >
                          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M4 4l12 6-12 6V4z" />
                          </svg>
                          Play
                        </a>
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
