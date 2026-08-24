import { ChevronDown, Clock3, History, Loader2, RotateCcw, Save, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { BookRecoveryPayload } from '../types';
import { cn } from '../utils';
import { parseChaptersFromHtml } from './CanvasRichEditor';

type Props = {
  bookId: string;
  onClose: () => void;
};

export const VersionHistoryPanel: React.FC<Props> = ({ bookId, onClose }) => {
  const { state, createBookVersion, loadBookVersion, restoreBookVersion } = useAppStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [payload, setPayload] = useState<BookRecoveryPayload | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const versions = useMemo(() => (
    [...(state.bookVersions || [])]
      .filter(item => item.bookId === bookId)
      .sort((a, b) => b.createdAt - a.createdAt)
  ), [bookId, state.bookVersions]);

  const handleCreate = async () => {
    setBusy('create');
    setStatus(null);
    try {
      await createBookVersion(bookId, 'Ручная версия', false);
      setStatus('Версия сохранена');
    } catch (error: any) {
      setStatus(error.message || 'Не удалось сохранить версию');
    } finally {
      setBusy(null);
    }
  };

  const handleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setPayload(null);
      return;
    }
    setBusy(id);
    setStatus(null);
    try {
      setPayload(await loadBookVersion(id));
      setExpandedId(id);
    } catch (error: any) {
      setStatus(error.message || 'Не удалось загрузить версию');
    } finally {
      setBusy(null);
    }
  };

  const handleRestore = async (id: string, chapterIndex?: number) => {
    const message = chapterIndex === undefined
      ? 'Восстановить всю книгу из этой версии? Текущее состояние будет предварительно сохранено.'
      : `Восстановить главу ${chapterIndex + 1}? Текущее состояние будет предварительно сохранено.`;
    if (!window.confirm(message)) return;
    setBusy(`${id}:${chapterIndex ?? 'all'}`);
    setStatus(null);
    try {
      await restoreBookVersion(id, chapterIndex);
      setStatus(chapterIndex === undefined ? 'Книга восстановлена' : 'Глава восстановлена');
    } catch (error: any) {
      setStatus(error.message || 'Не удалось восстановить версию');
    } finally {
      setBusy(null);
    }
  };

  const payloadChapters = payload
    ? parseChaptersFromHtml(payload.book.canvasContent || '')
    : [];

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <button className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-label="Закрыть историю" />
      <aside className="relative w-full max-w-lg h-full bg-zinc-950 border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <div className="px-5 py-4 border-b border-zinc-900 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-zinc-100 flex items-center gap-2">
              <History className="w-5 h-5 text-emerald-400" /> История версий
            </h2>
            <p className="text-xs text-zinc-600 mt-1">Автоснимки создаются при входе, выходе и каждые 10 минут. Хранятся последние 30.</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-900">
          <button
            onClick={handleCreate}
            disabled={busy !== null}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
          >
            {busy === 'create' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Сохранить версию сейчас
          </button>
          {status && <p className="text-xs text-zinc-400 mt-2 text-center">{status}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {versions.length === 0 ? (
            <div className="py-16 text-center text-zinc-600">
              <Clock3 className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Версий пока нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {versions.map(version => {
                const expanded = expandedId === version.id;
                return (
                  <div key={version.id} className="rounded-xl border border-zinc-900 bg-zinc-900/20 overflow-hidden">
                    <button
                      onClick={() => void handleExpand(version.id)}
                      className="w-full px-3.5 py-3 flex items-center gap-3 text-left hover:bg-zinc-900/40 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-200">{version.label}</span>
                          <span className={cn(
                            'text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded',
                            version.automatic ? 'bg-zinc-800 text-zinc-500' : 'bg-emerald-500/10 text-emerald-400',
                          )}>
                            {version.automatic ? 'авто' : 'вручную'}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-600 mt-1">
                          {new Date(version.createdAt).toLocaleString('ru-RU')} · {version.chapterCount} гл. · {version.charCount.toLocaleString('ru-RU')} симв.
                        </div>
                      </div>
                      {busy === version.id ? <Loader2 className="w-4 h-4 animate-spin text-zinc-500" /> : <ChevronDown className={cn('w-4 h-4 text-zinc-600 transition-transform', expanded && 'rotate-180')} />}
                    </button>

                    {expanded && payload && (
                      <div className="border-t border-zinc-900 p-3 space-y-3">
                        <button
                          onClick={() => void handleRestore(version.id)}
                          disabled={busy !== null}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold disabled:opacity-50"
                        >
                          {busy === `${version.id}:all` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                          Восстановить всю книгу
                        </button>
                        {payloadChapters.length > 0 && (
                          <div>
                            <div className="text-[10px] uppercase tracking-wider font-bold text-zinc-600 mb-1.5">Отдельная глава</div>
                            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
                              {payloadChapters.map((chapter, index) => (
                                <div key={`${version.id}-${index}`} className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-zinc-950 border border-zinc-900">
                                  <span className="flex-1 text-xs text-zinc-400 truncate">{index + 1}. {chapter.title}</span>
                                  <button
                                    onClick={() => void handleRestore(version.id, index)}
                                    disabled={busy !== null}
                                    className="text-[10px] font-semibold text-zinc-500 hover:text-emerald-400 disabled:opacity-50"
                                  >
                                    Восстановить
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};
