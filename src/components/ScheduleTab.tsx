import { addDays } from 'date-fns';
import { CheckCircle2, Clock, Plus, Trash2, Wand2, X, Bell, Tag } from 'lucide-react';
import React, { useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';

export const ScheduleTab: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, updateChapter, syncCanvasChapters, updateBook } = useAppStore();
  const book = state.books.find(b => b.id === bookId);

  useEffect(() => {
    if (book && typeof book.canvasContent === 'string') {
      const temp = document.createElement('div');
      temp.innerHTML = book.canvasContent;
      const headings = Array.from(temp.querySelectorAll('h2')).map(h => h.textContent || 'Без названия');
      syncCanvasChapters(bookId, headings);
    }
  }, [book?.canvasContent, bookId, syncCanvasChapters]);

  const chapters = state.chapters.filter((c) => c.bookId === bookId).sort((a, b) => a.order - b.order);

  const [showAutoForm, setShowAutoForm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Auto-schedule state
  const [autoStart, setAutoStart] = useState('');
  const [timeSlots, setTimeSlots] = useState<string[]>(['10:00', '14:00', '20:00']);
  const [useFirstOverride, setUseFirstOverride] = useState(false);
  const [firstDayTimeSlots, setFirstDayTimeSlots] = useState<string[]>(['10:00']);
  const [publishDays, setPublishDays] = useState(1);
  const [restDays, setRestDays] = useState(0);

  const addTimeSlot = () => setTimeSlots(s => [...s, '12:00']);
  const removeTimeSlot = (idx: number) => setTimeSlots(s => s.filter((_, i) => i !== idx));
  const updateTimeSlot = (idx: number, val: string) =>
    setTimeSlots(s => s.map((t, i) => (i === idx ? val : t)));

  const addFirstDayTimeSlot = () => setFirstDayTimeSlots(s => [...s, '12:00']);
  const removeFirstDayTimeSlot = (idx: number) => setFirstDayTimeSlots(s => s.filter((_, i) => i !== idx));
  const updateFirstDayTimeSlot = (idx: number, val: string) =>
    setFirstDayTimeSlots(s => s.map((t, i) => (i === idx ? val : t)));

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
    const cycleLen = publishDays + restDays;

    // Helper: advance dayOffset to next publish day
    const nextPublishDay = (d: number): number => {
      while (restDays > 0 && (d % cycleLen) >= publishDays) d++;
      return d;
    };

    // Assign chapters to first day separately if override is active
    let startIdx = 0;
    if (useFirstOverride && unpublished.length > 0 && firstDayTimeSlots.length > 0) {
      const limit = Math.min(unpublished.length, firstDayTimeSlots.length);
      for (let i = 0; i < limit; i++) {
        dates.push(makeDate(0, firstDayTimeSlots[i]));
        startIdx++;
      }
    }

    // Assign remaining chapters: cycle through time slots, advance day when slots exhausted
    // Skip days that fall in the "rest" part of the cycle
    let dayOffset = useFirstOverride ? 1 : 0;
    dayOffset = nextPublishDay(dayOffset);
    let slotIdx = 0;

    for (let i = startIdx; i < unpublished.length; i++) {
      dates.push(makeDate(dayOffset, timeSlots[slotIdx]));
      slotIdx++;
      if (slotIdx >= timeSlots.length) {
        slotIdx = 0;
        dayOffset++;
        dayOffset = nextPublishDay(dayOffset);
      }
    }

    // Apply dates
    unpublished.forEach((chapter, i) => {
      // Need to format as local time for datetime-local to read it properly
      // If we use toISOString, standard JS converts to UTC.
      // So we use a custom local ISO format:
      const d = dates[i];
      const offsetMs = d.getTimezoneOffset() * 60 * 1000;
      const localISOTime = new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);

      // Store the local time string so that `new Date(string)` gets parsed locally
      // Or simply store the exact string the datetime-local input expects.
      updateChapter(chapter.id, { scheduledDate: localISOTime });
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
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto h-full flex flex-col">
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

          {/* First day override */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={useFirstOverride}
                onChange={e => setUseFirstOverride(e.target.checked)}
                className="rounded border-zinc-700 text-emerald-600 focus:ring-emerald-500 bg-zinc-900"
              />
              Особое расписание для первого дня
            </label>
            {useFirstOverride && (
              <div className="ml-6 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">
                    Время выкладки в первый день ({firstDayTimeSlots.length} слот{firstDayTimeSlots.length === 1 ? '' : firstDayTimeSlots.length < 5 ? 'а' : 'ов'})
                  </label>
                  <button
                    onClick={addFirstDayTimeSlot}
                    className="flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Добавить
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {firstDayTimeSlots.map((slot, idx) => (
                    <div
                      key={`first-day-${idx}`}
                      className="flex items-center gap-2 bg-zinc-800 border border-emerald-500/20 rounded-lg px-2 py-1"
                    >
                      <span className="text-xs text-zinc-500 w-4 text-right">{idx + 1}.</span>
                      <input
                        type="time"
                        value={slot}
                        onChange={e => updateFirstDayTimeSlot(idx, e.target.value)}
                        className="text-sm bg-transparent text-emerald-400 outline-none w-20"
                      />
                      {firstDayTimeSlots.length > 1 && (
                        <button
                          onClick={() => removeFirstDayTimeSlot(idx)}
                          className="text-zinc-600 hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Schedule pattern */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-zinc-400">Ритм публикации</label>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={publishDays}
                  onChange={e => setPublishDays(Math.max(1, +e.target.value || 1))}
                  className="w-14 px-2 py-1.5 text-sm border border-zinc-700 rounded-lg bg-zinc-800 text-zinc-200 outline-none focus:border-emerald-500 text-center"
                />
                <span className="text-xs text-zinc-400">дн. публикуем</span>
              </div>
              <span className="text-zinc-600 text-sm">/</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={restDays}
                  onChange={e => setRestDays(Math.max(0, +e.target.value || 0))}
                  className="w-14 px-2 py-1.5 text-sm border border-zinc-700 rounded-lg bg-zinc-800 text-zinc-200 outline-none focus:border-emerald-500 text-center"
                />
                <span className="text-xs text-zinc-400">дн. отдыхаем</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { label: 'Ежедневно', p: 1, r: 0 },
                { label: 'Через день', p: 1, r: 1 },
                { label: '2 / 2', p: 2, r: 2 },
                { label: '3 / 1', p: 3, r: 1 },
                { label: '6 / 1', p: 6, r: 1 },
              ].map(preset => (
                <button
                  key={preset.label}
                  onClick={() => { setPublishDays(preset.p); setRestDays(preset.r); }}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border',
                    publishDays === preset.p && restDays === preset.r
                      ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300 hover:border-zinc-600'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time slots */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">
                Время выкладки в рабочие дни ({timeSlots.length} слот{timeSlots.length === 1 ? '' : timeSlots.length < 5 ? 'а' : 'ов'})
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
                  ? `В 1-й день выйдут ${firstDayTimeSlots.length} глав. Далее: ${timeSlots.join(', ')}${restDays > 0 ? ` — ${publishDays} дн. публикуем, ${restDays} дн. отдыхаем` : ' — ежедневно'}.`
                  : restDays > 0
                    ? `${publishDays} дн. публикуем (${timeSlots.join(', ')}), ${restDays} дн. отдыхаем`
                    : `Каждый день: ${timeSlots.join(', ')}`
                }
              </p>
            )}
          </div>

          {/* Preview */}
          {autoStart && timeSlots.length > 0 && (() => {
            const [yyyy2, mm2, dd2] = autoStart.split('-').map(Number);
            const previewMakeDate = (dayOff: number, time: string) => {
              const [h, m2] = time.split(':').map(Number);
              const d = new Date(yyyy2, mm2 - 1, dd2 + dayOff);
              d.setHours(h, m2, 0, 0);
              return d.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
            };
            const cycleLen = publishDays + restDays;
            const isPublishDay = (d: number) => restDays === 0 || (d % cycleLen) < publishDays;
            const nextPubDay = (d: number) => { while (!isPublishDay(d)) d++; return d; };

            const unpub = chapters.filter(c => !c.isPublished);
            const labels: string[] = [];
            let si = 0;
            if (useFirstOverride && firstDayTimeSlots.length > 0) {
              const lim = Math.min(unpub.length, firstDayTimeSlots.length);
              for (let j = 0; j < lim; j++) { labels.push(previewMakeDate(0, firstDayTimeSlots[j])); si++; }
            }
            let dayOff = useFirstOverride ? 1 : 0;
            dayOff = nextPubDay(dayOff);
            let slotI = 0;
            for (let j = si; j < unpub.length && labels.length < 8; j++) {
              labels.push(previewMakeDate(dayOff, timeSlots[slotI]));
              slotI++;
              if (slotI >= timeSlots.length) { slotI = 0; dayOff++; dayOff = nextPubDay(dayOff); }
            }

            return (
              <div className="bg-zinc-800/50 rounded-xl p-3 text-xs text-zinc-400 space-y-0.5 max-h-28 overflow-y-auto">
                {unpub.slice(0, 8).map((c, i) => (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-zinc-600 w-4">{i + 1}.</span>
                    <span className="text-emerald-400">{labels[i]}</span>
                    <span className="truncate">{c.title}</span>
                  </div>
                ))}
                {unpub.length > 8 && (
                  <div className="text-zinc-600 pt-1">…и ещё {unpub.length - 8} глав</div>
                )}
              </div>
            );
          })()}

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
        <div className="grid grid-cols-[1fr_200px_90px_90px_90px] gap-4 p-4 border-b border-zinc-800 bg-zinc-950 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
          <div>Глава</div>
          <div>Дата и время выкладки</div>
          <div className="text-center">Подписка</div>
          <div className="text-center">Промо</div>
          <div className="text-center">Статус</div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chapters.map((chapter) => (
            <div
              key={chapter.id}
              className="grid grid-cols-[1fr_200px_90px_90px_90px] gap-4 p-3 items-center hover:bg-zinc-950 rounded-xl transition-colors border border-transparent hover:border-zinc-800"
            >
              <div className="font-medium text-zinc-100 truncate pr-4" title={chapter.title}>
                {chapter.title}
              </div>

              <div>
                <input
                  type="datetime-local"
                  // Value should be formatted cleanly to YYYY-MM-DDTHH:mm
                  value={chapter.scheduledDate ? chapter.scheduledDate.slice(0, 16) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Store the raw local YYYY-MM-DDTHH:mm string 
                    updateChapter(chapter.id, { scheduledDate: val || undefined });
                  }}
                  className="w-full px-3 py-1.5 text-sm border border-zinc-700 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-zinc-200 bg-zinc-900"
                />
              </div>

              <div className="flex justify-center">
                <button
                  onClick={() => {
                    const isOpeningHere = book?.subOpensAtChapterId === chapter.id;
                    updateBook(bookId, {
                      subOpensAtChapterId: isOpeningHere ? undefined : chapter.id,
                      notifiedSubOpen: false
                    });
                  }}
                  className={cn(
                    'w-6 h-6 flex items-center justify-center rounded-full border transition-colors',
                    book?.subOpensAtChapterId === chapter.id
                      ? 'border-amber-500 bg-amber-500 text-amber-950'
                      : 'border-zinc-700 hover:border-amber-500/50 text-transparent hover:text-amber-500/50'
                  )}
                  title={book?.subOpensAtChapterId === chapter.id ? "Подписка открывается на этой главе" : "Отметить открытие подписки здесь"}
                >
                  <span className="text-xs font-bold leading-none">$</span>
                </button>
              </div>

              <div className="flex justify-center">
                {state.books.some(b => b.publishedPromos?.some(p => p.chapterId === chapter.id)) ? (
                  <span className="w-6 h-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center shadow-inner" title="В этой главе размещена реклама других книг">
                    <Tag className="w-3.5 h-3.5" />
                  </span>
                ) : (
                  <span className="w-6 h-6 rounded-full border border-zinc-800 flex items-center justify-center text-zinc-700 text-xs font-bold bg-zinc-900/50" title="Нет рекламы">
                    -
                  </span>
                )}
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
