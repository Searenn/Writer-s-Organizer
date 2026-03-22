import React, { createContext, useContext, useEffect, useState } from 'react';
import { Account, AdBlock, AppState, Book, Chapter, Character, Credential, GoogleTokens, Prompt, Setting } from './types';
import { generateId, getTextLength } from './utils';

const initialState: AppState = {
  accounts: [
    { id: '1', name: 'Эротика / СЛР (18+)' },
    { id: '2', name: 'Янг Эдалт (YA)' },
    { id: '3', name: 'Фэнтези Романтика' },
  ],
  books: [],
  chapters: [],
  characters: [],
  settings: [],
  prompts: [
    { id: '1', title: 'Генерация персонажа', content: 'Опиши персонажа для фэнтези романа. Внешность, характер, мотивация.' },
    { id: '2', title: 'Редактура главы', content: 'Отредактируй этот текст, сделай его более эмоциональным и живым, исправь ошибки.' },
  ],
  adBlocks: [],
  dailyGoal: 10000,
  writingLogs: [],
  credentials: [],
};

type AppContextType = {
  state: AppState;
  isLoading: boolean;
  addAccount: (name: string, color?: string) => void;
  updateAccount: (id: string, name: string, color?: string) => void;
  deleteAccount: (id: string) => void;
  reorderAccounts: (startIndex: number, endIndex: number) => void;
  addBook: (book: Omit<Book, 'id'>) => void;
  updateBook: (id: string, updates: Partial<Book>) => void;
  deleteBook: (id: string) => void;
  addChapter: (chapter: Omit<Chapter, 'id'>) => void;
  updateChapter: (id: string, updates: Partial<Chapter>) => void;
  deleteChapter: (id: string) => void;
  addCharacter: (character: Omit<Character, 'id'>) => void;
  updateCharacter: (id: string, updates: Partial<Character>) => void;
  deleteCharacter: (id: string) => void;
  addSetting: (setting: Omit<Setting, 'id'>) => void;
  updateSetting: (id: string, updates: Partial<Setting>) => void;
  deleteSetting: (id: string) => void;
  addPrompt: (prompt: Omit<Prompt, 'id'>) => void;
  updatePrompt: (id: string, updates: Partial<Prompt>) => void;
  deletePrompt: (id: string) => void;
  addAdBlock: (adBlock: Omit<AdBlock, 'id'>) => void;
  updateAdBlock: (id: string, updates: Partial<AdBlock>) => void;
  deleteAdBlock: (id: string) => void;
  addCredential: (credential: Omit<Credential, 'id'>) => void;
  updateCredential: (id: string, updates: Partial<Credential>) => void;
  deleteCredential: (id: string) => void;
  updateDailyGoal: (goal: number) => void;
  updateGoogleTokens: (tokens: GoogleTokens) => void;
  clearGoogleTokens: () => void;
  replaceChaptersForBook: (bookId: string, parsedChapters: { id: string | null; title: string; content: string }[]) => void;
  syncCanvasChapters: (bookId: string, headings: string[]) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);



