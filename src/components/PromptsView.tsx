import { Copy, Plus, Settings, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const PromptsView: React.FC = () => {
  const { state, addPrompt, updatePrompt, deletePrompt } = useAppStore();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

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

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col">
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
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-emerald-700 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5" />
          Новый промпт
        </button>
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
          Все промпты
        </button>
        <button
          onClick={() => setSelectedAccountId('general')}
          className={cn(
            "px-5 py-2 rounded-xl text-sm font-semibold transition-all duration-200",
            selectedAccountId === 'general'
              ? "bg-zinc-100 text-zinc-950 shadow-lg shadow-black/20"
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pb-20">
        {state.prompts
          .filter(p => {
            if (selectedAccountId === 'all') return true;
            if (selectedAccountId === 'general') return !p.accountId;
            return p.accountId === selectedAccountId;
          })
          .map((prompt) => (
            <div
              key={prompt.id}
              className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 p-6 flex flex-col group relative"
            >
              <div className="flex justify-between items-start mb-4">
                <input
                  type="text"
                  value={prompt.title}
                  onChange={(e) => updatePrompt(prompt.id, { title: e.target.value })}
                  className="text-lg font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-[80%]"
                  placeholder="Название промпта"
                />
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(prompt.id)}
                    className="text-zinc-500 hover:text-zinc-300 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-all p-1"
                    title="Дублировать"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Удалить промпт?',
                        message: `Вы уверены, что хотите удалить промпт "${prompt.title}"?`,
                        onConfirm: () => deletePrompt(prompt.id),
                      });
                    }}
                    className="text-zinc-400 hover:text-red-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-all p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <textarea
                value={prompt.content}
                onChange={(e) => updatePrompt(prompt.id, { content: e.target.value })}
                className="flex-1 w-full text-sm text-zinc-200 resize-none bg-zinc-950 border border-zinc-800/50 rounded-xl p-4 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none min-h-[160px] leading-relaxed"
                placeholder="Текст промпта..."
              />

              <div className="mt-4">
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Жанр / Аккаунт</label>
                <select
                  value={prompt.accountId || ''}
                  onChange={(e) => updatePrompt(prompt.id, { accountId: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 text-xs text-zinc-400 rounded-lg px-3 py-2 outline-none focus:border-emerald-500/50 transition-colors"
                >
                  <option value="">Без привязки</option>
                  {state.accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => handleCopy(prompt.id, prompt.content)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-200 rounded-lg text-sm font-medium transition-colors"
                >
                  <Copy className="w-4 h-4" />
                  {copiedId === prompt.id ? 'Скопировано!' : 'Копировать'}
                </button>
              </div>
            </div>
          ))}
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
