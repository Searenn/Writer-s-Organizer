import { ArrowDownRight, ExternalLink, GripVertical, Image, Link, Music, Palette, Play, Plus, Trash2, Type, X, LayoutGrid } from 'lucide-react';
import React, { useCallback, useRef, useState, useEffect } from 'react';
import { useAppStore } from '../store';
import { MoodBoardItem } from '../types';
import { cn } from '../utils';

type AddMode = 'image' | 'color' | 'link' | 'text' | null;

// ---- Smart Link Helpers ----

function getYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/,
    /youtube\.com\/embed\/([\w-]{11})/,
    /youtube\.com\/shorts\/([\w-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function getSpotifyEmbed(url: string): string | null {
  const m = url.match(/open\.spotify\.com\/(track|album|playlist|artist)\/([\w]+)/);
  if (m) return `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0`;
  return null;
}

function isEmbeddableLink(url: string): boolean {
  return !!getYouTubeId(url) || !!getSpotifyEmbed(url);
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0];
  }
}

function getFaviconUrl(url: string): string {
  const domain = getDomain(url);
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#1e293b',
  '#334155', '#475569', '#64748b', '#94a3b8', '#e2e8f0', '#f8fafc',
];

export const MoodBoardTab: React.FC<{ bookId: string }> = ({ bookId }) => {
  const { state, addMoodBoardItem, updateMoodBoardItem, updateMoodBoardItems, deleteMoodBoardItem } = useAppStore();
  const items = (state.moodBoardItems || [])
    .filter(m => m.bookId === bookId)
    .sort((a, b) => a.order - b.order);

  const [addMode, setAddMode] = useState<AddMode>(null);
  const [formContent, setFormContent] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Free layout states
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ id: string; x: number; y: number } | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [activeResize, setActiveResize] = useState<{ id: string; width: number; height: number } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  // Bring dynamic z-index layering to the front
  const bringToFront = useCallback((itemId: string) => {
    if (items.length <= 1) return;
    const currentItem = items.find(i => i.id === itemId);
    if (!currentItem) return;

    const maxOrder = Math.max(...items.map(i => i.order || 0));
    if (currentItem.order < maxOrder) {
      updateMoodBoardItem(itemId, { order: maxOrder + 1 });
    }
  }, [items, updateMoodBoardItem]);

  // Helper to find position for newly added cards so they don't overlap
  const getNewItemPosition = useCallback(() => {
    const margin = 20;
    if (items.length === 0) return { x: margin, y: margin };

    let maxY = 0;
    items.forEach(item => {
      const y = item.y !== undefined ? item.y : 0;
      const h = item.height || 200;
      if (y + h > maxY) {
        maxY = y + h;
      }
    });

    return { x: margin, y: maxY + margin };
  }, [items]);

  // Automated masonry grid sorting logic
  const handleSortBlocks = useCallback(() => {
    if (!gridRef.current || items.length === 0) return;
    const containerWidth = gridRef.current.clientWidth || 1000;
    const gap = 16;
    const colWidth = 280;
    const numCols = Math.max(1, Math.floor((containerWidth + gap) / (colWidth + gap)));
    const colHeights = new Array(numCols).fill(0);

    const updates: { id: string; updates: Partial<MoodBoardItem> }[] = [];

    items.forEach((item, index) => {
      let w = colWidth;
      let h = 200; // Default

      if (item.type === 'color') {
        w = colWidth;
        h = 100;
      } else if (item.type === 'text') {
        w = colWidth;
        // ~30 chars per line, line height 18px, padding 50px
        const textLen = item.content.length;
        const lines = Math.ceil(textLen / 30);
        h = Math.max(120, Math.min(600, lines * 18 + 50 + (item.label ? 40 : 0)));
      } else if (item.type === 'image') {
        w = colWidth;
        h = 240;
        if (item.label) h += 40;
      } else if (item.type === 'link') {
        w = colWidth;
        const isEmbed = isEmbeddableLink(item.content);
        if (isEmbed) {
          h = 220; // embeds
        } else {
          h = 130; // regular link card
        }
        if (item.label) h += 40;
      }

      // Find the column with the minimum height
      let minCol = 0;
      let minHeight = colHeights[0];
      for (let i = 1; i < numCols; i++) {
        if (colHeights[i] < minHeight) {
          minHeight = colHeights[i];
          minCol = i;
        }
      }

      const x = minCol * (colWidth + gap);
      const y = colHeights[minCol];

      updates.push({
        id: item.id,
        updates: { x, y, width: w, height: h, order: index }
      });

      colHeights[minCol] += h + gap;
    });

    updateMoodBoardItems(updates);
  }, [items, updateMoodBoardItems]);

  // Self-healing: if any items don't have position/size coordinates, trigger sort automatically
  useEffect(() => {
    const needsSorting = items.some(i => i.x === undefined || i.y === undefined || !i.width || !i.height);
    if (needsSorting && items.length > 0) {
      handleSortBlocks();
    }
  }, [items, handleSortBlocks]);

  const handleDragStart = useCallback((e: React.MouseEvent, item: MoodBoardItem) => {
    const target = e.target as HTMLElement;

    // For YouTube/Spotify embeds, dragging is restricted strictly to the invisible top header zone
    const isEmbed = item.type === 'link' && isEmbeddableLink(item.content);
    if (isEmbed && !target.closest('.drag-handle')) {
      return;
    }

    // Don't drag if clicking buttons, inputs, links, or the resize handle
    if (
      target.closest('button') || 
      target.closest('a') || 
      target.closest('input') || 
      target.closest('.resize-handle')
    ) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const currentX = item.x !== undefined ? item.x : 20;
    const currentY = item.y !== undefined ? item.y : 20;

    setDraggingId(item.id);

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const newX = Math.max(0, currentX + dx);
      const newY = Math.max(0, currentY + dy);

      setActiveDrag({ id: item.id, x: newX, y: newY });
    };

    const handleMouseUp = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const newX = Math.max(0, currentX + dx);
      const newY = Math.max(0, currentY + dy);

      updateMoodBoardItem(item.id, { x: newX, y: newY });
      setDraggingId(null);
      setActiveDrag(null);

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateMoodBoardItem]);

  const handleResizeStart = useCallback((e: React.MouseEvent, item: MoodBoardItem) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const currentW = item.width || 280;
    const currentH = item.height || 200;

    setResizingId(item.id);
    document.body.style.cursor = 'se-resize';

    const handleMouseMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const newW = Math.max(150, currentW + dx);
      const newH = Math.max(80, currentH + dy);

      setActiveResize({ id: item.id, width: newW, height: newH });
    };

    const handleMouseUp = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;

      const newW = Math.max(150, currentW + dx);
      const newH = Math.max(80, currentH + dy);

      updateMoodBoardItem(item.id, { width: newW, height: newH });
      setResizingId(null);
      setActiveResize(null);
      document.body.style.cursor = '';

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [updateMoodBoardItem]);

  const handleAddItem = (type: 'color' | 'link' | 'text' | 'image') => {
    if (!formContent.trim()) return;
    const pos = getNewItemPosition();
    let w = 280;
    let h = 200;

    if (type === 'color') {
      w = 150;
      h = 100;
    } else if (type === 'text') {
      w = 280;
      const lines = Math.ceil(formContent.length / 30);
      h = Math.max(120, lines * 18 + 50 + (formLabel ? 40 : 0));
    } else if (type === 'link') {
      w = 280;
      const isEmbed = isEmbeddableLink(formContent.trim());
      h = isEmbed ? 220 : 130;
      if (formLabel) h += 40;
    } else if (type === 'image') {
      w = 280;
      h = 240;
      if (formLabel) h += 40;
    }

    addMoodBoardItem({
      bookId,
      type,
      content: formContent.trim(),
      label: formLabel || undefined,
      order: items.length,
      width: w,
      height: h,
      x: pos.x,
      y: pos.y,
    });
    resetForm();
  };

  const resetForm = () => {
    setAddMode(null);
    setFormContent('');
    setFormLabel('');
    setEditingId(null);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteMoodBoardItem(id);
  };

  const handleEditLabel = (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    const newLabel = prompt('Подпись:', item.label || '');
    if (newLabel !== null) {
      updateMoodBoardItem(id, { label: newLabel || undefined });
    }
  };

  const maxCanvasHeight = items.reduce((max, item) => {
    const h = item.height || 200;
    const y = item.y || 0;
    return Math.max(max, y + h);
  }, 500);

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <Palette className="w-5 h-5 text-pink-400" />
          <h2 className="text-lg font-bold text-zinc-100">Mood Board</h2>
          <span className="text-xs text-zinc-500">{items.length} элементов</span>
        </div>

        {/* Add buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleSortBlocks}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/40 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-semibold hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Сортировать
          </button>
          <button
            onClick={() => { resetForm(); setAddMode('image'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-600/10 border border-pink-500/15 text-pink-400 rounded-lg text-xs font-semibold hover:bg-pink-600/20 transition-colors cursor-pointer"
          >
            <Image className="w-3.5 h-3.5" />
            Фото
          </button>
          <button
            onClick={() => { resetForm(); setAddMode('color'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/40 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-semibold hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
            Цвет
          </button>
          <button
            onClick={() => { resetForm(); setAddMode('link'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/40 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-semibold hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Link className="w-3.5 h-3.5" />
            Ссылка
          </button>
          <button
            onClick={() => { resetForm(); setAddMode('text'); }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900/40 border border-zinc-800 text-zinc-400 rounded-lg text-xs font-semibold hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <Type className="w-3.5 h-3.5" />
            Текст
          </button>
        </div>
      </div>

      {/* Add form for color/link/text/image */}
      {addMode && (addMode === 'color' || addMode === 'link' || addMode === 'text' || addMode === 'image') && (
        <div className="mb-6 bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-zinc-300">
              {addMode === 'color' ? 'Добавить цвет палитры' : addMode === 'link' ? 'Добавить ссылку' : addMode === 'image' ? 'Добавить изображение по ссылке' : 'Добавить текстовую заметку'}
            </span>
            <button onClick={resetForm} className="text-zinc-500 hover:text-zinc-300 p-1">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {addMode === 'color' ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormContent(c)}
                    className={cn(
                      'w-8 h-8 rounded-lg border-2 transition-all hover:scale-110',
                      formContent === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={formContent || '#6366f1'}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent"
                />
                <input
                  type="text"
                  value={formLabel}
                  onChange={(e) => setFormLabel(e.target.value)}
                  placeholder="Подпись (опционально)..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-pink-500/30"
                />
                <button
                  onClick={() => handleAddItem('color')}
                  disabled={!formContent}
                  className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition-colors disabled:opacity-30"
                >
                  Добавить
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {addMode === 'image' ? (
                <input
                  type="url"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Ссылка на изображение (https://...)"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-pink-500/30"
                  autoFocus
                />
              ) : addMode === 'link' ? (
                <input
                  type="url"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-pink-500/30"
                  autoFocus
                />
              ) : (
                <input
                  type="text"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Атмосфера, настроение, идея..."
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-pink-500/30"
                  autoFocus
                />
              )}
              <input
                type="text"
                value={formLabel}
                onChange={(e) => setFormLabel(e.target.value)}
                placeholder="Подпись..."
                className="w-36 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-300 outline-none focus:border-pink-500/30"
              />
              <button
                onClick={() => handleAddItem(addMode)}
                disabled={!formContent.trim()}
                className="px-3 py-1.5 bg-pink-600 text-white rounded-lg text-xs font-semibold hover:bg-pink-700 transition-colors disabled:opacity-30"
              >
                Добавить
              </button>
            </div>
          )}
        </div>
      )}

      {/* Mood Board Canvas */}
      {items.length === 0 ? (
        <div className="bg-zinc-950/20 border border-dashed border-zinc-900 rounded-2xl p-16 text-center mt-8 animate-in fade-in duration-300">
          <Palette className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-sm text-zinc-400 font-medium mb-1">Mood Board пуст</p>
          <p className="text-xs text-zinc-600">Добавьте изображения, цвета палитры, ссылки и заметки для вдохновения.</p>
        </div>
      ) : (
        <div
          ref={gridRef}
          className="relative w-full rounded-2xl border border-zinc-800/40 bg-zinc-950/5 p-4 overflow-hidden mt-8"
          style={{ minHeight: '600px', height: `${maxCanvasHeight + 80}px` }}
        >
          {items.map(item => {
            const { x: itemX, y: itemY, w: itemW, h: itemH } = (() => {
              let x = item.x !== undefined ? item.x : 20;
              let y = item.y !== undefined ? item.y : 20;
              let w = item.width || 280;
              let h = item.height || 200;

              if (activeDrag && activeDrag.id === item.id) {
                x = activeDrag.x;
                y = activeDrag.y;
              }
              if (activeResize && activeResize.id === item.id) {
                w = activeResize.width;
                h = activeResize.height;
              }
              return { x, y, w, h };
            })();

            return (
              <div
                key={item.id}
                onMouseDown={(e) => {
                  bringToFront(item.id);
                  handleDragStart(e, item);
                }}
                onDoubleClick={() => handleEditLabel(item.id)}
                className={cn(
                  'group absolute rounded-xl overflow-hidden border bg-zinc-900/90 shadow-md backdrop-blur-sm select-none',
                  (draggingId === item.id || resizingId === item.id)
                    ? 'z-50 ring-2 ring-pink-500/40 border-pink-500 shadow-xl cursor-grabbing'
                    : 'transition-all duration-200 border-zinc-800/50 hover:border-zinc-700 cursor-grab'
                )}
                style={{
                  left: `${itemX}px`,
                  top: `${itemY}px`,
                  width: `${itemW}px`,
                  height: `${itemH}px`,
                }}
              >
                {/* Delete button (absolute top-2 right-2) */}
                <button
                  onClick={(e) => handleDelete(item.id, e)}
                  className="absolute top-2 right-2 z-20 p-1 bg-zinc-950/80 border border-zinc-800 text-zinc-500 hover:text-red-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Invisible drag handle overlay at the top (32px high) */}
                <div className="drag-handle absolute top-0 left-0 right-0 h-8 z-10 cursor-grab active:cursor-grabbing bg-transparent" />

                {/* Content area taking full width and height */}
                <div className="w-full h-full relative overflow-hidden">
                  {item.type === 'image' && (
                    <div className="w-full h-full">
                      <img
                        src={item.content}
                        alt={item.label || 'Mood board image'}
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-350 pointer-events-none"
                      />
                    </div>
                  )}

                  {item.type === 'color' && (
                    <div
                      className="w-full h-full flex items-center justify-center pointer-events-none"
                      style={{ backgroundColor: item.content }}
                    >
                      <span className="text-[10px] font-mono font-bold text-white/60 opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg">
                        {item.content.toUpperCase()}
                      </span>
                    </div>
                  )}

                  {item.type === 'link' && (() => {
                    const ytId = getYouTubeId(item.content);
                    const spotifyEmbed = getSpotifyEmbed(item.content);

                    // YouTube embed
                    if (ytId) {
                      return (
                        <div className="w-full h-full">
                          <iframe
                            src={`https://www.youtube.com/embed/${ytId}`}
                            title={item.label || 'YouTube video'}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className={cn(
                              "w-full h-full",
                              (draggingId || resizingId) && "pointer-events-none"
                            )}
                            style={{ border: 0 }}
                          />
                        </div>
                      );
                    }

                    // Spotify embed
                    if (spotifyEmbed) {
                      return (
                        <div className="w-full h-full">
                          <iframe
                            src={spotifyEmbed}
                            title={item.label || 'Spotify'}
                            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                            loading="lazy"
                            className={cn(
                              "w-full h-full",
                              (draggingId || resizingId) && "pointer-events-none"
                            )}
                            style={{ border: 0 }}
                          />
                        </div>
                      );
                    }

                    // Regular link with favicon preview
                    return (
                      <a
                        href={item.content}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-full flex flex-col items-center justify-center bg-zinc-900/40 p-4 gap-3 hover:bg-zinc-900/60 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-zinc-800 flex items-center justify-center border border-zinc-700/50 shadow-sm animate-pulse">
                          <img
                            src={getFaviconUrl(item.content)}
                            alt=""
                            className="w-5 h-5 pointer-events-none"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                          />
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] text-blue-400/90 font-semibold block truncate max-w-[150px]">
                            {getDomain(item.content)}
                          </span>
                          <span className="text-[9px] text-zinc-600 flex items-center gap-0.5 justify-center mt-1">
                            <ExternalLink className="w-2.5 h-2.5" />
                            Открыть
                          </span>
                        </div>
                      </a>
                    );
                  })()}

                  {item.type === 'text' && (
                    <div className="w-full h-full flex items-center justify-center bg-zinc-900/40 p-4 overflow-y-auto">
                      <p className="text-xs text-zinc-305 text-center leading-relaxed italic">
                        «{item.content}»
                      </p>
                    </div>
                  )}

                  {/* Label overlay */}
                  {item.label && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 py-2 pr-8 pointer-events-none">
                      <span className="text-[10px] font-semibold text-white/80 line-clamp-1">{item.label}</span>
                    </div>
                  )}
                </div>

                {/* Resize handle */}
                <div
                  onMouseDown={(e) => handleResizeStart(e, item)}
                  className="resize-handle absolute bottom-0 right-0 w-6 h-6 flex items-center justify-center cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 bg-zinc-950/60 backdrop-blur-sm rounded-tl-lg border-t border-l border-zinc-700/50"
                  title="Потяните для изменения размера"
                >
                  <ArrowDownRight className="w-3.5 h-3.5 text-zinc-400" />
                </div>

                {/* Size indicator while resizing */}
                {resizingId === item.id && (
                  <div className="absolute top-2 left-2 z-20 bg-pink-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-lg animate-fade-in">
                    {itemW}px × {itemH}px
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
