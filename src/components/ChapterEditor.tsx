import { CheckCircle2, Clock, FileText, GripVertical, Heading, ImageIcon, Plus, Search } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { cn, pickFileAsDataUrl, parseChapters } from '../utils';
import { CanvasRichEditor, CanvasChapter, CanvasRichEditorHandle, parseChaptersFromHtml, reorderChapterHtml } from './CanvasRichEditor';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export const ChapterEditor: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, updateBook } = useAppStore();
  const book = state.books.find(b => b.id === bookId);
  const bookChapters = state.chapters.filter((c) => c.bookId === bookId).sort((a, b) => a.order - b.order);

  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [canvasChapters, setCanvasChapters] = useState<CanvasChapter[]>([]);
  const selectedChapterRef = useRef<number | null>(null);
  const prevChaptersLengthRef = useRef<number>(0);
  const canvasEditorRef = useRef<CanvasRichEditorHandle>(null);
  const [activeScrollChapter, setActiveScrollChapter] = useState<number | null>(null);

  // Smart paste state
  const [isPasting, setIsPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Keep ref in sync
  selectedChapterRef.current = selectedChapterIndex;

  const handleChaptersChange = useCallback((chapters: CanvasChapter[]) => {
    prevChaptersLengthRef.current = chapters.length;
    setCanvasChapters(chapters);
    const selIdx = selectedChapterRef.current;
    if (selIdx === null) return;
    if (chapters.length === 0) {
      // All chapters gone
      setSelectedChapterIndex(null);
    } else if (selIdx >= chapters.length) {
      // Selected index now out of bounds — clamp to last
      setSelectedChapterIndex(chapters.length - 1);
    }
    // Otherwise keep the current selection as-is.
    // Do NOT auto-shift on list shrink — it causes wrong chapter to be
    // selected in single mode, leading to data loss / duplication.
  }, []);

  const handleSelectChapter = (index: number) => {
    if (viewMode === 'all') {
      // In canvas mode, scroll to the chapter instead of switching mode
      canvasEditorRef.current?.scrollToChapter(index);
    } else {
      setSelectedChapterIndex(index);
      setViewMode('single');
    }
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

    // Immediately update canvasChapters so the sidebar list refreshes
    const parsedChapters = parseChaptersFromHtml(mergedHtml);
    setCanvasChapters(parsedChapters);
    prevChaptersLengthRef.current = parsedChapters.length;

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

    // Immediately update canvasChapters so the sidebar list refreshes
    const parsedChapters = parseChaptersFromHtml(newHtml);
    setCanvasChapters(parsedChapters);
    prevChaptersLengthRef.current = parsedChapters.length;

    // Switch to all mode to see it, then user can click on it
    setViewMode('all');
    setSelectedChapterIndex(null);
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIndex(idx);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIndex !== null && idx !== dragIndex) {
      setDropIndex(idx);
    }
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dropIndex !== null && dragIndex !== dropIndex) {
      const fullHtml = book?.canvasContent || '';
      if (fullHtml) {
        const newHtml = reorderChapterHtml(fullHtml, dragIndex, dropIndex);
        updateBook(bookId, { canvasContent: newHtml });
        const parsedChapters = parseChaptersFromHtml(newHtml);
        setCanvasChapters(parsedChapters);
        prevChaptersLengthRef.current = parsedChapters.length;
        // Update selected chapter index to follow the moved chapter
        if (selectedChapterIndex === dragIndex) {
          setSelectedChapterIndex(dropIndex);
        } else if (selectedChapterIndex !== null) {
          let newSel = selectedChapterIndex;
          if (dragIndex < selectedChapterIndex && dropIndex >= selectedChapterIndex) {
            newSel--;
          } else if (dragIndex > selectedChapterIndex && dropIndex <= selectedChapterIndex) {
            newSel++;
          }
          setSelectedChapterIndex(newSel);
        }
      }
    }
    setDragIndex(null);
    setDropIndex(null);
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

  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <div className="flex h-full relative overflow-hidden">
      {/* Main Editor Area */}
      <div className="flex-1 bg-zinc-950 overflow-hidden relative">
        {/* Mobile Sidebar Toggle */}
        <button
          className="md:hidden absolute top-4 right-4 z-30 p-2.5 bg-zinc-900/90 backdrop-blur border border-zinc-800 text-zinc-300 rounded-xl shadow-lg"
          onClick={() => setShowSidebar(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
        </button>

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
          <div className="flex items-center justify-center h-full text-zinc-400 p-4 text-center">
            Выберите главу справа для редактирования.
          </div>
        ) : viewMode === 'single' && canvasChapters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-3 p-4 text-center">
            <Heading className="w-12 h-12 opacity-20" />
            <p>Нет глав. Переключитесь на «Полотном» и добавьте заголовок.</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <CanvasRichEditor
              ref={canvasEditorRef}
              bookId={bookId}
              viewMode={viewMode}
              selectedChapterIndex={selectedChapterIndex}
              onChaptersChange={handleChaptersChange}
              onActiveChapterChange={setActiveScrollChapter}
            />
          </div>
        )}
      </div>

      {/* Mobile Sidebar Overlay Backdrop */}
      {showSidebar && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar with chapters list — RIGHT side */}
      <div className={cn(
        "w-72 bg-zinc-900 border-l border-zinc-800 flex flex-col h-full overflow-hidden shrink-0 z-50",
        "absolute right-0 top-0 bottom-0 md:relative transition-transform duration-300",
        showSidebar ? "translate-x-0" : "translate-x-full md:translate-x-0"
      )}>
        {/* Cover at the very top */}
        {book?.coverPath && (
          <div className="p-2 border-b border-zinc-800 shrink-0">
            <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950">
              <img
                src={book.coverPath}
                alt="Cover"
                className="w-full object-contain max-h-32"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          </div>
        )}
        <div className="p-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1.5">
              <button
                onClick={async () => {
                  const dataUrl = await pickFileAsDataUrl('image/*');
                  if (dataUrl) {
                    updateBook(bookId, { coverPath: dataUrl });
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-emerald-400 bg-zinc-950 border border-zinc-800 hover:border-emerald-500/30 transition-all"
              >
                <ImageIcon className="w-3.5 h-3.5" />
                Обложка
              </button>
              {book?.coverPath && (
                <button
                  onClick={() => updateBook(bookId, { coverPath: undefined })}
                  className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                >
                  Убрать
                </button>
              )}
            </div>
            <button 
              className="md:hidden p-1.5 text-zinc-500 hover:text-zinc-200"
              onClick={() => setShowSidebar(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
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
              <div key={chapter.id} className="relative">
                {/* Drop indicator line */}
                {dropIndex === idx && dragIndex !== null && dragIndex !== idx && (
                  <div className="absolute -top-0.5 left-2 right-2 h-0.5 bg-emerald-500 rounded-full z-10" />
                )}
                <button
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    handleSelectChapter(idx);
                    // Close sidebar on mobile after selecting a chapter
                    if (window.innerWidth < 768) {
                      setShowSidebar(false);
                    }
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg transition-all border flex items-center gap-1.5',
                    getIndent(chapter.level),
                    selectedChapterIndex === idx && viewMode === 'single'
                      ? 'bg-zinc-800 border-zinc-700 text-emerald-50'
                      : activeScrollChapter === idx && viewMode === 'all'
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
                        : 'border-transparent text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200',
                    dragIndex === idx && 'opacity-40'
                  )}
                >
                  <GripVertical className="w-3.5 h-3.5 shrink-0 opacity-30 hover:opacity-70 cursor-grab active:cursor-grabbing" />
                  <div className="flex-1 min-w-0">
                    <div className={cn('truncate', getHeadingStyle(chapter.level))}>
                      {chapter.title}
                    </div>
                    <div className="flex items-center justify-between text-xs opacity-50 mt-0.5">
                      <span>{chapter.charCount.toLocaleString('ru-RU')} симв.</span>
                      {bookChapters[idx]?.scheduledDate && (
                        <div className="flex items-center gap-1">
                          {bookChapters[idx].isPublished ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-400" />
                          )}
                          <span>{format(new Date(bookChapters[idx].scheduledDate!), "d MMM, HH:mm", { locale: ru })}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              </div>
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
