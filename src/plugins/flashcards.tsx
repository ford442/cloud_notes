import type { Plugin } from '../services/plugin';
import { markdownToHtml } from '../utils/serialization';
import { AIService } from '../services/ai';

export const FlashcardsPlugin: Plugin = {
  id: 'flashcards',
  name: 'Flashcards',
  init: (ctx) => {
    ctx.registerAction({
      id: 'review-flashcards',
      title: 'Review Flashcards',
      section: 'Actions',
      icon: <span className="text-lg">🧠</span>,
      perform: () => {
        ctx.setMode('flashcards');
      }
    });

    // Slash command to insert a flashcard template
    ctx.registerCommand({
      title: 'Flashcard',
      description: 'Insert a new flashcard',
      searchTerms: ['card', 'study', 'flashcard'],
      icon: <span className="text-lg">🗂️</span>,
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent(markdownToHtml('\n\nQuestion :: Answer\n\n')).run();
      }
    });

    ctx.registerAction({
      id: 'generate-flashcards',
      title: 'Generate Flashcards (AI)',
      section: 'Actions',
      icon: <span className="text-lg">✨</span>,
      perform: async () => {
        const note = (window as any).__DEBUG_GET_CURRENT_NOTE ? (window as any).__DEBUG_GET_CURRENT_NOTE() : null;
        if (!note || !note.content) return;

        ctx.setMode('rich');

        const originalContent = note.content;

        try {
          const cardsMarkdown = await AIService.generateFlashcards(originalContent);

          if (cardsMarkdown) {
            const newContent = `${originalContent}\n\n## AI Generated Flashcards\n\n${cardsMarkdown}`;
            ctx.updateNote({ content: newContent });

            // Re-trigger editor re-render or push to editor directly
            window.dispatchEvent(new CustomEvent('text-tool', {
              detail: { action: 'insert-html', payload: markdownToHtml(`\n\n## AI Generated Flashcards\n\n${cardsMarkdown}`) }
            }));
          }
        } catch (e) {
          console.error('Failed to generate flashcards', e);
        }
      }
    });
  }
};
