import { BookPlus, ChevronDown, Edit2, ImageIcon, Plus, SortAsc, Trash2, Layers, X, Search, BookOpen, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { BookStatus } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';
import { ColorInput } from './ColorInput';

export const Dashboard: React.FC<{ onSelectBook: (id: string) => void }> = ({ onSelectBook }) => {
  const { state, addBook, updateBook, addAccount, updateAccount, deleteAccount, deleteBook, reorderAccounts, addSeries } = useAppStore();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  
  const [isAddingBook, setIsAddingBook] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newBookAccount, setNewBookAccount] = useState(state.accounts[0]?.id || '');
  const [newBookColor, setNewBookColor] = useState('#6366f1');
  const [newBookSeriesId, setNewBookSeriesId] = useState<string>('');
  const [newSeriesName, setNewSeriesName] = useState('');
  const [isCreatingNewSeries, setIsCreatingNewSeries] = useState(false);

  const [isEditingBook, setIsEditingBook] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editBookTitle, setEditBookTitle] = useState('');
  const [editBookAccount, setEditBookAccount] = useState('');
  const [editBookColor, setEditBookColor] = useState('#6366f1');
  const [editBookSeriesId, setEditBookSeriesId] = useState('');
  const [editBookCoverPath, setEditBookCoverPath] = useState('');
  const [isCreatingNewSeriesInEdit, setIsCreatingNewSeriesInEdit] = useState(false);
  const [editNewSeriesName, setEditNewSeriesName] = useState('');

  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountColor, setNewAccountColor] = useState('#10b981');

  const [sortBy, setSortBy] = useState<'date' | 'title' | 'status' | 'chars' | 'chapters'>('date');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editAccountColor, setEditAccountColor] = useState('#10b981');
  const [hoveredBookId, setHoveredBookId] = useState<string | null>(null);

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

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    if (selectedAccountId !== 'all') {
      e.preventDefault();
      return;
    }
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (selectedAccountId !== 'all') return;
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (selectedAccountId !== 'all') return;
    if (draggedIdx !== null && draggedIdx !== idx) {
      reorderAccounts(draggedIdx, idx);
    }
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleAddBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim() || !newBookAccount) return;
    let seriesId = newBookSeriesId || undefined;
    if (isCreatingNewSeries && newSeriesName.trim()) {
      addSeries({ accountId: newBookAccount, name: newSeriesName.trim() });
      seriesId = undefined; 
    }
    addBook({
      title: newBookTitle,
      accountId: newBookAccount,
      status: 'PLANNED',
      color: newBookColor,
      seriesId,
    });
    setNewBookTitle('');
    setNewBookSeriesId('');
    setNewSeriesName('');
    setIsCreatingNewSeries(false);
    setIsAddingBook(false);
  };

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) return;
    addAccount(newAccountName, newAccountColor);
    setNewAccountName('');
    setNewAccountColor('#10b981');
    setIsAddingAccount(false);
  };

  const handleStartEditAccount = (id: string, name: string, color?: string) => {
    setEditingAccountId(id);
    setEditAccountName(name);
    setEditAccountColor(color || '#10b981');
  };

  const handleSaveAccountName = () => {
    if (editingAccountId && editAccountName.trim()) {
      updateAccount(editingAccountId, editAccountName.trim(), editAccountColor);
    }
    setEditingAccountId(null);
  };

  const handleOpenAddBook = () => {
    if (state.accounts.length === 0) {
      alert("Сначала создайте хотя бы один аккаунт / жанр кнопкой «Новый аккаунт»!");
      setIsAddingAccount(true);
      return;
    }
    const defaultAccount = selectedAccountId !== 'all' ? selectedAccountId : state.accounts[0].id;
    setNewBookAccount(defaultAccount);
    setIsAddingBook(true);
  };

  const handleOpenEditBook = (bookId: string) => {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return;
    setEditingBookId(bookId);
    setEditBookTitle(book.title);
    setEditBookAccount(book.accountId);
    setEditBookColor(book.color || '#6366f1');
    setEditBookSeriesId(book.seriesId || '');
    setEditBookCoverPath(book.coverPath || '');
    setIsCreatingNewSeriesInEdit(false);
    setEditNewSeriesName('');
    setIsEditingBook(true);
  };

  const handleSaveBookEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookId || !editBookTitle.trim() || !editBookAccount) return;
    let seriesId = editBookSeriesId || undefined;
    if (isCreatingNewSeriesInEdit && editNewSeriesName.trim()) {
      addSeries({ accountId: editBookAccount, name: editNewSeriesName.trim() });
      seriesId = undefined;
    }
    updateBook(editingBookId, {
      title: editBookTitle.trim(),
      accountId: editBookAccount,
      color: editBookColor,
      seriesId,
      coverPath: editBookCoverPath.trim() || undefined
    });
    setIsEditingBook(false);
    setEditingBookId(null);
  };

  const statusLabels: Record<BookStatus, string> = {
    PLANNED: 'В планах',
    IN_PROGRESS: 'В процессе',
    PUBLISHED: 'Опубликовано',
  };

  const getInitials = (title: string) => {
    return title.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'КН';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Библиотека</h1>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* Search bar */}
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск книги по названию..."
              className="w-full bg-zinc-900/40 border border-zinc-900 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-800 transition-colors"
            />
          </div>

          {/* Sort bar */}
          <div className="flex items-center gap-1.5 bg-zinc-900/40 border border-zinc-900 rounded-lg px-2.5 py-1.5">
            <SortAsc className="w-3.5 h-3.5 text-zinc-550" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-zinc-400 outline-none cursor-pointer hover:text-zinc-200 transition-colors"
            >
              <option value="date">По дате</option>
              <option value="title">По названию</option>
              <option value="status">По статусу</option>
              <option value="chars">По символам</option>
              <option value="chapters">По главам</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => setIsAddingAccount(true)}
              className="flex items-center gap-1.5 border border-zinc-900 hover:border-zinc-800 hover:bg-zinc-900/40 text-zinc-300 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Новый аккаунт
            </button>
            <button
              onClick={handleOpenAddBook}
              className="flex items-center gap-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-450 border border-emerald-500/10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Новая книга
            </button>
          </div>
        </div>
      </div>

      {/* Author Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-1.5 mb-6 border-b border-zinc-900 pb-3">
        <button
          onClick={() => setSelectedAccountId('all')}
          className={cn(
            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
            selectedAccountId === 'all'
              ? "bg-zinc-900 text-zinc-100 shadow-sm"
              : "text-zinc-500 hover:text-zinc-350"
          )}
        >
          <span>Все авторы</span>
          <span className="text-[10px] opacity-60 font-mono bg-zinc-950 px-1.5 py-0.5 rounded-md border border-zinc-900">
            {state.books.length}
          </span>
        </button>
        {state.accounts.map((acc) => {
          const count = state.books.filter(b => b.accountId === acc.id).length;
          return (
            <button
              key={acc.id}
              onClick={() => setSelectedAccountId(acc.id)}
              title={acc.name}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 flex items-center gap-1.5",
                selectedAccountId === acc.id
                  ? "bg-zinc-900 text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-350"
              )}
            >
              <span>{acc.name.includes(':') ? acc.name.split(':')[0].trim() : acc.name}</span>
              <span className="text-[10px] opacity-60 font-mono bg-zinc-950 px-1.5 py-0.5 rounded-md border border-zinc-900">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Account Settings Header */}
      {selectedAccountId !== 'all' && (() => {
        const activeAcc = state.accounts.find(a => a.id === selectedAccountId);
        if (!activeAcc) return null;
        return (
          <div className="flex items-center gap-3 mb-6 bg-zinc-900/10 border border-zinc-900/60 px-4 py-2 rounded-xl w-fit">
            {editingAccountId === activeAcc.id ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editAccountName}
                  onChange={(e) => setEditAccountName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveAccountName()}
                  className="bg-zinc-950 text-xs font-semibold text-zinc-100 border border-emerald-500/30 rounded-lg px-2.5 py-1 outline-none"
                />
                <ColorInput
                  value={editAccountColor}
                  onChange={(val) => setEditAccountColor(val)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent flex-shrink-0"
                />
                <button
                  onClick={handleSaveAccountName}
                  className="px-2.5 py-1 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 rounded-md text-[10px] font-semibold"
                >
                  ОК
                </button>
                <button
                  onClick={() => setEditingAccountId(null)}
                  className="px-2 py-1 text-zinc-400 hover:text-zinc-200 text-[10px]"
                >
                  Отмена
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeAcc.color || '#10b981' }} />
                  <span className="text-xs font-bold text-zinc-300">{activeAcc.name}</span>
                </div>
                <div className="flex items-center gap-1 border-l border-zinc-900 pl-3 ml-1">
                  <button
                    onClick={() => handleStartEditAccount(activeAcc.id, activeAcc.name, activeAcc.color)}
                    className="text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors px-1.5 py-0.5 hover:bg-zinc-900/40 rounded"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Удалить аккаунт?',
                        message: `Вы уверены, что хотите удалить аккаунт "${activeAcc.name}" и все его книги? Это действие необратимо.`,
                        onConfirm: () => {
                          deleteAccount(activeAcc.id);
                          setSelectedAccountId('all');
                        },
                      });
                    }}
                    className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors px-1.5 py-0.5 hover:bg-zinc-900/40 rounded"
                  >
                    Удалить
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* Add Account Modal Overlay */}
      {isAddingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-100">Новый аккаунт / жанр</h2>
              <button onClick={() => setIsAddingAccount(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddAccount} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Название аккаунта</label>
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-800 focus:border-emerald-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-emerald-500/10 transition-all"
                  placeholder="Например: Фэнтези..."
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Цвет аккаунта</label>
                <div className="flex items-center gap-3">
                  <ColorInput
                    value={newAccountColor}
                    onChange={(val) => setNewAccountColor(val)}
                    className="w-9 h-9 rounded cursor-pointer border border-zinc-800 p-0 bg-transparent"
                  />
                  <span className="text-xs text-zinc-500">Цвет профиля</span>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingAccount(false)}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Book Modal Overlay */}
      {isAddingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-100">Добавить новую книгу</h2>
              <button onClick={() => setIsAddingBook(false)} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddBook} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Название книги</label>
                <input
                  type="text"
                  value={newBookTitle}
                  onChange={(e) => setNewBookTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-800 focus:border-emerald-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-emerald-500/10 transition-all"
                  placeholder="Например: Академия магии..."
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Аккаунт / Жанр</label>
                  <select
                    value={newBookAccount}
                    onChange={(e) => { setNewBookAccount(e.target.value); setNewBookSeriesId(''); }}
                    className="w-full px-3 py-2 border border-zinc-800 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 transition-all"
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
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Цвет метки</label>
                  <div className="flex items-center gap-2">
                    <ColorInput
                      value={newBookColor}
                      onChange={(val) => setNewBookColor(val)}
                      className="w-9 h-9 rounded cursor-pointer border border-zinc-800 p-0 bg-transparent"
                    />
                    <span className="text-xs text-zinc-550">Для разделения</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Цикл / Серия</label>
                {!isCreatingNewSeries ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={newBookSeriesId}
                      onChange={(e) => setNewBookSeriesId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-zinc-800 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 transition-all"
                    >
                      <option value="">Без цикла</option>
                      {(state.series || []).filter(s => s.accountId === newBookAccount).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSeries(true)}
                      className="px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 font-semibold transition-colors"
                    >
                      + Новый
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={newSeriesName}
                      onChange={(e) => setNewSeriesName(e.target.value)}
                      className="flex-1 px-3.5 py-2 border border-zinc-800 focus:border-emerald-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-emerald-500/10 transition-all"
                      placeholder="Название нового цикла..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setIsCreatingNewSeries(false); setNewSeriesName(''); }}
                      className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setIsAddingBook(false); setIsCreatingNewSeries(false); setNewSeriesName(''); }}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Book Modal Overlay */}
      {isEditingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-100">Редактировать книгу</h2>
              <button onClick={() => { setIsEditingBook(false); setEditingBookId(null); }} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveBookEdit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Название книги</label>
                <input
                  type="text"
                  value={editBookTitle}
                  onChange={(e) => setEditBookTitle(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-800 focus:border-emerald-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-emerald-500/10 transition-all"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Аккаунт / Жанр</label>
                  <select
                    value={editBookAccount}
                    onChange={(e) => { setEditBookAccount(e.target.value); setEditBookSeriesId(''); }}
                    className="w-full px-3 py-2 border border-zinc-800 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 transition-all"
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
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Цвет метки</label>
                  <div className="flex items-center gap-2">
                    <ColorInput
                      value={editBookColor}
                      onChange={(val) => setEditBookColor(val)}
                      className="w-9 h-9 rounded cursor-pointer border border-zinc-800 p-0 bg-transparent"
                    />
                    <span className="text-xs text-zinc-550">Цвет обложки</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Ссылка на обложку (URL)</label>
                <input
                  type="text"
                  value={editBookCoverPath}
                  onChange={(e) => setEditBookCoverPath(e.target.value)}
                  className="w-full px-3.5 py-2 border border-zinc-800 focus:border-emerald-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-emerald-500/10 transition-all"
                  placeholder="Например: https://site.com/image.jpg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Цикл / Серия</label>
                {!isCreatingNewSeriesInEdit ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editBookSeriesId}
                      onChange={(e) => setEditBookSeriesId(e.target.value)}
                      className="flex-1 px-3 py-2 border border-zinc-800 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 transition-all"
                    >
                      <option value="">Без цикла</option>
                      {(state.series || []).filter(s => s.accountId === editBookAccount).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsCreatingNewSeriesInEdit(true)}
                      className="px-2.5 py-1.5 text-xs text-emerald-400 hover:bg-emerald-500/10 rounded-lg border border-emerald-500/20 font-semibold transition-colors"
                    >
                      + Новый
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editNewSeriesName}
                      onChange={(e) => setEditNewSeriesName(e.target.value)}
                      className="flex-1 px-3.5 py-2 border border-zinc-800 focus:border-emerald-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-emerald-500/10 transition-all"
                      placeholder="Название нового цикла..."
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => { setIsCreatingNewSeriesInEdit(false); setEditNewSeriesName(''); }}
                      className="px-3 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => { setIsEditingBook(false); setEditingBookId(null); }}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm"
                >
                  Сохранить
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Unified Book Grid */}
      {(() => {
        const filteredBooks = state.books
          .filter((b) => selectedAccountId === 'all' || b.accountId === selectedAccountId)
          .filter((b) => b.title.toLowerCase().includes(searchQuery.toLowerCase()))
          .sort((a, b) => {
            if (sortBy === 'date') return (b.createdAt || 0) - (a.createdAt || 0);
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

        if (filteredBooks.length === 0) {
          return (
            <div className="bg-zinc-950/20 border border-dashed border-zinc-900 rounded-2xl p-12 text-center max-w-sm mx-auto mt-12 animate-in fade-in duration-300">
              <BookPlus className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
              <p className="text-sm text-zinc-400 font-medium">Книг пока нет</p>
              <p className="text-xs text-zinc-600 mt-1">
                {searchQuery ? "Попробуйте изменить поисковый запрос." : "Нажмите «Новая книга», чтобы начать писать."}
              </p>
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {filteredBooks.map((book) => {
              const chapters = state.chapters.filter(c => c.bookId === book.id);
              const publishedCount = chapters.filter(c => c.isPublished).length;
              const account = state.accounts.find(a => a.id === book.accountId);
              const totalChaptersCount = book.canvasContent
                ? (() => {
                    const t = document.createElement('div');
                    t.innerHTML = book.canvasContent;
                    return t.querySelectorAll('h2').length;
                  })()
                : chapters.length;
              const totalChars = book.canvasContent
                ? (() => { const t = document.createElement('div'); t.innerHTML = book.canvasContent; return (t.innerText || t.textContent || '').length; })()
                : chapters.reduce((sum, c) => sum + c.content.length, 0);
              const isHovered = hoveredBookId === book.id;

              return (
                <div
                  key={book.id}
                  onClick={() => onSelectBook(book.id)}
                  onMouseEnter={() => setHoveredBookId(book.id)}
                  onMouseLeave={() => setHoveredBookId(null)}
                  className="flex flex-col bg-zinc-900/15 border rounded-2xl transition-all duration-300 cursor-pointer group relative overflow-hidden h-[310px] hover:-translate-y-1.5 select-none"
                  style={{
                    borderColor: isHovered ? book.color : `${book.color}25`,
                    boxShadow: isHovered ? `0 12px 30px -8px ${book.color}35` : 'none',
                  }}
                >
                  {/* Cover Area (Aspect ratio container) */}
                  <div className="relative h-44 w-full bg-zinc-950/40 flex items-center justify-center overflow-hidden border-b border-zinc-900/40">
                    {/* Background Dynamic Radial Glow for Cards without covers */}
                    {!book.coverPath && (
                      <div 
                        className="absolute inset-0 opacity-10 transition-opacity duration-300 group-hover:opacity-20"
                        style={{
                          background: `radial-gradient(circle at 50% 50%, ${book.color}, transparent 75%)`
                        }}
                      />
                    )}

                    {book.coverPath ? (
                      <img
                        src={book.coverPath}
                        alt={book.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 z-10 transition-transform duration-300 group-hover:scale-105">
                        <div 
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black border"
                          style={{
                            backgroundColor: `${book.color}15`,
                            borderColor: `${book.color}40`,
                            color: book.color
                          }}
                        >
                          {getInitials(book.title)}
                        </div>
                      </div>
                    )}

                    {/* Status Badge (Top-left absolute) */}
                    <span className={cn(
                      "absolute top-3 left-3 text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider backdrop-blur-md border shadow-sm",
                      book.status === 'PUBLISHED' ? 'text-emerald-450 bg-emerald-950/40 border-emerald-500/25' :
                      book.status === 'IN_PROGRESS' ? 'text-amber-455 bg-amber-955/40 border-amber-500/25' : 
                      'text-zinc-400 bg-zinc-950/45 border-zinc-800/25'
                    )}>
                      {statusLabels[book.status]}
                    </span>

                    {/* Edit action (Absolute hover overlay) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEditBook(book.id);
                      }}
                      className="absolute top-3 right-11 p-1.5 bg-zinc-950/80 border border-zinc-800/60 text-zinc-500 hover:text-emerald-400 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
                      title="Редактировать книгу"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete action (Absolute hover overlay) */}
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
                      className="absolute top-3 right-3 p-1.5 bg-zinc-950/80 border border-zinc-800/60 text-zinc-500 hover:text-red-400 rounded-lg backdrop-blur-md opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-sm"
                      title="Удалить книгу"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Info Area */}
                  <div className="flex-1 p-4 flex flex-col justify-between min-w-0">
                    <div>
                      {/* Account indicator */}
                      {account && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: account.color || book.color }} />
                          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate" title={account.name}>
                            {account.name.includes(':') ? account.name.split(':')[0].trim() : account.name}
                          </span>
                        </div>
                      )}

                      {/* Book Title */}
                      <h3 className="text-sm font-bold text-zinc-100 leading-snug line-clamp-1 transition-colors duration-250" style={{ color: isHovered ? book.color : undefined }}>
                        {book.title}
                      </h3>

                      {/* Series */}
                      {book.seriesId && (() => {
                        const series = (state.series || []).find(s => s.id === book.seriesId);
                        return series ? (
                          <span className="flex items-center gap-1 text-[9px] text-indigo-400 font-semibold mt-1 truncate">
                            <Layers className="w-2.5 h-2.5 text-indigo-500" />
                            {series.name}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    {/* Stats footer */}
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-zinc-900/60">
                      <div className="flex items-center gap-1 text-zinc-500">
                        <FileText className="w-3.5 h-3.5 text-zinc-650" />
                        <span className="text-xs font-semibold">{totalChaptersCount} гл.</span>
                      </div>
                      <span className="text-[11px] text-zinc-550 font-mono font-medium">
                        {totalChars.toLocaleString('ru-RU')} зн.
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

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
