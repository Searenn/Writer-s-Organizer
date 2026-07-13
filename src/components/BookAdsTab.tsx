import { Tag, Link as LinkIcon, Copy, CheckCircle2, ChevronDown, ChevronUp, ImageIcon } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';

export const BookAdsTab: React.FC<{ bookId: string }> = ({ bookId }) => {
    const { state, updateBook } = useAppStore();
    const book = state.books.find(b => b.id === bookId);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [expandedBookId, setExpandedBookId] = useState<string | null>(null);

    if (!book) return null;

    const chapters = state.chapters.filter(c => c.bookId === book.id).sort((a, b) => a.order - b.order);

    // Other books by the same author (for cross-promo)
    const otherBooks = state.books.filter(b => b.accountId === book.accountId && b.id !== book.id);

    // Find where THIS book is advertised
    const advertisedIn = state.books.filter(b =>
        (b.publishedPromos || []).some(promo => promo.bookId === book.id)
    );

    const handleCopy = (id: string, title: string, link: string | undefined, text: string) => {
        if (!text) return;
        const completeText = `${title}${link ? '\n' + link : ''}\n\n${text}`;
        navigator.clipboard.writeText(completeText);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleTogglePromo = (targetBookId: string) => {
        const currentPromos = book.publishedPromos || [];
        const isActive = currentPromos.some(p => p.bookId === targetBookId);

        let newPromos;
        if (isActive) {
            newPromos = currentPromos.filter(p => p.bookId !== targetBookId);
        } else {
            newPromos = [...currentPromos, { bookId: targetBookId }];
        }
        updateBook(book.id, { publishedPromos: newPromos });
    };

    const handleUpdatePromoChapter = (targetBookId: string, chapterId: string) => {
        const currentPromos = book.publishedPromos || [];
        const newPromos = currentPromos.map(p =>
            p.bookId === targetBookId ? { ...p, chapterId: chapterId || undefined } : p
        );
        updateBook(book.id, { publishedPromos: newPromos });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto h-full overflow-y-auto w-full space-y-8 pb-20">
            <div>
                <h2 className="text-2xl font-bold text-emerald-50 tracking-tight flex items-center gap-3">
                    <Tag className="w-6 h-6 text-emerald-500" />
                    Кросс-промо и Реклама
                </h2>
                <p className="text-zinc-400 mt-1 text-sm">Управляйте взаимным пиаром: настраивайте рекламный текст этой книги и отмечайте, кого вы рекламируете здесь.</p>
            </div>

            {/* Section 1: This Book's Promo Text */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-zinc-300">Настройки рекламы этой книги</label>
                    <button
                        onClick={() => handleCopy('self', book.title, book.promoLink, book.promoText || '')}
                        disabled={!book.promoText}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 disabled:opacity-50 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs font-medium transition-colors border border-zinc-700 hover:border-emerald-500/50"
                    >
                        {copiedId === 'self' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        Копировать
                    </button>
                </div>
                <div>
                    <input
                        type="text"
                        value={book.promoLink || ''}
                        onChange={(e) => updateBook(book.id, { promoLink: e.target.value })}
                        placeholder="Ссылка на книгу..."
                        className="w-full bg-zinc-950/50 hover:bg-zinc-950 focus:bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-colors"
                    />
                </div>
                {book.coverPath && (
                    <div className="flex items-center gap-2 bg-zinc-950/50 border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm">
                        <ImageIcon className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span className="text-zinc-400 truncate flex-1" title={book.coverPath}>
                            {book.coverPath}
                        </span>
                        <button
                            onClick={() => {
                                navigator.clipboard.writeText(book.coverPath || '');
                                setCopiedId('cover');
                                setTimeout(() => setCopiedId(null), 2000);
                            }}
                            className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400 font-medium shrink-0 ml-2"
                        >
                            {copiedId === 'cover' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                            Копия пути
                        </button>
                    </div>
                )}
                <textarea
                    value={book.promoText || ''}
                    onChange={(e) => updateBook(book.id, { promoText: e.target.value })}
                    placeholder="Введите текст рекламного блока, который вы будете вставлять в другие книги..."
                    rows={4}
                    className="w-full bg-zinc-950/50 hover:bg-zinc-950 focus:bg-zinc-950 border border-zinc-800/80 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 resize-y transition-colors min-h-[120px]"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8 items-start">

                {/* Main Section: Who we promote HERE */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-4">
                        Кого мы рекламируем в этой книге
                    </h3>

                    {otherBooks.length === 0 ? (
                        <div className="text-center text-zinc-500 py-8 bg-zinc-900/50 border border-zinc-800 rounded-xl text-sm">
                            У этого аккаунта нет других книг для взаимного пиара.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {otherBooks.map(targetBook => {
                                const currentPromos = book.publishedPromos || [];
                                const promoData = currentPromos.find(p => p.bookId === targetBook.id);
                                const isPlaced = !!promoData;
                                const isExpanded = expandedBookId === targetBook.id;

                                return (
                                    <div
                                        key={targetBook.id}
                                        className={cn(
                                            "bg-zinc-900 border rounded-xl overflow-hidden transition-colors",
                                            isPlaced ? "border-emerald-500/30" : "border-zinc-800"
                                        )}
                                    >
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-4">
                                            {/* Checkbox */}
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                <button
                                                    onClick={() => handleTogglePromo(targetBook.id)}
                                                    className={cn(
                                                        "w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors",
                                                        isPlaced ? "bg-emerald-500 border-emerald-500" : "border-zinc-600 bg-zinc-800"
                                                    )}
                                                >
                                                    {isPlaced && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                                </button>
                                                <span className={cn(
                                                    "font-medium truncate transition-colors",
                                                    isPlaced ? "text-emerald-50" : "text-zinc-300"
                                                )}>
                                                    {targetBook.title}
                                                </span>
                                            </div>

                                            {/* Chapter Select */}
                                            {isPlaced && (
                                                <div className="shrink-0 flex items-center gap-2 ml-8 sm:ml-0">
                                                    <span className="text-xs text-zinc-500">Глава:</span>
                                                    <select
                                                        value={promoData.chapterId || ''}
                                                        onChange={(e) => handleUpdatePromoChapter(targetBook.id, e.target.value)}
                                                        className="bg-zinc-950 border border-zinc-700 text-xs text-zinc-300 rounded-lg px-2 py-1.5 outline-none focus:border-emerald-500 max-w-[150px]"
                                                    >
                                                        <option value="">Не указана</option>
                                                        {chapters.map(c => (
                                                            <option key={c.id} value={c.id}>{c.title}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            )}

                                            {/* Expand action */}
                                            <div className="shrink-0 ml-auto">
                                                <button
                                                    onClick={() => setExpandedBookId(isExpanded ? null : targetBook.id)}
                                                    className="flex items-center gap-1 text-xs text-zinc-400 hover:text-emerald-400 p-1 transition-colors"
                                                >
                                                    Текст {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expanded Promo Text Area */}
                                        {isExpanded && (
                                            <div className="bg-zinc-950/50 p-4 border-t border-zinc-800">
                                                {targetBook.promoText ? (
                                                    <div className="relative group">
                                                        <div className="text-sm text-zinc-300 whitespace-pre-wrap font-serif leading-relaxed bg-zinc-900 border border-zinc-800 p-4 rounded-xl min-h-[80px]">
                                                            <div className="font-bold text-zinc-100 mb-1">{targetBook.title}</div>
                                                            {targetBook.promoLink && <div className="text-emerald-400 text-xs mb-3 truncate">{targetBook.promoLink}</div>}
                                                            {targetBook.coverPath && (
                                                                <div className="flex items-center gap-1.5 text-emerald-400 text-xs mb-3 bg-zinc-950/50 p-1.5 rounded-lg border border-zinc-800/50 w-fit max-w-full">
                                                                    <ImageIcon className="w-3.5 h-3.5 shrink-0" />
                                                                    <span className="truncate" title={targetBook.coverPath}>{targetBook.coverPath}</span>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            navigator.clipboard.writeText(targetBook.coverPath || '');
                                                                            setCopiedId(`cover-${targetBook.id}`);
                                                                            setTimeout(() => setCopiedId(null), 2000);
                                                                        }}
                                                                        className="hover:text-emerald-300 ml-1 shrink-0 p-1 bg-zinc-900 rounded-md border border-zinc-700/50"
                                                                        title="Копировать путь к обложке"
                                                                    >
                                                                        {copiedId === `cover-${targetBook.id}` ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </div>
                                                            )}
                                                            {targetBook.promoText}
                                                        </div>
                                                        <button
                                                            onClick={() => handleCopy(targetBook.id, targetBook.title, targetBook.promoLink, targetBook.promoText!)}
                                                            className="absolute top-2 right-2 p-2 bg-zinc-800/80 backdrop-blur rounded-lg border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                                            title="Копировать рекламный текст"
                                                        >
                                                            {copiedId === targetBook.id ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-zinc-500 italic py-2 text-center">
                                                        У этой книги пока нет рекламного текста. Заполните его в её собственной вкладке рекламы.
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Sidebar Section: Where THIS book is advertised */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-5 sticky top-0">
                    <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2 mb-4">
                        <LinkIcon className="w-4 h-4" />
                        Где рекламируется эта книга
                    </h3>

                    {advertisedIn.length === 0 ? (
                        <p className="text-xs text-zinc-500 leading-relaxed italic">
                            В данный момент ни в одной другой книге вашего аккаунта не установлена реклама этой книги.
                        </p>
                    ) : (
                        <ul className="space-y-3">
                            {advertisedIn.map(b => {
                                const promo = b.publishedPromos?.find(p => p.bookId === book.id);
                                const chapterName = promo?.chapterId
                                    ? state.chapters.find(c => c.id === promo.chapterId)?.title
                                    : null;

                                return (
                                    <li key={b.id} className="text-sm">
                                        <div className="font-medium text-emerald-50 truncate pb-0.5">{b.title}</div>
                                        <div className="text-xs text-zinc-500 flex flex-wrap gap-1">
                                            <span>Глава:</span>
                                            <span className="text-zinc-400">{chapterName || 'Не указана'}</span>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

            </div>
        </div>
    );
};
