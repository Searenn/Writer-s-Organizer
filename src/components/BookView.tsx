import { Calendar, CheckCircle2, Copy, ExternalLink, FileText, Loader2, Settings, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';
import { ChapterEditor } from './ChapterEditor';
import { CharacterCards } from './CharacterCards';
import { SettingCards } from './SettingCards';
import { ScheduleTab } from './ScheduleTab';

export const BookView: React.FC<{
  bookId: string;
  activeTab: 'chapters' | 'characters' | 'settings' | 'schedule';
  onTabChange: (tab: 'chapters' | 'characters' | 'settings' | 'schedule') => void;
}> = ({ bookId, activeTab, onTabChange }) => {
  const { state, updateBook, updateGoogleTokens } = useAppStore();
  const book = state.books.find((b) => b.id === bookId);
  const [descCopied, setDescCopied] = useState(false);
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

  const handleCopyDesc = () => {
    if (book.description) {
      navigator.clipboard.writeText(book.description);
      setDescCopied(true);
      setTimeout(() => setDescCopied(false), 2000);
    }
  };

  const handleExportToGoogleDocs = async () => {
    if (!state.googleTokens) return;
    setExporting(true);
    setExportError(null);

    try {
      const result = await window.electron.googleExportBook({
        book,
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
        setExportError(result.error || 'Неизвестная ошибка');
      }
    } catch (err: any) {
      setExportError(err.message);
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { id: 'chapters', label: 'Главы', icon: FileText },
    { id: 'characters', label: 'Персонажи', icon: Users },
    { id: 'settings', label: 'Сеттинг', icon: Settings },
    { id: 'schedule', label: 'Расписание', icon: Calendar },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full shadow-sm"
              style={{ backgroundColor: book.color }}
            />
            <div>
              <input
                type="text"
                value={book.title}
                onChange={(e) => updateBook(book.id, { title: e.target.value })}
                className="text-xl font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-[400px]"
              />
              <div className="text-xs text-zinc-500">
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

          <div className="flex items-center gap-3">
            {/* Google Docs export button */}
            {hasGoogleTokens ? (
              <div className="flex flex-col items-end gap-1">
                <button
                  onClick={handleExportToGoogleDocs}
                  disabled={exporting}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all border',
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
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
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
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    Открыть документ
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
                {exportError && (
                  <div className="text-xs text-red-400 max-w-[200px] text-right">{exportError}</div>
                )}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 italic">
                Подключите Google в сайдбаре для экспорта
              </div>
            )}

            <select
              value={book.status}
              onChange={(e) => updateBook(book.id, { status: e.target.value as any })}
              className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm font-medium text-zinc-200 outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="PLANNED">В планах</option>
              <option value="IN_PROGRESS">В процессе</option>
              <option value="PUBLISHED">Опубликовано</option>
            </select>
          </div>
        </div>

        {/* Annotation field */}
        <div className="relative group/desc">
          <textarea
            value={book.description || ''}
            onChange={(e) => updateBook(book.id, { description: e.target.value })}
            placeholder="Аннотация книги (для публикации)..."
            rows={2}
            className="w-full bg-zinc-800/40 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-none transition-colors"
          />
          {book.description && (
            <button
              onClick={handleCopyDesc}
              className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 backdrop-blur rounded-md border border-zinc-700 text-zinc-500 hover:text-emerald-400 hover:border-emerald-500/40 transition-all opacity-0 group-hover/desc:opacity-100"
              title="Копировать аннотацию"
            >
              {descCopied
                ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                : <Copy className="w-3.5 h-3.5" />
              }
            </button>
          )}
        </div>

        <div className="flex items-center gap-1 border-b border-zinc-800">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors',
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

      <div className="flex-1 overflow-hidden">
        {activeTab === 'chapters' && <ChapterEditor bookId={book.id} />}
        {activeTab === 'characters' && <CharacterCards bookId={book.id} />}
        {activeTab === 'settings' && <SettingCards bookId={book.id} />}
        {activeTab === 'schedule' && <ScheduleTab bookId={book.id} />}
      </div>
    </div>
  );
};
