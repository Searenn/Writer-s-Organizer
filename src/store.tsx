import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from './lib/firebase';
import { Account, AdBlock, AppState, AppTheme, Book, Chapter, Character, Credential, DailyEarning, EarningsEntry, FinanceGoal, GoogleTokens, KanbanTask, MoodBoardItem, Note, Platform, PomodoroSession, PomodoroSettings, Prompt, ScheduledTask, Series, Setting } from './types';
import { generateId, getTextLength, getCanvasChaptersLength, getLocalISODate } from './utils';

const STORAGE_KEY = 'writer-organizer-state';

const initialState: AppState = {
  accounts: [],
  books: [],
  chapters: [],
  characters: [],
  settings: [],
  prompts: [],
  adBlocks: [],
  dailyGoal: 10000,
  writingLogs: [],
  credentials: [],
  series: [],
  platforms: [],
  earnings: [],
  financeGoals: [],
  dailyEarnings: [],
  theme: 'mystic-dark',
  notes: [],
  moodBoardItems: [],
  kanbanTasks: [],
  pomodoroSessions: [],
  moodBoardVersion: 2,
  scheduledTasks: [],
};


type AppContextType = {
  state: AppState;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
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
  syncCharactersFromHtml: (bookId: string, html: string) => void;
  addSeries: (series: Omit<Series, 'id'>) => void;
  updateSeries: (id: string, updates: Partial<Series>) => void;
  deleteSeries: (id: string) => void;
  addPlatform: (platform: Omit<Platform, 'id'>) => void;
  updatePlatform: (id: string, updates: Partial<Platform>) => void;
  deletePlatform: (id: string) => void;
  upsertEarnings: (entry: EarningsEntry) => void;
  deleteEarnings: (platformId: string, month: string) => void;
  upsertFinanceGoal: (goal: FinanceGoal) => void;
  upsertDailyEarning: (entry: DailyEarning) => void;
  deleteDailyEarning: (date: string) => void;
  setTheme: (theme: AppTheme) => void;
  // Notes
  addNote: (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePinNote: (id: string) => void;
  // MoodBoard
  addMoodBoardItem: (item: Omit<MoodBoardItem, 'id'>) => void;
  updateMoodBoardItem: (id: string, updates: Partial<MoodBoardItem>) => void;
  updateMoodBoardItems: (updates: { id: string; updates: Partial<MoodBoardItem> }[]) => void;
  deleteMoodBoardItem: (id: string) => void;
  // Kanban Tasks
  addKanbanTask: (task: Omit<KanbanTask, 'id' | 'createdAt'>) => void;
  updateKanbanTask: (id: string, updates: Partial<KanbanTask>) => void;
  deleteKanbanTask: (id: string) => void;
  // Pomodoro
  addPomodoroSession: (session: Omit<PomodoroSession, 'id'>) => void;
  updatePomodoroSettings: (settings: PomodoroSettings) => void;
  // Scheduled Tasks
  addScheduledTask: (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'completedDates'>) => void;
  updateScheduledTask: (id: string, updates: Partial<ScheduledTask>) => void;
  deleteScheduledTask: (id: string) => void;
  toggleScheduledTaskDate: (id: string, date: string) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);



export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>(initialState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Load state on startup from Firebase — per user path: /users/{uid}/data/main
  useEffect(() => {
    const loadFromDB = async () => {
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setIsLoading(false);
          return;
        }

        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');

        const userDocRef = doc(db, 'users', uid, 'data', 'main');
        const userDocSnap = await getDoc(userDocRef);

        let parsed: any = null;

        if (userDocSnap.exists()) {
          parsed = userDocSnap.data();
        }


        if (parsed) {
          let moodBoardItems = parsed.moodBoardItems || [];
          let moodBoardVersion = parsed.moodBoardVersion || 1;

          if (moodBoardVersion < 2) {
            moodBoardItems = moodBoardItems.map((item: any) => {
              let colSpan = item.colSpan;
              let rowSpan = item.rowSpan;

              if (colSpan === undefined || colSpan <= 3) {
                const oldCol = colSpan || 1;
                if (oldCol === 1) colSpan = 3;
                else if (oldCol === 2) colSpan = 6;
                else if (oldCol === 3) colSpan = 9;
              }
              if (rowSpan === undefined || rowSpan <= 3) {
                const oldRow = rowSpan || 1;
                if (oldRow === 1) rowSpan = 3;
                else if (oldRow === 2) rowSpan = 6;
                else if (oldRow === 3) rowSpan = 9;
              }

            return { ...item, colSpan, rowSpan };
            });
            moodBoardVersion = 2;
          }

          // Convert maps back to arrays if they were saved as maps (due to Firestore nested arrays constraint)
          let books = parsed.books || [];
          if (books && !Array.isArray(books)) {
            books = Object.values(books);
          }

          let notes = parsed.notes || [];
          if (notes && !Array.isArray(notes)) {
            notes = Object.values(notes);
          }

          let scheduledTasks = parsed.scheduledTasks || [];
          if (scheduledTasks && !Array.isArray(scheduledTasks)) {
            scheduledTasks = Object.values(scheduledTasks);
          }

          setState({
            ...initialState,
            ...parsed,
            books,
            notes,
            scheduledTasks,
            moodBoardItems,
            moodBoardVersion,
            kanbanTasks: parsed.kanbanTasks || [],
          });
        }
      } catch (e) {
        console.error('Failed to load state from Firebase', e);
      } finally {
        setIsLoading(false);
      }
    };

    loadFromDB();
  }, []);

  // Save state on changes to Firebase (debounced) — per user
  useEffect(() => {
    if (isLoading) return;

    setIsSaving(true);
    setSaveError(null);

    const timer = setTimeout(async () => {
      let cleanState: any = null;
      try {
        const uid = auth.currentUser?.uid;
        if (!uid) {
          setIsSaving(false);
          return;
        }

        const { doc, setDoc } = await import('firebase/firestore');
        const { db } = await import('./lib/firebase');
        // Don't persist google tokens to cloud — they're short-lived
        const { googleTokens, ...stateToSave } = state;
        try {
          cleanState = JSON.parse(JSON.stringify(stateToSave));
        } catch (err: any) {
          throw new Error(`Serialization: ${err.message}`);
        }

        // Convert arrays containing nested arrays to maps to prevent Firestore "Property array contains an invalid nested entity" error
        if (Array.isArray(cleanState.books)) {
          const booksMap: Record<string, any> = {};
          cleanState.books.forEach((book: any) => {
            if (book.id) booksMap[book.id] = book;
          });
          cleanState.books = booksMap;
        }

        if (Array.isArray(cleanState.notes)) {
          const notesMap: Record<string, any> = {};
          cleanState.notes.forEach((note: any) => {
            if (note.id) notesMap[note.id] = note;
          });
          cleanState.notes = notesMap;
        }

        if (Array.isArray(cleanState.scheduledTasks)) {
          const tasksMap: Record<string, any> = {};
          cleanState.scheduledTasks.forEach((task: any) => {
            if (task.id) tasksMap[task.id] = task;
          });
          cleanState.scheduledTasks = tasksMap;
        }

        // Helper to find any nested arrays inside arrays
        const findNestedArrays = (val: any, inArray = false, path = ''): string[] => {
          if (!val || typeof val !== 'object') return [];
          const result: string[] = [];
          if (Array.isArray(val)) {
            if (inArray) {
              result.push(`${path} (nested array)`);
            }
            val.forEach((item, index) => {
              result.push(...findNestedArrays(item, true, `${path}[${index}]`));
            });
          } else {
            Object.keys(val).forEach(key => {
              result.push(...findNestedArrays(val[key], inArray, path ? `${path}.${key}` : key));
            });
          }
          return result;
        };

        const nestedArrays = findNestedArrays(cleanState);
        if (nestedArrays.length > 0) {
          console.warn('CRITICAL: Nested arrays found in cleanState:', nestedArrays);
          fetch('/api/debug-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'nestedArrays', nestedArrays, cleanState })
          }).catch(() => {});
        }

        await setDoc(doc(db, 'users', uid, 'data', 'main'), cleanState);
        setIsSaving(false);
      } catch (e: any) {
        console.error('Failed to save state to Firebase', e);
        
        let debugMsg = '';
        try {
          if (cleanState) {
            const getInvalidFields = (val: any, path = ''): string[] => {
              if (val === undefined) return [`${path} is undefined`];
              if (val === null) return [];
              if (typeof val === 'function') return [`${path} is a function`];
              if (typeof val !== 'object') return [];
              
              const result: string[] = [];
              if (Array.isArray(val)) {
                val.forEach((item, index) => {
                  if (Array.isArray(item)) {
                    result.push(`${path}[${index}] is a nested array`);
                  } else {
                    result.push(...getInvalidFields(item, `${path}[${index}]`));
                  }
                });
              } else {
                const proto = Object.getPrototypeOf(val);
                if (proto !== null && proto !== Object.prototype) {
                  result.push(`${path} is a custom class (${proto.constructor?.name || 'unknown'})`);
                  return result;
                }
                Object.keys(val).forEach(key => {
                  result.push(...getInvalidFields(val[key], path ? `${path}.${key}` : key));
                });
              }
              return result;
            };
            
            const invalidFields = getInvalidFields(cleanState);
            if (invalidFields.length > 0) {
              debugMsg = ` | Невалидные поля: ${invalidFields.slice(0, 5).join(', ')}`;
            }
          } else {
            debugMsg = ` | Ошибка сериализации состояния`;
          }
        } catch (err: any) {
          debugMsg = ` | Ошибка при разборе отладки: ${err.message || err.toString()}`;
        }

        setSaveError(`${e.message || 'Ошибка сохранения'}${debugMsg}`);
        setIsSaving(false);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timer);
  }, [state, isLoading]);

  // Sync theme with HTML document element
  useEffect(() => {
    const activeTheme = state.theme || 'mystic-dark';
    document.documentElement.setAttribute('data-theme', activeTheme);
  }, [state.theme]);

  const setTheme = (theme: AppTheme) => {
    setState((s) => ({ ...s, theme }));
  };

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
        kanbanTasks: (s.kanbanTasks || []).filter((t) => t.accountId !== id),
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
    setState((s) => ({ ...s, books: [...s.books, { ...book, id: generateId(), createdAt: Date.now() }] }));
  };

  const updateBook = (id: string, updates: Partial<Book>) => {
    setState((s) => {
      const oldBook = s.books.find(b => b.id === id);
      let newLogs = s.writingLogs || [];

      // If updating content, track character progress
      if (updates.canvasContent !== undefined && oldBook) {
        const oldLen = getCanvasChaptersLength(oldBook.canvasContent || '');
        const newLen = getCanvasChaptersLength(updates.canvasContent);
        const delta = newLen - oldLen;

        if (delta > 0) {
          const today = getLocalISODate();
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
        const today = getLocalISODate();
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
          const today = getLocalISODate();
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
        const today = getLocalISODate();
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

      // Track which existing chapters have been claimed
      const claimed = new Set<number>();

      // First pass: match by title at same index (exact position match)
      const matchedIndices: (number | null)[] = headings.map((title, idx) => {
        if (idx < existingChapters.length && !claimed.has(idx) && existingChapters[idx].title === title) {
          claimed.add(idx);
          return idx;
        }
        return null;
      });

      // Second pass: for unmatched headings, find any unclaimed chapter with matching title
      matchedIndices.forEach((matched, idx) => {
        if (matched !== null) return;
        const title = headings[idx];
        const found = existingChapters.findIndex((c, i) => !claimed.has(i) && c.title === title);
        if (found !== -1) {
          claimed.add(found);
          matchedIndices[idx] = found;
        }
      });

      // Third pass: for still-unmatched headings, fall back to unclaimed by nearest index
      matchedIndices.forEach((matched, idx) => {
        if (matched !== null) return;
        if (idx < existingChapters.length && !claimed.has(idx)) {
          claimed.add(idx);
          matchedIndices[idx] = idx;
        }
      });

      // Build the new chapters list
      const newChapters: Chapter[] = headings.map((title, idx) => {
        const order = idx + 1;
        const existingIdx = matchedIndices[idx];
        if (existingIdx !== null) {
          const existing = existingChapters[existingIdx];
          return { ...existing, title, order };
        } else {
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

  const syncCharactersFromHtml = (bookId: string, html: string) => {
    setState((s) => {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      const headings = Array.from(temp.querySelectorAll('h2'));
      
      const parsedCharacters: Character[] = headings.map((heading, idx) => {
        const name = heading.textContent?.trim() || 'Новый персонаж';
        const nextHeading = headings[idx + 1] || null;
        const range = document.createRange();
        range.setStartAfter(heading);
        if (nextHeading) {
          range.setEndBefore(nextHeading);
        } else {
          range.setEnd(temp, temp.childNodes.length);
        }
        const fragment = range.cloneContents();
        const div = document.createElement('div');
        div.appendChild(fragment);

        let aliases = '';
        let description = div.innerText || div.textContent || '';
        
        const aliasMatch = description.match(/(?:Псевдонимы|Псевдоним):\s*([^\n\r]*)/i);
        if (aliasMatch) {
          aliases = aliasMatch[1].trim();
          description = description.replace(/(?:Псевдонимы|Псевдоним):\s*[^\n\r]*/i, '').trim();
        }
        
        const existingChar = s.characters.find(c => c.bookId === bookId && c.name === name);
        const color = existingChar?.color || '#10b981';

        return {
          id: existingChar?.id || `${bookId}-char-${idx}`,
          bookId,
          name,
          description: description.trim(),
          aliases,
          color
        };
      });

      const otherChars = s.characters.filter(c => c.bookId !== bookId);
      const currentChars = s.characters.filter(c => c.bookId === bookId);
      
      let changed = currentChars.length !== parsedCharacters.length;
      if (!changed) {
        for (let i = 0; i < parsedCharacters.length; i++) {
          const c1 = currentChars[i];
          const c2 = parsedCharacters[i];
          if (!c1 || c1.name !== c2.name || c1.description !== c2.description || c1.aliases !== c2.aliases) {
            changed = true;
            break;
          }
        }
      }

      if (!changed) return s;

      return {
        ...s,
        characters: [...otherChars, ...parsedCharacters]
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

  // Series CRUD
  const addSeries = (series: Omit<Series, 'id'>) => {
    setState((s) => ({ ...s, series: [...(s.series || []), { ...series, id: generateId() }] }));
  };

  const updateSeries = (id: string, updates: Partial<Series>) => {
    setState((s) => ({
      ...s,
      series: (s.series || []).map((sr) => (sr.id === id ? { ...sr, ...updates } : sr)),
    }));
  };

  const deleteSeries = (id: string) => {
    setState((s) => ({
      ...s,
      series: (s.series || []).filter((sr) => sr.id !== id),
      books: s.books.map((b) => (b.seriesId === id ? { ...b, seriesId: undefined } : b)),
    }));
  };

  // Platform CRUD
  const addPlatform = (platform: Omit<Platform, 'id'>) => {
    setState((s) => ({ ...s, platforms: [...(s.platforms || []), { ...platform, id: generateId() }] }));
  };

  const updatePlatform = (id: string, updates: Partial<Platform>) => {
    setState((s) => ({
      ...s,
      platforms: (s.platforms || []).map((p) => (p.id === id ? { ...p, ...updates } : p)),
    }));
  };

  const deletePlatform = (id: string) => {
    setState((s) => ({
      ...s,
      platforms: (s.platforms || []).filter((p) => p.id !== id),
      earnings: (s.earnings || []).filter((e) => e.platformId !== id),
    }));
  };

  // Earnings upsert/delete
  const upsertEarnings = (entry: EarningsEntry) => {
    setState((s) => {
      const earnings = [...(s.earnings || [])];
      const idx = earnings.findIndex((e) => e.platformId === entry.platformId && e.month === entry.month);
      if (idx >= 0) {
        earnings[idx] = entry;
      } else {
        earnings.push(entry);
      }
      return { ...s, earnings };
    });
  };

  const deleteEarnings = (platformId: string, month: string) => {
    setState((s) => ({
      ...s,
      earnings: (s.earnings || []).filter((e) => !(e.platformId === platformId && e.month === month)),
    }));
  };

  // Finance goals upsert
  const upsertFinanceGoal = (goal: FinanceGoal) => {
    setState((s) => {
      const goals = [...(s.financeGoals || [])];
      const idx = goals.findIndex((g) => g.month === goal.month);
      if (idx >= 0) {
        goals[idx] = goal;
      } else {
        goals.push(goal);
      }
      return { ...s, financeGoals: goals };
    });
  };

  // Daily earnings upsert/delete
  const upsertDailyEarning = (entry: DailyEarning) => {
    setState((s) => {
      const dailyEarnings = [...(s.dailyEarnings || [])];
      const idx = dailyEarnings.findIndex((e) => e.date === entry.date);
      if (idx >= 0) {
        dailyEarnings[idx] = entry;
      } else {
        dailyEarnings.push(entry);
      }
      return { ...s, dailyEarnings };
    });
  };

  const deleteDailyEarning = (date: string) => {
    setState((s) => ({
      ...s,
      dailyEarnings: (s.dailyEarnings || []).filter((e) => e.date !== date),
    }));
  };

  // ---- Notes CRUD ----
  const addNote = (note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    setState((s) => ({ ...s, notes: [...(s.notes || []), { ...note, id: generateId(), createdAt: now, updatedAt: now }] }));
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setState((s) => ({
      ...s,
      notes: (s.notes || []).map((n) => (n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n)),
    }));
  };

  const deleteNote = (id: string) => {
    setState((s) => ({ ...s, notes: (s.notes || []).filter((n) => n.id !== id) }));
  };

  const togglePinNote = (id: string) => {
    setState((s) => ({
      ...s,
      notes: (s.notes || []).map((n) => (n.id === id ? { ...n, isPinned: !n.isPinned, updatedAt: Date.now() } : n)),
    }));
  };

  // ---- MoodBoard CRUD ----
  const addMoodBoardItem = (item: Omit<MoodBoardItem, 'id'>) => {
    setState((s) => ({ ...s, moodBoardItems: [...(s.moodBoardItems || []), { ...item, id: generateId() }] }));
  };

  const updateMoodBoardItem = (id: string, updates: Partial<MoodBoardItem>) => {
    setState((s) => ({
      ...s,
      moodBoardItems: (s.moodBoardItems || []).map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  };

  const updateMoodBoardItems = (updatesList: { id: string; updates: Partial<MoodBoardItem> }[]) => {
    setState((s) => {
      const updatesMap = new Map(updatesList.map(u => [u.id, u.updates]));
      return {
        ...s,
        moodBoardItems: (s.moodBoardItems || []).map((m) => {
          const u = updatesMap.get(m.id);
          return u ? { ...m, ...u } : m;
        }),
      };
    });
  };

  const deleteMoodBoardItem = (id: string) => {
    setState((s) => ({ ...s, moodBoardItems: (s.moodBoardItems || []).filter((m) => m.id !== id) }));
  };

  // ---- Kanban Tasks CRUD ----
  const addKanbanTask = (task: Omit<KanbanTask, 'id' | 'createdAt'>) => {
    setState((s) => ({
      ...s,
      kanbanTasks: [...(s.kanbanTasks || []), { ...task, id: generateId(), createdAt: Date.now() }]
    }));
  };

  const updateKanbanTask = (id: string, updates: Partial<KanbanTask>) => {
    setState((s) => ({
      ...s,
      kanbanTasks: (s.kanbanTasks || []).map((t) => (t.id === id ? { ...t, ...updates } : t))
    }));
  };

  const deleteKanbanTask = (id: string) => {
    setState((s) => ({
      ...s,
      kanbanTasks: (s.kanbanTasks || []).filter((t) => t.id !== id)
    }));
  };

  // ---- Pomodoro ----
  const addPomodoroSession = (session: Omit<PomodoroSession, 'id'>) => {
    setState((s) => ({ ...s, pomodoroSessions: [...(s.pomodoroSessions || []), { ...session, id: generateId() }] }));
  };

  const updatePomodoroSettings = (settings: PomodoroSettings) => {
    setState((s) => ({ ...s, pomodoroSettings: settings }));
  };

  // ---- Scheduled Tasks ----
  const addScheduledTask = (task: Omit<ScheduledTask, 'id' | 'createdAt' | 'completedDates'>) => {
    setState((s) => ({
      ...s,
      scheduledTasks: [...(s.scheduledTasks || []), { ...task, id: generateId(), createdAt: Date.now(), completedDates: [] }]
    }));
  };

  const updateScheduledTask = (id: string, updates: Partial<ScheduledTask>) => {
    setState((s) => ({
      ...s,
      scheduledTasks: (s.scheduledTasks || []).map((t) => (t.id === id ? { ...t, ...updates } : t))
    }));
  };

  const deleteScheduledTask = (id: string) => {
    setState((s) => ({
      ...s,
      scheduledTasks: (s.scheduledTasks || []).filter((t) => t.id !== id)
    }));
  };

  const toggleScheduledTaskDate = (id: string, date: string) => {
    setState((s) => ({
      ...s,
      scheduledTasks: (s.scheduledTasks || []).map((t) => {
        if (t.id !== id) return t;
        const completed = t.completedDates.includes(date)
          ? t.completedDates.filter((d) => d !== date)
          : [...t.completedDates, date];
        return { ...t, completedDates: completed };
      })
    }));
  };

  return (
    <AppContext.Provider
      value={{
        state,
        isLoading,
        isSaving,
        saveError,
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
        syncCharactersFromHtml,
        addAdBlock,
        updateAdBlock,
        deleteAdBlock,
        addCredential,
        updateCredential,
        deleteCredential,
        updateDailyGoal,
        updateGoogleTokens,
        clearGoogleTokens,
        addSeries,
        updateSeries,
        deleteSeries,
        addPlatform,
        updatePlatform,
        deletePlatform,
        upsertEarnings,
        deleteEarnings,
        upsertFinanceGoal,
        upsertDailyEarning,
        deleteDailyEarning,
        setTheme,
        addNote,
        updateNote,
        deleteNote,
        togglePinNote,
        addMoodBoardItem,
        updateMoodBoardItem,
        updateMoodBoardItems,
        deleteMoodBoardItem,
        addKanbanTask,
        updateKanbanTask,
        deleteKanbanTask,
        addPomodoroSession,
        updatePomodoroSettings,
        addScheduledTask,
        updateScheduledTask,
        deleteScheduledTask,
        toggleScheduledTaskDate,
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
