import { useState, useEffect, useMemo, useCallback } from 'react';
import { useToast } from './Toast';
import { API_BASE_URL } from '../services/api';
import { PluginRegistry } from '../services/plugin';

interface ModEntry {
  id: string;
  filename: string;
  title: string;
  author: string;
  duration: number;
  size: number;
  tags: string[];
  notes: string;
  url: string;
  added_at: string;
  updated_at: string;
}

interface ModSongsViewProps {
  onClose: () => void;
}

function formatDuration(secs: number): string {
  if (!secs) return '--:--';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ModSongsView = ({ onClose }: ModSongsViewProps) => {
  const [mods, setMods] = useState<ModEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ModEntry>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const { addToast } = useToast();

  const modsApiUrl = API_BASE_URL;

  const fetchMods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${modsApiUrl}/api/songs?type=pattern`);
      if (res.ok) {
        const data = await res.json();
        setMods(Array.isArray(data) ? data : []);
      } else {
        addToast('Failed to fetch MOD files', 'error');
      }
    } catch (err) {
      console.error('Failed to fetch mods:', err);
      addToast('Failed to connect to storage API', 'error');
    } finally {
      setLoading(false);
    }
  }, [modsApiUrl, addToast]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`${modsApiUrl}/api/admin/sync`, { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        addToast(
          `Sync complete: ${result.added} added, ${result.updated} updated (${result.total} total)`,
          'success'
        );
        await fetchMods();
      } else {
        addToast('Sync failed', 'error');
      }
    } catch (err) {
      console.error('Sync failed:', err);
      addToast('Sync failed', 'error');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchMods();
  }, [fetchMods]);

  const filteredMods = useMemo(() => {
    if (!searchQuery.trim()) return mods || [];
    const q = searchQuery.toLowerCase();
    return (mods || []).filter(
      m =>
        m.title?.toLowerCase().includes(q) ||
        m.author?.toLowerCase().includes(q) ||
        m.filename?.toLowerCase().includes(q) ||
        (m.tags || []).some(t => t?.toLowerCase().includes(q))
    );
  }, [mods, searchQuery]);

  const startEdit = (mod: ModEntry) => {
    setEditingId(mod.id);
    setEditForm({ ...mod, tags: mod.tags ? [...mod.tags] : [] });
    setNewTagInput('');
  };

  const handleAddTag = () => {
    const trimmed = newTagInput.trim();
    if (trimmed && !editForm.tags?.includes(trimmed)) {
      setEditForm(prev => ({ ...prev, tags: [...(prev.tags || []), trimmed] }));
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    setEditForm(prev => ({ ...prev, tags: (prev.tags || []).filter(t => t !== tag) }));
  };

  const saveEdit = async (id: string) => {
    try {
      const res = await fetch(`${modsApiUrl}/api/songs/${id}?type=pattern`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          author: editForm.author,
          tags: editForm.tags,
          notes: editForm.notes,
        }),
      });
      if (res.ok) {
        setMods(prev =>
          prev.map(m => (m.id === id ? { ...m, ...editForm as ModEntry } : m))
        );
        setEditingId(null);
        addToast('MOD updated', 'success');
      } else {
        addToast('Failed to update MOD', 'error');
      }
    } catch (err) {
      console.error('Save edit failed:', err);
      addToast('Failed to update MOD', 'error');
    }
  };

  const deleteMod = async (id: string) => {
    if (!modsApiUrl) return;
    if (!(await PluginRegistry.confirm('Are you sure you want to delete this track?'))) return;
    try {
      const res = await fetch(`${modsApiUrl}/api/songs/${id}?type=pattern`, { method: 'DELETE' });
      if (res.ok) {
        setMods(mods.filter(m => m.id !== id));
        addToast('MOD deleted', 'success');
      } else {
        addToast('Failed to delete MOD', 'error');
      }
    } catch (error) {
      console.error('Failed to delete MOD:', error);
      addToast('Failed to delete MOD', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-slate-500 font-medium">Loading MOD Songs...</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-900 p-8 overflow-hidden">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <span className="text-purple-500">🎵</span> MOD Songs
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            <strong>{mods.length}</strong> files in storage.
            {searchQuery && (
              <span className="ml-2 text-purple-500">({filteredMods.length} matching)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search MODs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-purple-500/20"
            />
            <svg
              className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-60"
            title="Scan storage folder and sync MOD index"
          >
            {syncing ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            {syncing ? 'Syncing...' : 'Sync'}
          </button>
          <button
            onClick={fetchMods}
            className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-md text-slate-500 hover:text-purple-500 transition-all"
            title="Refresh"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
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

      <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
        {mods.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <div className="text-6xl mb-4">🎹</div>
            <p className="text-xl mb-2">No MOD files found.</p>
            <p className="text-sm">Click Sync to scan the storage folder.</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0">
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Title
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Author
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 w-24">
                  Duration
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 w-24">
                  Size
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Tags
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Notes
                </th>
                <th className="p-4 text-sm font-semibold text-slate-700 dark:text-slate-300 text-right w-28">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredMods.map(mod => (
                <tr
                  key={mod.id}
                  className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  {editingId === mod.id ? (
                    <>
                      <td className="p-4">
                        <input
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-full text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20"
                          value={editForm.title ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                        />
                      </td>
                      <td className="p-4">
                        <input
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-full text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20"
                          value={editForm.author ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, author: e.target.value }))}
                        />
                      </td>
                      <td className="p-4 text-sm text-slate-500">{formatDuration(mod.duration)}</td>
                      <td className="p-4 text-sm text-slate-500">{formatSize(mod.size)}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-1.5">
                            {editForm.tags?.map(tag => (
                              <span
                                key={tag}
                                className="flex items-center gap-1 text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md border border-purple-200 dark:border-purple-800"
                              >
                                {tag}
                                <button
                                  onClick={() => handleRemoveTag(tag)}
                                  className="text-purple-500 hover:text-purple-700"
                                >
                                  &times;
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-1">
                            <input
                              className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 text-sm text-slate-900 dark:text-white outline-none flex-1 min-w-0"
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
                      <td className="p-4">
                        <textarea
                          className="bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1.5 w-full text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-purple-500/20 resize-none"
                          rows={2}
                          value={editForm.notes ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                        />
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => saveEdit(mod.id)}
                          className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 hover:text-green-700 text-sm font-medium mr-3"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 text-sm font-medium"
                        >
                          Cancel
                        </button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-sm font-medium text-slate-800 dark:text-slate-200">
                        {mod.title || mod.filename}
                      </td>
                      <td className="p-4 text-sm text-slate-500 dark:text-slate-400">
                        {mod.author || '—'}
                      </td>
                      <td className="p-4 text-sm text-slate-500">{formatDuration(mod.duration)}</td>
                      <td className="p-4 text-sm text-slate-500">{formatSize(mod.size)}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1.5">
                          {mod.tags?.map(tag => (
                            <span
                              key={tag}
                              className="text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-500 dark:text-slate-400 max-w-[160px] truncate">
                        {mod.notes || '—'}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => startEdit(mod)}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 text-sm font-medium mr-3"
                        >
                          <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => deleteMod(mod.id)}
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
