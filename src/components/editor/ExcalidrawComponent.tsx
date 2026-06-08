import React, { useMemo, useState } from 'react'
import { NodeViewWrapper } from '@tiptap/react'
import { Excalidraw } from '@excalidraw/excalidraw'
import "@excalidraw/excalidraw/index.css"

export const ExcalidrawComponent = (props: any) => {
  const node = props.node;
  const updateAttributes = props.updateAttributes;
  const dataString = node.attrs.data;

  const [isEditing, setIsEditing] = useState(false);
  const [tempData, setTempData] = useState<any>(null);

  const parsedData = useMemo(() => {
      try {
          return JSON.parse(dataString);
      } catch (e) {
          return null;
      }
  }, [dataString]);

  if (!parsedData) {
    return (
      <NodeViewWrapper className="excalidraw-component my-4 relative">
         <div className="p-4 bg-slate-100 dark:bg-slate-800 text-slate-500 text-center rounded border border-slate-200 dark:border-slate-700">
            Invalid Excalidraw Data
         </div>
      </NodeViewWrapper>
    )
  }

  const handleEdit = () => {
      setTempData(parsedData);
      setIsEditing(true);
  };

  // Keep a ref to avoid triggering infinite re-renders inside `onChange`
  const lastStateRef = React.useRef<any>(null);

  const handleSave = () => {
      if (lastStateRef.current) {
          updateAttributes({ data: JSON.stringify(lastStateRef.current) });
      } else if (tempData) {
          updateAttributes({ data: JSON.stringify(tempData) });
      }
      setIsEditing(false);
  };

  return (
    <NodeViewWrapper className={`not-prose excalidraw-component border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden my-4 shadow-sm relative group ${isEditing ? 'ring-2 ring-blue-500 z-50' : ''}`}>

      {/* Controls */}
      <div className="absolute top-2 right-2 z-[100] flex gap-2">
          {!isEditing ? (
              <button
                onClick={handleEdit}
                className="bg-white/80 dark:bg-slate-800/80 backdrop-blur px-3 py-1 rounded text-xs font-medium text-slate-700 dark:text-slate-200 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white dark:hover:bg-slate-700"
              >
                Edit Sketch
              </button>
          ) : (
              <button
                onClick={handleSave}
                className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium shadow-sm hover:bg-blue-700 transition-colors pointer-events-auto"
              >
                Done
              </button>
          )}
      </div>

      <div style={{ height: '500px', width: '100%', position: 'relative' }}>
         <Excalidraw
            key={isEditing ? 'editing' : 'viewing'}
            initialData={{
                elements: parsedData.elements,
                appState: {
                    ...parsedData.appState,
                    viewBackgroundColor: 'transparent',
                    scrollX: 0,
                    scrollY: 0
                },
                scrollToContent: true
            }}
            viewModeEnabled={!isEditing}
            zenModeEnabled={!isEditing}
            gridModeEnabled={isEditing}
            onChange={(elements, appState) => {
                if (isEditing) {
                    lastStateRef.current = { elements, appState };
                }
            }}
         />
      </div>
    </NodeViewWrapper>
  )
}
