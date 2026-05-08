import React, { useState, useEffect, useRef } from 'react';
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

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      if (messages.length === 0) {
        setMessages([{ role: 'system', content: 'Ask anything about your notes. I will search your brain and find the answer securely on your device.' }]);
      }
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, aiStatus]);

  const handleAsk = async () => {
    if (!query.trim() || isLoading) return;

    const userQuery = query.trim();
    setQuery('');
    setMessages(prev => [...prev, { role: 'user', content: userQuery }]);
    setIsLoading(true);
    setAiStatus('Searching your notes semantically...');

    try {
      // 1. Semantic Search to find relevant notes
      const similarNotes = await SemanticService.findSimilar(userQuery, undefined, 3);

      if (similarNotes.length === 0) {
        setMessages(prev => [...prev, { role: 'ai', content: "I couldn't find any notes relevant to that question." }]);
        setIsLoading(false);
        setAiStatus('');
        return;
      }

      // 2. Fetch and Decrypt the context
      let contextString = '';
      const sources: { id: string, title: string }[] = [];

      for (const sim of similarNotes) {
        const noteRecord = await db.get<Note>(STORE_NOTES_CONTENT, sim.id);
        if (noteRecord) {
           const decryptedContent = await EncryptionService.decrypt(noteRecord.content);
           contextString += `--- Note: ${noteRecord.title} ---\n${decryptedContent}\n\n`;
           sources.push({ id: noteRecord.id || 'unknown', title: noteRecord.title || 'Untitled' });
        }
      }

      // 3. Ask the AI Worker
      setAiStatus('Reading context & thinking...');
      const answer = await AIService.askQuestion(userQuery, contextString, (msg) => {
         setAiStatus(msg);
      });

      setMessages(prev => [...prev, { role: 'ai', content: answer, sources }]);

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${e instanceof Error ? e.message : 'Failed to generate answer'}` }]);
    } finally {
      setIsLoading(false);
      setAiStatus('');
    }
  };

  // Also close on escape key globally if modal is open
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isOpen && e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col h-[600px] max-h-[80vh] border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <span className="text-xl">🧠</span>
            <h2 className="font-semibold text-slate-800 dark:text-white">Q&A over Notes</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
             Esc
          </button>
        </div>

        {/* Chat History */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : msg.role === 'system'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm italic'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-none'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>

                {/* Source Citations */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Sources used:</p>
                    <div className="flex flex-wrap gap-2">
                      {msg.sources.map(source => (
                        <button
                          key={source.id}
                          onClick={() => { onNavigate(source.id); onClose(); }}
                          className="text-xs bg-slate-200 dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors px-2 py-1 rounded border border-slate-300 dark:border-slate-600"
                        >
                          {source.title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-start">
              <div className="bg-slate-100 dark:bg-slate-700 px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-3">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm text-slate-500 dark:text-slate-300">{aiStatus || 'Thinking...'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800">
          <form
            onSubmit={(e) => { e.preventDefault(); handleAsk(); }}
            className="relative flex items-center"
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              disabled={isLoading}
              placeholder="Ask a question about your notes..."
              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-12 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!query.trim() || isLoading}
              className="absolute right-2 p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg disabled:opacity-50 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};
