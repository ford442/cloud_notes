import { useState, useCallback, useEffect } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import type { AppState, BinaryFiles, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { PluginRegistry } from '../services/plugin';

interface CanvasEditorProps {
  initialData: string;
  onChange: (val: string) => void;
  theme: 'light' | 'dark';
}

export const CanvasEditor = ({ initialData, onChange, theme }: CanvasEditorProps) => {
  // Initialize state once on mount (or key change)
  const [init] = useState(() => {
      let elements: readonly ExcalidrawElement[] = [];
      let appState: Partial<AppState> = {};
      let error: string | null = null;

      if (initialData && initialData.trim()) {
        let json = initialData;
        const match = initialData.match(/^```excalidraw\s+([\s\S]*?)\s*```/);

        if (match) {
            json = match[1];
        } else {
            // Check if it's text content
            if (!initialData.trim().startsWith('{')) {
                error = "This note contains text content. Switch to 'Rich' or 'Simple' mode to view/edit it.";
            }
        }

        if (!error) {
            try {
                const data = JSON.parse(json);
                if (data.elements) {
                    elements = data.elements;
                    if (data.appState) {
                        appState = data.appState;
                    }
                } else if (Array.isArray(data)) {
                    elements = data;
                }
            } catch (e) {
                console.warn('Failed to parse Excalidraw data', e);
                error = "Failed to parse Canvas data.";
            }
        }
      }

      return { elements, appState, error };
  });

  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (excalidrawAPI) {
      PluginRegistry.setCanvasAPI(excalidrawAPI);
    }
    return () => PluginRegistry.setCanvasAPI(null);
  }, [excalidrawAPI]);

  const handleChange = useCallback((elements: readonly ExcalidrawElement[], appState: AppState, _files: BinaryFiles) => {
      if (init.error) return;

      const payload = {
          elements,
          appState: { viewBackgroundColor: appState.viewBackgroundColor }
      };

      const json = JSON.stringify(payload);
      const wrapped = `\`\`\`excalidraw\n${json}\n\`\`\``;

      // Prevent loop: only trigger parent update if content actually changed
      if (wrapped === initialData) return;

      onChange(wrapped);
  }, [onChange, init.error, initialData]);

  if (init.error) {
      return (
          <div className="w-full h-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 p-8 text-center">
              <div>
                  <svg className="w-12 h-12 mx-auto mb-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-bold mb-2">Content Mismatch</h3>
                  <p>{init.error}</p>
              </div>
          </div>
      );
  }

  return (
    <div className="w-full h-full border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <Excalidraw
        excalidrawAPI={(api) => setExcalidrawAPI(api)}
        initialData={{
            elements: init.elements,
            appState: { ...init.appState, theme },
            scrollToContent: true
        }}
        theme={theme}
        onChange={handleChange}
      />
    </div>
  );
};
