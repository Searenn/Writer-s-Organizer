import { Check, ClipboardCopy, Plus, Trash2, Users } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Character } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const CharacterCards: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, addCharacter, updateCharacter, deleteCharacter } = useAppStore();
  const characters = state.characters.filter((c) => c.bookId === bookId);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(characters[0]?.id || null);

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

  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    if (characters.length === 0) return;
    const text = characters.map((char) => {
      let block = `【${char.name}】`;
      if (char.aliases) block += `\nПсевдонимы: ${char.aliases}`;
      block += `\n${char.description}`;
      return block;
    }).join('\n\n————————————————\n\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy characters', err);
    }
  };

  useEffect(() => {
    if (!selectedCharId && characters.length > 0) {
      setSelectedCharId(characters[0].id);
    } else if (selectedCharId && !characters.find(c => c.id === selectedCharId)) {
      setSelectedCharId(characters[0]?.id || null);
    }
  }, [characters, selectedCharId]);

  const handleAdd = () => {
    addCharacter({
      bookId,
      name: 'Новый персонаж',
      description: 'Описание внешности, характера, роли в сюжете...',
    });
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Horizontal character selector bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 shrink-0">
        <div className="flex items-center gap-2 px-4 py-2">
          <div className="flex items-center gap-2 text-zinc-400 shrink-0">
            <Users className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-semibold uppercase tracking-wider">Персонажи</span>
          </div>
          <div className="w-px h-5 bg-zinc-800 shrink-0" />
          <div className="flex-1 overflow-x-auto flex items-center gap-1 py-0.5 scrollbar-thin">
            {characters.length === 0 ? (
              <span className="text-xs text-zinc-600 italic">Список пуст</span>
            ) : (
              characters.map((char) => (
                <button
                  key={char.id}
                  onClick={() => setSelectedCharId(char.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap shrink-0",
                    selectedCharId === char.id
                      ? "bg-zinc-800 text-emerald-50 shadow-sm border border-zinc-700"
                      : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 border border-transparent"
                  )}
                >
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: char.color || '#10b981' }}
                  />
                  {char.name}
                </button>
              ))
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {characters.length > 0 && (
              <button
                onClick={handleCopyAll}
                className="p-1.5 text-zinc-500 rounded hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
                title="Скопировать всех персонажей"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardCopy className="w-3.5 h-3.5" />}
              </button>
            )}
            <button
              onClick={handleAdd}
              className="p-1.5 text-zinc-500 rounded hover:text-emerald-400 hover:bg-zinc-800 transition-colors"
              title="Добавить персонажа"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area — full width */}
      <div className="flex-1 overflow-y-auto">
        {!selectedChar ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Создайте первого персонажа нажав +
          </div>
        ) : (
          <div className="p-6 h-full flex flex-col">
            <div className="flex-1 flex flex-col bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 relative overflow-hidden">
              <div
                className="absolute top-0 left-0 w-full h-1 transition-colors"
                style={{ backgroundColor: selectedChar.color || '#10b981' }}
              />

              <button
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Удалить персонажа?',
                    message: `Вы уверены, что хотите удалить персонажа "${selectedChar.name}"?`,
                    onConfirm: () => deleteCharacter(selectedChar.id),
                  });
                }}
                className="absolute top-6 right-6 text-zinc-500 hover:text-red-500 transition-colors z-10"
                title="Удалить"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="p-6 pb-0">
                <div className="flex items-center gap-4 pr-12 mt-1">
                  <input
                    type="text"
                    value={selectedChar.name}
                    onChange={(e) => updateCharacter(selectedChar.id, { name: e.target.value })}
                    className="text-2xl font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none flex-1"
                    placeholder="Имя персонажа"
                  />
                  <input
                    type="color"
                    value={selectedChar.color || '#10b981'}
                    onChange={(e) => updateCharacter(selectedChar.id, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Цвет подсветки в тексте"
                  />
                </div>

                <div className="mt-4 mb-4">
                  <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider">Псевдонимы / Склонения</label>
                  <input
                    type="text"
                    value={selectedChar.aliases || ''}
                    onChange={(e) => updateCharacter(selectedChar.id, { aliases: e.target.value })}
                    className="w-full text-sm text-zinc-300 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                    placeholder="Например: Саша, Саня, Александр (через запятую)..."
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col px-6 pb-6 min-h-0">
                <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Описание</label>
                <textarea
                  value={selectedChar.description}
                  onChange={(e) => updateCharacter(selectedChar.id, { description: e.target.value })}
                  className="flex-1 w-full text-base text-zinc-200 resize-none bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none leading-relaxed transition-all"
                  placeholder="Описание внешности, характера, мотивации..."
                />
              </div>
            </div>
          </div>
        )}
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
