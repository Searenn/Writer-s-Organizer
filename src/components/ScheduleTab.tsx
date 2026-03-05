import { addDays } from 'date-fns';
import { CheckCircle2, Clock, Plus, Trash2, Wand2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';

export const ScheduleTab: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, updateChapter } = useAppStore();
  const chapters = state.chapters.filter((c) => c.bookId === bookId).sort((a, b) => a.order - b.order);

  const [showAutoForm, setShowAutoForm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Auto-schedule state
  const [autoStart, setAutoStart] = useState('');
  const [timeSlots, setTimeSlots] = useState<string[]>(['10:00', '14:00', '20:00']);
  const [useFirstOverride, setUseFirstOverride] = useState(false);
  const [firstChapterTime, setFirstChapterTime] = useState('20:00');

  const addTimeSlot = () => setTimeSlots(s => [...s, '12:00']);
  const removeTimeSlot = (idx: number) => setTimeSlots(s => s.filter((_, i) => i !== idx));
  const updateTimeSlot = (idx: number, val: string) =>
    setTimeSlots(s => s.map((t, i) => (i === idx ? val : t)));

  const handleAutoSchedule = () => {
    if (!autoStart || timeSlots.length === 0) return;
    const unpublished = chapters.filter(c => !c.isPublished);
    if (unpublished.length === 0) return;

    // Parse start date
    const [yyyy, mm, dd] = autoStart.split('-').map(Number);

    const makeDate = (dayOffset: number, time: string): Date => {
      const [h, m] = time.split(':').map(Number);
      const d = addDays(new Date(yyyy, mm - 1, dd), dayOffset);
      d.setHours(h, m, 0, 0);
      return d;
    };

    const dates: Date[] = [];

    // If first chapter override: assign first chapter separately
    let startIdx = 0;
    if (useFirstOverride && unpublished.length > 0) {
      dates.push(makeDate(0, firstChapterTime));
      startIdx = 1;
    }

    // Assign remaining chapters: cycle through time slots, advance day when slots exhausted
    let dayOffset = useFirstOverride ? 1 : 0;
    let slotIdx = 0;

    for (let i = startIdx; i < unpublished.length; i++) {
      dates.push(makeDate(dayOffset, timeSlots[slotIdx]));
      slotIdx++;
      if (slotIdx >= timeSlots.length) {
        slotIdx = 0;
        dayOffset++;
      }
    }

    // Apply dates
    unpublished.forEach((chapter, i) => {
      updateChapter(chapter.id, { scheduledDate: dates[i].toISOString() });
    });

    setShowAutoForm(false);
  };

  const handleClearAll = () => {
    chapters.forEach(c => {
      updateChapter(c.id, { scheduledDate: undefined });
    });
    setShowClearConfirm(false);
  };

  const scheduledCount = chapters.filter(c => c.scheduledDate).length;

  return (
    <div className="p-8 max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-emerald-50">Расписание выкладки</h2>
          <p className="text-zinc-400 mt-1">Назначьте даты публикации для каждой главы.</p>
        </div>
        <div className="flex items-center gap-3">
          {scheduledCount > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-2 text-sm text-zinc-500 hover:text-red-400 transition-colors px-3 py-2 rounded-lg hover:bg-red-500/10 border border-transparent hover:border-red-500/20"
            >
              <Trash2 className="w-4 h-4" />
              Очистить расписание
            </button>
          )}
          <button
            onClick={() => setShowAutoForm(v => !v)}
            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-emerald-400 px-4 py-2 rounded-xl text-sm font-medium transition-colors border border-zinc-700"
          >
            <Wand2 className="w-4 h-4" />
            Авто-расписание
          </button>
        </div>
      </div>

      {/* Clear confirm */}
      {showClearConfirm && (
        <div className="mb-5 bg-red-950/30 border border-red-500/30 rounded-2xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-red-300">Очистить все даты расписания?</p>
            <p className="text-xs text-zinc-500 mt-0.5">Это уберёт даты у всех {scheduledCount} глав. Статус публикации не изменится.</p>
          </div>
          <div className="flex gap-3 shrink-0 ml-6">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleClearAll}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Да, очистить
            </button>
          </div>
        </div>
      )}

      {/* Auto schedule form */}
      {showAutoForm && (
        <div className="mb-6 bg-zinc-900 border border-emerald-500/20 rounded-2xl p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-3.5 h-3.5" />
              Авто-расписание
            </h3>
            <button onClick={() => setShowAutoForm(false)} className="text-zinc-600 hover:text-zinc-300">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Start date */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-zinc-400">Дата начала выкладки</label>
            <input
              type="date"
              value={autoStart}
              onChange={e => setAutoStart(e.target.value)}
              className="w-44 px-3 py-2 text-sm border border-zinc-700 rounded-lg bg-zinc-800 text-zinc-200 outline-none focus:border-emerald-500"
            />
          </div>

          {/* First chapter override */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useFirstOverride}
                onChange={e => setUseFirstOverride(e.target.checked)}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500 bg-zinc-900"
              />
              Первая глава в особое время (один раз)
            </label>
            {useFirstOverride && (
              <div className="ml-6 flex items-center gap-2">
                <span className="text-xs text-zinc-500">Глава 1 выходит в:</span>
                <input
                  type="time"
                  value={firstChapterTime}
                  onChange={e => setFirstChapterTime(e.target.value)}
                  className="px-3 py-1.5 text-sm border border-zinc-700 rounded-lg bg-zinc-800 text-zinc-200 outline-none focus:border-emerald-500"
                />
                <span className="text-xs text-zinc-500">в день начала</span>
              </div>
            )}
          </div>

          {/* Time slots */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">
                Время выкладки каждый день ({timeSlots.length} слот{timeSlots.length === 1 ? '' : timeSlots.length < 5 ? 'а' : 'ов'})
              </label>
              <button
                onClick={addTimeSlot}
                className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Добавить
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {timeSlots.map((slot, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1"
                >
                  <span className="text-xs text-zinc-500 w-4 text-right">{idx + 1}.</span>
                  <input
                    type="time"
                    value={slot}
                    onChange={e => updateTimeSlot(idx, e.target.value)}
                    className="text-sm bg-transparent text-zinc-200 outline-none w-20"
                  />
                  {timeSlots.length > 1 && (
                    <button
                      onClick={() => removeTimeSlot(idx)}
                      className="text-zinc-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            {timeSlots.length > 0 && (
              <p className="text-xs text-zinc-600">
                {useFirstOverride
                  ? `Глава 1 → ${firstChapterTime}. Далее: ${timeSlots.join(', ')} — повторяется каждые сутки.`
                  : `Каждый день: ${timeSlots.join(', ')}`
                }
              </p>
            )}
          </div>

          {/* Preview */}
          {autoStart && timeSlots.length > 0 && (
            <div className="bg-zinc-800/50 rounded-xl p-3 text-xs text-zinc-400 space-y-0.5 max-h-28 overflow-y-auto">
              {chapters.filter(c => !c.isPublished).slice(0, 8).map((c, i) => {
                const [yyyy, mm, dd] = autoStart.split('-').map(Number);
                const makeDate = (dayOffset: number, time: string) => {
                  const [h, m2] = time.split(':').map(Number);
                  const d = new Date(yyyy, mm - 1, dd + dayOffset);
                  d.setHours(h, m2, 0, 0);
                  return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                };

                let label = '';
                if (useFirstOverride && i === 0) {
                  label = makeDate(0, firstChapterTime);
                } else {
                  const offset = useFirstOverride ? i - 1 : i;
                  const day = Math.floor(offset / timeSlots.length);
                  const slot = offset % timeSlots.length;
                  label = makeDate(useFirstOverride ? day + 1 : day, timeSlots[slot]);
                }

                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-zinc-600 w-4">{i + 1}.</span>
                    <span className="text-emerald-400">{label}</span>
                    <span className="truncate">{c.title}</span>
                  </div>
                );
              })}
              {chapters.filter(c => !c.isPublished).length > 8 && (
                <div className="text-zinc-600 pt-1">…и ещё {chapters.filter(c => !c.isPublished).length - 8} глав</div>
              )}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1 border-t border-zinc-800">
            <button
              onClick={handleAutoSchedule}
              disabled={!autoStart || timeSlots.length === 0}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              Расставить даты ({chapters.filter(c => !c.isPublished).length} глав)
            </button>
            <button
              onClick={() => setShowAutoForm(false)}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Chapter list */}
      <div className="bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden flex-1 flex flex-col">
        <div className="grid grid-cols-[1fr_200px_100px_100px] gap-4 p-4 border-b border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-300">
          <div>Глава</div>
          <div>Дата и время выкладки</div>
          <div className="text-center">Промо</div>
          <div className="text-center">Статус</div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="grid grid-cols-[1fr_200px_100px_100px] gap-4 p-3 items-center hover:bg-zinc-950 rounded-xl transition-colors border border-transparent hover:border-zinc-800"
            >
              <div className="font-medium text-zinc-100 truncate pr-4" title={chapter.title}>
                {chapter.title}
              </div>

              <div>
                <input
                  type="datetime-local"
                  value={chapter.scheduledDate ? new Date(chapter.scheduledDate).toISOString().slice(0, 16) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateChapter(chapter.id, { scheduledDate: val ? new Date(val).toISOString() : undefined });
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-zinc-200 bg-zinc-900"
                />
              </div>

              <div className="flex justify-center">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={chapter.hasPromo}
                    onChange={(e) => updateChapter(chapter.id, { hasPromo: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500"
                  />
                </label>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => updateChapter(chapter.id, { isPublished: !chapter.isPublished })}
                  className={cn(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
                    chapter.isPublished
                      ? 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'
                      : 'bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                  )}
                  title={chapter.isPublished ? 'Опубликовано' : 'Ожидает публикации'}
                >
                  {chapter.isPublished ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))}
          {chapters.length === 0 && (
            <div className="text-center text-zinc-400 py-12">
              Сначала добавьте главы в разделе «Главы».
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
