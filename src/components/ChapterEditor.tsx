import { CheckCircle2, Copy, FileText, Heading, ImageIcon, Plus, Search } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { cn, formatFilePath, parseChapters } from '../utils';
import { CanvasRichEditor, CanvasChapter } from './CanvasRichEditor';

export const ChapterEditor: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, updateBook } = useAppStore();
  const book = state.books.find(b => b.id === bookId);

  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [canvasChapters, setCanvasChapters] = useState<CanvasChapter[]>([]);
  const selectedChapterRef = useRef<number | null>(null);
  const prevChaptersLengthRef = useRef<number>(0);

  // Smart paste state
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Keep ref in sync
  selectedChapterRef.current = selectedChapterIndex;

  const handleChaptersChange = useCallback((chapters: CanvasChapter[]) => {
    const prevLen = prevChaptersLengthRef.current;
    prevChaptersLengthRef.current = chapters.length;
    setCanvasChapters(chapters);
    const selIdx = selectedChapterRef.current;
    if (selIdx === null) return;
    if (selIdx >= chapters.length) {
      // Selected chapter removed (e.g. last chapter's heading removed)
      setSelectedChapterIndex(chapters.length > 0 ? chapters.length - 1 : null);
    } else if (prevLen > chapters.length) {
      // List shrank but selIdx still in range → heading was removed from selIdx,
      // content merged into selIdx-1. Navigate there so editor shows merged chapter.
      const newIdx = Math.max(0, selIdx - 1);
      setSelectedChapterIndex(newIdx);
    }
  }, []);

  const handleSelectChapter = (index: number) => {
    setSelectedChapterIndex(index);
    setViewMode('single');
  };

  // Smart paste: insert pasted text as headings + content into canvasContent
  const handleSmartPaste = () => {
    if (!pasteText.trim()) return;

    const parsed = parseChapters(pasteText);
    const newHtml = parsed.map(p => {
      const titleHtml = `<h2>${escapeHtml(p.title)}</h2>`;
      const contentLines = p.content.split('\n');
      const contentHtml = contentLines
        .map(line => line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>')
        .join('');
      return titleHtml + contentHtml;
    }).join('');

    // Append to existing canvas content
    const existingHtml = book?.canvasContent || '';
    const mergedHtml = existingHtml + newHtml;
    updateBook(bookId, { canvasContent: mergedHtml });

    setPasteText('');
    setIsPasting(false);

    // Force mode to 'all' and then switch back to trigger reload
    setViewMode('all');
    setSelectedChapterIndex(null);
  };

  // Add empty heading at the end
  const handleAddChapter = () => {
    const existingHtml = book?.canvasContent || '';
    const chapterNum = canvasChapters.length + 1;
    const newHtml = existingHtml + `<h2>Глава ${chapterNum}</h2><div><br></div>`;
    updateBook(bookId, { canvasContent: newHtml });
    // Switch to all mode to see it, then user can click on it
    setViewMode('all');
    setSelectedChapterIndex(null);
  };

  // Get heading level indent
  const getIndent = (level: number) => {
    if (level <= 1) return 'pl-0';
    if (level === 2) return 'pl-3';
    if (level === 3) return 'pl-6';
    return 'pl-9';
  };

  // Get heading level text style
  const getHeadingStyle = (level: number) => {
    if (level <= 1) return 'text-sm font-semibold';
    if (level === 2) return 'text-sm font-medium';
    return 'text-xs font-medium';
  };

  return (
    <div className="flex h-full">
      {/* Main Editor Area */}
      <div className="flex-1 bg-zinc-950 overflow-hidden relative">
        {isPasting ? (
          <div className="absolute inset-0 bg-zinc-900 z-10 p-8 flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-zinc-100">Умная вставка текста</h2>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsPasting(false)}
                  className="px-4 py-2 text-zinc-300 hover:bg-zinc-800/50 rounded-lg font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSmartPaste}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Разбить на главы и вставить
                </button>
              </div>
            </div>
            <p className="text-zinc-400 mb-4 text-sm">
              Вставьте сюда весь текст книги. Система автоматически найдет заголовки (например, «Глава 1», «Глава 2.») и разобьет текст на отдельные главы.
            </p>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              className="flex-1 w-full p-6 border border-zinc-800 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-zinc-200 font-serif leading-relaxed bg-zinc-950"
              placeholder="Вставьте текст сюда..."
            />
          </div>
        ) : viewMode === 'single' && selectedChapterIndex === null && canvasChapters.length > 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Выберите главу справа для редактирования.
          </div>
        ) : viewMode === 'single' && canvasChapters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-3">
            <Heading className="w-12 h-12 opacity-20" />
            <p>Нет глав. Переключитесь на «Полотном» и добавьте заголовок.</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <CanvasRichEditor
              bookId={bookId}
              viewMode={viewMode}
              selectedChapterIndex={selectedChapterIndex}
              onChaptersChange={handleChaptersChange}
            />
          </div>
        )}
      </div>

      {/* Sidebar with chapters list — RIGHT side */}
      <div className="w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full overflow-hidden">
        {/* Cover at the very top */}
        {book?.coverPath && (
          <div className="p-2 border-b border-zinc-800 shrink-0">
            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
              <img
                src={formatFilePath(book.coverPath)}
                alt="Cover"
                className="w-full object-contain max-h-32"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        )}
        <div className="p-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1">
            <button
              onClick={async () => {
                const path = await window.electron.selectFile();
                if (path) {
                  updateBook(bookId, { coverPath: path });
                }
              }}
              className="hover:text-emerald-500 transition-colors"
              title="Выбрать файл"
            >
              <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
            </button>
            <input
              type="text"
              value={book?.coverPath || ''}
              onChange={(e) => updateBook(bookId, { coverPath: e.target.value })}
              placeholder="Обложка..."
              className="bg-transparent border-none text-[11px] text-zinc-400 outline-none w-full"
            />
            {book?.coverPath && (
              <button
                onClick={() => navigator.clipboard.writeText(book?.coverPath || '')}
                className="text-zinc-500 hover:text-emerald-500 transition-colors"
                title="Копировать путь"
              >
                <Copy className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* TOC header */}
        <div className="p-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <h3 className="font-semibold text-zinc-100 text-sm">Оглавление</h3>
          <div className="flex gap-1.5">
            <button
              onClick={handleAddChapter}
              className="p-1.5 text-zinc-400 hover:bg-zinc-800/50 rounded-md transition-colors"
              title="Добавить новую главу"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPasting(true)}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50/10 rounded-md transition-colors"
              title="Вставить текст с авто-разбивкой"
            >
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="p-2 border-b border-zinc-800 shrink-0">
          <div className="flex bg-zinc-800/50 p-1 rounded-lg">
            <button
              onClick={() => {
                setViewMode('single');
                if (selectedChapterIndex === null && canvasChapters.length > 0) {
                  setSelectedChapterIndex(0);
                }
              }}
              className={cn(
                'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                viewMode === 'single' ? 'bg-zinc-900 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Поглавно
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                'flex-1 text-xs font-medium py-1.5 rounded-md transition-colors',
                viewMode === 'all' ? 'bg-zinc-900 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Полотном
            </button>
          </div>
        </div>

        {/* Chapter list — fills remaining height */}
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {canvasChapters.length > 0 ? (
            canvasChapters.map((chapter, idx) => (
              <button
                key={chapter.id}
                onClick={() => handleSelectChapter(idx)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-lg transition-all border',
                  getIndent(chapter.level),
                  selectedChapterIndex === idx && viewMode === 'single'
                    ? 'bg-zinc-800 border-zinc-700 text-emerald-50'
                    : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
                )}
              >
                <div className={cn('truncate', getHeadingStyle(chapter.level))}>
                  {chapter.title}
                </div>
                <div className="text-xs opacity-50 mt-0.5">
                  {chapter.charCount.toLocaleString('ru-RU')} симв.
                </div>
              </button>
            ))
          ) : (
            <div className="p-4 text-center text-sm text-zinc-500">
              <Heading className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>Нет глав.</p>
              <p className="text-xs mt-1 text-zinc-600">
                Добавьте заголовок (H) в текст, и глава появится здесь.
              </p>
            </div>
          )}
        </div>

        {/* Chapter info bar */}
        {viewMode === 'single' && selectedChapterIndex !== null && canvasChapters[selectedChapterIndex] && (
          <div className="p-3 border-t border-zinc-800 bg-zinc-950/50 shrink-0">
            <div className="text-xs text-zinc-500">
              Глава {selectedChapterIndex + 1} из {canvasChapters.length}
            </div>
            <div className="text-xs text-zinc-600 mt-0.5">
              {canvasChapters[selectedChapterIndex].charCount.toLocaleString('ru-RU')} символов
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
