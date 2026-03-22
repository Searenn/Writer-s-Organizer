import { CheckCircle2, Copy, Info, Users, Map, AlignLeft, List } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { CharacterCards } from './CharacterCards';
import { SettingCards } from './SettingCards';
import { cn } from '../utils';

export const BookInfoTab: React.FC<{ bookId: string }> = ({ bookId }) => {
    const { state, updateBook } = useAppStore();
    const book = state.books.find(b => b.id === bookId);
    const [descCopied, setDescCopied] = useState(false);
    const [shortDescCopied, setShortDescCopied] = useState(false);
    const [chapterPlanCopied, setChapterPlanCopied] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState<'annotation' | 'short_description' | 'chapter_plan' | 'characters' | 'settings'>('annotation');

    if (!book) return null;

    const handleCopyDesc = () => {
        if (book.description) {
            navigator.clipboard.writeText(book.description);
            setDescCopied(true);
            setTimeout(() => setDescCopied(false), 2000);
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-950">
            {/* Inner Tabs Header */}
            <div className="flex items-center justify-center pt-6 pb-4 border-b border-zinc-900 bg-zinc-950">
                <div className="flex bg-zinc-900/80 p-1 rounded-xl border border-zinc-800 shadow-sm">
                    <button
                        onClick={() => setActiveSubTab('annotation')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                            activeSubTab === 'annotation'
                                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        )}
                    >
                        <Info className="w-4 h-4" />
                        Аннотация
                    </button>
                    <button
                        onClick={() => setActiveSubTab('short_description')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                            activeSubTab === 'short_description'
                                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        )}
                    >
                        <AlignLeft className="w-4 h-4" />
                        Краткое описание
                    </button>
                    <button
                        onClick={() => setActiveSubTab('chapter_plan')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                            activeSubTab === 'chapter_plan'
                                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        )}
                    >
                        <List className="w-4 h-4" />
                        Поглавный план
                    </button>
                    <button
                        onClick={() => setActiveSubTab('characters')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                            activeSubTab === 'characters'
                                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        )}
                    >
                        <Users className="w-4 h-4" />
                        Персонажи
                    </button>
                    <button
                        onClick={() => setActiveSubTab('settings')}
                        className={cn(
                            "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
                            activeSubTab === 'settings'
                                ? "bg-zinc-800 text-zinc-100 shadow-sm"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50"
                        )}
                    >
                        <Map className="w-4 h-4" />
                        Сеттинг
                    </button>
                </div>
            </div>

            {/* Inner Content Component */}
            <div className="flex-1 overflow-hidden">
                {activeSubTab === 'annotation' && (
                    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto w-full">
                        <div className="mb-8 text-center mt-4">
                            <h2 className="text-2xl font-bold text-emerald-50 tracking-tight flex items-center justify-center gap-3">
                                Аннотация
                            </h2>
                            <p className="text-zinc-400 mt-2 text-sm">Общее описание книги для публикации на площадках.</p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
                            <div className="relative group/desc w-full">
                                <textarea
                                    value={book.description || ''}
                                    onChange={(e) => updateBook(book.id, { description: e.target.value })}
                                    placeholder="Введите аннотацию книги здесь..."
                                    className="w-full bg-zinc-950/50 hover:bg-zinc-950 focus:bg-zinc-950 border border-zinc-800/80 rounded-xl px-5 py-5 text-[15px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-y transition-colors min-h-[300px]"
                                />
                                {book.description && (
                                    <button
                                        onClick={handleCopyDesc}
                                        className="absolute top-4 right-4 p-2 bg-zinc-800/80 backdrop-blur rounded-lg border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all opacity-0 group-hover/desc:opacity-100 shadow-sm"
                                        title="Копировать аннотацию"
                                    >
                                        {descCopied
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            : <Copy className="w-4 h-4" />
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {activeSubTab === 'short_description' && (
                    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto w-full">
                        <div className="mb-8 text-center mt-4">
                            <h2 className="text-2xl font-bold text-emerald-50 tracking-tight flex items-center justify-center gap-3">
                                Краткое описание
                            </h2>
                            <p className="text-zinc-400 mt-2 text-sm">Короткая версия аннотации для рекламных постов или логлайна.</p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
                            <div className="relative group/desc w-full">
                                <textarea
                                    value={book.shortDescription || ''}
                                    onChange={(e) => updateBook(book.id, { shortDescription: e.target.value })}
                                    placeholder="Введите краткое описание книги здесь..."
                                    className="w-full bg-zinc-950/50 hover:bg-zinc-950 focus:bg-zinc-950 border border-zinc-800/80 rounded-xl px-5 py-5 text-[15px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-y transition-colors min-h-[300px]"
                                />
                                {book.shortDescription && (
                                    <button
                                        onClick={() => {
                                            if (book.shortDescription) {
                                                navigator.clipboard.writeText(book.shortDescription);
                                                setShortDescCopied(true);
                                                setTimeout(() => setShortDescCopied(false), 2000);
                                            }
                                        }}
                                        className="absolute top-4 right-4 p-2 bg-zinc-800/80 backdrop-blur rounded-lg border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all opacity-0 group-hover/desc:opacity-100 shadow-sm"
                                        title="Копировать краткое описание"
                                    >
                                        {shortDescCopied
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            : <Copy className="w-4 h-4" />
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {activeSubTab === 'chapter_plan' && (
                    <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto w-full">
                        <div className="mb-8 text-center mt-4">
                            <h2 className="text-2xl font-bold text-emerald-50 tracking-tight flex items-center justify-center gap-3">
                                Поглавный план
                            </h2>
                            <p className="text-zinc-400 mt-2 text-sm">План событий и сюжета по главам.</p>
                        </div>

                        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm">
                            <div className="relative group/desc w-full">
                                <textarea
                                    value={book.chapterPlan || ''}
                                    onChange={(e) => updateBook(book.id, { chapterPlan: e.target.value })}
                                    placeholder="Введите поглавный план здесь..."
                                    className="w-full bg-zinc-950/50 hover:bg-zinc-950 focus:bg-zinc-950 border border-zinc-800/80 rounded-xl px-5 py-5 text-[15px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-y transition-colors min-h-[300px]"
                                />
                                {book.chapterPlan && (
                                    <button
                                        onClick={() => {
                                            if (book.chapterPlan) {
                                                navigator.clipboard.writeText(book.chapterPlan);
                                                setChapterPlanCopied(true);
                                                setTimeout(() => setChapterPlanCopied(false), 2000);
                                            }
                                        }}
                                        className="absolute top-4 right-4 p-2 bg-zinc-800/80 backdrop-blur rounded-lg border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all opacity-0 group-hover/desc:opacity-100 shadow-sm"
                                        title="Копировать поглавный план"
                                    >
                                        {chapterPlanCopied
                                            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            : <Copy className="w-4 h-4" />
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {activeSubTab === 'characters' && (
                    <CharacterCards bookId={bookId} />
                )}
                {activeSubTab === 'settings' && (
                    <SettingCards bookId={bookId} />
                )}
            </div>
        </div>
    );
};
