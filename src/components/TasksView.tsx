import {
    Calendar, Check, ChevronLeft, ChevronRight, Clock, Edit2,
    ListChecks, Plus, RefreshCw, Repeat, Trash2, X
} from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { RecurrenceType, ScheduledTask } from '../types';
import { cn, getLocalISODate } from '../utils';

/* ── Helpers ──────────────────────────────────────────────────── */

const WEEKDAY_LABELS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const WEEKDAY_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
const MONTH_NAMES = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

function formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

function getWeekdayIndex(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00');
    return (d.getDay() + 6) % 7; // 0=пн, 6=вс
}

function addDays(dateStr: string, n: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
}

function getDayOfMonth(dateStr: string): number {
    return new Date(dateStr + 'T00:00:00').getDate();
}

/** Check if a task should appear on a given date */
function isTaskVisibleOnDate(task: ScheduledTask, dateStr: string): boolean {
    const taskStart = task.date;
    if (dateStr < taskStart) return false;
    if (task.recurrenceEndDate && dateStr > task.recurrenceEndDate) return false;

    if (task.recurrence === 'none') {
        return dateStr === taskStart;
    }

    if (task.recurrence === 'daily') {
        return true;
    }

    if (task.recurrence === 'every_n_days') {
        const interval = task.recurrenceInterval || 2;
        const startMs = new Date(taskStart + 'T00:00:00').getTime();
        const dateMs = new Date(dateStr + 'T00:00:00').getTime();
        const diff = Math.round((dateMs - startMs) / (1000 * 60 * 60 * 24));
        return diff % interval === 0;
    }

    if (task.recurrence === 'weekly') {
        const weekday = getWeekdayIndex(dateStr);
        return (task.recurrenceWeekdays || []).includes(weekday);
    }

    if (task.recurrence === 'monthly') {
        return getDayOfMonth(dateStr) === getDayOfMonth(taskStart);
    }

    return false;
}

function getRecurrenceLabel(task: ScheduledTask): string {
    if (task.recurrence === 'none') return '';
    if (task.recurrence === 'daily') return 'ежедневно';
    if (task.recurrence === 'every_n_days') return `каждые ${task.recurrenceInterval || 2} дн.`;
    if (task.recurrence === 'weekly') {
        const days = (task.recurrenceWeekdays || []).map(d => WEEKDAY_LABELS[d]).join(', ');
        return days || 'еженедельно';
    }
    if (task.recurrence === 'monthly') return 'ежемесячно';
    return '';
}

const TASK_COLORS = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

/* ── Component ───────────────────────────────────────────────── */

