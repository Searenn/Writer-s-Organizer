import { Calendar, CheckCircle2, Copy, ExternalLink, FileText, Loader2, Settings, Users, Info, Tag } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';
import { ChapterEditor } from './ChapterEditor';
import { ScheduleTab } from './ScheduleTab';
import { BookInfoTab } from './BookInfoTab';
import { BookAdsTab } from './BookAdsTab';

export const BookView: React.FC<{
  bookId: string;
  activeTab: 'info' | 'chapters' | 'schedule' | 'ads';
  onTabChange: (tab: 'info' | 'chapters' | 'schedule' | 'ads') => void;
}> = ({ bookId, activeTab, onTabChange }) => {
  const { state, updateBook, updateGoogleTokens } = useAppStore();
  const book = state.books.find((b) => b.id === bookId);
  const [descCopied, setDescCopied] = useState(false);
  const [authorNoteCopied, setAuthorNoteCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ docId: string; docUrl: string } | null>(
    book?.googleDocId ? { docId: book.googleDocId, docUrl: `https://docs.google.com/document/d/${book.googleDocId}/edit` } : null
  );
  const [exportError, setExportError] = useState<string | null>(null);

  if (!book) return <div className="p-8 text-zinc-400">Книга не найдена.</div>;

  const chapters = state.chapters.filter(c => c.bookId === book.id);
  const characters = state.characters.filter(c => c.bookId === book.id);
  const settings = state.settings.filter(s => s.bookId === book.id);
  // Compute total chars from canvasContent if available, otherwise from legacy chapters
  const totalChars = book.canvasContent
    ? (() => { const t = document.createElement('div'); t.innerHTML = book.canvasContent; return (t.innerText || t.textContent || '').length; })()
    : chapters.reduce((sum, c) => sum + c.content.length, 0);

  const hasGoogleTokens = !!state.googleTokens;

  const handleExportToGoogleDocs = async () => {
    if (!state.googleTokens) return;
    setExporting(true);
    setExportError(null);

    try {
      const account = state.accounts.find(a => a.id === book.accountId);
      const result = await window.electron.googleExportBook({
        book,
        accountName: account?.name || 'Unknown Author',
        chapters,
        characters,
        settings,
        tokens: state.googleTokens,
      });

      if (result.success && result.docId && result.docUrl) {
        // Save updated tokens (may have been refreshed)
        if (result.updatedTokens) {
          updateGoogleTokens(result.updatedTokens);
        }
        // Save docId to book
        updateBook(book.id, { googleDocId: result.docId });
        setExportResult({ docId: result.docId, docUrl: result.docUrl });
      } else {
        if (result.error === 'invalid_grant' || result.error?.includes('invalid_grant')) {
          setExportError('Токен устарел или отозван. Пожалуйста, отключите и подключите Google заново.');
          updateGoogleTokens(undefined as any);
        } else {
          setExportError(result.error || 'Неизвестная ошибка');
        }
      }
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Инфо', icon: Info },
    { id: 'chapters', label: 'Главы', icon: FileText },
    { id: 'schedule', label: 'Расписание', icon: Calendar },
    { id: 'ads', label: 'Реклама', icon: Tag },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 pt-5 flex items-stretch justify-between gap-8">
        {/* Left Column: Title, Note fields and Tabs */}
        <div className="flex flex-col justify-between flex-1 min-w-[50%]">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full shadow-sm shrink-0"
              style={{ backgroundColor: book.color }}
            />
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={book.title}
                onChange={(e) => updateBook(book.id, { title: e.target.value })}
                className="text-xl font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-full"
              />
              <div className="text-xs text-zinc-500 mt-1">
                {(() => {
                  if (!book.canvasContent) return `${chapters.length} глав`;
                  const t = document.createElement('div');
                  t.innerHTML = book.canvasContent;
                  const count = t.querySelectorAll('h2').length;
                  return `${count} глав`;
                })()} • {totalChars.toLocaleString('ru-RU')} символов
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 -mb-px mt-auto pt-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Actions */}
        <div className="flex flex-col gap-4 pb-5 shrink-0 pl-4 border-l border-zinc-800/50">
          <div className="flex flex-col items-end gap-3">
            <select
              value={book.status}
              onChange={(e) => updateBook(book.id, { status: e.target.value as any })}
              className="px-4 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg text-sm font-medium text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500 w-full"
            >
              <option value="PLANNED">В планах</option>
              <option value="IN_PROGRESS">В процессе</option>
              <option value="PUBLISHED">Опубликовано</option>
            </select>

            {hasGoogleTokens ? (
              <div className="flex flex-col items-end gap-1 w-full">
                <button
                  onClick={handleExportToGoogleDocs}
                  disabled={exporting}
                  className={cn(
                    'flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border shrink-0 w-full',
                    exporting
                      ? 'border-zinc-700 text-zinc-500 bg-zinc-800/50 cursor-not-allowed'
                      : 'border-blue-500/40 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/60'
                  )}
                >
                  {exporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Экспорт...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                      </svg>
                      {exportResult ? 'Обновить в Google Docs' : 'Экспорт в Google Docs'}
                    </>
                  )}
                </button>
                {exportResult && !exporting && (
                  <a
                    href={exportResult.docUrl}
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(exportResult.docUrl, '_blank');
                    }}
                    className="flex items-center justify-end gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer w-full mt-1"
                  >
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    Открыть документ
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
                {exportError && (
                  <div className="text-xs text-red-400 w-full text-right mt-1">{exportError}</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 italic py-2 text-right">
                Подключите Google для экспорта
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === 'info' && <BookInfoTab bookId={book.id} />}
        {activeTab === 'chapters' && <ChapterEditor bookId={book.id} />}
        {activeTab === 'schedule' && <ScheduleTab bookId={book.id} />}
        {activeTab === 'ads' && <BookAdsTab bookId={book.id} />}
      </div>
    </div>
  );
};
