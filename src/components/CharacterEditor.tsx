import { Check, ClipboardCopy, GripVertical, Plus, Trash2, Users } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';
import { CanvasRichEditor, CanvasChapter, CanvasRichEditorHandle, parseChaptersFromHtml, reorderChapterHtml, deleteChapterHtml } from './CanvasRichEditor';
import { ConfirmationModal } from './ConfirmationModal';

export const CharacterEditor: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, updateBook, syncCharactersFromHtml } = useAppStore();
  const book = state.books.find(b => b.id === bookId);

  const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
  const [canvasChapters, setCanvasChapters] = useState<CanvasChapter[]>([]);
  const selectedChapterRef = useRef<number | null>(null);
  const canvasEditorRef = useRef<CanvasRichEditorHandle>(null);
  const [activeScrollChapter, setActiveScrollChapter] = useState<number | null>(null);

  // Drag & drop state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    index: number | null;
    name: string;
  }>({
    isOpen: false,
    index: null,
    name: '',
  });

  selectedChapterRef.current = selectedChapterIndex;

  const handleChaptersChange = useCallback((chapters: CanvasChapter[]) => {
    setCanvasChapters(chapters);
    const selIdx = selectedChapterRef.current;
    if (selIdx === null) return;
    if (chapters.length === 0) {
      setSelectedChapterIndex(null);
    } else if (selIdx >= chapters.length) {
      setSelectedChapterIndex(chapters.length - 1);
    }
  }, []);

  const handleSelectCharacter = (index: number) => {
    if (viewMode === 'all') {
      canvasEditorRef.current?.scrollToChapter(index);
    } else {
      setSelectedChapterIndex(index);
      setViewMode('single');
    }
  };

  const handleAddCharacter = () => {
    const existingHtml = book?.charactersCanvasContent || '';
    const charNum = canvasChapters.length + 1;
    const newHtml = existingHtml + `<h2>Новый персонаж ${charNum}</h2><div>Псевдонимы: </div><div>Описание внешности, характера...</div><br>`;
    updateBook(bookId, { charactersCanvasContent: newHtml });

    const parsedChapters = parseChaptersFromHtml(newHtml);
    setCanvasChapters(parsedChapters);
    syncCharactersFromHtml(bookId, newHtml);

    setViewMode('all');
    setSelectedChapterIndex(null);
  };

  const handleDeleteCharacter = () => {
    const index = deleteModal.index;
    if (index === null) return;
    const fullHtml = book?.charactersCanvasContent || '';
    if (fullHtml) {
      const newHtml = deleteChapterHtml(fullHtml, index);
      updateBook(bookId, { charactersCanvasContent: newHtml });

      const parsedChapters = parseChaptersFromHtml(newHtml);
      setCanvasChapters(parsedChapters);
      syncCharactersFromHtml(bookId, newHtml);

      if (selectedChapterIndex === index) {
        setSelectedChapterIndex(null);
      } else if (selectedChapterIndex !== null && selectedChapterIndex > index) {
        setSelectedChapterIndex(selectedChapterIndex - 1);
      }
    }
    setDeleteModal({ isOpen: false, index: null, name: '' });
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
      const fullHtml = book?.charactersCanvasContent || '';
      if (fullHtml) {
        const newHtml = reorderChapterHtml(fullHtml, dragIndex, dropIndex);
        updateBook(bookId, { charactersCanvasContent: newHtml });
        const parsedChapters = parseChaptersFromHtml(newHtml);
        setCanvasChapters(parsedChapters);
        syncCharactersFromHtml(bookId, newHtml);

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

  const handleCopyAll = async () => {
    const fullHtml = book?.charactersCanvasContent || '';
    if (!fullHtml) return;
    const temp = document.createElement('div');
    temp.innerHTML = fullHtml;
    const text = temp.innerText || temp.textContent || '';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy characters', err);
    }
  };

  const avatarColors = [
    'bg-emerald-500/10 text-emerald-450 border-emerald-500/20',
    'bg-indigo-500/10 text-indigo-455 border-indigo-500/20',
    'bg-purple-500/10 text-purple-450 border-purple-500/20',
    'bg-rose-500/10 text-rose-450 border-rose-500/20',
    'bg-amber-500/10 text-amber-450 border-amber-500/20',
  ];

  return (
    <div className="flex h-full w-full bg-zinc-950 overflow-hidden">
      {/* Main Editor Area */}
      <div className="flex-1 bg-zinc-950 overflow-hidden relative">
        {viewMode === 'single' && selectedChapterIndex === null && canvasChapters.length > 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-400">
            Выберите персонажа справа для редактирования.
          </div>
        ) : viewMode === 'single' && canvasChapters.length === 0 ? (
          <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-3">
            <Users className="w-12 h-12 opacity-20" />
            <p>Нет персонажей. Переключитесь на «Полотном» и добавьте заголовок.</p>
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
              contentType="characters"
            />
          </div>
        )}
      </div>

      {/* Sidebar with characters list — RIGHT side */}
      <div className="w-72 bg-zinc-900 border-l border-zinc-900 flex flex-col h-full overflow-hidden shrink-0">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-zinc-200 text-sm">Персонажи</h3>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleCopyAll}
              className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-md transition-colors"
              title="Скопировать всех персонажей"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleAddCharacter}
              className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-md transition-colors"
              title="Добавить персонажа"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="p-3 border-b border-zinc-800 shrink-0">
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800/60">
            <button
              onClick={() => {
                setViewMode('single');
                if (selectedChapterIndex === null && canvasChapters.length > 0) {
                  setSelectedChapterIndex(0);
                }
              }}
              className={cn(
                'flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors',
                viewMode === 'single' ? 'bg-zinc-900 text-emerald-400 shadow-sm' : 'text-zinc-550 hover:text-zinc-300'
              )}
            >
              Поперсонажно
            </button>
            <button
              onClick={() => {
                setViewMode('all');
                setSelectedChapterIndex(null);
              }}
              className={cn(
                'flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors',
                viewMode === 'all' ? 'bg-zinc-900 text-emerald-400 shadow-sm' : 'text-zinc-550 hover:text-zinc-300'
              )}
            >
              Полотном
            </button>
          </div>
        </div>

        {/* TOC List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {canvasChapters.map((char, idx) => {
            const isActive =
              (viewMode === 'single' && selectedChapterIndex === idx) ||
              (viewMode === 'all' && activeScrollChapter === idx);

            const isDragged = dragIndex === idx;
            const isOver = dropIndex === idx;
            const avatarColor = avatarColors[idx % avatarColors.length];

            return (
              <div
                key={char.id}
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'group flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border cursor-pointer select-none',
                  isActive
                    ? 'bg-zinc-800/80 border-zinc-700 text-zinc-100 shadow-sm'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30',
                  isDragged && 'opacity-40 scale-95 border-emerald-500/20 bg-emerald-500/5',
                  isOver && 'border-emerald-500 bg-emerald-500/5 border-dashed scale-105'
                )}
                onClick={() => handleSelectCharacter(idx)}
              >
                <GripVertical className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-450 cursor-grab shrink-0 transition-colors" />
                
                {/* Colored Avatar Initials */}
                <div className={cn("w-6 h-6 rounded-full flex items-center justify-center border text-[10px] font-black shrink-0", avatarColor)}>
                  {(char.title[0] || 'П').toUpperCase()}
                </div>

                <span className="flex-1 truncate font-bold text-zinc-305">{char.title}</span>
                
                <span className="text-[10px] text-zinc-600 shrink-0 font-mono">
                  {char.charCount} зн.
                </span>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteModal({
                      isOpen: true,
                      index: idx,
                      name: char.title,
                    });
                  }}
                  className="p-1 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 rounded transition-all shrink-0"
                  title="Удалить"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Удалить персонажа?"
        message={`Вы уверены, что хотите удалить персонажа "${deleteModal.name}"? Это действие удалит его описание из холста.`}
        onClose={() => setDeleteModal({ isOpen: false, index: null, name: '' })}
        onConfirm={handleDeleteCharacter}
      />
    </div>
  );
};