export const TasksView: React.FC = () => {
    const {
        state, addScheduledTask, updateScheduledTask,
        deleteScheduledTask, toggleScheduledTaskDate
    } = useAppStore();

    const today = getLocalISODate();

    // Day navigation
    const [selectedDate, setSelectedDate] = useState(today);
    const [weekOffset, setWeekOffset] = useState(0);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);

    // Form state
    const [formTitle, setFormTitle] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formColor, setFormColor] = useState(TASK_COLORS[0]);
    const [formDate, setFormDate] = useState(today);
    const [formTime, setFormTime] = useState('');
    const [formRecurrence, setFormRecurrence] = useState<RecurrenceType>('none');
    const [formInterval, setFormInterval] = useState(2);
    const [formWeekdays, setFormWeekdays] = useState<number[]>([]);
    const [formEndDate, setFormEndDate] = useState('');

    // Date strip
    const dateStrip = useMemo(() => {
        const dates: string[] = [];
        const base = addDays(today, weekOffset * 7 - 3);
        for (let i = 0; i < 14; i++) {
            dates.push(addDays(base, i));
        }
        return dates;
    }, [today, weekOffset]);

    // Tasks for selected date
    const tasksForDate = useMemo(() => {
        return (state.scheduledTasks || []).filter(t => isTaskVisibleOnDate(t, selectedDate));
    }, [state.scheduledTasks, selectedDate]);

    // Count tasks per date for indicators
    const taskCountForDate = (dateStr: string): number => {
        return (state.scheduledTasks || []).filter(t => isTaskVisibleOnDate(t, dateStr)).length;
    };

    /* ── Handlers ──────────────────────────────────────────── */

    const openNewTaskModal = () => {
        setEditingTask(null);
        setFormTitle('');
        setFormDescription('');
        setFormColor(TASK_COLORS[0]);
        setFormDate(selectedDate);
        setFormTime('');
        setFormRecurrence('none');
        setFormInterval(2);
        setFormWeekdays([]);
        setFormEndDate('');
        setIsModalOpen(true);
    };

    const openEditModal = (task: ScheduledTask) => {
        setEditingTask(task);
        setFormTitle(task.title);
        setFormDescription(task.description || '');
        setFormColor(task.color || TASK_COLORS[0]);
        setFormDate(task.date);
        setFormTime(task.time || '');
        setFormRecurrence(task.recurrence);
        setFormInterval(task.recurrenceInterval || 2);
        setFormWeekdays(task.recurrenceWeekdays || []);
        setFormEndDate(task.recurrenceEndDate || '');
        setIsModalOpen(true);
    };

    const handleSave = () => {
        if (!formTitle.trim()) return;

        const data = {
            title: formTitle.trim(),
            description: formDescription.trim() || undefined,
            color: formColor,
            date: formDate,
            time: formTime || undefined,
            recurrence: formRecurrence,
            recurrenceInterval: formRecurrence === 'every_n_days' ? formInterval : undefined,
            recurrenceWeekdays: formRecurrence === 'weekly' ? formWeekdays : undefined,
            recurrenceEndDate: formEndDate || undefined,
        };

        if (editingTask) {
            updateScheduledTask(editingTask.id, data);
        } else {
            addScheduledTask(data as any);
        }
        setIsModalOpen(false);
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Удалить задачу?')) {
            deleteScheduledTask(id);
        }
    };

    const toggleWeekday = (d: number) => {
        setFormWeekdays(prev =>
            prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort()
        );
    };

    /* ── Upcoming tasks (next 7 days with tasks) ──────────── */
    const upcomingTasks = useMemo(() => {
        const result: { date: string; tasks: ScheduledTask[] }[] = [];
        for (let i = 1; i <= 14; i++) {
            const d = addDays(today, i);
            const tasks = (state.scheduledTasks || []).filter(t => isTaskVisibleOnDate(t, d));
            if (tasks.length > 0) {
                result.push({ date: d, tasks });
            }
            if (result.length >= 5) break;
        }
        return result;
    }, [state.scheduledTasks, today]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto h-full overflow-y-auto">
            {/* ═══ Header ═══ */}
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-emerald-50 tracking-tight flex items-center gap-2.5">
                        <ListChecks className="w-7 h-7 text-emerald-400" />
                        Задачи
                    </h1>
                    <p className="text-zinc-500 mt-0.5 text-xs sm:text-sm">Список дел с повторяемостью</p>
                </div>
                <button
                    onClick={openNewTaskModal}
                    className="flex items-center gap-1.5 bg-emerald-600 text-white px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Новая задача</span>
                </button>
            </div>

            {/* ═══ Date Strip ═══ */}
            <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                    <button
                        onClick={() => setWeekOffset(w => w - 1)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => { setWeekOffset(0); setSelectedDate(today); }}
                        className="text-xs font-semibold text-zinc-400 hover:text-emerald-400 transition-colors px-2 py-0.5 rounded"
                    >
                        Сегодня
                    </button>
                    <button
                        onClick={() => setWeekOffset(w => w + 1)}
                        className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1 snap-x snap-mandatory">
                    {dateStrip.map(d => {
                        const dayDate = new Date(d + 'T00:00:00');
                        const isToday = d === today;
                        const isSelected = d === selectedDate;
                        const weekdayIdx = (dayDate.getDay() + 6) % 7;
                        const isWeekend = weekdayIdx >= 5;
                        const count = taskCountForDate(d);
                        const allDone = count > 0 && (state.scheduledTasks || [])
                            .filter(t => isTaskVisibleOnDate(t, d))
                            .every(t => t.completedDates.includes(d));

                        return (
                            <button
                                key={d}
                                onClick={() => setSelectedDate(d)}
                                className={cn(
                                    "flex flex-col items-center gap-0.5 px-2.5 py-2 rounded-xl min-w-[48px] shrink-0 transition-all duration-200 snap-center border",
                                    isSelected
                                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400 shadow-sm"
                                        : isToday
                                            ? "bg-zinc-800/60 border-zinc-700 text-zinc-200"
                                            : "bg-zinc-900/40 border-zinc-800/50 text-zinc-400 hover:bg-zinc-800/60 hover:border-zinc-700"
                                )}
                            >
                                <span className={cn(
                                    "text-[9px] font-bold uppercase",
                                    isWeekend && !isSelected ? "text-emerald-400/50" : ""
                                )}>
                                    {WEEKDAY_LABELS[weekdayIdx]}
                                </span>
                                <span className={cn(
                                    "text-base font-bold tabular-nums",
                                    isSelected ? "text-emerald-400" : isToday ? "text-zinc-100" : ""
                                )}>
                                    {dayDate.getDate()}
                                </span>
                                {/* Task indicator dots */}
                                <div className="flex gap-0.5 h-1.5">
                                    {count > 0 && (
                                        allDone
                                            ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                            : <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                    )}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ═══ Two-column layout on desktop ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left column: Task list */}
                <div className="lg:col-span-2">
                    {/* Selected Day Header */}
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-semibold text-zinc-300">
                            {selectedDate === today ? 'Сегодня' :
                                selectedDate === addDays(today, 1) ? 'Завтра' :
                                    selectedDate === addDays(today, -1) ? 'Вчера' :
                                        formatDateShort(selectedDate)
                            }
                            <span className="text-zinc-600 ml-2 font-normal">
                                {WEEKDAY_FULL[getWeekdayIndex(selectedDate)]}
                            </span>
                        </h2>
                        <span className="text-xs text-zinc-500 tabular-nums">
                            {tasksForDate.filter(t => t.completedDates.includes(selectedDate)).length}/{tasksForDate.length}
                        </span>
                    </div>

                    {/* Task List */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                        {tasksForDate.length === 0 ? (
                            <div className="py-10 text-center">
                                <ListChecks className="w-8 h-8 text-zinc-700 mx-auto mb-2" />
                                <p className="text-sm text-zinc-500">Нет задач на этот день</p>
                                <button
                                    onClick={openNewTaskModal}
                                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Добавить задачу
                                </button>
                            </div>
                        ) : (
                            tasksForDate.map((task, idx) => {
                                const isCompleted = task.completedDates.includes(selectedDate);
                                const recLabel = getRecurrenceLabel(task);

                                return (
                                    <div
                                        key={task.id}
                                        className={cn(
                                            "flex items-center gap-3 px-4 py-3 border-b border-zinc-800/50 last:border-b-0 transition-all group",
                                            isCompleted && "opacity-60"
                                        )}
                                    >
                                        {/* Checkbox */}
                                        <button
                                            onClick={() => toggleScheduledTaskDate(task.id, selectedDate)}
                                            className={cn(
                                                "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all",
                                                isCompleted
                                                    ? "border-emerald-500 bg-emerald-500"
                                                    : "border-zinc-600 hover:border-emerald-500/60"
                                            )}
                                        >
                                            {isCompleted && <Check className="w-3 h-3 text-white" />}
                                        </button>

                                        {/* Color dot */}
                                        <div
                                            className="w-2 h-2 rounded-full shrink-0"
                                            style={{ backgroundColor: task.color || '#6366f1' }}
                                        />

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className={cn(
                                                "text-sm font-medium truncate",
                                                isCompleted ? "line-through text-zinc-500" : "text-zinc-200"
                                            )}>
                                                {task.title}
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                {task.time && (
                                                    <span className="text-[10px] text-zinc-500 flex items-center gap-0.5">
                                                        <Clock className="w-2.5 h-2.5" />
                                                        {task.time}
                                                    </span>
                                                )}
                                                {recLabel && (
                                                    <span className="text-[10px] text-emerald-400/60 flex items-center gap-0.5 bg-emerald-500/5 px-1.5 py-0.5 rounded">
                                                        <Repeat className="w-2.5 h-2.5" />
                                                        {recLabel}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                            <button
                                                onClick={() => openEditModal(task)}
                                                className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(task.id)}
                                                className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right column: Upcoming */}
                <div className="lg:col-span-1">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Ближайшие
                    </h3>
                    {upcomingTasks.length > 0 ? (
                        <div className="space-y-2">
                            {upcomingTasks.map(({ date, tasks }) => (
                                <button
                                    key={date}
                                    onClick={() => { setSelectedDate(date); setWeekOffset(0); }}
                                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl bg-zinc-900/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors"
                                >
                                    <div className="text-center shrink-0 w-10">
                                        <div className="text-[9px] font-bold text-zinc-500 uppercase">
                                            {WEEKDAY_LABELS[getWeekdayIndex(date)]}
                                        </div>
                                        <div className="text-base font-bold text-zinc-300 tabular-nums">
                                            {new Date(date + 'T00:00:00').getDate()}
                                        </div>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs text-zinc-300 truncate">
                                            {tasks.map(t => t.title).join(' · ')}
                                        </div>
                                        <div className="text-[10px] text-zinc-600">
                                            {tasks.length} {tasks.length === 1 ? 'задача' : tasks.length < 5 ? 'задачи' : 'задач'}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="py-8 text-center rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30">
                            <Calendar className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                            <p className="text-xs text-zinc-600">Нет предстоящих задач</p>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Create/Edit Modal ═══ */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 sticky top-0 bg-zinc-900 z-10">
                            <h2 className="text-sm font-bold text-zinc-100">
                                {editingTask ? 'Редактировать задачу' : 'Новая задача'}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1 text-zinc-500 hover:text-zinc-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="px-5 py-4 space-y-4">
                            {/* Title */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Название</label>
                                <input
                                    type="text"
                                    value={formTitle}
                                    onChange={e => setFormTitle(e.target.value)}
                                    placeholder="Что нужно сделать?"
                                    className="w-full px-3 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-emerald-500/50 transition-colors"
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Описание</label>
                                <textarea
                                    value={formDescription}
                                    onChange={e => setFormDescription(e.target.value)}
                                    placeholder="Подробности (необязательно)..."
                                    rows={2}
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-emerald-500/50 transition-colors resize-none"
                                />
                            </div>

                            {/* Date + Time */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Дата начала</label>
                                    <input
                                        type="date"
                                        value={formDate}
                                        onChange={e => setFormDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Время</label>
                                    <input
                                        type="time"
                                        value={formTime}
                                        onChange={e => setFormTime(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                </div>
                            </div>

                            {/* Color */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">Цвет</label>
                                <div className="flex gap-2">
                                    {TASK_COLORS.map(c => (
                                        <button
                                            key={c}
                                            onClick={() => setFormColor(c)}
                                            className={cn(
                                                "w-6 h-6 rounded-full transition-all",
                                                formColor === c ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-emerald-500 scale-110" : "hover:scale-110"
                                            )}
                                            style={{ backgroundColor: c }}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Recurrence */}
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">
                                    <RefreshCw className="w-3 h-3 inline mr-1" />
                                    Повторение
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                    {([
                                        { value: 'none', label: 'Без повтора' },
                                        { value: 'daily', label: 'Ежедневно' },
                                        { value: 'every_n_days', label: 'Каждые N дн.' },
                                        { value: 'weekly', label: 'По дням нед.' },
                                        { value: 'monthly', label: 'Ежемесячно' },
                                    ] as { value: RecurrenceType; label: string }[]).map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => setFormRecurrence(opt.value)}
                                            className={cn(
                                                "px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                                                formRecurrence === opt.value
                                                    ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                                    : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                                            )}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Every N days input */}
                            {formRecurrence === 'every_n_days' && (
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Интервал (дни)</label>
                                    <input
                                        type="number"
                                        min={2}
                                        max={365}
                                        value={formInterval}
                                        onChange={e => setFormInterval(Math.max(2, parseInt(e.target.value) || 2))}
                                        className="w-24 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-emerald-500/50 tabular-nums"
                                    />
                                    <span className="text-xs text-zinc-500 ml-2">каждые {formInterval} дней</span>
                                </div>
                            )}

                            {/* Weekly weekday selector */}
                            {formRecurrence === 'weekly' && (
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">Дни недели</label>
                                    <div className="flex gap-1.5">
                                        {WEEKDAY_LABELS.map((label, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => toggleWeekday(idx)}
                                                className={cn(
                                                    "w-9 h-9 rounded-lg text-xs font-bold transition-all border",
                                                    formWeekdays.includes(idx)
                                                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                                                )}
                                            >
                                                {label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* End date for recurring */}
                            {formRecurrence !== 'none' && (
                                <div>
                                    <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">
                                        Повторять до (необязательно)
                                    </label>
                                    <input
                                        type="date"
                                        value={formEndDate}
                                        onChange={e => setFormEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 outline-none focus:border-emerald-500/50 transition-colors"
                                    />
                                    {!formEndDate && (
                                        <span className="text-[10px] text-zinc-600 mt-0.5 block">Бесконечно</span>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between px-5 py-4 border-t border-zinc-800 sticky bottom-0 bg-zinc-900">
                            {editingTask ? (
                                <button
                                    onClick={() => { handleDelete(editingTask.id); setIsModalOpen(false); }}
                                    className="text-xs text-red-400 hover:text-red-300 transition-colors font-medium flex items-center gap-1"
                                >
                                    <Trash2 className="w-3 h-3" />
                                    Удалить
                                </button>
                            ) : (
                                <div />
                            )}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={!formTitle.trim()}
                                    className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {editingTask ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
