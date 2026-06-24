import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { CloudItemMeta } from '../../services/api';
import { vpsStorageAPI } from '../../services/vpsStorageAPI';
import { StorageService } from '../../services/api';

export const HoverLinkPreview = () => {
    const [previewTarget, setPreviewTarget] = useState<{ id: string, x: number, y: number, name: string } | null>(null);
    const [previewContent, setPreviewContent] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);

    useEffect(() => {
        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const link = target.closest('.internal-wiki-link');

            if (link) {
                const id = link.getAttribute('data-id') || link.getAttribute('href');
                const name = link.textContent || '';

                if (id && id !== 'CREATE_NEW') {
                    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);

                    elementRef.current = link as HTMLElement;

                    hoverTimerRef.current = setTimeout(() => {
                        const rect = link.getBoundingClientRect();
                        setPreviewTarget({ id, x: rect.left, y: rect.bottom + window.scrollY, name });
                        loadPreview(id, name);
                    }, 500); // 500ms delay before showing
                }
            }
        };

        const handleMouseOut = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // Only clear if we are leaving the link itself AND not entering the preview
            // Actually, for simplicity, let's just clear on mousemove outside of link and preview
        };

        const handleMouseMove = (e: MouseEvent) => {
             if (previewTarget || hoverTimerRef.current) {
                 const isOverLink = elementRef.current && elementRef.current.contains(e.target as Node);
                 const isOverPreview = document.getElementById('link-preview-popup')?.contains(e.target as Node);

                 if (!isOverLink && !isOverPreview) {
                     if (hoverTimerRef.current) {
                         clearTimeout(hoverTimerRef.current);
                         hoverTimerRef.current = null;
                     }
                     setPreviewTarget(null);
                     setPreviewContent('');
                 }
             }
        }

        document.addEventListener('mouseover', handleMouseOver);
        document.addEventListener('mousemove', handleMouseMove);

        return () => {
            document.removeEventListener('mouseover', handleMouseOver);
            document.removeEventListener('mousemove', handleMouseMove);
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
        };
    }, [previewTarget]);

    const loadPreview = async (id: string, fallbackName: string) => {
        setIsLoading(true);
        try {
            // First check local metadata to find the filename
            const allNotes = await StorageService.getNotes();
            const noteMeta = allNotes.find((n: CloudItemMeta) => n.id === id || n.name === fallbackName);

            if (noteMeta) {
                 const note = await StorageService.getNoteContent(noteMeta.name);
                 if (note && note.content) {
                      // Extract just a snippet
                      const snippet = note.content.substring(0, 300).replace(/[#*`_\[\]]/g, '') + (note.content.length > 300 ? '...' : '');
                      setPreviewContent(snippet);
                 } else {
                     setPreviewContent('No content found.');
                 }
            } else {
                setPreviewContent('Note not found locally.');
            }
        } catch (e) {
            console.error('Preview error', e);
            setPreviewContent('Error loading preview.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!previewTarget) return null;

    return createPortal(
        <div
            id="link-preview-popup"
            className="absolute z-[100] w-72 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in-95 duration-200 p-4"
            style={{
                left: Math.max(10, previewTarget.x),
                top: previewTarget.y + 10
            }}
            onClick={(e) => e.stopPropagation()}
        >
             <h4 className="font-bold text-slate-800 dark:text-white mb-2 pb-2 border-b border-slate-100 dark:border-slate-700 truncate">
                 📄 {previewTarget.name}
             </h4>
             <div className="text-sm text-slate-600 dark:text-slate-300 max-h-32 overflow-hidden relative">
                 {isLoading ? (
                     <div className="flex items-center gap-2 text-slate-400">
                         <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                         Loading preview...
                     </div>
                 ) : (
                     <div className="whitespace-pre-wrap text-xs opacity-90 line-clamp-5">
                         {previewContent || <em>Empty note</em>}
                     </div>
                 )}
                 {!isLoading && previewContent && (
                     <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-800 to-transparent pointer-events-none"></div>
                 )}
             </div>
        </div>,
        document.body
    );
};
