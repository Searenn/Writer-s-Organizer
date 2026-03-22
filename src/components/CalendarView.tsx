import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CheckCircle2, Clock } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';

export const CalendarView: React.FC<{ onSelectBook: (id: string) => void }> = ({ onSelectBook }) => {
  const { state, updateChapter } = useAppStore();
  const [currentDate, setCurrentDate] = useState(new Date());

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const dateFormat = 'd';
  const rows = [];
  let days = [];
  let day = startDate;
  let formattedDate = '';

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      formattedDate = format(day, dateFormat);
      const cloneDay = day;

      // Find chapters scheduled for this day
      const dayChapters = state.chapters.filter((c) => {
        if (!c.scheduledDate) return false;
        return isSameDay(new Date(c.scheduledDate), cloneDay);
      });

      days.push(
        <div
          key={day.toString()}
          className={cn(
            'min-h-[120px] border-r border-b border-zinc-800 p-2 flex flex-col transition-colors',
            !isSameMonth(day, monthStart)
              ? 'bg-zinc-950/50 text-zinc-500'
              : isSameDay(day, new Date())
                ? 'bg-emerald-50/30 text-emerald-900 font-semibold'
                : 'bg-zinc-900 text-zinc-200 hover:bg-zinc-950'
          )}
        >
          <div className="flex justify-end mb-2">
            <span className={cn('text-sm', isSameDay(day, new Date()) ? 'bg-emerald-600 text-white w-6 h-6 rounded-full flex items-center justify-center' : '')}>
              {formattedDate}
            </span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin">
            {dayChapters.map((chapter) => {
              const book = state.books.find((b) => b.id === chapter.bookId);
              if (!book) return null;

              const account = state.accounts.find((a) => a.id === book.accountId);
              const color = account?.color || book.color || '#10b981';

              return (
                <div
                  key={chapter.id}
                  className={cn(
                    'text-[10px] p-1 px-1.5 rounded flex items-center justify-between gap-1.5 cursor-pointer group transition-all min-w-0 border',
                    chapter.isPublished
                      ? 'bg-zinc-800/30 border-zinc-800/50 text-zinc-500 opacity-60'
                      : 'shadow-sm opacity-90 hover:opacity-100'
                  )}
                  style={!chapter.isPublished ? { backgroundColor: `${color}15`, color: color, borderColor: `${color}40` } : undefined}
                  title={`${book.title} — ${chapter.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle published status on click
                    updateChapter(chapter.id, { isPublished: !chapter.isPublished });
                  }}
                >
                  <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
                    {chapter.isPublished ? (
                      <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-emerald-500" />
                    ) : (
                      <Clock className="w-3 h-3 flex-shrink-0 opacity-70 group-hover:opacity-100" />
                    )}
                    <span className="font-semibold truncate flex-shrink-0 max-w-[45%]">{book.title}</span>
                    <span className="truncate opacity-80 min-w-0">{chapter.title}</span>
                  </div>
                  {chapter.hasPromo && (
                    <span className="bg-amber-100/90 text-amber-800 px-1 py-[1px] rounded-[3px] text-[8px] font-bold flex-shrink-0 leading-none">
                      ПРОМО
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
      day = addDays(day, 1);
    }
    rows.push(
      <div className="grid grid-cols-7" key={day.toString()}>
        {days}
      </div>
    );
    days = [];
  }

  return (
    <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 tracking-tight">Календарь выкладок</h1>
          <p className="text-zinc-400 mt-1">Отслеживайте расписание публикаций. Кликните на главу, чтобы отметить её как выложенную.</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={prevMonth}
            className="p-2 hover:bg-zinc-800/50 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6 text-zinc-300" />
          </button>
          <h2 className="text-xl font-semibold text-zinc-100 w-48 text-center capitalize">
            {format(currentDate, 'LLLL yyyy', { locale: ru })}
          </h2>
          <button
            onClick={nextMonth}
            className="p-2 hover:bg-zinc-800/50 rounded-full transition-colors"
          >
            <ChevronRight className="w-6 h-6 text-zinc-300" />
          </button>
        </div>
      </div>

      <div className="flex-1 bg-zinc-900 rounded-2xl shadow-sm border border-zinc-800 overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b border-zinc-800 bg-zinc-950">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((dayName) => (
            <div
              key={dayName}
              className="py-3 text-center text-sm font-semibold text-zinc-400 uppercase tracking-wider border-r border-zinc-800 last:border-r-0"
            >
              {dayName}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          {rows}
        </div>
      </div>
    </div>
  );
};
