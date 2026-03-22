import { Map, Plus, Trash2 } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Setting } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const SettingCards: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, addSetting, updateSetting, deleteSetting } = useAppStore();
  const settings = state.settings.filter((s) => s.bookId === bookId);
  const [selectedSettingId, setSelectedSettingId] = useState<string | null>(settings[0]?.id || null);

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
    if (!selectedSettingId && settings.length > 0) {
      setSelectedSettingId(settings[0].id);
    } else if (selectedSettingId && !settings.find(s => s.id === selectedSettingId)) {
      setSelectedSettingId(settings[0]?.id || null);
    }
  }, [settings, selectedSettingId]);

  const handleAdd = () => {
    addSetting({
      bookId,
      title: 'Новая локация',
      description: 'Описание места, атмосферы, важных деталей...',
    });
  };

  const selectedSetting = settings.find(s => s.id === selectedSettingId);

  return (
    <div className="h-full flex bg-zinc-950 overflow-hidden">
      {/* Sidebar for Settings */}
      <div className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col shrink-0">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-300 font-semibold">
            <Map className="w-4 h-4 text-emerald-500" />
            <span>Локации</span>
          </div>
          <button
            onClick={handleAdd}
            className="p-1.5 bg-zinc-800 text-zinc-300 rounded hover:text-emerald-400 hover:bg-zinc-700 transition-colors"
            title="Добавить локацию"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
          {settings.length === 0 ? (
            <div className="text-center text-zinc-500 text-xs mt-10 px-4">
              Список пуст. Создайте первую локацию/элемент сеттинга.
            </div>
          ) : (
            settings.map((setting) => (
              <button
                key={setting.id}
                onClick={() => setSelectedSettingId(setting.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                  selectedSettingId === setting.id
                    ? "bg-zinc-800 text-amber-50 shadow-sm"
                    : "text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
                )}
              >
                <div
                  className="w-2 h-2 rounded-full shrink-0 bg-amber-500"
                />
                <span className="truncate flex-1 py-0.5">{setting.title}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto bg-zinc-950">
        {!selectedSetting ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
            Выберите локацию из списка слева или добавьте новую
          </div>
        ) : (
          <div className="p-8 max-w-3xl mx-auto space-y-6">
            <div className="bg-zinc-900 p-8 rounded-2xl shadow-sm border border-zinc-800 relative group overflow-hidden">
              <div
                className="absolute top-0 left-0 w-full h-1 transition-colors bg-amber-500"
              />

              <button
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Удалить локацию?',
                    message: `Вы уверены, что хотите удалить локацию/элемент сеттинга "${selectedSetting.title}"?`,
                    onConfirm: () => deleteSetting(selectedSetting.id),
                  });
                }}
                className="absolute top-8 right-8 text-zinc-500 hover:text-red-500 transition-colors"
                title="Удалить"
              >
                <Trash2 className="w-5 h-5" />
              </button>

              <div className="flex flex-col gap-2 mb-6 pr-12 mt-2">
                <label className="block text-xs font-semibold text-zinc-500 uppercase tracking-wider">Название локации</label>
                <input
                  type="text"
                  value={selectedSetting.title}
                  onChange={(e) => updateSetting(selectedSetting.id, { title: e.target.value })}
                  className="text-2xl font-bold text-amber-50 bg-transparent border-none focus:ring-0 p-0 outline-none w-full"
                  placeholder="Название локации"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-2 uppercase tracking-wider">Описание</label>
                <textarea
                  value={selectedSetting.description}
                  onChange={(e) => updateSetting(selectedSetting.id, { description: e.target.value })}
                  className="w-full text-base text-zinc-200 resize-y bg-zinc-950 px-4 py-3 rounded-xl border border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 outline-none min-h-[300px] leading-relaxed transition-all"
                  placeholder="Описание места, атмосферы, важных деталей..."
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
