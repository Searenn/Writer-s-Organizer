import { Copy, Plus, Settings, Trash2, CheckCircle2, ChevronUp, ChevronDown } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const PromptsView: React.FC = () => {
  const { state, addPrompt, updatePrompt, deletePrompt } = useAppStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [sortField, setSortField] = useState<'title' | 'account' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const shortenAccountName = (name: string) => name.split(':')[0].trim();

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

  const handleAdd = () => {
    addPrompt({
      title: 'Новый промпт',
      content: 'Текст промпта...',
      accountId: selectedAccountId !== 'all' ? selectedAccountId : state.accounts[0]?.id,
    });
  };

  const handleDuplicate = (id: string) => {
    const prompt = state.prompts.find(p => p.id === id);
    if (!prompt) return;
    addPrompt({
      title: `${prompt.title} (копия)`,
      content: prompt.content,
      accountId: prompt.accountId
    });
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSort = (field: 'title' | 'account') => {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortedPrompts = [...state.prompts]
    .filter(p => {
      if (selectedAccountId === 'all') return true;
      if (selectedAccountId === 'general') return !p.accountId;
      return p.accountId === selectedAccountId;
    })
    .sort((a, b) => {
      if (sortField === 'title') {
        return sortDir === 'asc'
          ? a.title.localeCompare(b.title)
          : b.title.localeCompare(a.title);
      }
      if (sortField === 'account') {
        const accA = state.accounts.find(x => x.id === a.accountId)?.name || 'Общие';
        const accB = state.accounts.find(x => x.id === b.accountId)?.name || 'Общие';
        return sortDir === 'asc'
          ? shortenAccountName(accA).localeCompare(shortenAccountName(accB))
          : shortenAccountName(accB).localeCompare(shortenAccountName(accA));
      }
      return 0;
    });

  return (
    <div className="p-8 max-w-[1400px] mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 tracking-tight flex items-center gap-3">
            <Settings className="w-8 h-8 text-emerald-500" />
            Библиотека Промптов
          </h1>
          <p className="text-zinc-400 mt-1">Храните здесь свои любимые запросы для нейросетей.</p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm shrink-0"
        >
          <Plus className="w-4 h-4" />
          Новый промпт
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50 overflow-x-auto shrink-0 scrollbar-none w-full max-w-full">
        <button
          onClick={() => setSelectedAccountId('all')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
            selectedAccountId === 'all'
              ? "bg-emerald-600 text-white shadow shadow-emerald-900/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          )}
        >
          Все
        </button>
        <button
          onClick={() => setSelectedAccountId('general')}
          className={cn(
            "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
            selectedAccountId === 'general'
              ? "bg-zinc-100 text-zinc-950 shadow shadow-black/20"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          )}
        >
          Общие
        </button>
        {state.accounts.map((acc) => (
          <button
            key={acc.id}
            onClick={() => setSelectedAccountId(acc.id)}
            className={cn(
              "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
              selectedAccountId === acc.id
                ? "bg-zinc-100 text-zinc-950 shadow shadow-black/20"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            )}
          >
            {shortenAccountName(acc.name)}
          </button>
        ))}
      </div>

      <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-[250px_180px_1fr_120px] gap-4 p-4 border-b border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-300 uppercase tracking-wider items-center pr-6">
          <button
            onClick={() => handleSort('title')}
            className="text-left flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            Название
            {sortField === 'title' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
          </button>
          <button
            onClick={() => handleSort('account')}
            className="text-left flex items-center gap-1 hover:text-emerald-400 transition-colors"
          >
            Жанр / Аккаунт
            {sortField === 'account' && (sortDir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />)}
          </button>
          <div>Текст Промпта</div>
          <div className="text-right">Действия</div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sortedPrompts.length === 0 ? (
            <div className="text-center text-zinc-500 py-12 text-sm">
              Промпты не найдены. Создайте первый!
            </div>
          ) : (
            sortedPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className="grid grid-cols-[250px_180px_1fr_120px] gap-4 p-3 items-start hover:bg-zinc-950 rounded-xl transition-colors border border-transparent hover:border-zinc-800 group"
              >
                <div>
                  <input
                    type="text"
                    value={prompt.title}
                    onChange={(e) => updatePrompt(prompt.id, { title: e.target.value })}
                    className="w-full text-sm font-semibold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none placeholder:text-zinc-700 focus:bg-zinc-900 focus:px-2 focus:-ml-2 rounded-md transition-all h-8"
                    placeholder="Название..."
                  />
                </div>

                <div>
                  <select
                    value={prompt.accountId || ''}
                    onChange={(e) => updatePrompt(prompt.id, { accountId: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800/60 text-xs text-zinc-400 rounded-md px-2 py-1.5 outline-none focus:border-emerald-500/50 transition-colors hover:border-zinc-700 h-8"
                  >
                    <option value="">Общие</option>
                    {state.accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {shortenAccountName(acc.name)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1 flex">
                  <textarea
                    value={prompt.content}
                    onChange={(e) => updatePrompt(prompt.id, { content: e.target.value })}
                    className="w-full text-[13px] text-zinc-300 resize-none bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2.5 outline-none min-h-[100px] hover:bg-zinc-950 focus:bg-zinc-950 focus:border-emerald-500/50 transition-all custom-scrollbar flex-1"
                    placeholder="Текст промпта..."
                  />
                  <div className="absolute right-2 bottom-2 bg-zinc-900/80 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => handleCopy(prompt.id, prompt.content)}
                      className={cn(
                        "p-1.5 rounded transition-all",
                        copiedId === prompt.id ? "text-emerald-400 bg-emerald-500/10" : "text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800"
                      )}
                      title="Копировать в буфер"
                    >
                      {copiedId === prompt.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 h-8">
                  <button
                    onClick={() => handleDuplicate(prompt.id)}
                    className="text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-zinc-800 rounded-md"
                    title="Дублировать промпт"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Удалить промпт?',
                        message: `Удалить промпт "${prompt.title}"?`,
                        onConfirm: () => deletePrompt(prompt.id),
                      });
                    }}
                    className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-red-500/10 rounded-md"
                    title="Удалить"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
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
