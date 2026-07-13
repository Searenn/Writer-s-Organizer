import { BookOpen, ChevronDown, ChevronUp, Clock, Pause, Play, RotateCcw, Settings, Square, Timer, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';

type PomodoroPhase = 'work' | 'break' | 'longBreak' | 'idle';

const MOTIVATIONAL_MESSAGES = [
  'Ты пишешь историю! 🔥',
  'Каждое слово — шаг к цели! ✍️',
  'Поток включён! 💫',
  'Магия создаётся прямо сейчас! ✨',
  'Не останавливайся! 🚀',
  'Читатели ждут продолжения! 📖',
];

export const PomodoroWidget: React.FC = () => {
  const { state, addPomodoroSession, updatePomodoroSettings } = useAppStore();
  const settings = state.pomodoroSettings || {
    workMinutes: 25,
    breakMinutes: 5,
    longBreakMinutes: 15,
    sessionsBeforeLongBreak: 4,
  };

  const [isOpen, setIsOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [phase, setPhase] = useState<PomodoroPhase>('idle');
  const [timeLeft, setTimeLeft] = useState(settings.workMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [completedSessions, setCompletedSessions] = useState(0);
  const [sessionBookId, setSessionBookId] = useState<string>('');
  const [charsAtStart, setCharsAtStart] = useState(0);
  const [motivationMsg, setMotivationMsg] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Settings form
  const [settingsForm, setSettingsForm] = useState(settings);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Calculate total chars for a book
  const getBookChars = useCallback((bookId: string) => {
    const book = state.books.find(b => b.id === bookId);
    if (!book) return 0;
    if (book.canvasContent) {
      const t = document.createElement('div');
      t.innerHTML = book.canvasContent;
      return (t.innerText || t.textContent || '').length;
    }
    return state.chapters.filter(c => c.bookId === bookId).reduce((sum, c) => sum + c.content.length, 0);
  }, [state.books, state.chapters]);

  const handlePhaseCompleteRef = useRef<() => void>(undefined);

  // Timer logic
  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      const expectedEnd = Date.now() + timeLeft * 1000;
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.round((expectedEnd - Date.now()) / 1000));
        if (remaining <= 0) {
          clearInterval(intervalRef.current!);
          setTimeLeft(0);
          handlePhaseCompleteRef.current?.();
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const handlePhaseComplete = () => {
    setIsRunning(false);

    // Play notification sound
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContext();
      
      // Play 3 loud distinct beeps
      for (let i = 0; i < 3; i++) {
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.frequency.value = 880;
        oscillator.type = 'square'; // loud, piercing wave
        gainNode.gain.value = 0.8;
        
        const startTime = audioCtx.currentTime + i * 0.4;
        oscillator.start(startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);
        oscillator.stop(startTime + 0.3);
      }
    } catch (e) { /* ignore audio errors */ }

    if (phase === 'work') {
      // Save session
      const charsNow = sessionBookId ? getBookChars(sessionBookId) : 0;
      const charsWritten = Math.max(0, charsNow - charsAtStart);

      addPomodoroSession({
        bookId: sessionBookId || undefined,
        startedAt: startTimeRef.current,
        duration: settings.workMinutes * 60,
        charsWritten,
        completed: true,
      });

      const newCompleted = completedSessions + 1;
      setCompletedSessions(newCompleted);

      // Show motivation
      setMotivationMsg(MOTIVATIONAL_MESSAGES[Math.floor(Math.random() * MOTIVATIONAL_MESSAGES.length)]);
      setTimeout(() => setMotivationMsg(''), 4000);

      // Auto-start break
      if (newCompleted % settings.sessionsBeforeLongBreak === 0) {
        setPhase('longBreak');
        setTimeLeft(settings.longBreakMinutes * 60);
      } else {
        setPhase('break');
        setTimeLeft(settings.breakMinutes * 60);
      }
    } else {
      // Break finished → ready for work
      setPhase('idle');
      setTimeLeft(settings.workMinutes * 60);
    }
  };

  handlePhaseCompleteRef.current = handlePhaseComplete;

  const startWork = () => {
    setPhase('work');
    setTimeLeft(settings.workMinutes * 60);
    setIsRunning(true);
    startTimeRef.current = Date.now();
    if (sessionBookId) {
      setCharsAtStart(getBookChars(sessionBookId));
    }
  };

  const togglePause = () => {
    setIsRunning(!isRunning);
  };

  const stopTimer = () => {
    setIsRunning(false);

    // Save partial session if was working
    if (phase === 'work') {
      const elapsed = settings.workMinutes * 60 - timeLeft;
      if (elapsed > 30) {
        const charsNow = sessionBookId ? getBookChars(sessionBookId) : 0;
        addPomodoroSession({
          bookId: sessionBookId || undefined,
          startedAt: startTimeRef.current,
          duration: elapsed,
          charsWritten: Math.max(0, charsNow - charsAtStart),
          completed: false,
        });
      }
    }

    setPhase('idle');
    setTimeLeft(settings.workMinutes * 60);
  };

  const resetTimer = () => {
    setIsRunning(false);
    if (phase === 'work') setTimeLeft(settings.workMinutes * 60);
    else if (phase === 'break') setTimeLeft(settings.breakMinutes * 60);
    else if (phase === 'longBreak') setTimeLeft(settings.longBreakMinutes * 60);
    else setTimeLeft(settings.workMinutes * 60);
  };

  const saveSettings = () => {
    updatePomodoroSettings(settingsForm);
    setShowSettings(false);
    if (phase === 'idle') {
      setTimeLeft(settingsForm.workMinutes * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Progress for ring
  const totalTime = phase === 'work' ? settings.workMinutes * 60
    : phase === 'break' ? settings.breakMinutes * 60
    : phase === 'longBreak' ? settings.longBreakMinutes * 60
    : settings.workMinutes * 60;
  const progress = 1 - timeLeft / totalTime;
  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference * (1 - progress);

  const phaseLabel = phase === 'work' ? 'Работа' : phase === 'break' ? 'Перерыв' : phase === 'longBreak' ? 'Длинный перерыв' : 'Готов';
  const phaseColor = phase === 'work' ? '#f59e0b' : phase === 'break' ? '#10b981' : phase === 'longBreak' ? '#3b82f6' : '#71717a';

  // Recent sessions (last 10)
  const recentSessions = (state.pomodoroSessions || [])
    .slice()
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 10);

  const todaySessions = recentSessions.filter(s => {
    const d = new Date(s.startedAt);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  });

  const todayMinutes = todaySessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0);
  const todayChars = todaySessions.reduce((sum, s) => sum + s.charsWritten, 0);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'fixed bottom-6 right-6 z-40 w-14 h-14 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 border',
          isRunning && phase === 'work'
            ? 'bg-amber-600/20 border-amber-500/30 text-amber-400 animate-pulse shadow-amber-500/20'
            : isRunning
            ? 'bg-emerald-600/20 border-emerald-500/30 text-emerald-400 shadow-emerald-500/10'
            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
        )}
        title="Pomodoro таймер"
      >
        <Timer className="w-6 h-6" />
        {isRunning && (
          <span className="absolute -top-1 -right-1 text-[9px] font-bold bg-zinc-900 border border-zinc-700 text-zinc-200 px-1.5 py-0.5 rounded-md">
            {formatTime(timeLeft)}
          </span>
        )}
      </button>

      {/* Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-80 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4" style={{ color: phaseColor }} />
              <span className="text-sm font-bold text-zinc-100">Pomodoro</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-md border" style={{
                color: phaseColor,
                backgroundColor: `${phaseColor}15`,
                borderColor: `${phaseColor}25`,
              }}>
                {phaseLabel}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setShowSettings(!showSettings)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Motivation message */}
          {motivationMsg && (
            <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/15 text-amber-300 text-xs font-semibold text-center animate-in fade-in duration-300">
              {motivationMsg}
            </div>
          )}

          {/* Settings panel */}
          {showSettings ? (
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Работа (мин)</label>
                  <input type="number" value={settingsForm.workMinutes} min={1} max={120}
                    onChange={(e) => setSettingsForm({ ...settingsForm, workMinutes: +e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500/30 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Перерыв (мин)</label>
                  <input type="number" value={settingsForm.breakMinutes} min={1} max={60}
                    onChange={(e) => setSettingsForm({ ...settingsForm, breakMinutes: +e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500/30 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Длинный (мин)</label>
                  <input type="number" value={settingsForm.longBreakMinutes} min={1} max={120}
                    onChange={(e) => setSettingsForm({ ...settingsForm, longBreakMinutes: +e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500/30 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider">Сессий до длинного</label>
                  <input type="number" value={settingsForm.sessionsBeforeLongBreak} min={1} max={10}
                    onChange={(e) => setSettingsForm({ ...settingsForm, sessionsBeforeLongBreak: +e.target.value })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-sm text-zinc-100 outline-none focus:border-amber-500/30 mt-1"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  Отмена
                </button>
                <button onClick={saveSettings} className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors">
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Timer display */}
              <div className="p-6 flex flex-col items-center">
                {/* Circular progress */}
                <div className="relative w-28 h-28 mb-4">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="4" />
                    <circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke={phaseColor}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-black text-zinc-100 font-mono tracking-wider">
                      {formatTime(timeLeft)}
                    </span>
                  </div>
                </div>

                {/* Book selector */}
                <div className="w-full mb-4">
                  <select
                    value={sessionBookId}
                    onChange={(e) => setSessionBookId(e.target.value)}
                    disabled={isRunning}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-amber-500/30 transition-colors disabled:opacity-50"
                  >
                    <option value="">Без привязки к книге</option>
                    {state.books.filter(b => b.status !== 'PUBLISHED').map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                  {phase === 'idle' ? (
                    <button
                      onClick={startWork}
                      className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-600/20 hover:shadow-amber-600/30"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      Старт
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={togglePause}
                        className={cn(
                          'p-3 rounded-xl border transition-all',
                          isRunning
                            ? 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700'
                            : 'bg-amber-600/15 border-amber-500/20 text-amber-400 hover:bg-amber-600/25'
                        )}
                      >
                        {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-amber-400" />}
                      </button>
                      <button
                        onClick={resetTimer}
                        className="p-3 rounded-xl border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-all"
                        title="Сбросить"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <button
                        onClick={stopTimer}
                        className="p-3 rounded-xl border border-red-500/20 text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Остановить"
                      >
                        <Square className="w-4 h-4 fill-red-400/30" />
                      </button>
                    </>
                  )}
                </div>

                {/* Session dots */}
                {completedSessions > 0 && (
                  <div className="flex items-center gap-1.5 mt-4">
                    {Array.from({ length: Math.min(completedSessions, 8) }).map((_, i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-amber-500/60"
                        style={{
                          opacity: i < (completedSessions % settings.sessionsBeforeLongBreak || settings.sessionsBeforeLongBreak) ? 1 : 0.3,
                        }}
                      />
                    ))}
                    <span className="text-[9px] text-zinc-500 font-semibold ml-1">
                      {completedSessions} сессий
                    </span>
                  </div>
                )}
              </div>

              {/* Today stats */}
              <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-zinc-600" />
                      <span className="text-[10px] text-zinc-400 font-semibold">{todayMinutes} мин</span>
                    </div>
                    {todayChars > 0 && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {todayChars.toLocaleString('ru-RU')} зн.
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 font-semibold flex items-center gap-0.5 transition-colors"
                  >
                    История
                    {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* History */}
                {showHistory && recentSessions.length > 0 && (
                  <div className="mt-3 space-y-1.5 max-h-32 overflow-y-auto">
                    {recentSessions.map(s => {
                      const book = s.bookId ? state.books.find(b => b.id === s.bookId) : null;
                      const d = new Date(s.startedAt);
                      return (
                        <div key={s.id} className="flex items-center justify-between text-[10px] py-1 border-b border-zinc-800/50 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'w-1.5 h-1.5 rounded-full',
                              s.completed ? 'bg-amber-400' : 'bg-zinc-600'
                            )} />
                            <span className="text-zinc-400 font-mono">
                              {d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })} {d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {book && (
                              <span className="text-zinc-500 truncate max-w-[80px] flex items-center gap-0.5">
                                <BookOpen className="w-2 h-2" />{book.title}
                              </span>
                            )}
                            <span className="text-zinc-500 font-mono">{Math.round(s.duration / 60)}м</span>
                            {s.charsWritten > 0 && (
                              <span className="text-amber-400/60 font-mono">{s.charsWritten}зн</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
};
