import { useState, useEffect, useRef } from 'react';
import { SemanticService } from '../services/semantic';
import { AIService } from '../services/ai';
import { db, STORE_NOTES_CONTENT } from '../utils/db';
import { EncryptionService } from '../utils/encryption';
import type { Note } from '../services/api';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

interface Message {
  role: 'user' | 'ai' | 'system';
  content: string;
  sources?: { id: string; title: string }[];
}

export const ChatModal = ({ isOpen, onClose, onNavigate }: ChatModalProps) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opened and show greeting
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{
          role: 'system',
          content: 'Hello! I am your local Second Brain. Ask me anything about your notes, and I will find the answers securely on your device.'
        }]);
      }
    }
  }, [isOpen, messages.length]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, aiStatus]);

  const handleAsk = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || loading) return;

    const userMsg = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);
    setAiStatus('Searching your notes semantically...');

    try {
      // 1. Retrieval: Find top 3 relevant notes
      const matches = await SemanticService.findSimilar(userMsg, undefined, 3);

      if (matches.length === 0) {
        setMessages(prev => [...prev, { role: 'ai', content: "I couldn't find any notes relevant to that question." }]);
        return;
      }

      const contextParts: string[] = [];
      const sources: {id: string, title: string}[] = [];

      // 2. Fetch & Decrypt Context
      for (const m of matches) {
        const note = await db.get<Note>(STORE_NOTES_CONTENT, m.id);
        if (note) {
          const decrypted = await EncryptionService.decrypt(note.content);
          contextParts.push(`--- Note: ${note.title || 'Untitled'} ---
${decrypted}`);
          sources.push({ id: note.id || 'unknown', title: note.title || 'Untitled Note' });
        }
      }

      // 3. Augmentation & Generation via local Qwen model
      setAiStatus('Reading context & thinking...');
      const context = contextParts.join('\n\n');
      const answer = await AIService.askQuestion(userMsg, context, (msg) => setAiStatus(msg));

      setMessages(prev => [...prev, { role: 'ai', content: answer, sources }]);
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${e instanceof Error ? e.message : 'Failed to generate answer'}` }]);
    } finally {
      setLoading(false);
      setAiStatus('');
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Darkened Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Glassmorphism Modal Container */}
      <div className="relative w-full max-w-4xl h-[85vh] flex flex-col bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border border-white/40 dark:border-slate-700/50 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg">
              <span className="text-xl">🧠</span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-slate-800 dark:text-white leading-tight">Second Brain Q&A</h2>
              <p className="text-xs font-medium text-purple-600 dark:text-purple-400">100% Local & Private</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-5 py-4 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-gradient-to-br from-blue-600 to-purple-600 text-white rounded-3xl rounded-br-sm'
                  : msg.role === 'system'
                  ? 'bg-slate-100/50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-sm italic rounded-2xl border border-slate-200/50 dark:border-slate-700/50'
                  : 'bg-white/80 dark:bg-slate-800/80 text-slate-800 dark:text-slate-100 rounded-3xl rounded-bl-sm border border-white/50 dark:border-slate-600/50'
              }`}>
                <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-slate-600/50">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">Sources Used:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map((source, idx) => (
                        <button
                          key={`${source.id}-${idx}`}
                          onClick={() => { onNavigate(source.id); onClose(); }}
                          className="text-xs flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-slate-700 dark:text-slate-300 transition-colors px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700"
                        >
                          <svg className="w-3 h-3 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          <span className="truncate max-w-[150px]">{source.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <div className="flex items-start animate-in fade-in">
              <div className="bg-white/80 dark:bg-slate-800/80 px-5 py-4 rounded-3xl rounded-bl-sm border border-white/50 dark:border-slate-600/50 flex items-center gap-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">{aiStatus || 'Thinking...'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 sm:p-6 border-t border-slate-200/50 dark:border-slate-700/50 bg-white/30 dark:bg-slate-800/30">
          <form
            onSubmit={handleAsk}
            className="relative flex items-center bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-600 rounded-2xl shadow-inner focus-within:ring-2 focus-within:ring-purple-500/50 focus-within:border-purple-500/50 transition-all"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={loading}
              placeholder="Ask a question to synthesize your notes..."
              className="w-full bg-transparent text-slate-800 dark:text-white placeholder:text-slate-400 outline-none px-6 py-4 rounded-2xl disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!query.trim() || loading}
              className="absolute right-2 p-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl disabled:opacity-30 disabled:hover:bg-purple-600 transition-all shadow-md"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </form>
          <div className="text-center mt-3 text-xs text-slate-400 font-medium">
            Press <kbd className="px-1.5 py-0.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-md">Esc</kbd> to close
          </div>
        </div>

      </div>
    </div>
  );
};
