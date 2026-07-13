import { Copy, Plus, Settings, Trash2, CheckCircle2, Search, FileText, ImageIcon, Music, Sparkles, Layers, Type, ChevronLeft } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Prompt, PromptType } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const PromptsView: React.FC = () => {
  const { state, addPrompt, updatePrompt, deletePrompt } = useAppStore();
  
  // Active selected prompt
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);
  
  // Search and filter queries
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAccountId, setFilterAccountId] = useState<string>('all');
  
  // Categorization filter: all, text, image, music, other
  const [activeCategory, setActiveCategory] = useState<'all' | PromptType>('all');
  
  const [copied, setCopied] = useState(false);
  const [showListOnMobile, setShowListOnMobile] = useState(true);

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

  const shortenAccountName = (name: string) => name.split(':')[0].trim();

  // Find the selected prompt
  const selectedPrompt = state.prompts.find(p => p.id === selectedPromptId);

  // Sync selected prompt on list changes
  useEffect(() => {
    if (state.prompts.length > 0) {
      if (!selectedPromptId || !state.prompts.some(p => p.id === selectedPromptId)) {
        setSelectedPromptId(state.prompts[0].id);
      }
    } else {
      setSelectedPromptId(null);
    }
  }, [state.prompts, selectedPromptId]);

  const handleSelectPrompt = (id: string) => {
    setSelectedPromptId(id);
    setShowListOnMobile(false);
  };

  const handleAdd = () => {
    const accId = filterAccountId !== 'all' && filterAccountId !== 'general' ? filterAccountId : state.accounts[0]?.id;
    const promptType: PromptType = activeCategory !== 'all' ? activeCategory : 'text';
    
    addPrompt({
      title: 'Новый промпт',
      content: 'Текст промпта...',
      accountId: accId,
      type: promptType
    });
  };

  const handleDuplicate = (prompt: Prompt) => {
    addPrompt({
      title: `${prompt.title} (копия)`,
      content: prompt.content,
      accountId: prompt.accountId,
      bookId: prompt.bookId,
      type: prompt.type || 'text'
    });
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Filter prompts
  const filteredPrompts = state.prompts.filter(p => {
    // 1. Account Filter
    if (filterAccountId !== 'all') {
      if (filterAccountId === 'general') {
        if (p.accountId) return false;
      } else {
        if (p.accountId !== filterAccountId) return false;
      }
    }
    
    // 2. Category Filter
    const pType = p.type || 'text';
    if (activeCategory !== 'all' && pType !== activeCategory) {
      return false;
    }
    
    // 3. Search query
    const titleMatch = p.title.toLowerCase().includes(searchQuery.toLowerCase());
    const contentMatch = p.content.toLowerCase().includes(searchQuery.toLowerCase());
    return titleMatch || contentMatch;
  });

  const getPromptTypeIcon = (type?: PromptType) => {
    switch (type) {
      case 'text':
        return <FileText className="w-3.5 h-3.5 text-blue-400" />;
      case 'image':
        return <ImageIcon className="w-3.5 h-3.5 text-purple-400" />;
      case 'music':
        return <Music className="w-3.5 h-3.5 text-pink-400" />;
      case 'other':
      default:
        return <Sparkles className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  const categoriesList: { id: 'all' | PromptType; label: string; icon: any }[] = [
    { id: 'all', label: 'Все', icon: Settings },
    { id: 'text', label: 'Текст', icon: FileText },
    { id: 'image', label: 'Изображения', icon: ImageIcon },
    { id: 'music', label: 'Музыка', icon: Music },
    { id: 'other', label: 'Разное', icon: Sparkles }
  ];

  return (
    <div className="flex h-full w-full bg-zinc-950 overflow-hidden flex-col md:flex-row">
      {/* Left Pane: Prompt Editor */}
      <div className={cn(
        "flex-1 bg-zinc-950 overflow-hidden relative flex-col order-2 md:order-1",
        showListOnMobile ? "hidden md:flex" : "flex"
      )}>
        <div className="md:hidden p-3 border-b border-zinc-800/50 bg-zinc-900/50 flex items-center">
            <button onClick={() => setShowListOnMobile(true)} className="text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 text-sm font-medium transition-colors">
                <ChevronLeft className="w-5 h-5"/> Назад к списку
            </button>
        </div>
        {!selectedPrompt ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <Settings className="w-12 h-12 opacity-20" />
            <p>Нет промптов в этом разделе. Создайте новый промпт в списке справа.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Toolbar (Floating top-right) */}
            <div className="absolute top-4 right-10 z-20 flex gap-1 bg-zinc-900/90 py-1.5 px-2 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md items-center">
              <button
                onClick={() => handleCopy(selectedPrompt.content)}
                disabled={!selectedPrompt.content}
                className="flex items-center gap-1.5 px-2 py-1 text-zinc-400 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-medium"
                title="Копировать текст промпта"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Скопировано</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Копировать</span>
                  </>
                )}
              </button>
              
              <div className="w-px h-5 bg-zinc-800 self-center" />

              <button
                onClick={() => handleDuplicate(selectedPrompt)}
                className="flex items-center gap-1.5 px-2.5 py-1 text-zinc-400 hover:text-emerald-400 transition-all text-xs font-medium"
                title="Дублировать промпт"
              >
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Дублировать</span>
              </button>

              <div className="w-px h-5 bg-zinc-800 self-center" />

              <button
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Удалить промпт?',
                    message: `Вы уверены, что хотите удалить промпт "${selectedPrompt.title}"?`,
                    onConfirm: () => {
                      deletePrompt(selectedPrompt.id);
                      setSelectedPromptId(null);
                    },
                  });
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-zinc-400 hover:text-red-400 transition-all text-xs font-medium"
                title="Удалить промпт"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Удалить</span>
              </button>
            </div>

            {/* Document Editor Page Wrapper */}
            <div className="flex-1 overflow-y-auto w-full px-4 sm:px-8 pb-32">
              <div className="max-w-3xl mx-auto py-12 flex flex-col h-full min-h-[500px]">
                {/* Title field */}
                <input
                  type="text"
                  value={selectedPrompt.title}
                  onChange={(e) => updatePrompt(selectedPrompt.id, { title: e.target.value })}
                  className="text-2xl font-bold text-zinc-100 bg-transparent border-none focus:ring-0 p-0 outline-none w-full mb-6"
                  placeholder="Название промпта..."
                />
                
                {/* Metadata Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 bg-zinc-900/10 border border-zinc-900/50 p-4 rounded-xl">
                  {/* Account/Pseudonym Select */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Псевдоним</label>
                    <select
                      value={selectedPrompt.accountId || ''}
                      onChange={(e) => updatePrompt(selectedPrompt.id, { accountId: e.target.value || undefined, bookId: undefined })}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      <option value="">Общие</option>
                      {state.accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {shortenAccountName(acc.name)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Book Select */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Связать с книгой</label>
                    <select
                      value={selectedPrompt.bookId || ''}
                      onChange={(e) => updatePrompt(selectedPrompt.id, { bookId: e.target.value || undefined })}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      <option value="">—</option>
                      {state.books
                        .filter(b => !selectedPrompt.accountId || b.accountId === selectedPrompt.accountId)
                        .map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title}
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Type Select */}
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Категория</label>
                    <select
                      value={selectedPrompt.type || 'text'}
                      onChange={(e) => updatePrompt(selectedPrompt.id, { type: e.target.value as PromptType })}
                      className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      <option value="text">Текст</option>
                      <option value="image">Изображение</option>
                      <option value="music">Музыка</option>
                      <option value="other">Разное</option>
                    </select>
                  </div>
                </div>

                {/* Prompt Content */}
                <textarea
                  value={selectedPrompt.content}
                  onChange={(e) => updatePrompt(selectedPrompt.id, { content: e.target.value })}
                  className="flex-1 w-full bg-transparent border-none text-[15px] leading-relaxed text-zinc-300 placeholder:text-zinc-700 outline-none resize-none font-sans font-normal min-h-[300px]"
                  placeholder="Введите текст промпта здесь..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Pane: Prompts List Sidebar */}
      <div className={cn(
        "w-full md:w-80 bg-zinc-900 md:border-l border-zinc-900 flex-col h-full overflow-hidden shrink-0 order-1 md:order-2",
        !showListOnMobile ? "hidden md:flex" : "flex"
      )}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800/35 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-emerald-500" />
            <h3 className="font-bold text-zinc-200 text-sm">Промпты</h3>
          </div>
          <button
            onClick={handleAdd}
            className="p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/50 rounded-md transition-colors"
            title="Добавить новый промпт"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Categories Bar inside Sidebar */}
        <div className="px-3 py-2.5 border-b border-zinc-800 shrink-0">
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800/60 overflow-x-auto scrollbar-none">
            {categoriesList.map(cat => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex-1 text-[10px] font-bold py-1 px-1.5 rounded-md transition-colors whitespace-nowrap",
                    isActive ? "bg-zinc-900 text-emerald-450 shadow-sm" : "text-zinc-550 hover:text-zinc-300"
                  )}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sidebar Search and Account Filters */}
        <div className="p-3 border-b border-zinc-800/40 shrink-0 space-y-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск промпта..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-emerald-500/30 transition-all"
            />
          </div>

          {/* Account Filter Select */}
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 outline-none focus:border-emerald-500/30 transition-all cursor-pointer"
          >
            <option value="all">Все псевдонимы</option>
            <option value="general">Общие</option>
            {state.accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>
        </div>

        {/* Sidebar List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredPrompts.length === 0 ? (
            <div className="text-center text-zinc-650 py-12 text-xs italic">
              {searchQuery || filterAccountId !== 'all' || activeCategory !== 'all' ? "Ничего не найдено" : "Список промптов пуст"}
            </div>
          ) : (
            filteredPrompts.map((prompt) => {
              const isActive = selectedPromptId === prompt.id;
              const account = state.accounts.find(a => a.id === prompt.accountId);
              const charCount = prompt.content.length;

              return (
                <button
                  key={prompt.id}
                  onClick={() => handleSelectPrompt(prompt.id)}
                  className={cn(
                    "w-full flex flex-col gap-1 px-3 py-2.5 rounded-lg border text-left transition-all duration-200",
                    isActive
                      ? "bg-zinc-800 border-zinc-700 text-zinc-100 shadow-sm"
                      : "border-transparent text-zinc-550 hover:text-zinc-300 hover:bg-zinc-800/30"
                  )}
                >
                  <div className="flex items-center gap-1.5 w-full">
                    {getPromptTypeIcon(prompt.type)}
                    <span className="flex-1 font-bold text-xs truncate leading-snug">{prompt.title}</span>
                    <span className="text-[9px] text-zinc-600 font-mono shrink-0">
                      {charCount} зн.
                    </span>
                  </div>
                  {account && (
                    <span className="text-[8px] font-extrabold uppercase tracking-wider text-zinc-600 block pl-5 truncate max-w-full">
                      {shortenAccountName(account.name)}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
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
