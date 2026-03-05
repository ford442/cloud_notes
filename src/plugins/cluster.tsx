import type { Plugin } from '../services/plugin';
import { db, STORE_EMBEDDINGS } from '../utils/db';

const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
};

export const ClusterPlugin: Plugin = {
  id: 'ai-cluster',
  name: 'Smart Clusters',
  init: (ctx) => {
    ctx.registerAction({
      id: 'cluster-notes',
      title: 'Auto-Group Related Notes',
      section: 'AI',
      icon: <span className="text-lg">🌌</span>,
      perform: async () => {
        try {
          ctx.alert('Analyzing semantic embeddings to form clusters...');

          const allEmbeddings = await db.getAll<number[]>(STORE_EMBEDDINGS);
          const notes = ctx.getAllNotes();

          if (allEmbeddings.length < 2) {
             ctx.alert('Not enough indexed notes to form clusters. Try re-indexing from Settings -> Data.');
             return;
          }

          const clusters: { centerId: string, memberIds: string[] }[] = [];
          const assigned = new Set<string>();

          for (const item of allEmbeddings) {
            if (assigned.has(item.key)) continue;

            const clusterMembers = [item.key];
            assigned.add(item.key);

            for (const other of allEmbeddings) {
               if (assigned.has(other.key)) continue;
               const score = cosineSimilarity(item.value, other.value);
               if (score > 0.7) {
                  clusterMembers.push(other.key);
                  assigned.add(other.key);
               }
            }

            if (clusterMembers.length > 1) {
                clusters.push({ centerId: item.key, memberIds: clusterMembers });
            }
          }

          if (clusters.length === 0) {
             ctx.alert('No strong clusters found among your notes.');
             return;
          }

          let report = 'Found the following related note clusters:\n\n';
          clusters.forEach((c, i) => {
             report += `Cluster ${i + 1}:\n`;
             c.memberIds.forEach(id => {
                const note = notes.find(n => n.id === id);
                if (note) report += `  - ${note.name}\n`;
             });
             report += '\n';
          });

          ctx.alert(report);

        } catch (e) {
          console.error(e);
          ctx.alert('Clustering failed. Make sure your notes are indexed.');
        }
      }
    });
  }
};
