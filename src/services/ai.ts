import { pipeline, env } from '@xenova/transformers';

// Configure environment to skip local model checks and download from CDN
// Since we are running in browser, we want it to fetch from Hugging Face Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

interface AIServiceState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summarizer: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classifier: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractor: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: any;
  isSummarizerLoading: boolean;
  isClassifierLoading: boolean;
  isExtractorLoading: boolean;
  isGeneratorLoading: boolean;
}

const state: AIServiceState = {
  summarizer: null,
  classifier: null,
  extractor: null,
  generator: null,
  isSummarizerLoading: false,
  isClassifierLoading: false,
  isExtractorLoading: false,
  isGeneratorLoading: false,
};

// Available candidate labels for zero-shot classification if no existing tags are provided
const DEFAULT_CANDIDATE_TAGS = [
  'Personal', 'Work', 'Meeting', 'Idea', 'Project',
  'Research', 'Todo', 'Journal', 'Technology', 'Health',
  'Finance', 'Travel', 'Learning', 'Code'
];

export const AIService = {

  async getSummarizer() {
    if (state.summarizer) return state.summarizer;
    if (state.isSummarizerLoading) {
      // Simple wait loop if already loading
      while (state.isSummarizerLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return state.summarizer;
    }

    try {
      state.isSummarizerLoading = true;
      // Use a smaller model for summarization in browser
      state.summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
      return state.summarizer;
    } finally {
      state.isSummarizerLoading = false;
    }
  },

  async getClassifier() {
    if (state.classifier) return state.classifier;
    if (state.isClassifierLoading) {
      while (state.isClassifierLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return state.classifier;
    }

    try {
      state.isClassifierLoading = true;
      // A smaller zero-shot classification model
      state.classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
      return state.classifier;
    } finally {
      state.isClassifierLoading = false;
    }
  },

  async getExtractor() {
    if (state.extractor) return state.extractor;
    if (state.isExtractorLoading) {
      while (state.isExtractorLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return state.extractor;
    }

    try {
      state.isExtractorLoading = true;
      // Standard model for embeddings
      state.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
      return state.extractor;
    } finally {
      state.isExtractorLoading = false;
    }
  },

  async getGenerator() {
    if (state.generator) return state.generator;
    if (state.isGeneratorLoading) {
      while (state.isGeneratorLoading) {
        await new Promise(r => setTimeout(r, 100));
      }
      return state.generator;
    }

    try {
      state.isGeneratorLoading = true;
      state.generator = await pipeline('text-generation', 'Xenova/distilgpt2');
      return state.generator;
    } finally {
      state.isGeneratorLoading = false;
    }
  },

  async summarize(text: string, onProgress?: (msg: string) => void): Promise<string> {
    if (!text.trim()) return '';

    if (onProgress) onProgress('Loading summarization model...');
    const summarizer = await this.getSummarizer();

    if (onProgress) onProgress('Summarizing...');
    const output = await summarizer(text, {
      max_new_tokens: 100,
    });

    // Output is array of [{ summary_text: string }]
    return output[0]?.summary_text || '';
  },

  async suggestTags(text: string, existingTags: string[] = [], onProgress?: (msg: string) => void): Promise<string[]> {
    if (!text.trim()) return [];

    if (onProgress) onProgress('Loading classification model...');
    const classifier = await this.getClassifier();

    if (onProgress) onProgress('Analyzing content...');

    // Combine defaults with existing tags to give the model a good set to choose from
    // Uniqify
    const candidates = Array.from(new Set([...DEFAULT_CANDIDATE_TAGS, ...existingTags]));

    const output = await classifier(text, candidates, {
      multi_label: true,
    });

    // output format: { sequence: string, labels: string[], scores: number[] }
    // Filter tags with score > threshold
    const threshold = 0.4;
    const suggestedTags = output.labels.filter((_: string, index: number) => output.scores[index] > threshold);

    return suggestedTags.slice(0, 5); // Return top 5
  },

  async getEmbedding(text: string): Promise<number[]> {
    if (!text.trim()) return [];

    const extractor = await this.getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });

    // Output is a Tensor, we need to convert it to array
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return Array.from((output as any).data);
  },

  async generateText(text: string, maxNewTokens = 200): Promise<string> {
    if (!text.trim()) return '';

    const generator = await this.getGenerator();
    const output = await generator(text, {
      max_new_tokens: maxNewTokens,
      do_sample: true,
      temperature: 0.7,
    });

    // Output is array of [{ generated_text: string }]
    // We only want the new part, but the model usually returns full text.
    // We strip the prompt from the result to avoid duplication.
    const fullText = output[0]?.generated_text || '';
    if (fullText.startsWith(text)) {
      return fullText.slice(text.length);
    }
    return fullText;
  }
};
