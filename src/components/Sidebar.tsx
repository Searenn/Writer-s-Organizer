import { Book, Calendar, CheckCircle2, Edit2, Home, Key, Library, Loader2, Megaphone, Plus, Search, Settings, Trash2, TrendingUp, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { cn, stripHtml } from '../utils';
import { NotificationsWidget } from './NotificationsWidget';

type SidebarProps = {
  currentView: string;
  setCurrentView: (view: string) => void;
  selectedBookId: string | null;
  setSelectedBookId: (id: string | null) => void;
  onSelectBook: (id: string, tab?: string) => void;
};

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  selectedBookId,
  setSelectedBookId,
  onSelectBook,
}) => {
  const { state, updateBook, updateAccount, deleteAccount, reorderAccounts, updateGoogleTokens, clearGoogleTokens } = useAppStore();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const hasGoogleTokens = !!state.googleTokens;

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDraggedIdx(idx);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDrop = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
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

  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return [];

    const query = searchQuery.toLowerCase();
    const results: any[] = [];

    // Search Books
    state.books.forEach(book => {
      if (book.title.toLowerCase().includes(query) ||
        (book.description && book.description.toLowerCase().includes(query)) ||
        (book.canvasContent && stripHtml(book.canvasContent).toLowerCase().includes(query))) {
        results.push({ type: 'book', id: book.id, title: book.title, tab: 'chapters' });
      }
    });

    // Search Characters
    state.characters.forEach(char => {
      if (char.name.toLowerCase().includes(query) ||
        char.description.toLowerCase().includes(query) ||
        (char.aliases && char.aliases.toLowerCase().includes(query))) {
        results.push({ type: 'character', id: char.bookId, title: char.name, subTitle: `Персонаж в "${state.books.find(b => b.id === char.bookId)?.title}"`, tab: 'info' });
      }
    });

    // Search Settings
    state.settings.forEach(set => {
      if (set.title.toLowerCase().includes(query) || set.description.toLowerCase().includes(query)) {
        results.push({ type: 'setting', id: set.bookId, title: set.title, subTitle: `Сеттинг в "${state.books.find(b => b.id === set.bookId)?.title}"`, tab: 'info' });
      }
    });

    // Search Prompts
    state.prompts.forEach(p => {
      if (p.title.toLowerCase().includes(query) || p.content.toLowerCase().includes(query)) {
        results.push({ type: 'prompt', id: 'prompts', title: p.title, subTitle: 'Промпт' });
      }
    });

    // Search Ad Blocks
    state.adBlocks.forEach(ab => {
      if (ab.title.toLowerCase().includes(query) || ab.content.toLowerCase().includes(query)) {
        results.push({ type: 'adblock', id: 'adblocks', title: ab.title, subTitle: 'Рекламный блок' });
      }
    });

    return results.slice(0, 10);
  }, [searchQuery, state]);

  const handleResultClick = (result: any) => {
    setSearchQuery('');
    if (result.type === 'book' || result.type === 'character' || result.type === 'setting') {
      onSelectBook(result.id, result.tab);
    } else {
      setCurrentView(result.id);
      setSelectedBookId(null);
    }
  };

  const handleNav = (view: string) => {
    setCurrentView(view);
    setSelectedBookId(null);
  };

  const handleStartEditAccount = (id: string, name: string) => {
    setEditingAccountId(id);
    setEditAccountName(name);
  };

  const handleSaveAccount = () => {
    if (editingAccountId && editAccountName.trim()) {
      updateAccount(editingAccountId, editAccountName.trim());
    }
    setEditingAccountId(null);
  };

  const handleDeleteAccount = (id: string, name: string) => {
    if (window.confirm(`Вы уверены, что хотите удалить аккаунт "${name}" и все его книги?`)) {
      deleteAccount(id);
    }
  };

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true);
    setGoogleError(null);
    try {
      const result = await (window as any).electron.googleAuthStart();
      if (result.success && result.tokens) {
        updateGoogleTokens(result.tokens);
      } else {
        setGoogleError(result.error || 'Ошибка авторизации');
      }
    } catch (err: any) {
      setGoogleError(err.message);
    } finally {
      setGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (state.googleTokens) {
      await (window as any).electron.googleRevoke(state.googleTokens);
    }
    clearGoogleTokens();
  };

  const [exportingAll, setExportingAll] = useState(false);
  const [exportAllUrl, setExportAllUrl] = useState<string | null>(null);

  const handleExportAll = async () => {
    if (!state.googleTokens) return;
    setExportingAll(true);
    setGoogleError(null);
    try {
      const result = await (window as any).electron.googleExportAll({
        state,
        tokens: state.googleTokens
      });
      if (result.success && result.docUrl) {
        setExportAllUrl(result.docUrl);
        if (result.updatedTokens) {
          updateGoogleTokens(result.updatedTokens);
        }
      } else {
        setGoogleError(result.error || 'Ошибка экспорта');
      }
    } catch (err: any) {
      setGoogleError(err.message);
    } finally {
      setExportingAll(false);
    }
  };

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-900 flex flex-col h-full overflow-hidden shrink-0">
      {/* Search Bar section */}
      <div className="p-6 flex items-center gap-3 text-white font-bold text-xl">
        <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
          <Library className="w-5 h-5 text-emerald-400" />
        </div>
        <span className="tracking-tight">Pisaka</span>
      </div>

      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-4">
        {/* Search Input */}
        <div className="px-4 mb-2 relative">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск везде..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-9 pr-8 text-xs text-zinc-200 placeholder:text-zinc-600 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-4 right-4 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-1">
                {searchResults.map((result, idx) => (
                  <button
                    key={`${result.type}-${result.id}-${idx}`}
                    onClick={() => handleResultClick(result)}
                    className="w-full text-left p-3 rounded-lg hover:bg-zinc-800 transition-colors group flex flex-col gap-0.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-100 group-hover:text-emerald-400 transition-colors truncate">
                        {result.title}
                      </span>
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">
                        {result.type === 'book' ? 'Книга' :
                          result.type === 'character' ? 'Герой' :
                            result.type === 'setting' ? 'Мир' :
                              result.type === 'prompt' ? 'ИИ' : 'Рек'}
                      </span>
                    </div>
                    {result.subTitle && (
                      <span className="text-[10px] text-zinc-500 truncate italic">
                        {result.subTitle}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && (
            <div className="absolute left-4 right-4 top-full mt-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center z-50 shadow-2xl">
              <span className="text-xs text-zinc-500 italic">Ничего не найдено</span>
            </div>
          )}
        </div>

        <NotificationsWidget />

        <div className="px-3 space-y-1">
          <button
            onClick={() => handleNav('dashboard')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              currentView === 'dashboard' && !selectedBookId
                ? 'bg-emerald-500/10 text-emerald-400 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.1)]'
                : 'hover:bg-zinc-900 hover:text-zinc-100'
            )}
          >
            <Home className="w-4 h-4" />
            Библиотека
          </button>
          <button
            onClick={() => handleNav('prompts')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'prompts'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'hover:bg-zinc-800 hover:text-white'
            )}
          >
            <Settings className="w-4 h-4" />
            Промпты
          </button>
          <button
            onClick={() => handleNav('credentials')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'credentials'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'hover:bg-zinc-800 hover:text-white'
            )}
          >
            <Key className="w-4 h-4" />
            Доступы
          </button>
          <button
            onClick={() => handleNav('calendar')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'calendar'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'hover:bg-zinc-800 hover:text-white'
            )}
          >
            <Calendar className="w-4 h-4" />
            Календарь
          </button>
          <button
            onClick={() => handleNav('stats')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              currentView === 'stats'
                ? 'bg-emerald-500/10 text-emerald-400'
                : 'hover:bg-zinc-800 hover:text-white'
            )}
          >
            <TrendingUp className="w-4 h-4" />
            Статистика
          </button>
        </div>

        <div className="px-3">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 px-3">
            Мои Книги
          </div>
          <div className="space-y-4">
            {state.accounts.map((account, idx) => {
              const accountBooks = state.books.filter((b) => b.accountId === account.id);
              return (
                <div
                  key={account.id}
                  className={cn(
                    "space-y-1 group/acc border-2 border-transparent transition-all rounded-lg",
                    dragOverIdx === idx && draggedIdx !== null && dragOverIdx !== draggedIdx
                      ? dragOverIdx > draggedIdx ? "border-b-emerald-500 pb-2" : "border-t-emerald-500 pt-2"
                      : "",
                    draggedIdx === idx ? "opacity-30 border-dashed border-zinc-700" : ""
                  )}
                  draggable
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragLeave={() => setDragOverIdx(null)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center justify-between px-3 py-1">
                    {editingAccountId === account.id ? (
                      <input
                        autoFocus
                        value={editAccountName}
                        onChange={(e) => setEditAccountName(e.target.value)}
                        onBlur={handleSaveAccount}
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveAccount()}
                        className="bg-zinc-900 text-[10px] font-semibold text-zinc-100 uppercase tracking-wider px-1 py-0.5 rounded border border-emerald-500/50 outline-none w-full"
                      />
                    ) : (
                      <>
                        <div
                          className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider truncate cursor-pointer hover:text-zinc-200 transition-colors flex-1"
                          onDoubleClick={() => handleStartEditAccount(account.id, account.name)}
                          title={account.name}
                        >
                          {account.name.includes(':') ? account.name.split(':')[0].trim() : account.name}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover/acc:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleStartEditAccount(account.id, account.name)}
                            className="p-1 text-zinc-600 hover:text-emerald-400"
                            title="Переименовать"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteAccount(account.id, account.name)}
                            className="p-1 text-zinc-600 hover:text-red-400"
                            title="Удалить аккаунт"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                  {accountBooks.map((book) => (
                    <button
                      key={book.id}
                      onClick={() => {
                        setCurrentView('book');
                        setSelectedBookId(book.id);
                      }}
                      className={cn(
                        'w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-colors pl-6 group',
                        selectedBookId === book.id
                          ? 'bg-zinc-800 text-white'
                          : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-200'
                      )}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: book.color || '#6366f1' }}
                        />
                        <span className="truncate text-left">{book.title}</span>
                      </div>
                      <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-tighter shrink-0 ml-2 opacity-60 group-hover:opacity-100 transition-opacity",
                        book.status === 'PUBLISHED' ? "text-emerald-500 bg-emerald-500/10" :
                          book.status === 'IN_PROGRESS' ? "text-amber-500 bg-amber-500/10" :
                            "text-zinc-500 bg-zinc-500/10"
                      )}>
                        {book.status === 'PUBLISHED' ? 'Опубл' : book.status === 'IN_PROGRESS' ? 'В проц' : 'План'}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Google Docs section */}
      <div className="p-4 border-t border-zinc-800">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">
          Google Docs
        </div>
        {hasGoogleTokens ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Google подключён</span>
            </div>

            <button
              onClick={handleExportAll}
              disabled={exportingAll}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
            >
              {exportingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Library className="w-3.5 h-3.5" />
              )}
              {exportingAll ? 'Экспорт...' : 'Экспорт всех панелей'}
            </button>

            {exportAllUrl && (
              <a
                href={exportAllUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[10px] text-emerald-400 hover:text-emerald-300 text-center flex items-center justify-center gap-1"
              >
                <CheckCircle2 className="w-3 h-3" />
                Отчет готов! Открыть
              </a>
            )}

            <button
              onClick={handleGoogleDisconnect}
              className="w-full text-xs text-zinc-500 hover:text-red-400 transition-colors text-left px-1 mt-1"
            >
              Отключить
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <button
              onClick={handleGoogleConnect}
              disabled={googleConnecting}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {googleConnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
              ) : (
                <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
                </svg>
              )}
              {googleConnecting ? 'Ожидание...' : 'Подключить Google'}
            </button>
            {googleError && (
              <div className="text-[10px] text-red-400 px-1">{googleError}</div>
            )}
          </div>
        )}
      </div>

    </div>
  );
};
