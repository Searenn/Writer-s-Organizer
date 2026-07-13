import { BookOpen, Hash, Pin, PinOff, Plus, Search, StickyNote, Trash2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store';
import { Note } from '../types';
import { cn } from '../utils';

const NOTE_COLORS = [
  { id: 'default', hex: '#3f3f46', label: 'Обычная' },
  { id: 'amber', hex: '#d97706', label: 'Жёлтая' },
  { id: 'emerald', hex: '#10b981', label: 'Зелёная' },
  { id: 'blue', hex: '#3b82f6', label: 'Синяя' },
  { id: 'purple', hex: '#8b5cf6', label: 'Фиолетовая' },
  { id: 'rose', hex: '#f43f5e', label: 'Розовая' },
];

export const NotesView: React.FC = () => {
  const { state, addNote, updateNote, deleteNote, togglePinNote } = useAppStore();
  const notes = state.notes || [];

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formBookId, setFormBookId] = useState<string>('');
  const [formTags, setFormTags] = useState('');
  const [formColor, setFormColor] = useState('');

  // All unique tags
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    notes.forEach(n => n.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [notes]);

  // Filtered notes
  const filteredNotes = useMemo(() => {
    let result = [...notes];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        n.tags?.some(t => t.toLowerCase().includes(q))
      );
    }

    if (selectedTag) {
      result = result.filter(n => n.tags?.includes(selectedTag));
    }

    if (selectedBookId) {
      result = result.filter(n => n.bookId === selectedBookId);
    }

    // Pinned first, then by updatedAt
    result.sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return b.updatedAt - a.updatedAt;
    });

    return result;
  }, [notes, searchQuery, selectedTag, selectedBookId]);

  const resetForm = () => {
    setFormTitle('');
    setFormContent('');
    setFormBookId('');
    setFormTags('');
    setFormColor('');
    setIsCreating(false);
    setEditingId(null);
  };

  const handleSave = () => {
    if (!formTitle.trim() && !formContent.trim()) return;

    const tags = formTags
      .split(',')
      .map(t => t.trim().replace(/^#/, ''))
      .filter(Boolean);

    if (editingId) {
      updateNote(editingId, {
        title: formTitle.trim() || 'Без заголовка',
        content: formContent,
        bookId: formBookId || undefined,
        tags,
        color: formColor || undefined,
      });
    } else {
      addNote({
        title: formTitle.trim() || 'Без заголовка',
        content: formContent,
        bookId: formBookId || undefined,
        tags,
        color: formColor || undefined,
        isPinned: false,
      });
    }
    resetForm();
  };

  const handleEdit = (note: Note) => {
    setEditingId(note.id);
    setFormTitle(note.title);
    setFormContent(note.content);
    setFormBookId(note.bookId || '');
    setFormTags(note.tags?.join(', ') || '');
    setFormColor(note.color || '');
    setIsCreating(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Удалить заметку?')) {
      deleteNote(id);
      if (editingId === id) resetForm();
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center border border-amber-500/15">
            <StickyNote className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Заметки</h1>
            <p className="text-xs text-zinc-500">Быстрые идеи и мысли</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative w-60">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск в заметках..."
              className="w-full bg-zinc-900/40 border border-zinc-900 rounded-lg pl-9 pr-3 py-1.5 text-xs text-zinc-300 placeholder:text-zinc-600 outline-none focus:border-zinc-800 transition-colors"
            />
          </div>

          <button
            onClick={() => { resetForm(); setIsCreating(true); }}
            className="flex items-center gap-1.5 bg-amber-600/15 hover:bg-amber-600/25 text-amber-400 border border-amber-500/15 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Новая заметка
          </button>
        </div>
      </div>

      {/* Tags bar + Book filter */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {/* Book filter */}
        <select
          value={selectedBookId || ''}
          onChange={(e) => setSelectedBookId(e.target.value || null)}
          className="bg-zinc-900/40 border border-zinc-900 rounded-lg px-2.5 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-800 transition-colors"
        >
          <option value="">Все книги</option>
          {state.books.map(b => (
            <option key={b.id} value={b.id}>{b.title}</option>
          ))}
        </select>

        {/* Tag filters */}
        {allTags.length > 0 && (
          <>
            <div className="w-px h-5 bg-zinc-800" />
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold transition-colors border',
                  selectedTag === tag
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-900/40 text-zinc-500 border-zinc-900 hover:text-zinc-300'
                )}
              >
                <Hash className="w-2.5 h-2.5" />
                {tag}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Create / Edit Modal */}
      {isCreating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-zinc-100">
                {editingId ? 'Редактировать заметку' : 'Новая заметка'}
              </h2>
              <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-300 p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <input
                type="text"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Заголовок..."
                className="w-full px-3.5 py-2 border border-zinc-800 focus:border-amber-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-amber-500/10 transition-all"
                autoFocus
              />

              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Текст заметки... Поддерживается Markdown"
                rows={6}
                className="w-full px-3.5 py-2 border border-zinc-800 focus:border-amber-500/30 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:ring-1 focus:ring-amber-500/10 transition-all resize-none"
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Привязка к книге</label>
                  <select
                    value={formBookId}
                    onChange={(e) => setFormBookId(e.target.value)}
                    className="w-full px-3 py-2 border border-zinc-800 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:border-amber-500/30 transition-all"
                  >
                    <option value="">Без привязки</option>
                    {state.books.map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Теги (через запятую)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="сюжет, персонаж..."
                    className="w-full px-3 py-2 border border-zinc-800 rounded-lg outline-none bg-zinc-950 text-zinc-100 text-sm focus:border-amber-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Color picker */}
              <div>
                <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Цвет метки</label>
                <div className="flex items-center gap-2">
                  {NOTE_COLORS.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setFormColor(c.hex)}
                      title={c.label}
                      className={cn(
                        'w-7 h-7 rounded-lg border-2 transition-all',
                        formColor === c.hex ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-2">
                <button
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors shadow-sm"
                >
                  {editingId ? 'Сохранить' : 'Создать'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-zinc-950/20 border border-dashed border-zinc-900 rounded-2xl p-12 text-center max-w-sm mx-auto mt-12 animate-in fade-in duration-300">
          <StickyNote className="w-8 h-8 text-zinc-650 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 font-medium">Заметок пока нет</p>
          <p className="text-xs text-zinc-600 mt-1">
            {searchQuery ? 'Ничего не найдено по запросу.' : 'Нажмите «Новая заметка», чтобы записать идею.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredNotes.map(note => {
            const book = note.bookId ? state.books.find(b => b.id === note.bookId) : null;
            const noteColor = note.color || '#3f3f46';

            return (
              <div
                key={note.id}
                onClick={() => handleEdit(note)}
                className="group relative bg-zinc-900/20 border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                style={{
                  borderColor: `${noteColor}30`,
                  borderLeftWidth: '3px',
                  borderLeftColor: noteColor,
                }}
              >
                {/* Pin & Delete buttons */}
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePinNote(note.id); }}
                    className={cn(
                      'p-1 rounded-md transition-colors',
                      note.isPinned ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-300'
                    )}
                    title={note.isPinned ? 'Открепить' : 'Закрепить'}
                  >
                    {note.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}
                    className="p-1 rounded-md text-zinc-600 hover:text-red-400 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Pinned indicator */}
                {note.isPinned && (
                  <Pin className="absolute top-3 left-3 w-3 h-3 text-amber-400/60 fill-amber-400/20" />
                )}

                {/* Title */}
                <h3 className="text-sm font-bold text-zinc-100 leading-snug line-clamp-1 mb-1 pr-16">
                  {note.title || 'Без заголовка'}
                </h3>

                {/* Content preview */}
                <p className="text-xs text-zinc-500 line-clamp-3 mb-3 leading-relaxed">
                  {note.content || 'Пустая заметка...'}
                </p>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {note.tags.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-zinc-800/50 text-[9px] font-semibold text-zinc-400"
                      >
                        <Hash className="w-2 h-2" />{tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Footer: book + date */}
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-zinc-800/50">
                  {book ? (
                    <span className="flex items-center gap-1 text-[9px] text-zinc-500 font-medium truncate">
                      <BookOpen className="w-2.5 h-2.5" />
                      {book.title}
                    </span>
                  ) : (
                    <span className="text-[9px] text-zinc-600 italic">Общая</span>
                  )}
                  <span className="text-[9px] text-zinc-600 font-mono">
                    {formatDate(note.updatedAt)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
