import { Calendar, CheckSquare, ChevronDown, ChevronLeft, ChevronRight, Columns3, DollarSign, Edit2, Flame, Home, Key, Library, MoreHorizontal, Palette, Search, Settings, StickyNote, Star, Trash2, TrendingUp, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { cn, stripHtml, getLocalISODate } from '../utils';
import { NotificationsWidget } from './NotificationsWidget';

const ALL_NAV_ITEMS = [
  { id: 'notes', label: 'Заметки', icon: StickyNote },
  { id: 'tasks', label: 'Задачи', icon: CheckSquare },
  { id: 'kanban', label: 'Контент-план', icon: Columns3 },
  { id: 'prompts', label: 'Промпты', icon: Settings },
  { id: 'credentials', label: 'Доступы', icon: Key },
  { id: 'calendar', label: 'Календарь', icon: Calendar },
  { id: 'stats', label: 'Статистика', icon: TrendingUp },
  { id: 'finance', label: 'Финансы', icon: DollarSign },
] as const;

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
  const { state, updateBook, updateAccount, deleteAccount, reorderAccounts, setTheme, updateGoogleTokens, clearGoogleTokens } = useAppStore();
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editAccountName, setEditAccountName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all' | 'in_progress' | 'planned' | 'published'>('active');
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('pisaka-sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pisaka-sidebar-collapsed', String(next));
      return next;
    });
  };

  const [isThemeCollapsed, setIsThemeCollapsed] = useState(() => {
    return localStorage.getItem('pisaka-theme-collapsed') === 'true';
  });

  const toggleThemeCollapse = () => {
    setIsThemeCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('pisaka-theme-collapsed', String(next));
      return next;
    });
  };

  const handleGoogleConnect = async () => {
    setGoogleConnecting(true);
    setGoogleError(null);
    try {
      const { startGoogleAuth } = await import('../lib/googleApi');
      const result = await startGoogleAuth();
      updateGoogleTokens({
        access_token: result.access_token,
        refresh_token: '', // Implicit flow doesn't give refresh token
        expiry_date: Date.now() + result.expires_in * 1000
      });
    } catch (err: any) {
      setGoogleError(err.message || 'Ошибка авторизации');
    } finally {
      setGoogleConnecting(false);
    }
  };

  const handleGoogleDisconnect = async () => {
    if (state.googleTokens?.access_token) {
      try {
        const { revokeGoogleToken } = await import('../lib/googleApi');
        await revokeGoogleToken(state.googleTokens.access_token);
      } catch (e) {
        // ignore
      }
    }
    clearGoogleTokens();
  };

  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Nav favorites (persisted in localStorage)
  const [pinnedNavIds, setPinnedNavIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('pisaka-pinned-nav');
      return saved ? JSON.parse(saved) : ['prompts', 'calendar'];
    } catch { return ['prompts', 'calendar']; }
  });
  const [showMoreNav, setShowMoreNav] = useState(false);

  // Writing streak calculation
  const streak = useMemo(() => {
    const logs = state.writingLogs || [];
    if (logs.length === 0) return 0;

    const today = new Date();
    let count = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      const dateStr = getLocalISODate(d);
      const log = logs.find(l => l.date === dateStr);
      if (log && log.count > 0) {
        count++;
      } else if (i > 0) {
        break;
      }
      // Allow today to be missing
      if (i === 0 && (!log || log.count === 0)) continue;
    }
    return count;
  }, [state.writingLogs]);

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

  const togglePinNav = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setPinnedNavIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      localStorage.setItem('pisaka-pinned-nav', JSON.stringify(next));
      return next;
    });
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

  return (
    <div className={cn(
      "bg-zinc-950 border-r border-zinc-900 flex flex-col h-full overflow-hidden shrink-0 transition-all duration-300 relative",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Sidebar Header */}
      <div className={cn(
        "border-b border-zinc-900 shrink-0 flex flex-col justify-center",
        isCollapsed ? "p-3 h-16 items-center" : "p-4"
      )}>
        <div className="flex items-center justify-between w-full">
          <button
            onClick={() => handleNav('dashboard')}
            className="flex items-center gap-2.5 text-zinc-100 font-bold text-lg select-none hover:text-emerald-400 active:scale-95 transition-all text-left outline-none"
            title="Библиотека"
          >
            <div className="w-8 h-8 bg-emerald-500/10 rounded-lg flex items-center justify-center border border-emerald-500/10">
              <Library className="w-4.5 h-4.5 text-emerald-400" />
            </div>
            {!isCollapsed && <span className="tracking-tight">Pisaka</span>}
          </button>
          
          {!isCollapsed && streak > 0 && (
            <div className="flex items-center gap-1 text-orange-400 bg-orange-500/5 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-orange-500/10" title="Писательский стрик">
              <Flame className="w-3 h-3 fill-orange-400/20" />
              <span>{streak}d</span>
            </div>
          )}

          {!isCollapsed && (
            <button 
              onClick={toggleCollapse} 
              className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
              title="Свернуть меню"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>

        {isCollapsed && streak > 0 && (
          <div className="flex items-center justify-center text-orange-400 mt-1" title={`Стрик: ${streak} дней`}>
            <Flame className="w-3.5 h-3.5 fill-orange-400/20" />
            <span className="text-[10px] font-bold ml-0.5">{streak}</span>
          </div>
        )}

        {isCollapsed && (
          <button 
            onClick={toggleCollapse} 
            className="p-1 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-colors mt-2"
            title="Развернуть меню"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-2.5">
        <NotificationsWidget isCollapsed={isCollapsed} />

        <div className={cn("space-y-0.5", isCollapsed ? "px-2" : "px-3")}>
          {/* Pinned nav items */}
          {ALL_NAV_ITEMS.filter(item => pinnedNavIds.includes(item.id)).map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              onContextMenu={(e) => { e.preventDefault(); togglePinNav(item.id, e); }}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                'flex items-center rounded-lg transition-all duration-200 border border-transparent',
                isCollapsed 
                  ? 'w-9 h-9 justify-center mx-auto' 
                  : 'w-full gap-2 px-2.5 py-1.5 text-xs font-semibold',
                currentView === item.id
                  ? 'bg-zinc-900 border-zinc-800 text-emerald-450 shadow-md border-l-2 border-l-emerald-500'
                  : 'text-zinc-500 hover:bg-zinc-900/40 hover:text-zinc-200 hover:border-zinc-900/50'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {!isCollapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  <span title="Убрать из избранного" onClick={(e) => togglePinNav(item.id, e as any)} className="opacity-0 group-hover/nav:opacity-100 transition-opacity cursor-pointer">
                    <Star className="w-3 h-3 text-emerald-500/40 fill-emerald-500/40" />
                  </span>
                </>
              )}
            </button>
          ))}

          {/* Show more toggle */}
          {ALL_NAV_ITEMS.some(item => !pinnedNavIds.includes(item.id)) && !isCollapsed && (
            <button
              onClick={() => setShowMoreNav(!showMoreNav)}
              className="w-full flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span>{showMoreNav ? 'Свернуть' : 'Ещё'}</span>
              <ChevronDown className={cn("w-3 h-3 ml-auto transition-transform", showMoreNav && "rotate-180")} />
            </button>
          )}

          {/* Unpinned nav items (hidden by default) */}
          {showMoreNav && !isCollapsed && ALL_NAV_ITEMS.filter(item => !pinnedNavIds.includes(item.id)).map(item => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              onContextMenu={(e) => { e.preventDefault(); togglePinNav(item.id, e); }}
              className={cn(
                'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 border border-transparent group/nav',
                currentView === item.id
                  ? 'bg-zinc-900 border-zinc-800 text-emerald-450 shadow-md border-l-2 border-l-emerald-500'
                  : 'hover:bg-zinc-900/40 hover:text-zinc-200 text-zinc-500 hover:border-zinc-900/50'
              )}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              <span title="Добавить в избранное" onClick={(e) => togglePinNav(item.id, e as any)} className="opacity-0 group-hover/nav:opacity-100 transition-opacity cursor-pointer">
                <Star className="w-3 h-3 text-zinc-700" />
              </span>
            </button>
          ))}
        </div>

        {/* Books list, only when expanded */}
        {!isCollapsed && (
          <div className="px-3 border-t border-zinc-900 pt-3 mt-1.5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Все книги ({state.books.length})</h2>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="text-[9px] bg-zinc-950 border border-zinc-900 text-zinc-400 rounded outline-none py-0.5 px-1 hover:text-emerald-400 focus:border-emerald-500/30 transition-colors"
              >
                <option value="active">Активные</option>
                <option value="all">Все книги</option>
                <option value="in_progress">В процессе</option>
                <option value="planned">В планах</option>
                <option value="published">Завершённые</option>
              </select>
            </div>
            
            <div className="space-y-4 max-h-[calc(100vh-340px)] overflow-y-auto pr-1">
              {state.accounts.map((account) => {
                const accountBooks = state.books.filter((b) => {
                  if (b.accountId !== account.id) return false;
                  if (statusFilter === 'active') return b.status !== 'PUBLISHED';
                  if (statusFilter === 'in_progress') return b.status === 'IN_PROGRESS';
                  if (statusFilter === 'planned') return b.status === 'PLANNED';
                  if (statusFilter === 'published') return b.status === 'PUBLISHED';
                  return true; // 'all'
                }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                
                if (accountBooks.length === 0 && statusFilter !== 'all') return null;

                return (
                  <div
                    key={account.id}
                    className={cn(
                      "space-y-0.5 group/acc border border-transparent transition-all rounded-lg p-1",
                      dragOverIdx === state.accounts.indexOf(account) && draggedIdx !== null && dragOverIdx !== state.accounts.indexOf(account)
                        ? dragOverIdx > draggedIdx ? "border-b-emerald-500 pb-2" : "border-t-emerald-500 pt-2"
                        : "",
                      draggedIdx === state.accounts.indexOf(account) ? "opacity-30 border-dashed border-zinc-700" : ""
                    )}
                    draggable
                    onDragStart={(e) => handleDragStart(e, state.accounts.indexOf(account))}
                    onDragOver={(e) => handleDragOver(e, state.accounts.indexOf(account))}
                    onDragLeave={() => setDragOverIdx(null)}
                    onDrop={(e) => handleDrop(e, state.accounts.indexOf(account))}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="flex items-center justify-between px-2 py-0.5">
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
                            className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider truncate cursor-pointer hover:text-zinc-300 transition-colors flex-1"
                            onDoubleClick={() => handleStartEditAccount(account.id, account.name)}
                            title={account.name}
                          >
                            {account.name.includes(':') ? account.name.split(':')[0].trim() : account.name}
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover/acc:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEditAccount(account.id, account.name)}
                              className="p-0.5 text-zinc-600 hover:text-emerald-400"
                              title="Переименовать"
                            >
                              <Edit2 className="w-2.5 h-2.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAccount(account.id, account.name)}
                              className="p-0.5 text-zinc-600 hover:text-red-400"
                              title="Удалить аккаунт"
                            >
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {accountBooks.map((book) => {
                      return (
                        <button
                          key={book.id}
                          onClick={() => {
                            setCurrentView('book');
                            setSelectedBookId(book.id);
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all pl-3 border border-transparent group',
                            selectedBookId === book.id
                              ? 'bg-zinc-900 border-zinc-800 text-emerald-450 font-bold border-l-2 border-l-emerald-500 pl-2.5 shadow-sm'
                              : 'text-zinc-500 hover:bg-zinc-900/30 hover:text-zinc-350'
                          )}
                        >
                          <div className="flex items-center gap-2 overflow-hidden">
                            <div
                              className="w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: book.color || '#6366f1' }}
                            />
                            <span className={cn("truncate text-left", book.status === 'PUBLISHED' && "opacity-60")}>{book.title}</span>
                          </div>
                          <span className={cn(
                            "text-[8px] font-extrabold px-1 rounded uppercase tracking-wider shrink-0 ml-1.5 transition-opacity opacity-40 group-hover:opacity-100",
                            book.status === 'PUBLISHED' ? "text-emerald-400 bg-emerald-500/5 border border-emerald-500/10" :
                              book.status === 'IN_PROGRESS' ? "text-amber-400 bg-amber-500/5 border border-amber-500/10" :
                                "text-zinc-500 bg-zinc-500/5 border border-zinc-800"
                          )}>
                            {book.status === 'PUBLISHED' ? 'Опубл' : book.status === 'IN_PROGRESS' ? 'В проц' : 'План'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Panel: Search & Theme Switcher */}
      <div className={cn(
        "border-t border-zinc-900 bg-zinc-950/40 p-3 flex flex-col gap-3 shrink-0 select-none",
        isCollapsed ? "items-center" : "px-4 py-3.5"
      )}>
        {/* Search Bar */}
        {!isCollapsed ? (
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск везде..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1.5 pl-8 pr-7 text-xs text-zinc-305 placeholder:text-zinc-600 outline-none focus:border-emerald-500/30 focus:ring-1 focus:ring-emerald-500/10 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-600 hover:text-zinc-400"
              >
                <X className="w-3 h-3" />
              </button>
            )}

            {/* Search Results Dropdown (opens upwards) */}
            {searchResults.length > 0 && (
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden max-h-[300px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-200">
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
              <div className="absolute left-0 right-0 bottom-full mb-2 bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center z-50 shadow-2xl">
                <span className="text-xs text-zinc-500 italic">Ничего не найдено</span>
              </div>
            )}
          </div>
        ) : (
          <button
            onClick={toggleCollapse}
            className="p-2 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 rounded-lg transition-colors"
            title="Поиск везде (развернуть)"
          >
            <Search className="w-4.5 h-4.5" />
          </button>
        )}

        {/* Theme Switcher */}
        {!isCollapsed ? (
          <div className="flex flex-col gap-1.5 w-full">
            <button
              onClick={toggleThemeCollapse}
              className="flex items-center justify-between w-full text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5 hover:text-zinc-300 transition-colors outline-none"
            >
              <div className="flex items-center gap-1.5">
                <Palette className="w-3 h-3" />
                <span>Оформление</span>
              </div>
              <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", isThemeCollapsed && "-rotate-90")} />
            </button>
            {!isThemeCollapsed && (
              <div className="flex items-center justify-between gap-1 bg-zinc-900/60 p-1.5 rounded-xl border border-zinc-800/80 animate-in fade-in slide-in-from-top-1 duration-150">
                {[
                  { id: 'mystic-dark', name: 'Mystic', desc: 'Mystic Dark (Тёмный индиго)', bg: '#0b0f19', border: '#1e293b', accent: '#6366f1' },
                  { id: 'nordic-light', name: 'Nordic', desc: 'Nordic Frost (Светлый нордик)', bg: '#ffffff', border: '#e2e2e7', accent: '#3b82f6' },
                  { id: 'warm-sepia', name: 'Sepia', desc: 'Warm Sepia (Тёплая сепия)', bg: '#fbf7ee', border: '#ebdcb9', accent: '#d97706' },
                  { id: 'forest-emerald', name: 'Forest', desc: 'Forest Emerald (Лесной изумруд)', bg: '#050806', border: '#1b2a1f', accent: '#10b981' },
                  { id: 'midnight-obsidian', name: 'Obsidian', desc: 'Midnight Obsidian (Черный обсидиан)', bg: '#000000', border: '#27272a', accent: '#f43f5e' },
                ].map((t) => {
                  const currentTheme = state.theme || 'mystic-dark';
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as any)}
                      title={t.desc}
                      className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200 relative group overflow-hidden border",
                        currentTheme === t.id
                          ? "border-emerald-500/80 scale-105 shadow-md shadow-emerald-500/10"
                          : "border-zinc-800 hover:border-zinc-700 hover:scale-105"
                      )}
                      style={{ backgroundColor: t.bg }}
                    >
                      {/* Inner accent dot */}
                      <div
                        className="w-2 h-2 rounded-full shadow-sm"
                        style={{ backgroundColor: t.accent }}
                      />
                      {currentTheme === t.id && (
                        <div className="absolute inset-0 border border-emerald-500 rounded-lg pointer-events-none" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="relative group/theme flex justify-center w-full">
            <button
              onClick={() => {
                const currentTheme = state.theme || 'mystic-dark';
                const themesList = ['mystic-dark', 'nordic-light', 'warm-sepia', 'forest-emerald', 'midnight-obsidian'];
                const currentIndex = themesList.indexOf(currentTheme);
                const nextIndex = (currentIndex + 1) % themesList.length;
                setTheme(themesList[nextIndex] as any);
              }}
              title="Сменить тему"
              className={cn(
                "w-9 h-9 rounded-lg flex items-center justify-center border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors shadow-sm",
                (state.theme && state.theme !== 'mystic-dark') && "border-emerald-500/20 text-emerald-400"
              )}
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* Popover on hover showing all themes for quick selection */}
            <div className="absolute left-12 bottom-0 hidden group-hover/theme:flex flex-col gap-1 bg-zinc-900 border border-zinc-800 p-2 rounded-xl shadow-2xl z-50 w-32 animate-in fade-in slide-in-from-left-2 duration-150">
              <div className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest pb-1 border-b border-zinc-800 mb-1">
                Тема
              </div>
              {[
                { id: 'mystic-dark', name: 'Mystic', bg: '#0b0f19', accent: '#6366f1' },
                { id: 'nordic-light', name: 'Nordic', bg: '#ffffff', accent: '#3b82f6' },
                { id: 'warm-sepia', name: 'Sepia', bg: '#fbf7ee', accent: '#d97706' },
                { id: 'forest-emerald', name: 'Forest', bg: '#050806', accent: '#10b981' },
                { id: 'midnight-obsidian', name: 'Obsidian', bg: '#000000', accent: '#f43f5e' },
              ].map((t) => {
                const currentTheme = state.theme || 'mystic-dark';
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id as any)}
                    className={cn(
                      "flex items-center gap-2 p-1 rounded-md text-left text-[10px] w-full transition-all",
                      currentTheme === t.id
                        ? "bg-zinc-800 text-zinc-100 font-bold"
                        : "text-zinc-400 hover:bg-zinc-800/40 hover:text-zinc-200"
                    )}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-zinc-800 flex items-center justify-center"
                      style={{ backgroundColor: t.bg }}
                    >
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: t.accent }} />
                    </div>
                    <span className="truncate">{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Google Auth Integration */}
        {!isCollapsed && (
          <div className="border-t border-zinc-900 pt-2 mt-1 w-full">
            <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Интеграции
            </div>
            {state.googleTokens ? (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-medium">
                  <CheckSquare className="w-3.5 h-3.5" />
                  Google Docs подключен
                </div>
                <button
                  onClick={handleGoogleDisconnect}
                  className="w-full py-1 text-[10px] font-medium text-zinc-500 hover:text-zinc-300 transition-colors text-left"
                >
                  Отключить аккаунт
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <button
                  onClick={handleGoogleConnect}
                  disabled={googleConnecting}
                  className={cn(
                    "w-full py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors border border-zinc-800 text-zinc-300 bg-zinc-900 hover:bg-zinc-800 disabled:opacity-50 flex items-center justify-center gap-2"
                  )}
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  {googleConnecting ? 'Подключение...' : 'Подключить Google Docs'}
                </button>
                {googleError && <div className="text-[10px] text-red-400">{googleError}</div>}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

