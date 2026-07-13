import { Map, Plus, Trash2, Copy, CheckCircle2, Search } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { Setting } from '../types';
import { cn } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const SettingCards: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, addSetting, updateSetting, deleteSetting } = useAppStore();
  const settings = state.settings.filter((s) => s.bookId === bookId);
  const [selectedSettingId, setSelectedSettingId] = useState<string | null>(null);
  
  // Search query for locations
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

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

  // Keep selection in sync
  useEffect(() => {
    if (settings.length > 0) {
      if (!selectedSettingId || !settings.some(s => s.id === selectedSettingId)) {
        setSelectedSettingId(settings[0].id);
      }
    } else {
      setSelectedSettingId(null);
    }
  }, [settings, selectedSettingId]);

  const handleAdd = () => {
    const newId = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    addSetting({
      bookId,
      title: 'Новая локация',
      description: 'Описание места, атмосферы, важных деталей...',
    });
  };

  const selectedSetting = settings.find(s => s.id === selectedSettingId);

  const handleCopyDescription = () => {
    if (selectedSetting?.description) {
      navigator.clipboard.writeText(selectedSetting.description);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Filter settings based on search
  const filteredSettings = settings.filter(s => 
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full w-full bg-zinc-950 overflow-hidden">
      {/* Left Pane: Editor */}
      <div className="flex-1 bg-zinc-950 overflow-hidden relative flex flex-col">
        {!selectedSetting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3">
            <Map className="w-12 h-12 opacity-20" />
            <p>Нет локаций в сеттинге. Создайте первую локацию в списке справа.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden relative">
            {/* Toolbar (Floating top-right) */}
            <div className="absolute top-4 right-10 z-20 flex gap-1 bg-zinc-900/90 py-1.5 px-2 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md items-center">
              <button
                onClick={handleCopyDescription}
                disabled={!selectedSetting.description}
                className="flex items-center gap-1.5 px-2 py-1 text-zinc-400 hover:text-emerald-400 disabled:opacity-30 disabled:cursor-not-allowed transition-all text-xs font-medium"
                title="Копировать описание локации"
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
                onClick={() => {
                  setConfirmModal({
                    isOpen: true,
                    title: 'Удалить локацию?',
                    message: `Вы уверены, что хотите удалить локацию "${selectedSetting.title}"?`,
                    onConfirm: () => {
                      deleteSetting(selectedSetting.id);
                      setSelectedSettingId(null);
                    },
                  });
                }}
                className="flex items-center gap-1 px-2.5 py-1 text-zinc-400 hover:text-red-400 transition-all text-xs font-medium"
                title="Удалить локацию"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Удалить</span>
              </button>
            </div>

            {/* Document Editor Page Wrapper */}
            <div className="flex-1 overflow-y-auto w-full px-8 pb-32">
              <div className="max-w-3xl mx-auto py-12 flex flex-col h-full min-h-[500px]">
                {/* Title field */}
                <input
                  type="text"
                  value={selectedSetting.title}
                  onChange={(e) => updateSetting(selectedSetting.id, { title: e.target.value })}
                  className="text-2xl font-bold text-zinc-100 bg-transparent border-none focus:ring-0 p-0 outline-none w-full mb-6"
                  placeholder="Название локации"
                />
                
                {/* Description Textarea */}
                <textarea
                  value={selectedSetting.description}
                  onChange={(e) => updateSetting(selectedSetting.id, { description: e.target.value })}
                  className="flex-1 w-full bg-transparent border-none text-[15px] leading-relaxed text-zinc-300 placeholder:text-zinc-700 outline-none resize-none font-sans font-normal"
                  placeholder="Описание места, атмосферы, важных деталей..."
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Right Pane: Settings/Locations List Sidebar */}
      <div className="w-72 bg-zinc-900 border-l border-zinc-900 flex flex-col h-full overflow-hidden shrink-0">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <Map className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-zinc-200 text-sm">Локации сеттинга</h3>
          </div>
          <button
            onClick={handleAdd}
            className="p-1.5 text-zinc-450 hover:text-amber-400 hover:bg-zinc-800/50 rounded-md transition-colors"
            title="Добавить локацию"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Search Bar */}
        <div className="p-3 border-b border-zinc-800 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-zinc-550" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск локации..."
              className="w-full bg-zinc-950 border border-zinc-800/80 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-650 outline-none focus:border-amber-500/30 transition-all"
            />
          </div>
        </div>

        {/* Sidebar List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredSettings.length === 0 ? (
            <div className="text-center text-zinc-650 py-8 text-xs italic">
              {searchQuery ? "Ничего не найдено" : "Список пуст"}
            </div>
          ) : (
            filteredSettings.map((setting) => {
              const isActive = selectedSettingId === setting.id;
              const charCount = setting.description.length;

              return (
                <button
                  key={setting.id}
                  onClick={() => setSelectedSettingId(setting.id)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 border text-left",
                    isActive
                      ? "bg-zinc-800 border-zinc-700 text-zinc-100 shadow-sm"
                      : "border-transparent text-zinc-500 hover:text-zinc-350 hover:bg-zinc-800/30"
                  )}
                >
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0 transition-transform duration-300", 
                    isActive ? "bg-amber-400 scale-125" : "bg-amber-600/50"
                  )} />
                  <span className="flex-1 truncate">{setting.title}</span>
                  <span className="text-[10px] text-zinc-600 font-mono shrink-0">
                    {charCount} зн.
                  </span>
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
