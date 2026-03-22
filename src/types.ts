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
  adBlocks?: string[];
  subOpensAtChapterId?: string;
  notifiedSubOpen?: boolean;
  notifiedCompletion?: boolean;
  promoText?: string;
  promoLink?: string;
  publishedPromos?: { bookId: string; chapterId?: string }[];
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

export type Prompt = {
  id: string;
  title: string;
  content: string;
  accountId?: string;
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
};
