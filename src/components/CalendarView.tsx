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
              
              return (
                <div
                  key={chapter.id}
                  className={cn(
                    'text-xs p-1.5 rounded-md border flex flex-col gap-1 cursor-pointer group transition-all',
                    chapter.isPublished
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : 'bg-zinc-900 border-zinc-800 text-zinc-300 shadow-sm hover:border-emerald-300'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    // Toggle published status on click
                    updateChapter(chapter.id, { isPublished: !chapter.isPublished });
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: book.color }}
                      />
                      <span className="font-medium truncate">{book.title}</span>
                    </div>
                    {chapter.isPublished ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    ) : (
                      <Clock className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0 group-hover:text-emerald-500" />
                    )}
                  </div>
                  <div className="flex items-center justify-between text-[10px] opacity-80">
                    <span className="truncate">{chapter.title}</span>
                    {chapter.hasPromo && (
                      <span className="bg-amber-100 text-amber-800 px-1 rounded text-[9px] font-bold">
                        ПРОМО
                      </span>
                    )}
                  </div>
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
