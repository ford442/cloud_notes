import { useState, useEffect } from 'react';
import { cloudStorageApi } from '../services/cloudStorageApi';
import type { MetaData } from '../services/cloudStorageApi';

export const LibraryBrowser = ({ onClose }: { onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState<'song' | 'pattern' | 'bank' | 'sample'>('song');
  const [items, setItems] = useState<MetaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tagsQuery, setTagsQuery] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await cloudStorageApi.listLibrary({
        type: activeTab,
        q: searchQuery,
        tags: tagsQuery
      });
      setItems(data || []);
    } catch (e) {
      console.error('Failed to fetch library items:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 300);
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery, tagsQuery]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await cloudStorageApi.syncStorage();
      await fetchItems();
    } catch (e) {
      console.error('Failed to sync storage:', e);
    } finally {
      setSyncing(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900" data-testid="library-browser">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <span className="text-blue-500">☁️</span> Cloud Library Browser
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {syncing ? (
              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <span>🔄</span>
            )}
            Sync Storage
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg" data-testid="library-tabs">
          {(['song', 'pattern', 'bank', 'sample'] as const).map(tab => (
            <button
              key={tab}
              data-testid={`tab-${tab}`}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'
              }`}
            >
              {tab}s
            </button>
          ))}
        </div>
        <div className="flex gap-2 relative">
          <div className="relative">
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64 text-slate-900 dark:text-slate-100"
            />
            <span className="absolute left-3 top-2.5 text-slate-400">🔍</span>
          </div>
          <div className="relative">
             <input
               type="text"
               placeholder="Tags (comma separated)..."
               value={tagsQuery}
               onChange={(e) => setTagsQuery(e.target.value)}
               className="pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-64 text-slate-900 dark:text-slate-100"
             />
             <span className="absolute left-3 top-2.5 text-slate-400">🏷️</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-6 overflow-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
             <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
             Loading library items...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 bg-white dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 border-dashed">
            <span className="text-4xl mb-3">📭</span>
            <p>No {activeTab}s found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredItems.map(item => (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-950 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group cursor-pointer"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate pr-2" title={item.name}>
                    {item.name}
                  </h3>
                  <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-md text-slate-500 uppercase font-bold tracking-wide">
                    {item.type}
                  </span>
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400 mb-3 truncate" title={item.description || 'No description'}>
                  {item.description || <span className="italic opacity-50">No description</span>}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 mt-auto pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="truncate flex-1 pr-2">👤 {item.author}</span>
                  <span>📅 {item.date}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
