import type { Plugin } from '../services/plugin';

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
        editor.chain().focus().deleteRange(range).insertContent('\n\nQuestion :: Answer\n\n').run();
      }
    });
  }
};
