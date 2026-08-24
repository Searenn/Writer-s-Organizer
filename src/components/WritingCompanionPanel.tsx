import { CalendarDays, Check, Copy, Globe2, ListTree, Plus, StickyNote, Users, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { CompanionPanelType } from '../types';
import { cn } from '../utils';

type Props = {
  bookId: string;
  active: CompanionPanelType;
  width: number;
  onSelect: (panel: CompanionPanelType) => void;
  onClose: () => void;
  onWidthChange: (width: number) => void;
};

const PANELS = [
  { id: 'plan', label: 'План', icon: ListTree },
  { id: 'characters', label: 'Герои', icon: Users },
  { id: 'settings', label: 'Мир', icon: Globe2 },
  { id: 'notes', label: 'Заметки', icon: StickyNote },
  { id: 'schedule', label: 'График', icon: CalendarDays },
] as const;

export const WritingCompanionPanel: React.FC<Props> = ({
  bookId,
  active,
  width,
  onSelect,
  onClose,
  onWidthChange,
}) => {
  const {
    state,
    updateBook,
    addCharacter,
    updateCharacter,
    addSetting,
    updateSetting,
    addNote,
    updateNote,
    updateChapter,
  } = useAppStore();
  const book = state.books.find(item => item.id === bookId);
  const characters = state.characters.filter(item => item.bookId === bookId);
  const settings = state.settings.filter(item => item.bookId === bookId);
  const notes = (state.notes || []).filter(item => item.bookId === bookId);
  const chapters = state.chapters.filter(item => item.bookId === bookId).sort((a, b) => a.order - b.order);
  const [draftTitle, setDraftTitle] = useState('');
  const [resizing, setResizing] = useState(false);
  const [liveWidth, setLiveWidth] = useState(width);
  const liveWidthRef = useRef(width);
  const resizeStart = useRef({ x: 0, width });
  const planRef = useRef<HTMLDivElement>(null);
  const [charactersCopied, setCharactersCopied] = useState(false);

  useEffect(() => {
    if (!resizing) {
      liveWidthRef.current = width;
      setLiveWidth(width);
    }
  }, [resizing, width]);

  useEffect(() => {
    if (active === 'plan' && planRef.current && planRef.current.innerHTML !== (book?.chapterPlan || '')) {
      planRef.current.innerHTML = book?.chapterPlan || '';
    }
  }, [active, book?.chapterPlan, bookId]);

  useEffect(() => {
    if (!resizing) return;
    const handleMove = (event: MouseEvent) => {
      const maxWidth = Math.min(960, Math.floor(window.innerWidth * 0.7));
      const next = Math.min(maxWidth, Math.max(180, resizeStart.current.width + resizeStart.current.x - event.clientX));
      liveWidthRef.current = next;
      setLiveWidth(next);
    };
    const handleUp = () => {
      setResizing(false);
      onWidthChange(liveWidthRef.current);
    };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [onWidthChange, resizing]);

  const addItem = () => {
    const title = draftTitle.trim();
    if (!title) return;
    if (active === 'characters') addCharacter({ bookId, name: title, description: '', color: '#10b981' });
    if (active === 'settings') addSetting({ bookId, title, description: '' });
    if (active === 'notes') addNote({ bookId, title, content: '', tags: [] });
    setDraftTitle('');
  };

  const copyAllCharacters = async () => {
    const text = characters.map(character => [
      character.name,
      character.aliases ? `Псевдонимы: ${character.aliases}` : '',
      character.description,
    ].filter(Boolean).join('\n')).join('\n\n');
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCharactersCopied(true);
    window.setTimeout(() => setCharactersCopied(false), 1800);
  };

  if (!book) return null;

  return (
    <aside
      className="absolute inset-y-0 right-0 z-40 md:relative md:inset-auto md:z-auto bg-zinc-950 border-l border-zinc-800 flex flex-col shrink-0 shadow-2xl md:shadow-none max-w-full"
      style={{ width: liveWidth }}
    >
      <button
        onMouseDown={(event) => {
          resizeStart.current = { x: event.clientX, width: liveWidthRef.current };
          setResizing(true);
        }}
        onDoubleClick={() => {
          liveWidthRef.current = 360;
          setLiveWidth(360);
          onWidthChange(360);
        }}
        className="hidden md:block absolute -left-1 top-0 bottom-0 w-2 cursor-col-resize group z-10"
        title="Изменить ширину"
      >
        <span className={cn('absolute left-1/2 top-0 bottom-0 w-px bg-zinc-800 group-hover:bg-emerald-500/60', resizing && 'bg-emerald-500')} />
      </button>

      <div className="px-2 py-2 border-b border-zinc-900 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
        {PANELS.map(panel => {
          const Icon = panel.icon;
          return (
            <button
              key={panel.id}
              onClick={() => onSelect(panel.id)}
              className={cn(
                'flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors',
                active === panel.id ? 'bg-emerald-500/10 text-emerald-400' : 'text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900',
              )}
              title={panel.label}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden xl:inline">{panel.label}</span>
            </button>
          );
        })}
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-zinc-900" title="Закрыть панель">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {active === 'plan' && (
          <div className="h-full flex flex-col">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-zinc-200">План книги</h3>
              <p className="text-[11px] text-zinc-600 mt-0.5">Держите структуру перед глазами во время письма.</p>
            </div>
            <div
              ref={planRef}
              contentEditable
              suppressContentEditableWarning
              onBlur={(event) => updateBook(bookId, { chapterPlan: event.currentTarget.innerHTML })}
              className="flex-1 min-h-[240px] rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 text-sm leading-relaxed text-zinc-300 outline-none focus:border-emerald-500/30 whitespace-pre-wrap empty:before:text-zinc-700 empty:before:content-[attr(data-placeholder)] [&_h2]:font-bold [&_h2]:text-emerald-200 [&_h2]:mt-3"
              data-placeholder="Набросайте арки, поворотные точки и финал…"
            />
          </div>
        )}

        {(active === 'characters' || active === 'settings' || active === 'notes') && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">
                {active === 'characters' ? 'Персонажи' : active === 'settings' ? 'Мир и локации' : 'Заметки книги'}
              </h3>
              {active === 'characters' && characters.length > 0 && (
                <button
                  onClick={() => void copyAllCharacters()}
                  className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500 hover:text-emerald-400 transition-colors"
                >
                  {charactersCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {charactersCopied ? 'Все персонажи скопированы' : 'Скопировать всех персонажей'}
                </button>
              )}
              <div className="flex gap-2 mt-2">
                <input
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  onKeyDown={event => event.key === 'Enter' && addItem()}
                  placeholder={active === 'characters' ? 'Новый персонаж' : active === 'settings' ? 'Новая локация' : 'Новая заметка'}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900/30 text-xs text-zinc-200 outline-none focus:border-emerald-500/30"
                />
                <button onClick={addItem} className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white" title="Добавить">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {active === 'characters' && characters.map(character => (
              <div key={character.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-2">
                <input value={character.name} onChange={event => updateCharacter(character.id, { name: event.target.value })} className="w-full bg-transparent text-sm font-semibold text-zinc-200 outline-none" />
                <textarea value={character.description} onChange={event => updateCharacter(character.id, { description: event.target.value })} placeholder="Роль, цель, конфликт…" className="w-full min-h-20 resize-y bg-transparent text-xs leading-relaxed text-zinc-500 outline-none" />
              </div>
            ))}

            {active === 'settings' && settings.map(setting => (
              <div key={setting.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-2">
                <input value={setting.title} onChange={event => updateSetting(setting.id, { title: event.target.value })} className="w-full bg-transparent text-sm font-semibold text-zinc-200 outline-none" />
                <textarea value={setting.description} onChange={event => updateSetting(setting.id, { description: event.target.value })} placeholder="Атмосфера, правила, детали…" className="w-full min-h-20 resize-y bg-transparent text-xs leading-relaxed text-zinc-500 outline-none" />
              </div>
            ))}

            {active === 'notes' && notes.map(note => (
              <div key={note.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-900/20 space-y-2">
                <input value={note.title} onChange={event => updateNote(note.id, { title: event.target.value })} className="w-full bg-transparent text-sm font-semibold text-zinc-200 outline-none" />
                <textarea value={note.content} onChange={event => updateNote(note.id, { content: event.target.value })} placeholder="Мысль, реплика, деталь…" className="w-full min-h-20 resize-y bg-transparent text-xs leading-relaxed text-zinc-500 outline-none" />
              </div>
            ))}
          </div>
        )}

        {active === 'schedule' && (
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200">График публикации</h3>
              <p className="text-[11px] text-zinc-600 mt-0.5">Даты редактируются без выхода из текста.</p>
            </div>
            {chapters.length === 0 ? (
              <p className="text-xs text-zinc-600 py-8 text-center">Глав пока нет</p>
            ) : chapters.map((chapter, index) => (
              <div key={chapter.id} className="p-3 rounded-xl border border-zinc-900 bg-zinc-900/20">
                <div className="text-xs font-semibold text-zinc-300 truncate mb-2">{index + 1}. {chapter.title}</div>
                <input
                  type="datetime-local"
                  value={chapter.scheduledDate ? chapter.scheduledDate.slice(0, 16) : ''}
                  onChange={event => updateChapter(chapter.id, { scheduledDate: event.target.value || undefined })}
                  className="w-full px-2 py-1.5 rounded-lg border border-zinc-800 bg-zinc-950 text-[11px] text-zinc-400 outline-none focus:border-emerald-500/30"
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};
