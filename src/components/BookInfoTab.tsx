import { CheckCircle2, Copy, Info, Users, Map, AlignLeft, List, Plus, GripVertical, Trash2, ClipboardCopy, Check } from 'lucide-react';
import React, { useState, useCallback, useRef } from 'react';
import { useAppStore } from '../store';
import { CharacterEditor } from './CharacterEditor';
import { SettingCards } from './SettingCards';
import { CanvasRichEditor, CanvasChapter, CanvasRichEditorHandle, parseChaptersFromHtml, reorderChapterHtml, deleteChapterHtml } from './CanvasRichEditor';
import { ConfirmationModal } from './ConfirmationModal';
import { cn } from '../utils';

export const BookInfoTab: React.FC<{ bookId: string }> = ({ bookId }) => {
    const { state } = useAppStore();
    const book = state.books.find(b => b.id === bookId);
    
    // Sub-tab selection: annotation, short_description, chapter_plan, characters, settings
    const [activeSubTab, setActiveSubTab] = useState<'annotation' | 'short_description' | 'chapter_plan' | 'characters' | 'settings'>('annotation');

    if (!book) return null;

    const subTabs = [
        { id: 'annotation' as const, label: 'Аннотация', icon: Info },
        { id: 'short_description' as const, label: 'Краткое описание', icon: AlignLeft },
        { id: 'chapter_plan' as const, label: 'Поглавный план', icon: List },
        { id: 'characters' as const, label: 'Персонажи', icon: Users },
        { id: 'settings' as const, label: 'Сеттинг', icon: Map },
    ];

    return (
        <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
            {/* Horizontal sub-tabs navigation */}
            <div className="border-b border-zinc-900 px-6 py-2.5 bg-zinc-950 flex items-center gap-1.5 shrink-0">
                {subTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSubTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSubTab(tab.id)}
                            className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200",
                                isActive
                                    ? "bg-zinc-900 text-emerald-400 border border-zinc-800 shadow-sm"
                                    : "text-zinc-500 hover:text-zinc-300 border border-transparent"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span>{tab.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden bg-zinc-950">
                {activeSubTab === 'annotation' && (
                    <div className="h-full flex flex-col">
                        <CanvasRichEditor
                            bookId={bookId}
                            viewMode="all"
                            selectedChapterIndex={null}
                            onChaptersChange={() => {}}
                            contentType="annotation"
                        />
                    </div>
                )}
                {activeSubTab === 'short_description' && (
                    <div className="h-full flex flex-col">
                        <CanvasRichEditor
                            bookId={bookId}
                            viewMode="all"
                            selectedChapterIndex={null}
                            onChaptersChange={() => {}}
                            contentType="short_description"
                        />
                    </div>
                )}
                {activeSubTab === 'chapter_plan' && (
                    <ChapterPlanEditor bookId={bookId} />
                )}
                {activeSubTab === 'characters' && (
                    <CharacterEditor bookId={bookId} />
                )}
                {activeSubTab === 'settings' && (
                    <SettingCards bookId={bookId} />
                )}
            </div>
        </div>
    );
};

/* --- Component for Chapter-by-chapter Plan Editor --- */
const ChapterPlanEditor: React.FC<{ bookId: string }> = ({ bookId }) => {
    const { state, updateBook } = useAppStore();
    const book = state.books.find(b => b.id === bookId);

    const [viewMode, setViewMode] = useState<'single' | 'all'>('all');
    const [selectedChapterIndex, setSelectedChapterIndex] = useState<number | null>(null);
    const [canvasChapters, setCanvasChapters] = useState<CanvasChapter[]>([]);
    const selectedChapterRef = useRef<number | null>(null);
    const canvasEditorRef = useRef<CanvasRichEditorHandle>(null);
    const [activeScrollChapter, setActiveScrollChapter] = useState<number | null>(null);

    const [dragIndex, setDragIndex] = useState<number | null>(null);
    const [dropIndex, setDropIndex] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

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

    const handleSelectChapter = (index: number) => {
        if (viewMode === 'all') {
            canvasEditorRef.current?.scrollToChapter(index);
        } else {
            setSelectedChapterIndex(index);
            setViewMode('single');
        }
    };

    const handleAddChapter = () => {
        const existingHtml = book?.chapterPlan || '';
        const planNum = canvasChapters.length + 1;
        const newHtml = existingHtml + `<h2>Глава ${planNum}</h2><div>План сюжета этой главы...</div><br>`;
        updateBook(bookId, { chapterPlan: newHtml });

        const parsedChapters = parseChaptersFromHtml(newHtml);
        setCanvasChapters(parsedChapters);
        setViewMode('all');
        setSelectedChapterIndex(null);
    };

    const handleDeleteChapter = () => {
        const index = deleteModal.index;
        if (index === null) return;
        const fullHtml = book?.chapterPlan || '';
        if (fullHtml) {
            const newHtml = deleteChapterHtml(fullHtml, index);
            updateBook(bookId, { chapterPlan: newHtml });

            const parsedChapters = parseChaptersFromHtml(newHtml);
            setCanvasChapters(parsedChapters);

            if (selectedChapterIndex === index) {
                setSelectedChapterIndex(null);
            } else if (selectedChapterIndex !== null && selectedChapterIndex > index) {
                setSelectedChapterIndex(selectedChapterIndex - 1);
            }
        }
        setDeleteModal({ isOpen: false, index: null, name: '' });
    };

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
            const fullHtml = book?.chapterPlan || '';
            if (fullHtml) {
                const newHtml = reorderChapterHtml(fullHtml, dragIndex, dropIndex);
                updateBook(bookId, { chapterPlan: newHtml });
                const parsedChapters = parseChaptersFromHtml(newHtml);
                setCanvasChapters(parsedChapters);

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
        const fullHtml = book?.chapterPlan || '';
        if (!fullHtml) return;
        const temp = document.createElement('div');
        temp.innerHTML = fullHtml;
        const text = temp.innerText || temp.textContent || '';
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy plan', err);
        }
    };

    return (
        <div className="flex h-full w-full bg-zinc-950 overflow-hidden">
            {/* Main Editor Area */}
            <div className="flex-1 bg-zinc-950 overflow-hidden relative">
                {viewMode === 'single' && selectedChapterIndex === null && canvasChapters.length > 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-400">
                        Выберите главу справа для редактирования плана.
                    </div>
                ) : viewMode === 'single' && canvasChapters.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-zinc-500 flex-col gap-3">
                        <List className="w-12 h-12 opacity-20" />
                        <p>Нет глав в поглавном плане. Добавьте главу в список справа.</p>
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
                            contentType="chapter_plan"
                        />
                    </div>
                )}
            </div>

            {/* Sidebar with chapters list */}
            <div className="w-72 bg-zinc-900 border-l border-zinc-900 flex flex-col h-full overflow-hidden shrink-0">
                {/* Header */}
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <List className="w-4 h-4 text-emerald-500" />
                        <h3 className="font-bold text-zinc-200 text-sm">План глав</h3>
                    </div>
                    <div className="flex gap-1">
                        <button
                            onClick={handleCopyAll}
                            className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-md transition-colors"
                            title="Скопировать весь план"
                        >
                            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <ClipboardCopy className="w-4 h-4" />}
                        </button>
                        <button
                            onClick={handleAddChapter}
                            className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-md transition-colors"
                            title="Добавить главу в план"
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
                            По главам
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

                {/* Chapters list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {canvasChapters.length === 0 ? (
                        <div className="p-4 text-center text-xs text-zinc-650">
                            План глав пуст. Нажмите +, чтобы добавить первую главу.
                        </div>
                    ) : (
                        canvasChapters.map((char, idx) => {
                            const isActive =
                                (viewMode === 'single' && selectedChapterIndex === idx) ||
                                (viewMode === 'all' && activeScrollChapter === idx);

                            const isDragged = dragIndex === idx;
                            const isOver = dropIndex === idx;

                            return (
                                <div
                                    key={char.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, idx)}
                                    onDragOver={(e) => handleDragOver(e, idx)}
                                    onDragEnd={handleDragEnd}
                                    className={cn(
                                        'group flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium transition-all duration-200 border cursor-pointer select-none',
                                        isActive
                                            ? 'bg-zinc-800/80 border-zinc-700 text-zinc-100 shadow-sm'
                                            : 'border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-zinc-800/30',
                                        isDragged && 'opacity-40 scale-95 border-emerald-500/20 bg-emerald-500/5',
                                        isOver && 'border-emerald-500 bg-emerald-500/5 border-dashed scale-105'
                                    )}
                                    onClick={() => handleSelectChapter(idx)}
                                >
                                    <GripVertical className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-450 cursor-grab shrink-0 transition-colors" />
                                    <span className="flex-1 truncate font-semibold">{char.title}</span>
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
                                        className="p-1 opacity-0 group-hover:opacity-100 text-zinc-550 hover:text-red-400 rounded transition-all shrink-0"
                                        title="Удалить главу из плана"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                title="Удалить главу из плана?"
                message={`Вы уверены, что хотите удалить главу "${deleteModal.name}"? Это действие удалит её из холста поглавного плана.`}
                onClose={() => setDeleteModal({ isOpen: false, index: null, name: '' })}
                onConfirm={handleDeleteChapter}
            />
        </div>
    );
};
