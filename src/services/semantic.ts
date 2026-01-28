import { AIService } from './ai';
import { db, STORE_EMBEDDINGS } from '../utils/db';

// Cosine similarity between two vectors
const cosineSimilarity = (a: number[], b: number[]) => {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  // If vectors are normalized, normA and normB should be ~1, but we calculate safely
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  if (denom === 0) return 0;
  return dot / denom;
};

export const SemanticService = {
  async indexNote(id: string, text: string) {
    // Only index if text has sufficient content
    if (!text || text.length < 30) return;

    try {
      const embedding = await AIService.getEmbedding(text);
      if (embedding && embedding.length > 0) {
        await db.set(STORE_EMBEDDINGS, id, embedding);
      }
    } catch (e) {
      console.warn('[Semantic] Failed to index note', id, e);
    }
  },

  async findSimilar(text: string, excludeId?: string, limit = 5): Promise<{ id: string; score: number }[]> {
    if (!text || text.length < 30) return [];

    try {
      const queryEmbedding = await AIService.getEmbedding(text);
      if (!queryEmbedding || queryEmbedding.length === 0) return [];

      const allEmbeddings = await db.getAll<number[]>(STORE_EMBEDDINGS);

      const scores = allEmbeddings
        .filter(item => item.key !== excludeId)
        .map(item => ({
          id: item.key,
          score: cosineSimilarity(queryEmbedding, item.value)
        }))
        .filter(item => item.score > 0.2) // Filter out very low relevance
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      return scores;
    } catch (e) {
      console.error('[Semantic] Find similar failed', e);
      return [];
    }
  }
};
