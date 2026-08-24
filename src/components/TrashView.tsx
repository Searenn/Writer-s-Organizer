import { Download, FileArchive, FileText, Notebook, RotateCcw, Trash2, Upload } from 'lucide-react';
import React, { useRef, useState } from 'react';
import { useAppStore } from '../store';
import { cn, downloadFile } from '../utils';

const TYPE_LABELS = {
  book: 'Книга',
  chapter: 'Глава',
  note: 'Заметка',
} as const;

export const TrashView: React.FC = () => {
  const {
    state,
    restoreTrashItem,
    deleteTrashItemPermanently,
    emptyTrash,
    exportBackup,
    importBackup,
  } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const items = [...(state.trashItems || [])].sort((a, b) => b.deletedAt - a.deletedAt);

  const run = async (id: string, action: () => Promise<void>, success: string) => {
    setBusyId(id);
    setStatus(null);
    try {
      await action();
      setStatus(success);
    } catch (error: any) {
      setStatus(error.message || 'Не удалось выполнить действие');
    } finally {
      setBusyId(null);
    }
  };

  const handleExport = async () => {
    await run('backup', async () => {
      const contents = await exportBackup();
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(contents, `pisaka-backup-${date}.json`, 'application/json');
    }, 'Резервная копия сохранена');
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!window.confirm('Импорт заменит текущие данные содержимым резервной копии. Продолжить?')) return;
    await run('backup', async () => importBackup(await file.text()), 'Резервная копия восстановлена');
  };

  return (
    <div className="max-w-5xl mx-auto p-5 sm:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-zinc-400" />
            Корзина и резервные копии
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Удалённое хранится 30 дней. Полная копия включает книги, версии и корзину.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            disabled={busyId !== null}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
          >
            <Download className="w-4 h-4" /> Скачать копию
          </button>
          <button
            onClick={() => inputRef.current?.click()}
            disabled={busyId !== null}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-semibold transition-colors"
          >
            <Upload className="w-4 h-4" /> Восстановить из файла
          </button>
          <input ref={inputRef} type="file" accept="application/json,.json" onChange={handleImport} className="hidden" />
        </div>
      </div>

      {status && (
        <div className={cn(
          'px-4 py-3 rounded-xl border text-sm',
          status.toLowerCase().includes('не удалось') || status.toLowerCase().includes('ошиб')
            ? 'border-red-500/20 bg-red-500/5 text-red-300'
            : 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
        )}>
          {status}
        </div>
      )}

      <section className="rounded-2xl border border-zinc-900 bg-zinc-900/20 overflow-hidden">
        <div className="flex items-center justify-between px-4 sm:px-5 py-4 border-b border-zinc-900">
          <div>
            <h2 className="font-semibold text-zinc-200">Удалённые объекты</h2>
            <p className="text-xs text-zinc-600 mt-0.5">{items.length} в корзине</p>
          </div>
          {items.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Очистить корзину без возможности восстановления?')) {
                  void run('empty', emptyTrash, 'Корзина очищена');
                }
              }}
              disabled={busyId !== null}
              className="text-xs font-medium text-red-400/80 hover:text-red-300 disabled:opacity-50"
            >
              Очистить корзину
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="py-16 text-center">
            <FileArchive className="w-10 h-10 mx-auto text-zinc-800 mb-3" />
            <p className="text-sm text-zinc-500">Корзина пуста</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-900">
            {items.map(item => {
              const daysLeft = Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 86_400_000));
              const Icon = item.type === 'book' ? FileArchive : item.type === 'chapter' ? FileText : Notebook;
              return (
                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 sm:px-5 py-4">
                  <div className="w-9 h-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-zinc-200 truncate">{item.title}</div>
                    <div className="text-[11px] text-zinc-600 mt-0.5">
                      {TYPE_LABELS[item.type]} · удалено {new Date(item.deletedAt).toLocaleString('ru-RU')} · осталось {daysLeft} дн.
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => void run(item.id, () => restoreTrashItem(item.id), 'Объект восстановлен')}
                      disabled={busyId !== null}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-400 text-xs font-semibold disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Восстановить
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Удалить «${item.title}» навсегда?`)) {
                          void run(item.id, () => deleteTrashItemPermanently(item.id), 'Объект удалён навсегда');
                        }
                      }}
                      disabled={busyId !== null}
                      className="p-2 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/5 disabled:opacity-50"
                      title="Удалить навсегда"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
