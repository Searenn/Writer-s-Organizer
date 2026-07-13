import React, { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { useAppStore } from '../store';

type Notification = {
    id: string;
    type: 'sub_open' | 'book_completed';
    bookId: string;
    bookTitle: string;
    message: string;
};

export const NotificationsWidget: React.FC<{ isCollapsed?: boolean }> = ({ isCollapsed }) => {
    const { state, updateBook } = useAppStore();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [tick, setTick] = useState(0);

    // Refresh every minute to catch time-based triggers
    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 60000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const newNotifications: Notification[] = [];
        const now = Date.now();

        state.books.forEach(book => {
            const bookChapters = state.chapters.filter(c => c.bookId === book.id);

            // 1. Check Subscription Opens
            if (book.subOpensAtChapterId && !book.notifiedSubOpen) {
                const subChapter = bookChapters.find(c => c.id === book.subOpensAtChapterId);
                if (subChapter && subChapter.scheduledDate) {
                    const schedDate = new Date(subChapter.scheduledDate).getTime();
                    if (now >= schedDate) {
                        newNotifications.push({
                            id: `${book.id}-sub`,
                            type: 'sub_open',
                            bookId: book.id,
                            bookTitle: book.title,
                            message: `Открыть подписку! (Глава: ${subChapter.title})`
                        });
                    }
                }
            }

            // 2. Check Book Completed
            if (!book.notifiedCompletion && bookChapters.length > 0) {
                const sorted = [...bookChapters].sort((a, b) => b.order - a.order);
                const lastChapter = sorted[0];
                if (lastChapter && lastChapter.scheduledDate) {
                    const lastTime = new Date(lastChapter.scheduledDate).getTime();
                    if (now >= lastTime) {
                        newNotifications.push({
                            id: `${book.id}-comp`,
                            type: 'book_completed',
                            bookId: book.id,
                            bookTitle: book.title,
                            message: `Публикация завершена! (Глава: ${lastChapter.title})`
                        });
                    }
                }
            }
        });

        setNotifications(newNotifications);
    }, [state.books, state.chapters, tick]);

    const handleDismiss = (notif: Notification) => {
        if (notif.type === 'sub_open') {
            updateBook(notif.bookId, { notifiedSubOpen: true });
        } else if (notif.type === 'book_completed') {
            updateBook(notif.bookId, { notifiedCompletion: true });
        }
    };

    if (notifications.length === 0) return null;

    if (isCollapsed) {
        return (
            <div className="flex justify-center py-2 relative" title={`Напоминания: ${notifications.length}`}>
                <div className="relative p-2 bg-amber-500/10 text-amber-500 rounded-lg animate-pulse border border-amber-500/15">
                    <Bell className="w-4 h-4" />
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[8px] font-bold text-white flex items-center justify-center">
                        {notifications.length}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-3 mb-2">
            <h3 className="text-xs font-bold text-amber-500 uppercase tracking-wider flex items-center gap-2 mb-3 px-2">
                <Bell className="w-3.5 h-3.5" />
                Напоминания ({notifications.length})
            </h3>
            <div className="space-y-2">
                {notifications.map(n => (
                    <div key={n.id} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 relative group">
                        <button
                            onClick={() => handleDismiss(n)}
                            className="absolute top-2 right-2 p-1 text-amber-500/50 hover:text-amber-400 hover:bg-amber-500/20 rounded-md transition-all"
                            title="Отметить как выполненное"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                        <div className="font-semibold text-amber-500 text-sm pr-6 mb-1">{n.bookTitle}</div>
                        <div className="text-amber-200/80 text-xs leading-snug">{n.message}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};
