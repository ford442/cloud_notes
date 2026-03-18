import { pipeline, env } from '@xenova/transformers';

// Configure environment to skip local model checks and download from CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton instances
const pipelines = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  summarizer: null as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  classifier: null as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractor: null as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generator: null as any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  transcriber: null as any,
};

const DEFAULT_CANDIDATE_TAGS = [
  'Personal', 'Work', 'Meeting', 'Idea', 'Project',
  'Research', 'Todo', 'Journal', 'Technology', 'Health',
  'Finance', 'Travel', 'Learning', 'Code'
];

self.addEventListener('message', async (e) => {
  const { id, type, payload } = e.data;

  try {
    if (type === 'summarize') {
       await handleSummarize(id, payload);
    } else if (type === 'suggestTags') {
       await handleSuggestTags(id, payload);
    } else if (type === 'getEmbedding') {
       await handleGetEmbedding(id, payload);
    } else if (type === 'generateText') {
       await handleGenerateText(id, payload);
    } else if (type === 'transcribeAudio') {
       await handleTranscribeAudio(id, payload);
    } else {
       throw new Error(`Unknown message type: ${type}`);
    }
  } catch (err: unknown) {
      self.postMessage({
          id,
          status: 'error',
          error: err instanceof Error ? err.message : String(err)
      });
  }
});

async function getSummarizer(onProgress: (msg: string) => void) {
    if (!pipelines.summarizer) {
        onProgress('Loading summarization model...');
        pipelines.summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6');
    }
    return pipelines.summarizer;
}

async function getClassifier(onProgress: (msg: string) => void) {
    if (!pipelines.classifier) {
        onProgress('Loading classification model...');
        pipelines.classifier = await pipeline('zero-shot-classification', 'Xenova/mobilebert-uncased-mnli');
    }
    return pipelines.classifier;
}

async function getExtractor() {
    if (!pipelines.extractor) {
        pipelines.extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    return pipelines.extractor;
}

async function getGenerator() {
    if (!pipelines.generator) {
        pipelines.generator = await pipeline('text-generation', 'Xenova/distilgpt2');
    }
    return pipelines.generator;
}

async function getTranscriber(onProgress: (msg: string) => void) {
    if (!pipelines.transcriber) {
        onProgress('Loading transcription model...');
        pipelines.transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
    }
    return pipelines.transcriber;
}

// Handlers

async function handleSummarize(id: string, text: string) {
    if (!text.trim()) {
        self.postMessage({ id, status: 'complete', data: '' });
        return;
    }

    const reportProgress = (msg: string) => self.postMessage({ id, status: 'progress', data: msg });

    const summarizer = await getSummarizer(reportProgress);
    reportProgress('Summarizing...');

    const output = await summarizer(text, {
      max_new_tokens: 100,
    });

    self.postMessage({ id, status: 'complete', data: output[0]?.summary_text || '' });
}

async function handleSuggestTags(id: string, { text, existingTags }: { text: string, existingTags: string[] }) {
    if (!text.trim()) {
        self.postMessage({ id, status: 'complete', data: [] });
        return;
    }

    const reportProgress = (msg: string) => self.postMessage({ id, status: 'progress', data: msg });

    const classifier = await getClassifier(reportProgress);
    reportProgress('Analyzing content...');

    const candidates = Array.from(new Set([...DEFAULT_CANDIDATE_TAGS, ...(existingTags || [])]));

    const output = await classifier(text, candidates, {
      multi_label: true,
    });

    const threshold = 0.4;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const suggestedTags = output.labels.filter((_: string, index: number) => output.scores[index] > threshold);

    self.postMessage({ id, status: 'complete', data: suggestedTags.slice(0, 5) });
}

async function handleGetEmbedding(id: string, text: string) {
    if (!text.trim()) {
        self.postMessage({ id, status: 'complete', data: [] });
        return;
    }

    const extractor = await getExtractor();
    const output = await extractor(text, { pooling: 'mean', normalize: true });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    self.postMessage({ id, status: 'complete', data: Array.from((output as any).data) });
}

async function handleGenerateText(id: string, { text, maxNewTokens }: { text: string, maxNewTokens: number }) {
    if (!text.trim()) {
        self.postMessage({ id, status: 'complete', data: '' });
        return;
    }

    const generator = await getGenerator();
    const output = await generator(text, {
      max_new_tokens: maxNewTokens || 200,
      do_sample: true,
      temperature: 0.7,
    });

    const fullText = output[0]?.generated_text || '';
    let result = fullText;
    if (fullText.startsWith(text)) {
      result = fullText.slice(text.length);
    }

    self.postMessage({ id, status: 'complete', data: result });
}

async function handleTranscribeAudio(id: string, audioData: Float32Array) {
    if (!audioData) {
        self.postMessage({ id, status: 'complete', data: '' });
        return;
    }

    const reportProgress = (msg: string) => self.postMessage({ id, status: 'progress', data: msg });

    try {
        const transcriber = await getTranscriber(reportProgress);
        reportProgress('Transcribing audio...');

        // Pass Float32Array directly to the pipeline
        const output = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        self.postMessage({ id, status: 'complete', data: (output as any).text || '' });
    } catch (e) {
        throw new Error(e instanceof Error ? e.message : String(e));
    }
}
