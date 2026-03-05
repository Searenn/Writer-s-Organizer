import { BookPlus, ChevronDown, ImageIcon, Plus, SortAsc, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { BookStatus } from '../types';
import { cn, formatFilePath } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const Dashboard: React.FC<{ onSelectBook: (id: string) => void }> = ({ onSelectBook }) => {
  const { state, addBook, addAccount, deleteAccount, deleteBook } = useAppStore();
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAccount, setNewBookAccount] = useState(state.accounts[0]?.id || '');
  const [newBookColor, setNewBookColor] = useState('#6366f1');

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');

  const [sortBy, setSortBy] = useState<'title' | 'status' | 'chars' | 'chapters'>('title');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

  // Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim() || !newBookAccount) return;
    addBook({
      title: newBookTitle,
      accountId: newBookAccount,
      status: 'PLANNED',
      color: newBookColor,
    });
    setNewBookTitle('');
    setIsAddingBook(false);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    addAccount(newAccountName);
    setNewAccountName('');
    setIsAddingAccount(false);
  };

  const statusColors: Record<BookStatus, string> = {
    PLANNED: 'bg-zinc-800/30 text-zinc-400 border-zinc-800',
    IN_PROGRESS: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    PUBLISHED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  };

  const statusBorderColors: Record<BookStatus, string> = {
    PLANNED: 'border-zinc-800',
    IN_PROGRESS: 'border-amber-500/30',
    PUBLISHED: 'border-emerald-500/30',
  };

  const statusLabels: Record<BookStatus, string> = {
    PLANNED: 'В планах',
    IN_PROGRESS: 'В процессе',
    PUBLISHED: 'Опубликовано',
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 tracking-tight">Библиотека</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-1.5 shadow-sm">
            <SortAsc className="w-4 h-4 text-zinc-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-zinc-900 text-sm font-medium text-zinc-300 outline-none cursor-pointer hover:text-white transition-colors"
            >
              <option value="title">По названию</option>
              <option value="status">По статусу</option>
              <option value="chars">По символам</option>
              <option value="chapters">По главам</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setIsAddingAccount(true)}
              className="flex items-center gap-2 bg-zinc-800 text-zinc-200 px-4 py-2 rounded-xl font-medium hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Новый аккаунт
            </button>
            <button
              onClick={() => setIsAddingBook(true)}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Новая книга
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-8 bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-800/50 w-fit">
        <button
          onClick={() => setSelectedAccountId('all')}
          className={cn(
            "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
            selectedAccountId === 'all'
              ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          )}
        >
          Все авторы
        </button>
        {state.accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccountId(acc.id)}
            className={cn(
              "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
              selectedAccountId === acc.id
                ? "bg-zinc-100 text-zinc-950 shadow-lg shadow-black/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {acc.name}
          </button>
        ))}
      </div>

      {isAddingAccount && (
        <div className="mb-8 bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800">
          <h2 className="text-lg font-semibold text-emerald-50 mb-4">Добавить новый аккаунт / жанр</h2>
          <form onSubmit={handleAddAccount} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Название аккаунта</label>
              <input
                type="text"
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-zinc-950 text-zinc-100"
                placeholder="Например: Фэнтези..."
                required
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsAddingAccount(false)}
                className="px-4 py-2 text-zinc-300 hover:bg-zinc-800/50 rounded-lg font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

      {isAddingBook && (
        <div className="mb-8 bg-zinc-900 p-6 rounded-2xl shadow-sm border border-zinc-800">
          <h2 className="text-lg font-semibold text-emerald-50 mb-4">Добавить новую книгу</h2>
          <form onSubmit={handleAddBook} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Название книги</label>
              <input
                type="text"
                value={newBookTitle}
                onChange={(e) => setNewBookTitle(e.target.value)}
                className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-zinc-950 text-zinc-100"
                placeholder="Например: Академия магии..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Аккаунт / Жанр</label>
                <select
                  value={newBookAccount}
                  onChange={(e) => setNewBookAccount(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-zinc-950 text-zinc-100"
                  required
                >
                  {state.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-200 mb-1">Цвет метки</label>
                <div className="flex items-center gap-2 h-10">
                  <input
                    type="color"
                    value={newBookColor}
                    onChange={(e) => setNewBookColor(e.target.value)}
                    className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                  />
                  <span className="text-sm text-zinc-400">Для визуального разделения</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                type="button"
                onClick={() => setIsAddingBook(false)}
                className="px-4 py-2 text-zinc-300 hover:bg-zinc-800/50 rounded-lg font-medium transition-colors"
              >
                Отмена
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Сохранить
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-10">
        {state.accounts
          .filter(acc => selectedAccountId === 'all' || acc.id === selectedAccountId)
          .map((account) => {
            const accountBooks = state.books
              .filter((b) => b.accountId === account.id)
              .sort((a, b) => {
                if (sortBy === 'title') return a.title.localeCompare(b.title);
                if (sortBy === 'status') {
                  const order = { 'PUBLISHED': 0, 'IN_PROGRESS': 1, 'PLANNED': 2 };
                  return order[a.status] - order[b.status];
                }
                if (sortBy === 'chars') {
                  const getChars = (id: string) => state.chapters.filter(c => c.bookId === id).reduce((sum, c) => sum + c.content.length, 0);
                  return getChars(b.id) - getChars(a.id);
                }
                if (sortBy === 'chapters') {
                  return state.chapters.filter(c => c.bookId === b.id).length - state.chapters.filter(c => c.bookId === a.id).length;
                }
                return 0;
              });

            return (
              <div key={account.id}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-semibold text-zinc-100">{account.name}</h2>
                    <span className="px-2.5 py-0.5 bg-zinc-800/50 text-zinc-300 text-xs font-medium rounded-full">
                      {accountBooks.length} книг
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Удалить аккаунт?',
                        message: `Вы уверены, что хотите удалить аккаунт "${account.name}" и все его книги? Это действие необратимо.`,
                        onConfirm: () => deleteAccount(account.id),
                      });
                    }}
                    className="text-zinc-500 hover:text-red-500 transition-colors p-2"
                    title="Удалить аккаунт"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {accountBooks.length === 0 ? (
                  <div className="bg-zinc-950 border border-dashed border-zinc-700 rounded-2xl p-8 text-center">
                    <BookPlus className="w-8 h-8 text-zinc-500 mx-auto mb-3" />
                    <p className="text-zinc-400">В этом аккаунте пока нет книг.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accountBooks.map((book) => {
                      const chapters = state.chapters.filter(c => c.bookId === book.id);
                      const publishedCount = chapters.filter(c => c.isPublished).length;

                      return (
                        <div
                          key={book.id}
                          onClick={() => onSelectBook(book.id)}
                          className={cn(
                            "bg-zinc-900 border rounded-xl hover:shadow-lg hover:border-emerald-500/20 transition-all cursor-pointer group relative overflow-hidden",
                            statusBorderColors[book.status]
                          )}
                        >
                          <div className="flex">
                            {/* Cover — left side */}
                            {book.coverPath ? (
                              <div className="w-20 min-h-[100px] flex-shrink-0 bg-zinc-950 flex items-center justify-center overflow-hidden rounded-l-xl">
                                <img
                                  src={formatFilePath(book.coverPath)}
                                  alt={book.title}
                                  className="w-full h-full object-cover"
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              </div>
                            ) : (
                              <div className="w-20 min-h-[100px] flex-shrink-0 bg-zinc-950/50 flex items-center justify-center rounded-l-xl">
                                <div
                                  className="w-6 h-6 rounded-full opacity-40"
                                  style={{ backgroundColor: book.color }}
                                />
                              </div>
                            )}

                            {/* Info — right side */}
                            <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className={cn(
                                      'px-1.5 py-0.5 text-[9px] font-bold rounded uppercase tracking-wider border',
                                      statusColors[book.status]
                                    )}
                                  >
                                    {statusLabels[book.status]}
                                  </span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConfirmModal({
                                        isOpen: true,
                                        title: 'Удалить книгу?',
                                        message: `Вы уверены, что хотите удалить книгу "${book.title}"? Все главы и данные будут потеряны.`,
                                        onConfirm: () => deleteBook(book.id),
                                      });
                                    }}
                                    className="text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
                                    title="Удалить книгу"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                                <h3 className="text-sm font-bold text-zinc-100 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                                  {book.title}
                                </h3>
                              </div>

                              <div className="flex items-center gap-3 text-[10px] text-zinc-500 mt-2">
                                <span>Гл: {(() => {
                                  if (!book.canvasContent) return chapters.length;
                                  const t = document.createElement('div');
                                  t.innerHTML = book.canvasContent;
                                  return t.querySelectorAll('h2').length;
                                })()}</span>
                                <span>Симв: {(book.canvasContent
                                  ? (() => { const t = document.createElement('div'); t.innerHTML = book.canvasContent; return (t.innerText || t.textContent || '').length; })()
                                  : chapters.reduce((sum, c) => sum + c.content.length, 0)
                                ).toLocaleString('ru-RU')}</span>
                                <span className={publishedCount > 0 ? "text-emerald-500/70" : ""}>Опубл: {publishedCount}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
      />
    </div>
  );
};