export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);

  // Load state on startup
  useEffect(() => {
    const initStorage = async () => {
      try {
        // 1. Try to load from file (Electron)
        const savedFile = await (window as any).electron.loadState();
        if (savedFile) {
          const parsed = JSON.parse(savedFile);
          setState({ ...initialState, ...parsed });
        } else {
          // 2. Migration: If no file exists, check localStorage
          const savedLocal = localStorage.getItem('writer-organizer-state');
          if (savedLocal) {
            console.log('Migrating data from localStorage to file storage...');
            const parsed = JSON.parse(savedLocal);
            const newState = { ...initialState, ...parsed };
            setState(newState);
            // Save to file immediately for migration
            await (window as any).electron.saveState(JSON.stringify(newState));
            // Optional: clear localStorage after migration
            // localStorage.removeItem('writer-organizer-state');
          }
        }
      } catch (e) {
        console.error('Failed to load state', e);
      } finally {
        setIsLoading(false);
      }
    };

    initStorage();
  }, []);

  // Save state on changes
  useEffect(() => {
    if (!isLoading) {
      (window as any).electron.saveState(JSON.stringify(state));
    }
  }, [state, isLoading]);

  const addAccount = (name: string, color?: string) => {
    setState((s) => ({ ...s, accounts: [...s.accounts, { id: generateId(), name, color, order: s.accounts.length }] }));
  };

  const updateAccount = (id: string, name: string, color?: string) => {
    setState((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, name, color: color !== undefined ? color : a.color } : a)),
    }));
  };

  const deleteAccount = (id: string) => {
    setState((s) => {
      const booksToDelete = s.books.filter(b => b.accountId === id).map(b => b.id);
      return {
        ...s,
        accounts: s.accounts.filter(a => a.id !== id),
        books: s.books.filter(b => b.accountId !== id),
        chapters: s.chapters.filter(c => !booksToDelete.includes(c.bookId)),
        characters: s.characters.filter(c => !booksToDelete.includes(c.bookId)),
        settings: s.settings.filter(set => !booksToDelete.includes(set.bookId)),
        credentials: s.credentials.filter(cred => cred.accountId !== id),
      };
    });
  };

  const reorderAccounts = (startIndex: number, endIndex: number) => {
    setState((s) => {
      const result = Array.from(s.accounts);
      result.forEach((acc, index) => {
        if (acc.order === undefined) acc.order = index;
      });
      result.sort((a, b) => (a.order || 0) - (b.order || 0));

      const [removed] = result.splice(startIndex, 1);
      result.splice(endIndex, 0, removed);

      const updatedAccounts = result.map((acc, index) => ({
        ...acc,
        order: index
      }));

      return { ...s, accounts: updatedAccounts };
    });
  };

  const addBook = (book: Omit<Book, 'id'>) => {
    setState((s) => ({ ...s, books: [...s.books, { ...book, id: generateId() }] }));
  };

  const updateBook = (id: string, updates: Partial<Book>) => {
    setState((s) => {
      const oldBook = s.books.find(b => b.id === id);
      let newLogs = s.writingLogs || [];

      // If updating content, track character progress
      if (updates.canvasContent !== undefined && oldBook) {
        const oldLen = getTextLength(oldBook.canvasContent || '');
        const newLen = getTextLength(updates.canvasContent);
        const delta = newLen - oldLen;

        if (delta > 0) {
          const today = new Date().toISOString().split('T')[0];
          const existingLogIndex = newLogs.findIndex(l => l.date === today);

          if (existingLogIndex >= 0) {
            newLogs = [...newLogs];
            newLogs[existingLogIndex] = {
              ...newLogs[existingLogIndex],
              count: newLogs[existingLogIndex].count + delta
            };
          } else {
            newLogs = [...newLogs, { date: today, count: delta }];
          }
        }
      }

      return {
        ...s,
        books: s.books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
        writingLogs: newLogs,
      };
    });
  };

  const deleteBook = (id: string) => {
    setState((s) => ({
      ...s,
      books: s.books.filter((b) => b.id !== id),
      chapters: s.chapters.filter((c) => c.bookId !== id),
      characters: s.characters.filter((c) => c.bookId !== id),
      settings: s.settings.filter((set) => set.bookId !== id),
    }));
  };

  const addChapter = (chapter: Omit<Chapter, 'id'>) => {
    setState((s) => {
      let newLogs = s.writingLogs || [];
      if (chapter.content && chapter.content.length > 0) {
        const today = new Date().toISOString().split('T')[0];
        const existingLogIndex = newLogs.findIndex(l => l.date === today);
        if (existingLogIndex >= 0) {
          newLogs = [...newLogs];
          newLogs[existingLogIndex] = {
            ...newLogs[existingLogIndex],
            count: newLogs[existingLogIndex].count + chapter.content.length
          };
        } else {
          newLogs = [...newLogs, { date: today, count: chapter.content.length }];
        }
      }
      return { ...s, chapters: [...s.chapters, { ...chapter, id: generateId() }], writingLogs: newLogs };
    });
  };

  const updateChapter = (id: string, updates: Partial<Chapter>) => {
    setState((s) => {
      const oldChapter = s.chapters.find(c => c.id === id);
      let newLogs = s.writingLogs || [];

      if (updates.content !== undefined && oldChapter) {
        const oldLen = oldChapter.content.length;
        const newLen = updates.content.length;
        const delta = newLen - oldLen;

        if (delta > 0) {
          const today = new Date().toISOString().split('T')[0];
          const existingLogIndex = newLogs.findIndex(l => l.date === today);

          if (existingLogIndex >= 0) {
            newLogs = [...newLogs];
            newLogs[existingLogIndex] = {
              ...newLogs[existingLogIndex],
              count: newLogs[existingLogIndex].count + delta
            };
          } else {
            newLogs = [...newLogs, { date: today, count: delta }];
          }
        }
      }

      return {
        ...s,
        chapters: s.chapters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
        writingLogs: newLogs,
      };
    });
  };

  const deleteChapter = (id: string) => {
    setState((s) => ({ ...s, chapters: s.chapters.filter((c) => c.id !== id) }));
  };

  const replaceChaptersForBook = (bookId: string, parsedChapters: { id: string | null; title: string; content: string }[]) => {
    setState((s) => {
      const existingChapters = s.chapters.filter(c => c.bookId === bookId);
      const otherChapters = s.chapters.filter(c => c.bookId !== bookId);

      const newChapters: Chapter[] = [];
      let order = 1;
      let totalLengthDiff = 0;

      parsedChapters.forEach(pc => {
        const existing = pc.id ? existingChapters.find(c => c.id === pc.id) : null;
        if (existing) {
          totalLengthDiff += (pc.content.length - existing.content.length);
          newChapters.push({
            ...existing,
            title: pc.title,
            content: pc.content,
            order: order++
          });
        } else {
          totalLengthDiff += pc.content.length;
          newChapters.push({
            id: generateId(),
            bookId,
            title: pc.title,
            content: pc.content,
            order: order++,
            isPublished: false,
            hasPromo: false,
          });
        }
      });

      let newLogs = s.writingLogs || [];
      if (totalLengthDiff > 0) {
        const today = new Date().toISOString().split('T')[0];
        const existingLogIndex = newLogs.findIndex(l => l.date === today);
        if (existingLogIndex >= 0) {
          newLogs = [...newLogs];
          newLogs[existingLogIndex] = {
            ...newLogs[existingLogIndex],
            count: newLogs[existingLogIndex].count + totalLengthDiff
          };
        } else {
          newLogs = [...newLogs, { date: today, count: totalLengthDiff }];
        }
      }

      return {
        ...s,
        chapters: [...otherChapters, ...newChapters],
        writingLogs: newLogs,
      };
    });
  };

  const syncCanvasChapters = (bookId: string, headings: string[]) => {
    setState((s) => {
      const existingChapters = s.chapters.filter(c => c.bookId === bookId).sort((a, b) => a.order - b.order);
      const otherChapters = s.chapters.filter(c => c.bookId !== bookId);

      // Generate new list
      const newChapters: Chapter[] = headings.map((title, idx) => {
        const order = idx + 1;
        // Keep existing if available
        if (idx < existingChapters.length) {
          const existing = existingChapters[idx];
          return { ...existing, title, order };
        } else {
          // Create new
          return {
            id: generateId(),
            bookId,
            title,
            content: '',
            order,
            isPublished: false,
            hasPromo: false,
          };
        }
      });

      // Avoid unnecessary state updates if nothing changed
      let changed = existingChapters.length !== headings.length;
      if (!changed) {
        for (let i = 0; i < headings.length; i++) {
          if (existingChapters[i].title !== headings[i] || existingChapters[i].order !== (i + 1)) {
            changed = true;
            break;
          }
        }
      }

      if (!changed) return s;

      return {
        ...s,
        chapters: [...otherChapters, ...newChapters],
      };
    });
  };

  const addCharacter = (character: Omit<Character, 'id'>) => {
    setState((s) => ({ ...s, characters: [...s.characters, { ...character, id: generateId() }] }));
  };

  const updateCharacter = (id: string, updates: Partial<Character>) => {
    setState((s) => ({
      ...s,
      characters: s.characters.map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const deleteCharacter = (id: string) => {
    setState((s) => ({ ...s, characters: s.characters.filter((c) => c.id !== id) }));
  };

  const addSetting = (setting: Omit<Setting, 'id'>) => {
    setState((s) => ({ ...s, settings: [...s.settings, { ...setting, id: generateId() }] }));
  };

  const updateSetting = (id: string, updates: Partial<Setting>) => {
    setState((s) => ({
      ...s,
      settings: s.settings.map((set) => (set.id === id ? { ...set, ...updates } : set)),
    }));
  };

  const deleteSetting = (id: string) => {
    setState((s) => ({ ...s, settings: s.settings.filter((set) => set.id !== id) }));
  };

  const addPrompt = (prompt: Omit<Prompt, 'id'>) => {
    setState((s) => ({ ...s, prompts: [...s.prompts, { ...prompt, id: generateId() }] }));
  };

  const updatePrompt = (id: string, updates: Partial<Prompt>) => {
    setState((s) => ({
      ...s,
      prompts: s.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  const deletePrompt = (id: string) => {
    setState((s) => ({ ...s, prompts: s.prompts.filter((p) => p.id !== id) }));
  };

  const addAdBlock = (adBlock: Omit<AdBlock, 'id'>) => {
    setState((s) => ({ ...s, adBlocks: [...(s.adBlocks || []), { ...adBlock, id: generateId() }] }));
  };

  const updateAdBlock = (id: string, updates: Partial<AdBlock>) => {
    setState((s) => ({
      ...s,
      adBlocks: (s.adBlocks || []).map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  };

  const deleteAdBlock = (id: string) => {
    setState((s) => ({ ...s, adBlocks: (s.adBlocks || []).filter((a) => a.id !== id) }));
  };

  const addCredential = (credential: Omit<Credential, 'id'>) => {
    setState((s) => ({ ...s, credentials: [...(s.credentials || []), { ...credential, id: generateId() }] }));
  };

  const updateCredential = (id: string, updates: Partial<Credential>) => {
    setState((s) => ({
      ...s,
      credentials: (s.credentials || []).map((c) => (c.id === id ? { ...c, ...updates } : c)),
    }));
  };

  const deleteCredential = (id: string) => {
    setState((s) => ({ ...s, credentials: (s.credentials || []).filter((c) => c.id !== id) }));
  };

  const updateDailyGoal = (goal: number) => {
    setState((s) => ({ ...s, dailyGoal: goal }));
  };

  const updateGoogleTokens = (tokens: GoogleTokens) => {
    setState((s) => ({ ...s, googleTokens: tokens }));
  };

  const clearGoogleTokens = () => {
    setState((s) => ({ ...s, googleTokens: undefined }));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        isLoading,
        addAccount,
        updateAccount,
        deleteAccount,
        reorderAccounts,
        addBook,
        updateBook,
        deleteBook,
        addChapter,
        updateChapter,
        deleteChapter,
        addCharacter,
        updateCharacter,
        deleteCharacter,
        addSetting,
        updateSetting,
        deleteSetting,
        addPrompt,
        updatePrompt,
        deletePrompt,
        replaceChaptersForBook,
        syncCanvasChapters,
        addAdBlock,
        updateAdBlock,
        deleteAdBlock,
        addCredential,
        updateCredential,
        deleteCredential,
        updateDailyGoal,
        updateGoogleTokens,
        clearGoogleTokens,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppStore = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppStore must be used within an AppProvider');
  }
  return context;
};
