import { exportToBlob } from '@excalidraw/excalidraw';
import type { Plugin } from '../services/plugin';

export const CanvasToolsPlugin: Plugin = {
  id: 'canvas-tools',
  name: 'Canvas Tools',
  init: (ctx) => {
    ctx.registerAction({
      id: 'canvas-timestamp',
      title: 'Add Timestamp to Canvas',
      section: 'Canvas',
      icon: <span className="text-lg">⏰</span>,
      perform: () => {
        const api = ctx.getCanvasAPI();
        if (!api) return alert('Canvas is not active. Switch to Canvas mode.');

        const timestamp = new Date().toLocaleString();
        const appState = api.getAppState();
        const isDark = appState.theme === 'dark';
        // Note: appState.theme might be undefined or string depending on version,
        // but checking 'dark' is safe.

        const color = isDark ? '#ffffff' : '#1e1e1e';

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element: any = {
            id: `text-${Date.now()}`,
            type: 'text',
            x: appState.scrollX + 100,
            y: appState.scrollY + 100,
            width: 200,
            height: 30,
            angle: 0,
            strokeColor: color,
            backgroundColor: 'transparent',
            fillStyle: 'hachure',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            groupIds: [],
            roundness: null,
            seed: Date.now(),
            version: 1,
            versionNonce: 0,
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            text: timestamp,
            fontSize: 20,
            fontFamily: 1,
            textAlign: 'left',
            verticalAlign: 'top',
            baseline: 18,
            containerId: null,
            originalText: timestamp,
        };

        api.updateScene({
            elements: [...api.getSceneElements(), element],
            commitToHistory: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    });

    ctx.registerAction({
      id: 'canvas-clear',
      title: 'Clear Canvas',
      section: 'Canvas',
      icon: <span className="text-lg">🗑️</span>,
      perform: () => {
        const api = ctx.getCanvasAPI();
        if (!api) return alert('Canvas is not active.');

        if (confirm('Are you sure you want to clear the canvas?')) {
            api.resetScene();
        }
      }
    });

    ctx.registerAction({
      id: 'canvas-sync-text',
      title: 'Sync Note Text to Canvas',
      section: 'Canvas',
      icon: <span className="text-lg">📝</span>,
      perform: () => {
        const api = ctx.getCanvasAPI();
        if (!api) return alert('Canvas is not active. Switch to Canvas mode.');

        const note = ctx.getCurrentNote();
        if (!note || !note.content) return alert('No text to sync.');

        const content = note.content;
        const appState = api.getAppState();
        const isDark = appState.theme === 'dark';
        const color = isDark ? '#ffffff' : '#1e1e1e';

        // Extract raw text if it's markdown or just use it directly
        // Removing simple markdown characters for cleaner canvas display
        const plainText = content.replace(/[#*`_~]/g, '').trim();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const element: any = {
            id: `text-${Date.now()}`,
            type: 'text',
            x: appState.scrollX + Math.random() * 100,
            y: appState.scrollY + Math.random() * 100,
            width: Math.min(plainText.length * 10, 400),
            height: plainText.split('\n').length * 25,
            angle: 0,
            strokeColor: color,
            backgroundColor: 'transparent',
            fillStyle: 'hachure',
            strokeWidth: 1,
            strokeStyle: 'solid',
            roughness: 1,
            opacity: 100,
            groupIds: [],
            roundness: null,
            seed: Date.now(),
            version: 1,
            versionNonce: 0,
            isDeleted: false,
            boundElements: null,
            updated: Date.now(),
            link: null,
            locked: false,
            text: plainText,
            fontSize: 20,
            fontFamily: 1,
            textAlign: 'left',
            verticalAlign: 'top',
            baseline: 18,
            containerId: null,
            originalText: plainText,
        };

        api.updateScene({
            elements: [...api.getSceneElements(), element],
            commitToHistory: true,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);
      }
    });

    ctx.registerAction({
      id: 'canvas-export-png',
      title: 'Export Canvas to Image',
      section: 'Canvas',
      icon: <span className="text-lg">🖼️</span>,
      perform: async () => {
        const api = ctx.getCanvasAPI();
        if (!api) return alert('Canvas is not active. Switch to Canvas mode.');

        try {
          const elements = api.getSceneElements();
          if (!elements || elements.length === 0) {
            return alert('Canvas is empty.');
          }

          const blob = await exportToBlob({
            elements,
            mimeType: 'image/png',
            appState: {
              ...api.getAppState(),
              exportBackground: true,
            },
            files: api.getFiles(),
          });

          if (!blob) throw new Error('Failed to create blob');

          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `canvas-export-${Date.now()}.png`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) {
          console.error(e);
          alert('Failed to export canvas.');
        }
      }
    });
  }
};
