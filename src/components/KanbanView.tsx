import { Columns3, FileText, GripVertical, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { PipelineStage, KanbanTask } from '../types';
import { cn } from '../utils';

const PIPELINE_STAGES: { id: PipelineStage; label: string; emoji: string; color: string }[] = [
  { id: 'idea', label: 'Идея', emoji: '💡', color: '#a78bfa' },
  { id: 'planning', label: 'Планирование', emoji: '📋', color: '#60a5fa' },
  { id: 'writing', label: 'Написание', emoji: '✍️', color: '#fbbf24' },
  { id: 'editing', label: 'Редактура', emoji: '🔍', color: '#f97316' },
  { id: 'publishing', label: 'Публикация', emoji: '🚀', color: '#34d399' },
  { id: 'promotion', label: 'Продвижение', emoji: '📣', color: '#f472b6' },
];

const PRESET_TASK_COLORS = [
  '#a78bfa', '#8b5cf6', '#6d28d9', // Purple
  '#60a5fa', '#3b82f6', '#1d4ed8', // Blue
  '#22d3ee', '#06b6d4', '#0891b2', // Cyan
  '#34d399', '#10b981', '#047857', // Emerald/Green
  '#a3e635', '#84cc16', '#4d7c0f', // Lime
  '#fbbf24', '#f59e0b', '#b45309', // Amber
  '#f97316', '#ea580c', '#c2410c', // Orange
  '#ef4444', '#dc2626', '#b91c1c', // Red
  '#f472b6', '#ec4899', '#be185d', // Pink
];

export const KanbanView: React.FC<{ onSelectBook: (id: string) => void }> = ({ onSelectBook }) => {
  const { state, updateBook, addKanbanTask, updateKanbanTask, deleteKanbanTask } = useAppStore();
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'book' | 'task' } | null>(null);
  const [dragOverStage, setDragOverStage] = useState<PipelineStage | null>(null);
  const [filterAccountId, setFilterAccountId] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [newTaskStage, setNewTaskStage] = useState<PipelineStage | null>(null);

  // Form Fields State
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAccountId, setTaskAccountId] = useState('');
  const [taskColor, setTaskColor] = useState('#a78bfa');

  const handleDragStart = (e: React.DragEvent, id: string, type: 'book' | 'task') => {
    setDraggedItem({ id, type });
    e.dataTransfer.effectAllowed = 'move';
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 50, 25);
    }
  };

  const handleDragOver = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    setDragOverStage(stage);
  };

  const handleDragLeave = () => {
    setDragOverStage(null);
  };

  const handleDrop = (e: React.DragEvent, stage: PipelineStage) => {
    e.preventDefault();
    if (draggedItem) {
      if (draggedItem.type === 'book') {
        updateBook(draggedItem.id, { pipelineStage: stage });
      } else {
        updateKanbanTask(draggedItem.id, { pipelineStage: stage });
      }
    }
    setDraggedItem(null);
    setDragOverStage(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverStage(null);
  };

  const openAddTask = (stageId: PipelineStage) => {
    setModalMode('add');
    setNewTaskStage(stageId);
    setTaskTitle('');
    setTaskDescription('');
    setTaskAccountId(filterAccountId !== 'all' ? filterAccountId : (state.accounts[0]?.id || ''));
    setTaskColor('#a78bfa');
    setEditingTask(null);
    setIsModalOpen(true);
  };

  const openEditTask = (task: KanbanTask) => {
    setModalMode('edit');
    setEditingTask(task);
    setTaskTitle(task.title);
    setTaskDescription(task.description || '');
    setTaskAccountId(task.accountId);
    setTaskColor(task.color || '#a78bfa');
    setIsModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) return;

    if (modalMode === 'add' && newTaskStage) {
      addKanbanTask({
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        accountId: taskAccountId,
        color: taskColor,
        pipelineStage: newTaskStage,
      });
    } else if (modalMode === 'edit' && editingTask) {
      updateKanbanTask(editingTask.id, {
        title: taskTitle.trim(),
        description: taskDescription.trim() || undefined,
        accountId: taskAccountId,
        color: taskColor,
      });
    }
    setIsModalOpen(false);
  };

  const handleDeleteTask = () => {
    if (editingTask && window.confirm('Вы уверены, что хотите удалить эту задачу?')) {
      deleteKanbanTask(editingTask.id);
      setIsModalOpen(false);
    }
  };

  // Filter books
  const allBooks = state.books.filter(b => {
    if (filterAccountId !== 'all' && b.accountId !== filterAccountId) return false;
    return true;
  });

  const getStageBooks = (stageId: PipelineStage) => {
    return allBooks.filter(b => {
      const bookStage = b.pipelineStage || mapStatusToStage(b.status);
      return bookStage === stageId;
    });
  };

  const getStageTasks = (stageId: PipelineStage) => {
    return (state.kanbanTasks || []).filter(t => {
      if (filterAccountId !== 'all' && t.accountId !== filterAccountId) return false;
      return t.pipelineStage === stageId;
    });
  };

  // Map legacy status to pipeline stage for books that don't have pipelineStage set
  const mapStatusToStage = (status: string): PipelineStage => {
    switch (status) {
      case 'PLANNED': return 'idea';
      case 'IN_PROGRESS': return 'writing';
      case 'PUBLISHED': return 'promotion';
      default: return 'idea';
    }
  };

  return (
    <div className="p-3 sm:p-4 lg:p-6 h-full flex flex-col relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-500/10 rounded-xl flex items-center justify-center border border-violet-500/15">
            <Columns3 className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">Контент-план</h1>
            <p className="text-xs text-zinc-550">Перетаскивайте книги и задачи между стадиями</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={filterAccountId}
            onChange={(e) => setFilterAccountId(e.target.value)}
            className="bg-zinc-900/40 border border-zinc-900 rounded-lg px-3 py-1.5 text-xs text-zinc-400 outline-none focus:border-zinc-800 transition-colors cursor-pointer"
          >
            <option value="all">Все аккаунты</option>
            {state.accounts.map(acc => (
              <option key={acc.id} value={acc.id}>{acc.name}</option>
            ))}
          </select>

          <button
            onClick={() => openAddTask('idea')}
            className="flex items-center gap-1.5 bg-violet-600/15 hover:bg-violet-600/25 text-violet-400 border border-violet-500/10 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Добавить задачу</span>
          </button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-y-auto sm:overflow-x-auto sm:overflow-y-hidden">
        <div className="flex flex-col sm:flex-row gap-4 h-full sm:min-w-max pb-4">
          {PIPELINE_STAGES.map(stage => {
            const stageBooks = getStageBooks(stage.id);
            const stageTasks = getStageTasks(stage.id);
            const isDragOver = dragOverStage === stage.id && draggedItem !== null;

            return (
              <div
                key={stage.id}
                className={cn(
                  'flex flex-col w-full sm:w-56 rounded-xl border transition-all duration-200 shrink-0 overflow-hidden',
                  isDragOver
                    ? 'border-opacity-60 bg-opacity-10 scale-[1.01]'
                    : 'border-zinc-800/60 bg-zinc-900/10'
                )}
                style={{
                  borderColor: isDragOver ? stage.color : undefined,
                  backgroundColor: isDragOver ? `${stage.color}08` : undefined,
                }}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Column header */}
                <div className="px-3.5 py-3 border-b border-zinc-800/40 shrink-0 bg-zinc-900/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{stage.emoji}</span>
                      <span className="text-xs font-bold text-zinc-350">{stage.label}</span>
                    </div>
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md border"
                      style={{
                        color: stage.color,
                        backgroundColor: `${stage.color}12`,
                        borderColor: `${stage.color}25`,
                      }}
                    >
                      {stageBooks.length + stageTasks.length}
                    </span>
                  </div>
                </div>

                {/* Cards Container */}
                <div className="flex-1 flex sm:flex-col overflow-x-auto sm:overflow-x-visible overflow-y-hidden sm:overflow-y-auto p-2 gap-2 sm:gap-0 sm:space-y-2">
                  {stageBooks.length === 0 && stageTasks.length === 0 && !isDragOver && (
                    <div className="text-center py-4 sm:py-8 w-full">
                      <span className="text-[10px] text-zinc-700 italic">Перетащите сюда</span>
                    </div>
                  )}

                  {/* Books */}
                  {stageBooks.map(book => {
                    const account = state.accounts.find(a => a.id === book.accountId);
                    const chapters = state.chapters.filter(c => c.bookId === book.id);
                    const totalChars = book.canvasContent
                      ? (() => { const t = document.createElement('div'); t.innerHTML = book.canvasContent; return (t.innerText || t.textContent || '').length; })()
                      : chapters.reduce((sum, c) => sum + c.content.length, 0);
                    const isDragged = draggedItem?.id === book.id && draggedItem?.type === 'book';

                    return (
                      <div
                        key={book.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, book.id, 'book')}
                        onDragEnd={handleDragEnd}
                        onClick={() => onSelectBook(book.id)}
                        className={cn(
                          'group bg-zinc-900/40 border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md shrink-0 w-[240px] sm:w-auto',
                          isDragged ? 'opacity-30 border-dashed border-zinc-650' : 'border-zinc-800/50 hover:border-zinc-700'
                        )}
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: book.color || '#6366f1',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3 h-3 text-zinc-755 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                          <div className="flex-1 min-w-0">
                            {account && (
                              <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider truncate block">
                                {account.name.includes(':') ? account.name.split(':')[0].trim() : account.name}
                              </span>
                            )}
                            <h4 className="text-xs font-bold text-zinc-205 line-clamp-2 mt-0.5 leading-snug">
                              {book.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="flex items-center gap-0.5 text-[9px] text-zinc-550">
                                <FileText className="w-2.5 h-2.5" />
                                {(() => {
                                  if (!book.canvasContent) return chapters.length;
                                  const t = document.createElement('div');
                                  t.innerHTML = book.canvasContent;
                                  return t.querySelectorAll('h2').length;
                                })()} гл.
                              </span>
                              <span className="text-[9px] text-zinc-600 font-mono">
                                {totalChars > 1000 ? `${(totalChars / 1000).toFixed(0)}k` : totalChars} зн.
                              </span>
                            </div>
                          </div>
                        </div>

                        {book.coverPath && (
                          <div className="mt-2 rounded-md overflow-hidden h-16">
                            <img src={book.coverPath} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Independent Tasks */}
                  {stageTasks.map(task => {
                    const account = state.accounts.find(a => a.id === task.accountId);
                    const isDragged = draggedItem?.id === task.id && draggedItem?.type === 'task';

                    return (
                      <div
                        key={task.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, task.id, 'task')}
                        onDragEnd={handleDragEnd}
                        onClick={() => openEditTask(task)}
                        className={cn(
                          'group bg-zinc-900/25 border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md relative overflow-hidden shrink-0 w-[240px] sm:w-auto',
                          isDragged ? 'opacity-30 border-dashed border-zinc-650' : 'border-zinc-850 hover:border-zinc-750'
                        )}
                        style={{
                          borderLeftWidth: '3px',
                          borderLeftColor: task.color || '#a78bfa',
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3 h-3 text-zinc-755 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              {account && (
                                <span className="text-[8px] font-bold text-zinc-600 uppercase tracking-wider truncate block">
                                  {account.name.includes(':') ? account.name.split(':')[0].trim() : account.name}
                                </span>
                              )}
                              <span className="text-[8px] font-extrabold px-1 rounded uppercase tracking-wider text-violet-400 bg-violet-500/5 border border-violet-500/10 shrink-0">
                                Задача
                              </span>
                            </div>
                            <h4 className="text-xs font-bold text-zinc-205 line-clamp-2 mt-1 leading-snug">
                              {task.title}
                            </h4>
                            {task.description && (
                              <p className="text-[10px] text-zinc-550 line-clamp-2 mt-1.5 leading-normal italic">
                                {task.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Creation & Editing Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <form
            onSubmit={handleSaveTask}
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-6 relative motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-200"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-zinc-150">
                {modalMode === 'add' ? 'Новая задача' : 'Редактировать задачу'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Title input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Название</label>
                <input
                  type="text"
                  required
                  placeholder="Купить рекламу, составить синопсис..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/10 transition-all"
                  autoFocus
                />
              </div>

              {/* Description input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Описание (опционально)</label>
                <textarea
                  placeholder="Добавьте детали..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  rows={3}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 outline-none focus:border-violet-500/30 focus:ring-1 focus:ring-violet-500/10 transition-all resize-none"
                />
              </div>

              {/* Account select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Аккаунт</label>
                <select
                  value={taskAccountId}
                  onChange={(e) => setTaskAccountId(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-400 outline-none focus:border-violet-500/30 transition-colors cursor-pointer"
                >
                  {state.accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>

              {/* Color dots */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Цвет метки</label>
                <div className="grid grid-cols-9 gap-1.5 pt-1">
                  {PRESET_TASK_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setTaskColor(c)}
                      className={cn(
                        "w-6 h-6 rounded-full border transition-all hover:scale-110",
                        taskColor === c ? "border-white scale-110 shadow-md ring-1 ring-violet-500/20" : "border-transparent"
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 mt-8">
              {modalMode === 'edit' && (
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  className="px-4 py-3.5 bg-red-650/10 border border-red-500/10 hover:bg-red-600/20 text-red-400 rounded-2xl font-semibold text-xs transition-all flex items-center gap-1.5"
                  title="Удалить задачу"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить
                </button>
              )}
              <div className="flex gap-3 flex-1 justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-3.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-350 rounded-2xl font-semibold text-xs transition-all"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="px-5 py-3.5 bg-emerald-650 hover:bg-emerald-700 text-white rounded-2xl font-semibold text-xs transition-all shadow-lg shadow-emerald-950/20"
                >
                  {modalMode === 'add' ? 'Создать' : 'Сохранить'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
