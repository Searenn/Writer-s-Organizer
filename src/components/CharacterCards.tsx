import { Plus, Trash2, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Character } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const CharacterCards: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, addCharacter, updateCharacter, deleteCharacter } = useAppStore();
  const characters = state.characters.filter((c) => c.bookId === bookId);
  const [viewMode, setViewMode] = useState<'grid' | 'canvas'>('grid');
  const [editingId, setEditingId] = useState<string | null>(null);

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
    addCharacter({
      bookId,
      name: 'Новый персонаж',
      description: 'Описание внешности, характера, роли в сюжете...',
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="px-8 py-4 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-100">Персонажи</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex bg-zinc-800/50 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-zinc-900 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Карточки
            </button>
            <button
              onClick={() => setViewMode('canvas')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                viewMode === 'canvas' ? 'bg-zinc-900 text-zinc-100 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Полотном
            </button>
          </div>
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Добавить
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {characters.length === 0 ? (
          <div className="text-center text-zinc-400 mt-20">
            Нет персонажей. Создайте первого!
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {characters.map((char) => (
              <div
                key={char.id}
                className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 p-5 flex flex-col group hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-3">
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                    className="text-lg font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-[70%]"
                    placeholder="Имя персонажа"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={char.color || '#10b981'}
                      onChange={(e) => updateCharacter(char.id, { color: e.target.value })}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent"
                      title="Цвет подсветки в тексте"
                    />
                    <button
                      onClick={() => {
                        setConfirmModal({
                          isOpen: true,
                          title: 'Удалить персонажа?',
                          message: `Вы уверены, что хотите удалить персонажа "${char.name}"?`,
                          onConfirm: () => deleteCharacter(char.id),
                        });
                      }}
                      className="text-zinc-400 hover:text-red-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="text"
                  value={char.aliases || ''}
                  onChange={(e) => updateCharacter(char.id, { aliases: e.target.value })}
                  className="w-full text-xs text-zinc-400 bg-transparent border-b border-zinc-800 focus:border-emerald-500 focus:ring-0 p-0 pb-1 mb-3 outline-none"
                  placeholder="Склонения, прозвища (через запятую)"
                />
                <textarea
                  value={char.description}
                  onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                  className="flex-1 w-full text-sm text-zinc-300 resize-none bg-transparent border-none focus:ring-0 p-0 outline-none min-h-[120px]"
                  placeholder="Описание..."
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-12 pb-20">
            {characters.map((char) => (
              <div key={char.id} className="bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-800 relative group">
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Удалить персонажа?',
                      message: `Вы уверены, что хотите удалить персонажа "${char.name}"?`,
                      onConfirm: () => deleteCharacter(char.id),
                    });
                  }}
                  className="absolute top-8 right-8 text-zinc-400 hover:text-red-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-4 mb-4 pr-12">
                  <input
                    type="text"
                    value={char.name}
                    onChange={(e) => updateCharacter(char.id, { name: e.target.value })}
                    className="text-2xl font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none flex-1"
                    placeholder="Имя персонажа"
                  />
                  <input
                    type="color"
                    value={char.color || '#10b981'}
                    onChange={(e) => updateCharacter(char.id, { color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                    title="Цвет подсветки в тексте"
                  />
                </div>
                <input
                  type="text"
                  value={char.aliases || ''}
                  onChange={(e) => updateCharacter(char.id, { aliases: e.target.value })}
                  className="w-full text-sm text-zinc-400 bg-transparent border-b border-zinc-800 focus:border-emerald-500 focus:ring-0 p-0 pb-2 mb-4 outline-none"
                  placeholder="Склонения, прозвища (через запятую)"
                />
                <textarea
                  value={char.description}
                  onChange={(e) => updateCharacter(char.id, { description: e.target.value })}
                  className="w-full text-lg text-zinc-200 resize-none bg-transparent border-none focus:ring-0 p-0 outline-none min-h-[200px] font-serif leading-relaxed"
                  placeholder="Описание..."
                />
              </div>
            ))}
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
