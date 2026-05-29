import { useMemo, useState, useEffect, useRef } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { CloudItemMeta } from '../services/api';

interface GraphViewProps {
  notes: CloudItemMeta[];
  currentId?: string | null;
  onNodeClick: (id: string) => void;
  theme: 'light' | 'dark';
}

export const GraphView = ({ notes, currentId, onNodeClick, theme }: GraphViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const graphRef = useRef<any>(null);

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
    // Initial delay to allow layout to settle
    const tm = setTimeout(updateDimensions, 100);

    return () => {
      window.removeEventListener('resize', updateDimensions);
      clearTimeout(tm);
    };
  }, []);

  const data = useMemo(() => {
    const nodes = notes.map(note => {
      const parts = (note.description || '').split(' ::: ');
      const subject = parts[0] || 'General';

      // Use the first tag as a secondary grouping if available
      const tags = parts[2] ? parts[2].split(',')[0].trim() : '';
      const group = tags || subject;

      return {
        id: note.id,
        name: note.name,
        group: group,
        isCurrent: note.id === currentId,
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
      const connections = connectionCount[node.id] || 0;
      node.val = node.isCurrent ? 10 : Math.max(2, connections * 1.5);
    });

    return { nodes, links };
  }, [notes, currentId]);

  // Center on selected node when it changes
  useEffect(() => {
    if (currentId && graphRef.current) {
      // Find the node
      const node = data.nodes.find(n => n.id === currentId);
      if (node) {
        // graphRef.current.centerAt(node.x, node.y, 1000);
        // graphRef.current.zoom(2, 1000);
      }
    }
  }, [currentId, data]);

  const isDark = theme === 'dark';
  const textColor = isDark ? 'rgba(255, 255, 255, 0.8)' : 'rgba(0, 0, 0, 0.8)';
  const highlightColor = '#ec4899'; // Pink-500

  return (
    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900 transition-colors relative">
       {notes.length === 0 && (
         <div className="absolute text-slate-400">No notes to visualize</div>
       )}
      <ForceGraph2D
        ref={graphRef}
        width={dimensions.width}
        height={dimensions.height}
        graphData={data}
        nodeLabel="name"

        nodeColor={(node: any) => {
           if (node.isCurrent) return highlightColor;

           // Simple color generation based on group string hash
           const str = node.group || '';
           let hash = 0;
           for (let i = 0; i < str.length; i++) {
             hash = str.charCodeAt(i) + ((hash << 5) - hash);
           }
           const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
           return '#' + '00000'.substring(0, 6 - c.length) + c;
        }}
        linkColor={() => isDark ? '#334155' : '#cbd5e1'} // slate-700 : slate-300
        backgroundColor={isDark ? '#0f172a' : '#f8fafc'} // slate-900 : slate-50

        onNodeClick={(node: any) => onNodeClick(node.id as string)}
        cooldownTicks={100}

        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
          const label = node.name;
          const isCurrent = node.isCurrent;
          const fontSize = isCurrent ? 14/globalScale : 12/globalScale;
          const radius = Math.sqrt(node.val || 1) * 4;

          // Draw Node
          ctx.beginPath();
          ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI, false);
          ctx.fillStyle = node.color || 'rgba(255, 255, 255, 0.8)';
          ctx.fill();

          if (isCurrent) {
            ctx.lineWidth = 2 / globalScale;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
          }

          // Draw Label (only if current or zoomed in)
          if (isCurrent || globalScale > 1.5) {
            ctx.font = `${fontSize}px Sans-Serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = textColor;
            ctx.fillText(label, node.x!, node.y! + radius + fontSize);
          }
        }}

        onNodeHover={(node: any) => {
           if (containerRef.current) {
             containerRef.current.style.cursor = node ? 'pointer' : 'default';
           }
        }}
      />
    </div>
  );
};
