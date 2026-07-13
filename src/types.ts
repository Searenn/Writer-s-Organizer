export type Account = {
  id: string;
  name: string;
  order?: number;
  description?: string;
  color?: string;
};

export type Credential = {
  id: string;
  accountId: string;
  serviceName: string;
  login: string;
  password?: string;
  notes?: string;
  link?: string;
};

export type BookStatus = 'PLANNED' | 'IN_PROGRESS' | 'PUBLISHED';

export type Series = {
  id: string;
  accountId: string;
  name: string;
};

export type Book = {
  id: string;
  accountId: string;
  title: string;
  status: BookStatus;
  color: string;
  coverPath?: string;
  description?: string;
  shortDescription?: string;
  chapterPlan?: string;
  authorNote?: string;
  googleDocId?: string;
  canvasContent?: string;
  charactersCanvasContent?: string;
  adBlocks?: string[];
  subOpensAtChapterId?: string;
  notifiedSubOpen?: boolean;
  notifiedCompletion?: boolean;
  promoText?: string;
  promoLink?: string;
  publishedPromos?: { bookId: string; chapterId?: string }[];
  seriesId?: string;
  createdAt?: number;
  pipelineStage?: PipelineStage;
};

export type Chapter = {
  id: string;
  bookId: string;
  title: string;
  content: string;
  order: number;
  scheduledDate?: string; // ISO string
  isPublished: boolean;
  hasPromo: boolean;
  publishNote?: string;
};

export type Character = {
  id: string;
  bookId: string;
  name: string;
  description: string;
  aliases?: string;
  color?: string;
};

export type Setting = {
  id: string;
  bookId: string;
  title: string;
  description: string;
};

export type PromptType = 'text' | 'image' | 'music' | 'other';

export type Prompt = {
  id: string;
  title: string;
  content: string;
  accountId?: string;
  bookId?: string;
  type?: PromptType;
};

export type AdBlock = {
  id: string;
  title: string;
  content: string;
  coverPath?: string;
  accountId?: string;
};

export type WritingLog = {
  date: string; // YYYY-MM-DD
  count: number; // characters written
};

export type GoogleTokens = {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
};

export type Platform = {
  id: string;
  accountId: string;
  name: string;
};

export type EarningsEntry = {
  platformId: string;
  month: string; // "YYYY-MM"
  amount: number;
};

export type FinanceGoal = {
  month: string; // "YYYY-MM"
  amount: number;
};

export type DailyEarning = {
  date: string; // "YYYY-MM-DD"
  amount: number;
};

// Notes / Idea Catcher
export type Note = {
  id: string;
  title: string;
  content: string;
  bookId?: string;
  tags: string[];
  color?: string;
  isPinned?: boolean;
  createdAt: number;
  updatedAt: number;
};

// Mood Board
export type MoodBoardItem = {
  id: string;
  bookId: string;
  type: 'image' | 'color' | 'link' | 'text';
  content: string;
  label?: string;
  order: number;
  colSpan?: number; // 1-3
  rowSpan?: number; // 1-3
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

// Kanban Pipeline
export type PipelineStage = 'idea' | 'planning' | 'writing' | 'editing' | 'publishing' | 'promotion';

export type KanbanTask = {
  id: string;
  accountId: string;
  title: string;
  description?: string;
  color?: string;
  pipelineStage: PipelineStage;
  createdAt: number;
};


// Pomodoro
export type PomodoroSession = {
  id: string;
  bookId?: string;
  startedAt: number;
  duration: number;
  charsWritten: number;
  completed: boolean;
};

export type PomodoroSettings = {
  workMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
};

// Scheduled Tasks with recurrence
export type RecurrenceType = 'none' | 'daily' | 'every_n_days' | 'weekly' | 'monthly';

export type ScheduledTask = {
  id: string;
  title: string;
  description?: string;
  color?: string;
  date: string;              // "YYYY-MM-DD" — start date
  time?: string;             // "HH:MM"
  recurrence: RecurrenceType;
  recurrenceInterval?: number;   // every N days (for 'every_n_days')
  recurrenceWeekdays?: number[]; // 0=пн..6=вс (for 'weekly')
  recurrenceEndDate?: string;    // "YYYY-MM-DD" — repeat until
  completedDates: string[];      // dates when task was completed
  createdAt: number;
};

export type AppTheme = 'mystic-dark' | 'nordic-light' | 'warm-sepia' | 'midnight-obsidian' | 'forest-emerald';

export type AppState = {
  accounts: Account[];
  books: Book[];
  chapters: Chapter[];
  characters: Character[];
  settings: Setting[];
  prompts: Prompt[];
  adBlocks: AdBlock[];
  dailyGoal: number;
  writingLogs: WritingLog[];
  credentials: Credential[];
  googleTokens?: GoogleTokens;
  series: Series[];
  platforms: Platform[];
  earnings: EarningsEntry[];
  financeGoals: FinanceGoal[];
  dailyEarnings: DailyEarning[];
  theme?: AppTheme;
  notes: Note[];
  moodBoardItems: MoodBoardItem[];
  kanbanTasks: KanbanTask[];
  pomodoroSessions: PomodoroSession[];
  pomodoroSettings?: PomodoroSettings;
  moodBoardVersion?: number;
  scheduledTasks: ScheduledTask[];
};

