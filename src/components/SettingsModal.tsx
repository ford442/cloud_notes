import { useState, useEffect } from 'react';
import { EncryptionService } from '../utils/encryption';
import { useToast } from './Toast';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  setAuthorName: (name: string) => void;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

const Tabs = ['General', 'Security', 'Integrations'];

export const SettingsModal = ({ isOpen, onClose, authorName, setAuthorName, theme, setTheme }: SettingsModalProps) => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('General');
  const [readwiseToken, setReadwiseToken] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setReadwiseToken(localStorage.getItem('readwise_token') || '');
      setEncryptionKey(EncryptionService.getOrInitPassword());
      setShowKey(false);
    }
  }, [isOpen]);

  const handleSaveReadwise = () => {
    localStorage.setItem('readwise_token', readwiseToken);
    addToast('Readwise token saved', 'success');
  };

  const handleUpdateKey = () => {
    if (!encryptionKey.trim()) return addToast('Key cannot be empty', 'error');
    if (confirm('Warning: changing the encryption key will make existing encrypted notes unreadable. Are you sure?')) {
        EncryptionService.setPassword(encryptionKey);
        addToast('Encryption key updated. Please reload.', 'success');
        setTimeout(() => window.location.reload(), 1500);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white">Settings</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 pt-2 border-b border-slate-100 dark:border-slate-700 space-x-6">
          {Tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-medium transition-colors relative ${
                activeTab === tab
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">

          {activeTab === 'General' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Author Name</label>
                <input
                  type="text"
                  value={authorName}
                  onChange={e => setAuthorName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Enter your name"
                />
                <p className="text-xs text-slate-400 mt-1">This name will be attached to new notes you create.</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Theme</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setTheme('light')}
                    className={`px-4 py-3 rounded-xl border transition-all ${
                      theme === 'light'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-sm">Light Mode</div>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`px-4 py-3 rounded-xl border transition-all ${
                      theme === 'dark'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500'
                        : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <div className="font-semibold text-sm">Dark Mode</div>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Security' && (
            <div className="space-y-4">
               <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
                 <strong>Warning:</strong> Your notes are encrypted with this key. If you lose it, you lose access to your encrypted content. If you change it, you must migrate your data or it will be unreadable.
               </div>

               <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Encryption Key</label>
                <div className="relative">
                  <input
                    type={showKey ? "text" : "password"}
                    value={encryptionKey}
                    onChange={e => setEncryptionKey(e.target.value)}
                    className="w-full pl-4 pr-12 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono"
                  />
                  <button
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showKey ? (
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
               </div>

               <div className="flex justify-end">
                 <button
                   onClick={handleUpdateKey}
                   className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                 >
                   Update Key
                 </button>
               </div>
            </div>
          )}

          {activeTab === 'Integrations' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Readwise Access Token</label>
                <input
                  type="password"
                  value={readwiseToken}
                  onChange={e => setReadwiseToken(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="Paste your token here"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Get your token from <a href="https://readwise.io/access_token" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Readwise</a>.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveReadwise}
                  className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white text-sm font-medium rounded-lg hover:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
                >
                  Save Token
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
