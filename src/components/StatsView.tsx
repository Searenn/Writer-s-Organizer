import { format, subDays, eachDayOfInterval, startOfWeek, endOfWeek, subMonths, eachMonthOfInterval, startOfMonth, endOfMonth, isSameDay, isSameMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Award, Target, TrendingUp } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from 'recharts';
import { useAppStore } from '../store';
import { cn } from '../utils';

export const StatsView: React.FC = () => {
  const { state, updateDailyGoal } = useAppStore();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState(state.dailyGoal.toString());

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const todayLog = state.writingLogs?.find(l => l.date === todayStr);
  const todayCount = todayLog ? todayLog.count : 0;
  const progress = Math.min(100, Math.round((todayCount / state.dailyGoal) * 100));

  const handleSaveGoal = () => {
    const goal = parseInt(goalInput, 10);
    if (!isNaN(goal) && goal > 0) {
      updateDailyGoal(goal);
    }
    setIsEditingGoal(false);
  };

  const chartData = useMemo(() => {
    const logs = state.writingLogs || [];
    
    if (timeRange === 'week') {
      const start = subDays(today, 6);
      const days = eachDayOfInterval({ start, end: today });
      return days.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const log = logs.find(l => l.date === dateStr);
        return {
          name: format(day, 'EEEEEE', { locale: ru }),
          fullDate: format(day, 'd MMMM', { locale: ru }),
          count: log ? log.count : 0
        };
      });
    }
    
    if (timeRange === 'month') {
      const start = subDays(today, 29);
      const days = eachDayOfInterval({ start, end: today });
      return days.map(day => {
        const dateStr = day.toISOString().split('T')[0];
        const log = logs.find(l => l.date === dateStr);
        return {
          name: format(day, 'dd.MM'),
          fullDate: format(day, 'd MMMM', { locale: ru }),
          count: log ? log.count : 0
        };
      });
    }

    // year
    const start = subMonths(today, 11);
    const months = eachMonthOfInterval({ start, end: today });
    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      const monthLogs = logs.filter(l => {
        const d = new Date(l.date);
        return d >= monthStart && d <= monthEnd;
      });
      const total = monthLogs.reduce((sum, l) => sum + l.count, 0);
      return {
        name: format(month, 'LLL', { locale: ru }),
        fullDate: format(month, 'LLLL yyyy', { locale: ru }),
        count: total
      };
    });
  }, [state.writingLogs, timeRange, today]);

  const totalAllTime = (state.writingLogs || []).reduce((sum, l) => sum + l.count, 0);

  return (
    <div className="p-8 max-w-6xl mx-auto h-full flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-emerald-50 tracking-tight flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-emerald-500" />
            Статистика
          </h1>
          <p className="text-zinc-400 mt-1">Отслеживайте свой прогресс и достигайте целей.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Daily Goal Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-zinc-300 font-medium">
              <Target className="w-5 h-5 text-emerald-500" />
              Цель на сегодня
            </div>
            {isEditingGoal ? (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={goalInput}
                  onChange={(e) => setGoalInput(e.target.value)}
                  className="w-24 px-2 py-1 text-sm bg-zinc-950 border border-zinc-700 rounded text-zinc-100 outline-none focus:border-emerald-500"
                />
                <button onClick={handleSaveGoal} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">ОК</button>
              </div>
            ) : (
              <button onClick={() => setIsEditingGoal(true)} className="text-xs text-zinc-500 hover:text-zinc-300">
                Изменить
              </button>
            )}
          </div>
          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl font-bold text-emerald-50">{todayCount.toLocaleString('ru-RU')}</span>
            <span className="text-zinc-500 mb-1">/ {state.dailyGoal.toLocaleString('ru-RU')} симв.</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2.5 mt-auto">
            <div
              className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Total Written Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex items-center gap-2 text-zinc-300 font-medium mb-4">
            <Award className="w-5 h-5 text-amber-500" />
            Всего написано
          </div>
          <div className="flex items-end gap-2 mt-auto">
            <span className="text-4xl font-bold text-emerald-50">{totalAllTime.toLocaleString('ru-RU')}</span>
            <span className="text-zinc-500 mb-1">символов</span>
          </div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-sm flex-1 min-h-[400px] flex flex-col">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-semibold text-zinc-100">График активности</h2>
          <div className="flex bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setTimeRange('week')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                timeRange === 'week' ? 'bg-zinc-800 text-emerald-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Неделя
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                timeRange === 'month' ? 'bg-zinc-800 text-emerald-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Месяц
            </button>
            <button
              onClick={() => setTimeRange('year')}
              className={cn(
                'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
                timeRange === 'year' ? 'bg-zinc-800 text-emerald-50 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              Год
            </button>
          </div>
        </div>

        <div className="flex-1 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a1a1aa', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#a1a1aa', fontSize: 12 }}
                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
              />
              <Tooltip
                cursor={{ fill: '#27272a' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-zinc-800 border border-zinc-700 p-3 rounded-lg shadow-xl">
                        <p className="text-zinc-300 text-sm mb-1">{payload[0].payload.fullDate}</p>
                        <p className="text-emerald-400 font-bold">
                          {payload[0].value?.toLocaleString('ru-RU')} симв.
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.count > 0 ? '#10b981' : '#3f3f46'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
