import { Map, Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { Setting } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const SettingCards: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, addSetting, updateSetting, deleteSetting } = useAppStore();
  const settings = state.settings.filter((s) => s.bookId === bookId);
  const [viewMode, setViewMode] = useState<'grid' | 'canvas'>('grid');

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
    addSetting({
      bookId,
      title: 'Новая локация',
      description: 'Описание места, атмосферы, важных деталей...',
    });
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="px-8 py-4 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Map className="w-5 h-5 text-emerald-500" />
          <h2 className="text-lg font-semibold text-zinc-100">Сеттинг / Локации</h2>
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
        {settings.length === 0 ? (
          <div className="text-center text-zinc-400 mt-20">
            Нет локаций. Создайте первую!
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {settings.map((setting) => (
              <div
                key={setting.id}
                className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 p-5 flex flex-col group hover:shadow-md transition-shadow relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-full h-1 bg-amber-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-3">
                  <input
                    type="text"
                    value={setting.title}
                    onChange={(e) => updateSetting(setting.id, { title: e.target.value })}
                    className="text-lg font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-[80%]"
                    placeholder="Название локации"
                  />
                  <button
                    onClick={() => {
                      setConfirmModal({
                        isOpen: true,
                        title: 'Удалить локацию?',
                        message: `Вы уверены, что хотите удалить локацию/элемент сеттинга "${setting.title}"?`,
                        onConfirm: () => deleteSetting(setting.id),
                      });
                    }}
                    className="text-zinc-400 hover:text-red-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={setting.description}
                  onChange={(e) => updateSetting(setting.id, { description: e.target.value })}
                  className="flex-1 w-full text-sm text-zinc-300 resize-none bg-transparent border-none focus:ring-0 p-0 outline-none min-h-[120px]"
                  placeholder="Описание..."
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-12 pb-20">
            {settings.map((setting) => (
              <div key={setting.id} className="bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-800 relative group">
                <button
                  onClick={() => {
                    setConfirmModal({
                      isOpen: true,
                      title: 'Удалить локацию?',
                      message: `Вы уверены, что хотите удалить локацию/элемент сеттинга "${setting.title}"?`,
                      onConfirm: () => deleteSetting(setting.id),
                    });
                  }}
                  className="absolute top-8 right-8 text-zinc-400 hover:text-red-500 opacity-40 hover:opacity-100 group-hover:opacity-100 transition-all"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <input
                  type="text"
                  value={setting.title}
                  onChange={(e) => updateSetting(setting.id, { title: e.target.value })}
                  className="text-2xl font-bold text-emerald-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-[80%] mb-4"
                  placeholder="Название локации"
                />
                <textarea
                  value={setting.description}
                  onChange={(e) => updateSetting(setting.id, { description: e.target.value })}
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
