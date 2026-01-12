import { useMemo, useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { CloudItemMeta } from '../services/api';

interface GraphViewProps {
  notes: CloudItemMeta[];
  onNodeClick: (id: string) => void;
  theme: 'light' | 'dark';
}

export const GraphView = ({ notes, onNodeClick, theme }: GraphViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Handle Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight
        });
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  const data = useMemo(() => {
    const nodes = notes.map(note => {
      const parts = (note.description || '').split(' ::: ');
      const subject = parts[0] || 'General';
      return {
        id: note.id,
        name: note.name,
        group: subject,
        val: 1 // base size
      };
    });

    const links: { source: string; target: string }[] = [];
    const nodeIds = new Set(nodes.map(n => n.id));

    notes.forEach(note => {
      const parts = (note.description || '').split(' ::: ');
      // Format: Subject ::: Section ::: Tags ::: Link1|Link2
      if (parts.length >= 4) {
        const linksStr = parts[3];
        if (linksStr) {
          const targetIds = linksStr.split('|');
          targetIds.forEach(targetId => {
            if (nodeIds.has(targetId) && targetId !== note.id) {
              links.push({ source: note.id, target: targetId });
            }
          });
        }
      }
    });

    // Calculate node value (size) based on connections
    const connectionCount: Record<string, number> = {};
    links.forEach(link => {
      connectionCount[link.source] = (connectionCount[link.source] || 0) + 1;
      connectionCount[link.target] = (connectionCount[link.target] || 0) + 1;
    });

    nodes.forEach(node => {
      node.val = 1 + (connectionCount[node.id] || 0) * 0.5;
    });

    return { nodes, links };
  }, [notes]);

  const isDark = theme === 'dark';

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors">
      <ForceGraph2D
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeLabel="name"
        nodeColor={node => {
           // Simple color generation based on group string hash
           const str = (node as any).group || '';
           let hash = 0;
           for (let i = 0; i < str.length; i++) {
             hash = str.charCodeAt(i) + ((hash << 5) - hash);
           }
           const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
           return '#' + '00000'.substring(0, 6 - c.length) + c;
        }}
        linkColor={() => isDark ? '#555' : '#ccc'}
        backgroundColor={isDark ? '#0f172a' : '#f8fafc'} // slate-900 : slate-50
        onNodeClick={(node) => onNodeClick(node.id as string)}
        cooldownTicks={100}
        onEngineStop={() => {}}
      />
    </div>
  );
};
