import { pipeline, env } from '@xenova/transformers';

// Configure environment to skip local model checks and download from CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

// Singleton instances
const pipelines = {

  summarizer: null as any,

  classifier: null as any,

  extractor: null as any,

  generator: null as any,

  chatGenerator: null as any,

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
    } else if (type === 'ragQuery') {
       await handleRagQuery(id, payload);
    } else if (type === 'transcribeAudio') {
       await handleTranscribeAudio(id, payload);
    } else if (type === 'generateFlashcards') {
       await handleGenerateFlashcards(id, payload);
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

async function getChatGenerator(onProgress?: (msg: string) => void) {
    if (!pipelines.chatGenerator) {
        if (onProgress) onProgress('Loading chat model (first time only, ~300MB)...');

        pipelines.chatGenerator = await pipeline('text-generation', 'Xenova/Qwen1.5-0.5B-Chat');
    }

    return pipelines.chatGenerator;
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


        self.postMessage({ id, status: 'complete', data: (output as any).text || '' });
    } catch (e) {
        throw new Error(e instanceof Error ? e.message : String(e));
    }
}

async function handleGenerateFlashcards(id: string, { context }: { context: string }) {
    if (!context.trim()) {
        self.postMessage({ id, status: 'complete', data: '' });
        return;
    }

    const reportProgress = (msg: string) => self.postMessage({ id, status: 'progress', data: msg });

    try {
        const generator = await getChatGenerator(reportProgress);
        reportProgress('Generating flashcards...');

        const prompt = `<|im_start|>system\nYou are an AI assistant that creates high-quality Anki-style flashcards from notes. Extract the 3 to 5 most important facts from the following text and format them strictly as:\nQuestion :: Answer\nDo not include any other text.<|im_end|>\n<|im_start|>user\nText:\n${context}<|im_end|>\n<|im_start|>assistant\n`;

        const output = await generator(prompt, {
            max_new_tokens: 300,
            temperature: 0.4,
            do_sample: true,
            repetition_penalty: 1.1,
        });

        const fullText = output[0]?.generated_text || '';

        let result = fullText;
        if (fullText.includes('<|im_start|>assistant\n')) {
            result = fullText.split('<|im_start|>assistant\n')[1];
        }

        result = result.replace(/<\|im_end\|>/g, '').trim();

        self.postMessage({ id, status: 'complete', data: result });
    } catch (e) {
        throw new Error(e instanceof Error ? e.message : String(e));
    }
}

async function handleRagQuery(id: string, { query, context }: { query: string, context: string }) {
    if (!query.trim()) {
        self.postMessage({ id, status: 'complete', data: '' });
        return;
    }

    const reportProgress = (msg: string) => self.postMessage({ id, status: 'progress', data: msg });

    try {
        const generator = await getChatGenerator(reportProgress);
        reportProgress('Analyzing notes...');

        // Construct ChatML prompt format for Qwen
        const prompt = `<|im_start|>system\nYou are a helpful AI assistant built into a note-taking app. Answer the user's question STRICTLY based on the provided Context. If the context does not contain the answer, say "I cannot find the answer in your notes." Be concise.<|im_end|>\n<|im_start|>user\nContext:\n${context}\n\nQuestion: ${query}<|im_end|>\n<|im_start|>assistant\n`;

        const output = await generator(prompt, {
            max_new_tokens: 200,
            temperature: 0.3, // Low temp for more factual answers
            do_sample: true,
            repetition_penalty: 1.1,
        });

        const fullText = output[0]?.generated_text || '';

        // Extract only the assistant's response
        let result = fullText;
        if (fullText.includes('<|im_start|>assistant\n')) {
            result = fullText.split('<|im_start|>assistant\n')[1];
        }

        // Clean up any trailing end tokens
        result = result.replace(/<\|im_end\|>/g, '').trim();

        self.postMessage({ id, status: 'complete', data: result });
    } catch (e) {
        throw new Error(e instanceof Error ? e.message : String(e));
    }
}
