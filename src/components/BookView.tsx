import { Calendar, Copy, Download, FileText, Settings, Users, Info, Tag, Palette } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn, canvasHtmlToPlainText, canvasHtmlToFb2, downloadFile } from '../utils';
import { ChapterEditor } from './ChapterEditor';
import { ScheduleTab } from './ScheduleTab';
import { BookInfoTab } from './BookInfoTab';
import { BookAdsTab } from './BookAdsTab';
import { MoodBoardTab } from './MoodBoardTab';
import { ColorInput } from './ColorInput';

export const BookView: React.FC<{
  bookId: string;
  activeTab: 'info' | 'chapters' | 'schedule' | 'ads' | 'mood';
  onTabChange: (tab: 'info' | 'chapters' | 'schedule' | 'ads' | 'mood') => void;
}> = ({ bookId, activeTab, onTabChange }) => {
  const { state, updateBook } = useAppStore();
  const book = state.books.find((b) => b.id === bookId);
  const [descCopied, setDescCopied] = useState(false);
  const [authorNoteCopied, setAuthorNoteCopied] = useState(false);
  const [fileExportStatus, setFileExportStatus] = useState<string | null>(null);

  if (!book) return <div className="p-8 text-zinc-400">Книга не найдена.</div>;

  const chapters = state.chapters.filter(c => c.bookId === book.id);
  const characters = state.characters.filter(c => c.bookId === book.id);
  const settings = state.settings.filter(s => s.bookId === book.id);
  // Compute total chars from canvasContent if available, otherwise from legacy chapters
  const totalChars = book.canvasContent
    ? (() => { const t = document.createElement('div'); t.innerHTML = book.canvasContent; return (t.innerText || t.textContent || '').length; })()
    : chapters.reduce((sum, c) => sum + c.content.length, 0);

  const handleExportFile = (format: 'txt' | 'fb2') => {
    if (!book.canvasContent) return;
    setFileExportStatus(`Экспорт .${format}...`);
    try {
      if (format === 'txt') {
        const text = canvasHtmlToPlainText(book.canvasContent!);
        downloadFile(text, `${book.title}.txt`);
      } else {
        const fb2 = canvasHtmlToFb2(book.canvasContent!, book.title);
        downloadFile(fb2, `${book.title}.fb2`, 'application/xml');
      }
      setFileExportStatus('Сохранено ✓');
    } catch (err: any) {
      setFileExportStatus(`Ошибка: ${err.message}`);
    }
    setTimeout(() => setFileExportStatus(null), 3000);
  };

  const handleExportToGoogleDocs = async () => {
    if (!state.googleTokens?.access_token) {
      setFileExportStatus('Подключите Google Docs в меню слева');
      setTimeout(() => setFileExportStatus(null), 3000);
      return;
    }
    if (!book.canvasContent) return;

    setFileExportStatus('Экспорт в Google Docs...');
    try {
      const { findOrCreateFolder, findOrCreateDocument, clearDocumentAndInsertText } = await import('../lib/googleApi');
      const token = state.googleTokens.access_token;
      
      const accountName = state.accounts.find(a => a.id === book.accountId)?.name || 'Писатель';
      const folderId = await findOrCreateFolder(token, accountName);
      const docId = await findOrCreateDocument(token, book.googleDocId, book.title, folderId);
      
      if (docId !== book.googleDocId) {
        updateBook(book.id, { googleDocId: docId });
      }

      await clearDocumentAndInsertText(token, docId, book.title, book.canvasContent);
      setFileExportStatus('Открываем Docs...');
      setTimeout(() => window.open(`https://docs.google.com/document/d/${docId}/edit`, '_blank'), 500);
    } catch (err: any) {
      setFileExportStatus(`Ошибка: ${err.message}`);
    }
    setTimeout(() => setFileExportStatus(null), 5000);
  };

  const tabs = [
    { id: 'info', label: 'Инфо', icon: Info },
    { id: 'chapters', label: 'Главы', icon: FileText },
    { id: 'schedule', label: 'Расписание', icon: Calendar },
    { id: 'ads', label: 'Реклама', icon: Tag },
    { id: 'mood', label: 'Mood Board', icon: Palette },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="border-b border-zinc-900 px-3 sm:px-5 py-2 sm:py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 shrink-0 bg-zinc-950">
        {/* Left Section: Color, Title, Stats, and Tabs */}
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <ColorInput
            value={book.color || '#6366f1'}
            onChange={(val) => updateBook(book.id, { color: val })}
            className="w-3.5 h-3.5 rounded-full shrink-0 cursor-pointer border-0 p-0 bg-transparent animate-pulse"
            title="Изменить цвет книги"
          />
          <div className="flex items-center gap-2 max-w-[160px] sm:max-w-[200px] shrink-0">
            <input
              type="text"
              value={book.title}
              onChange={(e) => updateBook(book.id, { title: e.target.value })}
              className="text-xs sm:text-sm font-bold text-zinc-100 bg-transparent border-none focus:ring-0 p-0 outline-none w-full truncate"
            />
          </div>
          <span className="hidden sm:inline text-[10px] text-zinc-500 font-semibold tracking-wider shrink-0 mr-2 border-r border-zinc-900 pr-4">
            {(() => {
              if (!book.canvasContent) return `${chapters.length} гл`;
              const t = document.createElement('div');
              t.innerHTML = book.canvasContent;
              const count = t.querySelectorAll('h2').length;
              return `${count} гл`;
            })()} • {totalChars.toLocaleString('ru-RU')} СИМВ.
          </span>

          <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-semibold transition-all duration-200 whitespace-nowrap',
                    isActive
                      ? 'bg-zinc-900 text-emerald-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  )}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Section: Actions */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          <select
            value={book.status}
            onChange={(e) => updateBook(book.id, { status: e.target.value as any })}
            className="px-2 py-0.5 bg-zinc-900/20 border border-zinc-900 rounded-lg text-xs font-semibold text-zinc-400 outline-none cursor-pointer focus:border-zinc-800 transition-colors"
          >
            <option value="PLANNED">В планах</option>
            <option value="IN_PROGRESS">В процессе</option>
            <option value="PUBLISHED">Опубликовано</option>
          </select>

          <select
            value={book.seriesId || ''}
            onChange={(e) => updateBook(book.id, { seriesId: e.target.value || undefined })}
            className="hidden sm:block px-2 py-0.5 bg-zinc-900/20 border border-zinc-900 rounded-lg text-xs font-semibold text-zinc-400 outline-none cursor-pointer focus:border-zinc-800 transition-colors max-w-[130px]"
            title="Цикл / Серия"
          >
            <option value="">Без цикла</option>
            {(state.series || []).filter(s => s.accountId === book.accountId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* File export buttons */}
          <div className="hidden sm:flex items-center gap-1.5 border-l border-zinc-900 pl-2.5">
            <button
              onClick={() => handleExportFile('txt')}
              disabled={!book.canvasContent}
              className="px-2 py-0.5 text-xs font-semibold rounded-md border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-zinc-350 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Экспорт в TXT"
            >
              TXT
            </button>
            <button
              onClick={() => handleExportFile('fb2')}
              disabled={!book.canvasContent}
              className="px-2 py-0.5 text-xs font-semibold rounded-md border border-zinc-900 hover:border-zinc-800 text-zinc-500 hover:text-zinc-350 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Экспорт в FB2"
            >
              FB2
            </button>
            <button
              onClick={handleExportToGoogleDocs}
              disabled={!book.canvasContent}
              className="px-2 py-0.5 text-xs font-semibold rounded-md border border-zinc-900 hover:border-emerald-500/50 text-zinc-500 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
              title="Экспорт в Google Docs"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14.18 1.5H5.25A2.25 2.25 0 0 0 3 3.75v16.5A2.25 2.25 0 0 0 5.25 22.5h13.5A2.25 2.25 0 0 0 21 20.25V8.32L14.18 1.5zM15 15.75H9v-1.5h6v1.5zm0-3H9v-1.5h6v1.5zM13.5 9V3l6 6h-6z" />
              </svg>
              DOCS
            </button>
          </div>
          {fileExportStatus && (
            <span className="text-[10px] text-zinc-500 font-medium ml-1 animate-pulse">{fileExportStatus}</span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'info' && <BookInfoTab bookId={book.id} />}
        {activeTab === 'chapters' && <ChapterEditor bookId={book.id} />}
        {activeTab === 'schedule' && <ScheduleTab bookId={book.id} />}
        {activeTab === 'ads' && <BookAdsTab bookId={book.id} />}
        {activeTab === 'mood' && <MoodBoardTab bookId={book.id} />}
      </div>
    </div>
  );
};
