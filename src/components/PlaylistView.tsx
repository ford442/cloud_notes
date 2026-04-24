import { useState, useEffect } from 'react';
import { useToast } from './Toast';
import { getFlacApiUrl } from '../utils/flac';
import type { Song, Playlist } from '../utils/flac';

interface PlaylistViewProps {
  onClose: () => void;
}

export const PlaylistView = ({ onClose }: PlaylistViewProps) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingNew, setCreatingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPlaylist, setNewPlaylist] = useState({ title: '', description: '', track_ids: [] as string[] });
  const [editForm, setEditForm] = useState<Partial<Playlist>>({});
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [showSongSelector, setShowSongSelector] = useState(false);
  const [addSongSearch, setAddSongSearch] = useState('');
  const [playlistSearch, setPlaylistSearch] = useState('');
  const { addToast } = useToast();

  const flacApiUrl = getFlacApiUrl();

  useEffect(() => {
    if (flacApiUrl) {
      fetchPlaylists();
      fetchSongs();
    }
  }, [flacApiUrl]);

  const fetchPlaylists = async () => {
    if (!flacApiUrl) return;
    setLoading(true);
    try {
      const res = await fetch(`${flacApiUrl}/api/playlists`);
      if (res.ok) {
        const data = await res.json();
        setPlaylists(Array.isArray(data) ? data : []);
      } else {
        addToast('Failed to fetch playlists', 'error');
      }
    } catch (error) {
      console.error('Failed to fetch playlists:', error);
      addToast('Failed to connect to FLAC backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSongs = async () => {
    if (!flacApiUrl) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/songs?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setSongs(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Failed to fetch songs:', error);
    }
  };

  const createPlaylist = async () => {
    if (!flacApiUrl || !newPlaylist.title.trim()) {
      addToast('Playlist title is required', 'error');
      return;
    }

    try {
      const res = await fetch(`${flacApiUrl}/api/playlists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newPlaylist.title,
          description: newPlaylist.description,
          track_ids: newPlaylist.track_ids
        })
      });

      if (res.ok) {
        const playlist = await res.json();
        setPlaylists([...playlists, playlist]);
        setNewPlaylist({ title: '', description: '', track_ids: [] });
        setCreatingNew(false);
        addToast('Playlist created successfully', 'success');
      } else {
        addToast('Failed to create playlist', 'error');
      }
    } catch (error) {
      console.error('Failed to create playlist:', error);
      addToast('Failed to create playlist', 'error');
    }
  };

  const updatePlaylist = async (id: string) => {
    if (!flacApiUrl) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/playlists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        const updated = await res.json();
        setPlaylists(playlists.map(p => p.id === id ? updated : p));
        setEditingId(null);
        addToast('Playlist updated successfully', 'success');
      } else {
        addToast('Failed to update playlist', 'error');
      }
    } catch (error) {
      console.error('Failed to update playlist:', error);
      addToast('Failed to update playlist', 'error');
    }
  };

  const deletePlaylist = async (id: string) => {
    if (!flacApiUrl || !confirm('Delete this playlist?')) return;
    try {
      const res = await fetch(`${flacApiUrl}/api/playlists/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setPlaylists(playlists.filter(p => p.id !== id));
        setSelectedPlaylistId(null);
        addToast('Playlist deleted', 'success');
      } else {
        addToast('Failed to delete playlist', 'error');
      }
    } catch (error) {
      console.error('Failed to delete playlist:', error);
      addToast('Failed to delete playlist', 'error');
    }
  };

  const addSongToPlaylist = async (playlistId: string, songId: string) => {
    if (!flacApiUrl) return;
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const updatedTrackIds = [...new Set([...playlist.track_ids, songId])];
    try {
      const res = await fetch(`${flacApiUrl}/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_ids: updatedTrackIds })
      });

      if (res.ok) {
        const updated = await res.json();
        setPlaylists(playlists.map(p => p.id === playlistId ? updated : p));
        addToast('Song added to playlist', 'success');
      }
    } catch (error) {
      console.error('Failed to add song:', error);
      addToast('Failed to add song', 'error');
    }
  };

  const removeSongFromPlaylist = async (playlistId: string, songId: string) => {
    if (!flacApiUrl) return;
    if (!confirm('Remove this song from the playlist?')) return;

    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const updatedTrackIds = playlist.track_ids.filter(id => id !== songId);
    try {
      const res = await fetch(`${flacApiUrl}/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_ids: updatedTrackIds })
      });

      if (res.ok) {
        const updated = await res.json();
        setPlaylists(playlists.map(p => p.id === playlistId ? updated : p));
        addToast('Song removed from playlist', 'success');
      }
    } catch (error) {
      console.error('Failed to remove song:', error);
      addToast('Failed to remove song', 'error');
    }
  };

  const selectedPlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const playlistSongs = selectedPlaylist
    ? songs.filter(s => selectedPlaylist.track_ids.includes(s.id))
    : [];

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-500 font-medium">Loading Playlists...</p>
      </div>
    );
  }

  if (!flacApiUrl) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8 text-center">
        <div className="text-6xl mb-6">📋</div>
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Playlists</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-md">
          Please configure your FLAC Player API URL in Settings → Integrations.
        </p>
        <button
          onClick={onClose}
          className="px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition"
        >
          Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex gap-4 bg-slate-50 dark:bg-slate-900 p-8 overflow-hidden">
      {/* Playlists List */}
      <div className="w-80 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white">Your Playlists</h3>
          <button
            onClick={() => setCreatingNew(!creatingNew)}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            title="New Playlist"
          >
            +
          </button>
        </div>

        {creatingNew && (
          <div className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-blue-500 space-y-3">
            <input
              placeholder="Playlist name"
              value={newPlaylist.title}
              onChange={e => setNewPlaylist({ ...newPlaylist, title: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <textarea
              placeholder="Description (optional)"
              value={newPlaylist.description}
              onChange={e => setNewPlaylist({ ...newPlaylist, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={createPlaylist}
                className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
              >
                Create
              </button>
              <button
                onClick={() => setCreatingNew(false)}
                className="flex-1 px-3 py-2 bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white text-sm rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto space-y-2 bg-white dark:bg-slate-800 rounded-lg p-3">
          {playlists.length === 0 ? (
            <div className="text-center text-slate-400 py-8">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm">No playlists yet</p>
            </div>
          ) : (
            playlists.map(playlist => (
              <div
                key={playlist.id}
                onClick={() => setSelectedPlaylistId(playlist.id)}
                className={`p-3 rounded-lg cursor-pointer transition-all ${
                  selectedPlaylistId === playlist.id
                    ? 'bg-blue-100 dark:bg-blue-900 border-2 border-blue-500'
                    : 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 border-2 border-transparent'
                }`}
              >
                <div className="font-semibold text-slate-900 dark:text-white text-sm">{playlist.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {playlist.track_ids.length} songs
                </div>
              </div>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg hover:bg-slate-400 dark:hover:bg-slate-600 transition"
        >
          Back
        </button>
      </div>

      {/* Playlist Editor */}
      <div className="flex-1 flex flex-col gap-4">
        {selectedPlaylist && !editingId ? (
          <>
            <div className="flex items-start justify-between p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm">
              <div>
                <h2 className="text-3xl font-bold text-slate-800 dark:text-white">{selectedPlaylist.title}</h2>
                {selectedPlaylist.description && (
                  <p className="text-slate-500 dark:text-slate-400 mt-2">{selectedPlaylist.description}</p>
                )}
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                  {playlistSongs.length} tracks
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditForm({ ...selectedPlaylist });
                    setEditingId(selectedPlaylist.id);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={() => deletePlaylist(selectedPlaylist.id)}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="flex-1 flex flex-col gap-4 overflow-hidden">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-slate-800 dark:text-white">Songs</h3>
                <button
                  onClick={() => setShowSongSelector(!showSongSelector)}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                >
                  {showSongSelector ? 'Done' : 'Add Songs'}
                </button>
              </div>

              {showSongSelector && (
                <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border-2 border-green-500 overflow-y-auto max-h-64 flex flex-col gap-3">
                  <input
                    type="text"
                    placeholder="Search songs to add..."
                    value={addSongSearch}
                    onChange={(e) => setAddSongSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-green-500/20"
                  />
                  <div className="space-y-2 overflow-y-auto flex-1">
                    {songs
                      .filter(s => !selectedPlaylist.track_ids.includes(s.id))
                      .filter(s => !addSongSearch.trim() ||
                                   s.title.toLowerCase().includes(addSongSearch.toLowerCase()) ||
                                   s.author.toLowerCase().includes(addSongSearch.toLowerCase()))
                      .map(song => (
                        <div
                          key={song.id}
                          onClick={() => addSongToPlaylist(selectedPlaylist.id, song.id)}
                          className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer flex justify-between items-center"
                        >
                          <div className="text-sm">
                            <div className="font-medium text-slate-900 dark:text-white">{song.title}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{song.author}</div>
                          </div>
                          <span className="text-xl">➕</span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                {playlistSongs.length > 0 && (
                  <div className="p-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      placeholder="Filter songs in playlist..."
                      value={playlistSearch}
                      onChange={(e) => setPlaylistSearch(e.target.value)}
                      className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                )}
                <div className="flex-1 overflow-auto">
                  {playlistSongs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                      <div className="text-3xl mb-2">🎵</div>
                      <p>No songs in this playlist</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200 dark:divide-slate-700">
                      {playlistSongs
                        .filter(s => !playlistSearch.trim() ||
                                     s.title.toLowerCase().includes(playlistSearch.toLowerCase()) ||
                                     s.author.toLowerCase().includes(playlistSearch.toLowerCase()))
                        .map((song, idx) => (
                        <div key={song.id} className="p-4 flex justify-between items-center hover:bg-slate-50 dark:hover:bg-slate-700/50">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-slate-900 dark:text-white">
                              {idx + 1}. {song.title}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{song.author}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <a
                              href={`${flacApiUrl}/api/music/${song.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2 py-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded text-sm flex items-center gap-1"
                              title="Play"
                            >
                              <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M4 4l12 6-12 6V4z" />
                              </svg>
                            </a>
                            <button
                              onClick={() => removeSongFromPlaylist(selectedPlaylist.id, song.id)}
                              className="px-2 py-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded text-sm"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : editingId ? (
          <div className="p-6 bg-white dark:bg-slate-800 rounded-lg shadow-sm space-y-4">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Edit Playlist</h3>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Title</label>
              <input
                value={editForm.title || ''}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full mt-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
              <textarea
                value={editForm.description || ''}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full mt-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20"
                rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => updatePlaylist(editingId)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="flex-1 px-4 py-2 bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-white rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <div className="text-6xl mb-4">📋</div>
            <p className="text-lg">Select a playlist to view and edit</p>
          </div>
        )}
      </div>
    </div>
  );
};
