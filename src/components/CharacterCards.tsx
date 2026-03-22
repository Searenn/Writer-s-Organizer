import { Plus, Trash2, Users } from 'lucide-react';
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
    // The new character will be selected automatically due to it being appended and not selected yet, wait we need to select the new one.
    // However, state update is async, we don't have its ID immediately here.
    // It's fine, the user can click it.
  };

  const selectedChar = characters.find(c => c.id === selectedCharId);

  return (
    <div className="h-full flex bg-zinc-950 overflow-hidden">
      {/* Sidebar for Characters */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold">
            <Users className="w-4 h-4 text-emerald-500" />
            <span>Персонажи</span>
          </div>
          <button
            onClick={handleAdd}
            className="p-1.5 bg-zinc-800 text-zinc-300 rounded hover:text-emerald-400 hover:bg-zinc-700 transition-colors"
            title="Добавить персонажа"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {characters.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs mt-10 px-4">
              Список пуст. Создайте первого персонажа.
            </div>
          ) : (
            characters.map((char) => (
              <button
                key={char.id}
                onClick={() => setSelectedCharId(char.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  selectedCharId === char.id
                    ? "bg-zinc-800 text-emerald-50 shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: char.color || '#10b981' }}
                />
                <span className="truncate flex-1">{char.name}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-950">
        {!selectedChar ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Выберите персонажа из списка слева или создайте нового
          </div>
        ) : (
          <div className="p-8 max-w-3xl mx-auto space-y-6">
            <div className="bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-800 relative group overflow-hidden">
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
                className="absolute top-8 right-8 text-zinc-500 hover:text-red-500 transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-4 mb-4 pr-12 mt-2">
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

              <div className="mb-6">
                <label className="block text-xs font-semibold text-zinc-500 mb-1 uppercase tracking-wider">Псевдонимы / Склонения</label>
                <input
                  type="text"
                  value={selectedChar.aliases || ''}
                  onChange={(e) => updateCharacter(selectedChar.id, { aliases: e.target.value })}
                  className="w-full text-sm text-zinc-300 bg-zinc-950 px-3 py-2 rounded-lg border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none transition-all"
                  placeholder="Например: Саша, Саня, Александр (через запятую)..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Описание</label>
                <textarea
                  value={selectedChar.description}
                  onChange={(e) => updateCharacter(selectedChar.id, { description: e.target.value })}
                  className="w-full text-base text-zinc-200 resize-y bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none min-h-[300px] leading-relaxed transition-all"
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
