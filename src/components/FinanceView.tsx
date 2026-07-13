import { ChevronDown, ChevronUp, DollarSign, Flame, Plus, Target, Trash2, TrendingUp, Trophy, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { cn, getLocalISODate } from '../utils';

/* ── helpers ─────────────────────────────────────────────────────── */

function getMonthKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getDaysInMonth(monthKey: string): number {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

const MONTH_NAMES_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const MONTH_NAMES_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAY_NAMES = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function formatMonthLabel(monthKey: string): string {
    const [y, m] = monthKey.split('-').map(Number);
    return `${MONTH_NAMES_SHORT[m - 1]} ${y} г.`;
}

function formatMonthFull(monthKey: string): string {
    const [y, m] = monthKey.split('-').map(Number);
    return `${MONTH_NAMES_FULL[m - 1]} ${y} г.`;
}

/** Generate a list of month keys around the current month */
function getMonthTabs(range: number = 4): string[] {
    const months: string[] = [];
    const now = new Date();
    for (let i = -range; i <= range; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
        months.push(getMonthKey(d));
    }
    return months;
}

/** Get weekday name for a date in a given month */
function getWeekday(monthKey: string, day: number): string {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    return WEEKDAY_NAMES[d.getDay()];
}

function isWeekend(monthKey: string, day: number): boolean {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    const dow = d.getDay();
    return dow === 0 || dow === 6;
}

/* ── 12-month table helpers (legacy) ─────────────────────────────── */

function getMonthColumns(count: number = 12): string[] {
    const months: string[] = [];
    const now = new Date();
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(getMonthKey(d));
    }
    return months;
}

function formatMonth(m: string): string {
    const [, mo] = m.split('-');
    return MONTH_NAMES_SHORT[parseInt(mo) - 1];
}

/* ── Component ───────────────────────────────────────────────────── */

export const FinanceView: React.FC = () => {
    const {
        state, addPlatform, deletePlatform,
        upsertEarnings, upsertFinanceGoal, upsertDailyEarning
    } = useAppStore();

    // Month selector
    const currentMonthKey = getMonthKey(new Date());
    const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
    const monthTabs = useMemo(() => getMonthTabs(4), []);
    const monthScrollRef = useRef<HTMLDivElement>(null);

    // Goal UI
    const [isGoalExpanded, setIsGoalExpanded] = useState(true);
    const [editingGoal, setEditingGoal] = useState(false);
    const [goalInput, setGoalInput] = useState('');

    // Platform section
    const [isPlatformsExpanded, setIsPlatformsExpanded] = useState(true);
    const [isAddingPlatform, setIsAddingPlatform] = useState(false);
    const [newPlatformName, setNewPlatformName] = useState('');
    const [newPlatformAccountId, setNewPlatformAccountId] = useState(state.accounts[0]?.id || '');

    // Daily writing
    const todayWritten = useMemo(() => {
        const today = getLocalISODate();
        const log = (state.writingLogs || []).find(l => l.date === today);
        return log?.count || 0;
    }, [state.writingLogs]);
    const dailyGoalMet = todayWritten >= state.dailyGoal;

    /* ── Data accessors ─────────────────────────────────────────── */

    const getGoal = (month: string): number => {
        const goal = (state.financeGoals || []).find(g => g.month === month);
        return goal?.amount || 0;
    };

    const getDailyEarning = (date: string): number => {
        const entry = (state.dailyEarnings || []).find(e => e.date === date);
        return entry?.amount || 0;
    };

    // Monthly totals from daily earnings
    const monthlyTotal = useMemo(() => {
        return (state.dailyEarnings || [])
            .filter(e => e.date.startsWith(selectedMonth))
            .reduce((sum, e) => sum + e.amount, 0);
    }, [state.dailyEarnings, selectedMonth]);

    const goal = getGoal(selectedMonth);
    const daysInMonth = getDaysInMonth(selectedMonth);
    const dailyMinimum = goal > 0 ? Math.round((goal / daysInMonth) * 100) / 100 : 0;
    const progress = goal > 0 ? Math.min((monthlyTotal / goal) * 100, 100) : 0;
    const goalMet = goal > 0 && monthlyTotal >= goal;

    /* ── Platform table accessors ─────────────────────────────── */
    const months12 = useMemo(() => getMonthColumns(12), []);

    const getEarnings = (platformId: string, month: string): number => {
        const entry = (state.earnings || []).find(e => e.platformId === platformId && e.month === month);
        return entry?.amount || 0;
    };

    const getMonthTotal = (month: string): number => {
        return (state.earnings || [])
            .filter(e => e.month === month)
            .reduce((sum, e) => sum + e.amount, 0);
    };

    const getAccountMonthTotal = (accountId: string, month: string): number => {
        const accountPlatforms = (state.platforms || []).filter(p => p.accountId === accountId);
        return accountPlatforms.reduce((sum, p) => sum + getEarnings(p.id, month), 0);
    };

    /* ── Handlers ──────────────────────────────────────────────── */

    const handleDailyEarningChange = (day: number, value: string) => {
        const amount = parseFloat(value) || 0;
        const date = `${selectedMonth}-${String(day).padStart(2, '0')}`;
        upsertDailyEarning({ date, amount });
    };

    const handleGoalSave = () => {
        const amount = parseFloat(goalInput) || 0;
        upsertFinanceGoal({ month: selectedMonth, amount });
        setEditingGoal(false);
        setGoalInput('');
    };

    const handleAddPlatform = () => {
        if (!newPlatformName.trim() || !newPlatformAccountId) return;
        addPlatform({ name: newPlatformName.trim(), accountId: newPlatformAccountId });
        setNewPlatformName('');
        setIsAddingPlatform(false);
    };

    const handleEarningsChange = (platformId: string, month: string, value: string) => {
        const amount = parseFloat(value) || 0;
        upsertEarnings({ platformId, month, amount });
    };

    /* ── Today index (for scroll hint) ─────────────────────────── */
    const today = new Date();
    const todayDay = selectedMonth === currentMonthKey ? today.getDate() : null;

    return (
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            {/* ═══ Header ═══ */}
            <div className="mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-emerald-50 tracking-tight flex items-center gap-2.5">
                            <DollarSign className="w-7 h-7 text-emerald-400" />
                            Финансы
                        </h1>
                        <p className="text-zinc-500 mt-0.5 text-xs sm:text-sm">Цель, доход, реклама, налог и накопления.</p>
                    </div>
                    {dailyGoalMet && (
                        <div className="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                            <Trophy className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs font-medium text-emerald-400">Дневная цель!</span>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ Month Tabs ═══ */}
            <div
                ref={monthScrollRef}
                className="flex gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar snap-x snap-mandatory"
            >
                {monthTabs.map(m => (
                    <button
                        key={m}
                        onClick={() => setSelectedMonth(m)}
                        className={cn(
                            'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 whitespace-nowrap snap-center border',
                            m === selectedMonth
                                ? 'bg-zinc-100 text-zinc-900 border-zinc-200 shadow-sm'
                                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800 hover:text-zinc-200'
                        )}
                    >
                        {formatMonthLabel(m)}
                    </button>
                ))}
            </div>

            {/* ═══ Main Grid ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                
                {/* Left Column */}
                <div className="space-y-6">

            {/* ═══ Goal Card ═══ */}
            <div className={cn(
                "rounded-2xl border transition-all",
                goalMet
                    ? "bg-emerald-500/5 border-emerald-500/20"
                    : "bg-zinc-900 border-zinc-800"
            )}>
                {/* Goal header */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3">
                    <span className="text-sm font-medium text-zinc-300">
                        {formatMonthFull(selectedMonth)} · цель
                    </span>
                    <button
                        onClick={() => setIsGoalExpanded(!isGoalExpanded)}
                        className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors font-medium"
                    >
                        {isGoalExpanded ? 'Свернуть' : 'Развернуть'}
                    </button>
                </div>

                {isGoalExpanded && (
                    <div className="px-4 sm:px-5 pb-4 space-y-4">
                        {/* Progress bar */}
                        <div className="flex flex-col items-center py-3 px-4 bg-zinc-950/40 rounded-xl">
                            <div className="text-xl sm:text-2xl font-bold tabular-nums">
                                <span className={cn(goalMet ? "text-emerald-400" : "text-amber-400")}>
                                    {monthlyTotal.toLocaleString('ru-RU')}
                                </span>
                                <span className="text-zinc-500"> / </span>
                                <span className="text-zinc-300">
                                    {goal > 0 ? goal.toLocaleString('ru-RU') : '—'}
                                </span>
                                <span className="text-zinc-500 text-lg ml-1">₽</span>
                            </div>
                            {goal > 0 && (
                                <span className="text-xs text-zinc-500 mt-1 tabular-nums">
                                    {Math.round(progress)}% цели
                                </span>
                            )}
                            {goal > 0 && (
                                <div className="w-full mt-3 bg-zinc-800 rounded-full h-2.5 overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-700 ease-out",
                                            progress >= 100 ? "bg-emerald-500" :
                                                progress >= 70 ? "bg-amber-400" :
                                                    progress >= 40 ? "bg-yellow-500" :
                                                        "bg-red-400"
                                        )}
                                        style={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                            {goalMet && (
                                <span className="text-emerald-400 text-xs font-medium mt-2 animate-pulse">
                                    🎉 Цель достигнута!
                                </span>
                            )}
                        </div>

                        {/* Goal + daily minimum inputs */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Цель</label>
                                {editingGoal ? (
                                    <div className="flex gap-1.5">
                                        <input
                                            type="number"
                                            value={goalInput}
                                            onChange={e => setGoalInput(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleGoalSave()}
                                            className="flex-1 min-w-0 px-3 py-2 bg-zinc-950 border border-emerald-500/50 rounded-lg text-sm text-zinc-100 outline-none tabular-nums"
                                            autoFocus
                                            placeholder="₽"
                                        />
                                        <button onClick={handleGoalSave} className="px-2 text-emerald-400 text-sm font-bold">✓</button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => { setEditingGoal(true); setGoalInput(String(goal || '')); }}
                                        className="w-full text-left px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-sm text-zinc-100 hover:border-zinc-700 transition-colors tabular-nums"
                                    >
                                        {goal > 0 ? goal.toLocaleString('ru-RU') : 'Установить'}
                                    </button>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] uppercase tracking-wider font-semibold text-zinc-500 mb-1">Ежедневный минимум</label>
                                <div className="px-3 py-2 bg-zinc-950/60 border border-zinc-800/50 rounded-lg text-sm text-zinc-400 tabular-nums">
                                    {dailyMinimum > 0 ? dailyMinimum.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══ Daily Earnings List ═══ */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
                    const amount = getDailyEarning(dateStr);
                    const weekday = getWeekday(selectedMonth, day);
                    const weekend = isWeekend(selectedMonth, day);
                    const isToday = todayDay === day;
                    const aboveMinimum = dailyMinimum > 0 && amount >= dailyMinimum;
                    const belowMinimum = dailyMinimum > 0 && amount > 0 && amount < dailyMinimum;

                    // Determine if this day is in the future
                    const [sy, sm] = selectedMonth.split('-').map(Number);
                    const dayDate = new Date(sy, sm - 1, day);
                    const isFuture = dayDate > new Date();

                    return (
                        <div
                            key={day}
                            className={cn(
                                "flex items-center gap-3 px-4 py-2.5 border-b border-zinc-800/50 last:border-b-0 transition-colors",
                                isToday && "ring-1 ring-inset ring-emerald-500/30",
                                aboveMinimum && "bg-emerald-500/20",
                                belowMinimum && "bg-red-500/[0.06]",
                                isFuture && !amount && "opacity-50"
                            )}
                        >
                            {/* Day number */}
                            <span className={cn(
                                "w-7 text-sm font-bold tabular-nums text-right shrink-0",
                                isToday ? "text-emerald-400" : "text-zinc-200"
                            )}>
                                {day}
                            </span>

                            {/* Weekday */}
                            <span className={cn(
                                "w-8 text-xs shrink-0",
                                weekend ? "text-emerald-400/60 font-semibold" : "text-zinc-500"
                            )}>
                                {weekday}
                            </span>

                            {/* Spacer / date line */}
                            <div className="flex-1 border-b border-dotted border-zinc-800" />

                            {/* Amount input */}
                            <input
                                type="number"
                                value={amount || ''}
                                onChange={(e) => handleDailyEarningChange(day, e.target.value)}
                                className={cn(
                                    "w-24 sm:w-28 text-right bg-transparent border border-transparent rounded-md px-2 py-1 text-sm tabular-nums outline-none transition-all",
                                    "hover:border-zinc-700 focus:border-emerald-500/50 focus:bg-zinc-950",
                                    amount > 0
                                        ? aboveMinimum ? "text-emerald-400 font-semibold" : belowMinimum ? "text-red-400 font-semibold" : "text-zinc-200"
                                        : "text-zinc-600"
                                )}
                                placeholder="—"
                            />
                        </div>
                    );
                })}

                {/* Monthly total row */}
                <div className="flex items-center gap-3 px-4 py-3 bg-zinc-800/50 border-t border-zinc-700">
                    <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="text-sm font-bold text-emerald-400 uppercase tracking-wider">Всего</span>
                    <div className="flex-1" />
                    <span className={cn(
                        "text-sm font-bold tabular-nums",
                        goalMet ? "text-emerald-400" : monthlyTotal > 0 ? "text-zinc-100" : "text-zinc-600"
                    )}>
                        {monthlyTotal > 0 ? monthlyTotal.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'} ₽
                    </span>
                </div>
            </div>

            </div>

            {/* Right Column: Platforms Table (collapsible) */}
            <div className="mt-6 lg:mt-0">
                <button
                    onClick={() => setIsPlatformsExpanded(!isPlatformsExpanded)}
                    className="flex items-center gap-2 w-full text-left mb-3 group"
                >
                    <ChevronDown className={cn("w-4 h-4 text-zinc-500 transition-transform", !isPlatformsExpanded && "-rotate-90")} />
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider group-hover:text-zinc-300 transition-colors">
                        По площадкам
                    </span>
                    <div className="flex-1 border-b border-zinc-800" />
                    <button
                        onClick={(e) => { e.stopPropagation(); setIsAddingPlatform(true); setIsPlatformsExpanded(true); }}
                        className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 hover:text-emerald-400 transition-colors bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-md"
                    >
                        <Plus className="w-3 h-3" />
                        Площадка
                    </button>
                </button>

                {isPlatformsExpanded && (
                    <>
                        {/* Add platform form */}
                        {isAddingPlatform && (
                            <div className="mb-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                                <h3 className="text-xs font-semibold text-zinc-200 mb-2">Новая площадка</h3>
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2">
                                    <div className="flex-1">
                                        <label className="block text-[10px] text-zinc-400 mb-1">Псевдоним</label>
                                        <select
                                            value={newPlatformAccountId}
                                            onChange={(e) => setNewPlatformAccountId(e.target.value)}
                                            className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
                                        >
                                            {state.accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-[10px] text-zinc-400 mb-1">Название</label>
                                        <input
                                            type="text"
                                            value={newPlatformName}
                                            onChange={(e) => setNewPlatformName(e.target.value)}
                                            placeholder="Литрес, Author.today..."
                                            className="w-full px-3 py-2 border border-zinc-700 rounded-lg bg-zinc-950 text-sm text-zinc-100 outline-none focus:border-emerald-500/50"
                                            autoFocus
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddPlatform()}
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAddPlatform}
                                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                                        >
                                            Добавить
                                        </button>
                                        <button
                                            onClick={() => setIsAddingPlatform(false)}
                                            className="px-3 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Platforms table */}
                        {(state.platforms || []).length > 0 ? (
                            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-zinc-800">
                                            <th className="text-left p-2.5 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-900 z-10 min-w-[140px]">
                                                Площадка
                                            </th>
                                            {months12.map(m => (
                                                <th key={m} className={cn(
                                                    "p-2 text-[10px] font-semibold uppercase tracking-wider min-w-[80px] text-center",
                                                    m === currentMonthKey ? "text-emerald-400 bg-emerald-500/5" : "text-zinc-500"
                                                )}>
                                                    {formatMonth(m)}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {state.accounts.map(account => {
                                            const platforms = (state.platforms || []).filter(p => p.accountId === account.id);
                                            if (platforms.length === 0) return null;

                                            return (
                                                <React.Fragment key={account.id}>
                                                    <tr className="border-b border-zinc-800/50">
                                                        <td colSpan={months12.length + 1} className="p-2 pl-2.5 sticky left-0 bg-zinc-900/95 z-10">
                                                            <div className="flex items-center gap-2">
                                                                {account.color && (
                                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: account.color }} />
                                                                )}
                                                                <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">
                                                                    {account.name.includes(':') ? account.name.split(':')[0].trim() : account.name}
                                                                </span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {platforms.map(platform => (
                                                        <tr key={platform.id} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors group">
                                                            <td className="p-2.5 sticky left-0 bg-zinc-900 group-hover:bg-zinc-800/40 z-10 transition-colors">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-zinc-200 font-medium text-xs">{platform.name}</span>
                                                                    <button
                                                                        onClick={() => deletePlatform(platform.id)}
                                                                        className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-0.5"
                                                                        title="Удалить"
                                                                    >
                                                                        <Trash2 className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            {months12.map(m => (
                                                                <td key={m} className={cn("p-1 text-center", m === currentMonthKey ? "bg-emerald-500/5" : "")}>
                                                                    <input
                                                                        type="number"
                                                                        value={getEarnings(platform.id, m) || ''}
                                                                        onChange={(e) => handleEarningsChange(platform.id, m, e.target.value)}
                                                                        className={cn(
                                                                            "w-full text-center bg-transparent border border-transparent rounded px-1 py-1 text-xs tabular-nums outline-none transition-all",
                                                                            "hover:border-zinc-700 focus:border-emerald-500/50 focus:bg-zinc-950",
                                                                            getEarnings(platform.id, m) > 0 ? "text-zinc-200" : "text-zinc-600"
                                                                        )}
                                                                        placeholder="—"
                                                                    />
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                    <tr className="border-b border-zinc-700/50">
                                                        <td className="p-2 pl-2.5 sticky left-0 bg-zinc-900 z-10">
                                                            <span className="text-[10px] font-semibold text-zinc-400 italic">Итого</span>
                                                        </td>
                                                        {months12.map(m => {
                                                            const total = getAccountMonthTotal(account.id, m);
                                                            return (
                                                                <td key={m} className={cn("p-2 text-center text-[10px] font-bold tabular-nums", m === currentMonthKey ? "bg-emerald-500/5" : "")}>
                                                                    <span className={total > 0 ? "text-zinc-300" : "text-zinc-600"}>
                                                                        {total > 0 ? total.toLocaleString('ru-RU') : '—'}
                                                                    </span>
                                                                </td>
                                                            );
                                                        })}
                                                    </tr>
                                                </React.Fragment>
                                            );
                                        })}

                                        {/* Grand total */}
                                        <tr className="bg-zinc-800/50">
                                            <td className="p-2.5 sticky left-0 bg-zinc-800/50 z-10">
                                                <div className="flex items-center gap-1.5">
                                                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                                                    <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Всего</span>
                                                </div>
                                            </td>
                                            {months12.map(m => {
                                                const total = getMonthTotal(m);
                                                return (
                                                    <td key={m} className={cn("p-2 text-center", m === currentMonthKey ? "bg-emerald-500/10" : "")}>
                                                        <span className={cn(
                                                            "text-xs font-bold tabular-nums",
                                                            total > 0 ? "text-zinc-100" : "text-zinc-600"
                                                        )}>
                                                            {total > 0 ? total.toLocaleString('ru-RU') : '—'}
                                                        </span>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 bg-zinc-900 border border-dashed border-zinc-700 rounded-xl">
                                <DollarSign className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
                                <h3 className="text-sm font-semibold text-zinc-300 mb-1">Нет площадок</h3>
                                <p className="text-zinc-500 text-xs mb-3">Добавьте площадки для отслеживания доходов.</p>
                                <button
                                    onClick={() => setIsAddingPlatform(true)}
                                    className="inline-flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                    Добавить площадку
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            
            </div>
        </div>
    );
};
