import { Bold, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, FileText, Heading, Highlighter, Italic, Replace, Search, Strikethrough, Type, Underline, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef, useMemo } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';

export type CanvasChapter = {
    id: string;       // unique id based on index
    title: string;    // heading text
    level: number;    // 1-6
    charCount: number; // characters in this chapter's content
};

type Props = {
    bookId: string;
    viewMode: 'single' | 'all';
    selectedChapterIndex: number | null;
    onChaptersChange: (chapters: CanvasChapter[]) => void;
    onActiveChapterChange?: (index: number | null) => void;
    contentType?: 'chapters' | 'characters' | 'annotation' | 'short_description' | 'chapter_plan';
};

export type CanvasRichEditorHandle = {
    scrollToChapter: (index: number) => void;
};

const HEADING_TAG = 'H2';
const HEADING_SELECTOR = 'h2';

// ─── Fast regex-based chapter parsing (no DOM) ─────────────────────────────

/** Strip HTML tags and decode common entities — pure string ops */
function fastStripHtml(html: string): string {
    let text = html.replace(/<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]*>/g, '');
    text = text
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#039;/gi, "'")
        .replace(/&apos;/gi, "'")
        .replace(/&nbsp;/gi, ' ')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
    return text;
}

/** Split full HTML into chapter HTML fragments by h2 headings */
export function splitHtmlIntoChapters(html: string): string[] {
    if (!html) return [];
    // Split on <h2...> tags, keeping the delimiter
    const parts = html.split(/(?=<h2[\s>])/i);
    const chapters: string[] = [];
    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        // Only include parts that start with an h2 heading
        if (/^<h2[\s>]/i.test(trimmed)) {
            chapters.push(trimmed);
        } else if (chapters.length > 0) {
            // Content after last chapter that doesn't start with h2 — append to last chapter
            chapters[chapters.length - 1] += trimmed;
        }
        // Content before first h2 is discarded (or kept as preamble if needed)
    }
    return chapters;
}

/** Parse headings from an HTML string — fast regex version */
export function parseChaptersFromHtml(html: string): CanvasChapter[] {
    const chapterHtmls = splitHtmlIntoChapters(html);
    return chapterHtmls.map((chHtml, idx) => {
        const titleMatch = chHtml.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        const title = titleMatch ? fastStripHtml(titleMatch[1]).trim() || 'Без названия' : 'Без названия';
        const charCount = fastStripHtml(chHtml).length;
        return {
            id: `ch-${idx}`,
            title,
            level: 1,
            charCount,
        };
    });
}

/** Parse headings from a live DOM element */
function parseChaptersFromElement(el: HTMLElement): CanvasChapter[] {
    const chapters: CanvasChapter[] = [];
    const headings = Array.from(el.querySelectorAll(HEADING_SELECTOR));

    headings.forEach((heading, idx) => {
        const title = heading.textContent?.trim() || 'Без названия';
        const level = 1;
        const nextHeading = headings[idx + 1] || null;

        const range = document.createRange();
        range.setStartBefore(heading);
        if (nextHeading) {
            range.setEndBefore(nextHeading);
        } else {
            range.setEnd(el, el.childNodes.length);
        }

        const fragment = range.cloneContents();
        const charCount = (fragment.textContent || '').length;

        chapters.push({
            id: `ch-${idx}`,
            title,
            level,
            charCount,
        });
    });

    return chapters;
}

/** Extract the HTML fragment for a single chapter (heading + content until next heading) */
function extractChapterHtml(fullHtml: string, chapterIndex: number): string {
    const chapters = splitHtmlIntoChapters(fullHtml);
    if (chapterIndex < 0 || chapterIndex >= chapters.length) return '';
    return chapters[chapterIndex];
}

/** Replace the chapter's HTML in the full canvas content */
function replaceChapterHtml(fullHtml: string, chapterIndex: number, newChapterHtml: string): string {
    const chapters = splitHtmlIntoChapters(fullHtml);
    if (chapterIndex < 0 || chapterIndex >= chapters.length) return fullHtml;
    chapters[chapterIndex] = newChapterHtml;
    return chapters.join('');
}

/** Reorder chapters: move chapter at fromIndex to toIndex */
export function reorderChapterHtml(fullHtml: string, fromIndex: number, toIndex: number): string {
    if (fromIndex === toIndex) return fullHtml;
    const chapters = splitHtmlIntoChapters(fullHtml);
    if (fromIndex < 0 || fromIndex >= chapters.length || toIndex < 0 || toIndex >= chapters.length) {
        return fullHtml;
    }
    const [moved] = chapters.splice(fromIndex, 1);
    chapters.splice(toIndex, 0, moved);
    return chapters.join('');
}

/** Delete a chapter/character fragment from HTML */
export function deleteChapterHtml(fullHtml: string, chapterIndex: number): string {
    const chapters = splitHtmlIntoChapters(fullHtml);
    if (chapterIndex < 0 || chapterIndex >= chapters.length) return fullHtml;
    chapters.splice(chapterIndex, 1);
    return chapters.join('');
}

/** Build initial HTML from legacy characters */
function migrateCharactersToHtml(characters: any[]): string {
    return characters.map(c => {
        const titleHtml = `<h2>${escapeHtml(c.name)}</h2>`;
        const aliasHtml = c.aliases ? `<div>Псевдонимы: ${escapeHtml(c.aliases)}</div>` : '';
        const descLines = (c.description || '').split('\n');
        const descHtml = descLines
            .map((line: string) => line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>')
            .join('');
        return titleHtml + aliasHtml + descHtml;
    }).join('');
}

/** Build initial HTML from legacy chapters */
function migrateChaptersToHtml(chapters: { title: string; content: string }[]): string {
    return chapters.map(c => {
        const titleHtml = `<h2>${escapeHtml(c.title)}</h2>`;
        const contentLines = c.content.split('\n');
        const contentHtml = contentLines
            .map(line => line.trim() ? `<div>${escapeHtml(line)}</div>` : '<div><br></div>')
            .join('');
        return titleHtml + contentHtml;
    }).join('');
}

function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Ensure chapter HTML keeps its heading. In single mode, if the user deletes
 * the heading, we must restore it to prevent chapter-index shifts.
 */
function ensureChapterHeading(chapterHtml: string, fullHtml: string, chapterIndex: number): string {
    const hasHeading = /<h[1-6][^>]*>/i.test(chapterHtml);
    if (hasHeading) return chapterHtml;

    const originalChapter = extractChapterHtml(fullHtml, chapterIndex);
    const match = originalChapter.match(/<h2[^>]*>[\s\S]*?<\/h2>/i);
    const headingTag = match ? match[0] : '<h2>Без названия</h2>';

    const stripped = chapterHtml.replace(/<br\s*\/?>/gi, '').replace(/<div>\s*<\/div>/gi, '').trim();
    if (!stripped) {
        return headingTag + '<div><br></div>';
    }

    return headingTag + chapterHtml;
}

// ─── Virtualized Chapter Block ─────────────────────────────────────────────

type VirtualChapterProps = {
    index: number;
    html: string;
    isVisible: boolean;
    cachedHeight: number | null;
    editorFontSize: number;
    editorFontFamily: string;
    editorLineHeight: string;
    headingStyles: string;
    onInput: (index: number, html: string) => void;
    onHeightMeasured: (index: number, height: number) => void;
    onFocusRequest: (index: number, position: 'start' | 'end') => void;
    onPaste: (e: React.ClipboardEvent, index: number) => void;
    registerRef: (index: number, el: HTMLDivElement | null) => void;
    observerRef: React.RefObject<IntersectionObserver | null>;
};

const VirtualChapterBlock = React.memo(forwardRef<HTMLDivElement, VirtualChapterProps>(({
    index,
    html,
    isVisible,
    cachedHeight,
    editorFontSize,
    editorFontFamily,
    editorLineHeight,
    headingStyles,
    onInput,
    onHeightMeasured,
    onFocusRequest,
    onPaste,
    registerRef,
    observerRef,
}, _ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<HTMLDivElement>(null);
    const isEditingRef = useRef(false);
    const htmlRef = useRef(html);

    // Update htmlRef when html prop changes (from external updates)
    useEffect(() => {
        htmlRef.current = html;
    }, [html]);

    // Observe this block for intersection
    useEffect(() => {
        const container = containerRef.current;
        const observer = observerRef.current;
        if (!container || !observer) return;
        observer.observe(container);
        return () => observer.unobserve(container);
    }, [observerRef]);

    // Set content when becoming visible or when html changes externally
    useEffect(() => {
        if (isVisible && editorRef.current) {
            if (!isEditingRef.current) {
                editorRef.current.innerHTML = html;
            }
            // Measure height after render
            requestAnimationFrame(() => {
                if (containerRef.current) {
                    onHeightMeasured(index, containerRef.current.offsetHeight);
                }
            });
        }
    }, [isVisible, html, index, onHeightMeasured]);

    // Register ref for parent access
    useEffect(() => {
        registerRef(index, editorRef.current);
        return () => registerRef(index, null);
    }, [index, registerRef]);

    const handleInput = useCallback(() => {
        isEditingRef.current = true;
        if (editorRef.current) {
            const newHtml = editorRef.current.innerHTML;
            htmlRef.current = newHtml;
            onInput(index, newHtml);
        }
        // Measure height after content change
        requestAnimationFrame(() => {
            if (containerRef.current) {
                onHeightMeasured(index, containerRef.current.offsetHeight);
            }
        });
    }, [index, onInput, onHeightMeasured]);

    const handleBlur = useCallback(() => {
        isEditingRef.current = false;
    }, []);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (!editorRef.current) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        if (e.key === 'ArrowUp' || (e.key === 'ArrowLeft' && range.collapsed)) {
            // Check if cursor is at the very start
            const editorEl = editorRef.current;
            const isAtStart = range.collapsed &&
                range.startOffset === 0 &&
                (range.startContainer === editorEl ||
                 range.startContainer === editorEl.firstChild ||
                 (range.startContainer.nodeType === Node.TEXT_NODE &&
                  (range.startContainer.parentNode as Node | null) === editorEl.firstChild));

            if (isAtStart && index > 0) {
                e.preventDefault();
                onFocusRequest(index - 1, 'end');
            }
        } else if (e.key === 'ArrowDown' || (e.key === 'ArrowRight' && range.collapsed)) {
            // Check if cursor is at the very end
            const editorEl = editorRef.current;
            const lastChild = editorEl.lastChild;
            const isAtEnd = range.collapsed && (
                (range.startContainer === editorEl && range.startOffset === editorEl.childNodes.length) ||
                (range.startContainer === lastChild && range.startOffset === (lastChild?.textContent?.length || 0)) ||
                (range.startContainer.nodeType === Node.TEXT_NODE &&
                 (range.startContainer.parentNode as Node | null) === lastChild &&
                 range.startOffset === (range.startContainer.textContent?.length || 0))
            );

            if (isAtEnd) {
                e.preventDefault();
                onFocusRequest(index + 1, 'start');
            }
        }
    }, [index, onFocusRequest]);

    const handlePaste = useCallback((e: React.ClipboardEvent) => {
        onPaste(e, index);
        // Re-measure after paste
        requestAnimationFrame(() => {
            if (containerRef.current) {
                onHeightMeasured(index, containerRef.current.offsetHeight);
            }
            if (editorRef.current) {
                htmlRef.current = editorRef.current.innerHTML;
                onInput(index, editorRef.current.innerHTML);
            }
        });
    }, [index, onPaste, onHeightMeasured, onInput]);

    if (!isVisible) {
        return (
            <div
                ref={containerRef}
                data-chapter-index={index}
                style={{ height: cachedHeight ? `${cachedHeight}px` : '80px', minHeight: '40px' }}
                className="bg-transparent"
            />
        );
    }

    return (
        <div ref={containerRef} data-chapter-index={index}>
            <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleInput}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                style={{
                    fontSize: `${editorFontSize}px`,
                    fontFamily: editorFontFamily || 'inherit',
                    lineHeight: editorLineHeight
                }}
                className={cn(
                    "outline-none text-zinc-200 font-sans font-normal leading-relaxed text-base",
                    headingStyles
                )}
                spellCheck={true}
            />
        </div>
    );
}));
VirtualChapterBlock.displayName = 'VirtualChapterBlock';


// ─── Main Editor Component ─────────────────────────────────────────────────

export const CanvasRichEditor = forwardRef<CanvasRichEditorHandle, Props>(({ bookId, viewMode, selectedChapterIndex, onChaptersChange, onActiveChapterChange, contentType = 'chapters' }, ref) => {
    const { state, updateBook, syncCharactersFromHtml } = useAppStore();
    const book = state.books.find(b => b.id === bookId);
    const chapters = state.chapters.filter(c => c.bookId === bookId).sort((a, b) => a.order - b.order);

    const contentField =
        contentType === 'characters' ? 'charactersCanvasContent' as const :
        contentType === 'annotation' ? 'description' as const :
        contentType === 'short_description' ? 'shortDescription' as const :
        contentType === 'chapter_plan' ? 'chapterPlan' as const :
        'canvasContent' as const;

    // Single-mode editor ref (kept as before)
    const singleEditorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isEditing = useRef(false);
    const lastBookId = useRef<string | null>(null);
    const lastViewMode = useRef<string>('all');
    const lastChapterIdx = useRef<number | null>(null);
    const canvasContentRef = useRef<string>(book?.[contentField] || '');
    const [copiedType, setCopiedType] = useState<string | null>(null);

    // ── Virtualized chapter state (all mode) ──────────────────────────────
    const chapterHtmlsRef = useRef<string[]>([]);
    const [chapterHtmls, setChapterHtmls] = useState<string[]>([]);
    const [visibleChapters, setVisibleChapters] = useState<Set<number>>(new Set());
    const chapterHeightsRef = useRef<Record<number, number>>({});
    const chapterEditorRefs = useRef<Record<number, HTMLDivElement | null>>({});
    const observerRef = useRef<IntersectionObserver | null>(null);
    const saveTimeoutRef = useRef<any>(null);
    const chapterDirtyRef = useRef<Set<number>>(new Set());

    const [showToolbar, setShowToolbar] = useState(() => {
        try {
            return localStorage.getItem('pisaka-editor-toolbar-visible') !== 'false';
        } catch {
            return true;
        }
    });

    const toggleToolbar = () => {
        const newValue = !showToolbar;
        setShowToolbar(newValue);
        try {
            localStorage.setItem('pisaka-editor-toolbar-visible', String(newValue));
        } catch {}
    };

    // Zoom font size via Ctrl + Wheel
    const [editorFontSize, setEditorFontSize] = useState(() => {
        try {
            return parseInt(localStorage.getItem('pisaka-editor-fontsize') || '16', 10);
        } catch {
            return 16;
        }
    });

    const [editorFontFamily, setEditorFontFamily] = useState(() => {
        return localStorage.getItem('pisaka-editor-fontfamily') || '';
    });

    const [editorLineHeight, setEditorLineHeight] = useState(() => {
        return localStorage.getItem('pisaka-editor-lineheight') || '1.6';
    });

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleWheel = (e: WheelEvent) => {
            if (e.ctrlKey) {
                e.preventDefault();
                setEditorFontSize(prev => {
                    const delta = e.deltaY < 0 ? 1 : -1;
                    const next = Math.min(36, Math.max(12, prev + delta));
                    localStorage.setItem('pisaka-editor-fontsize', String(next));
                    return next;
                });
            }
        };

        container.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            container.removeEventListener('wheel', handleWheel);
        };
    }, []);

    // Search state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const isSearchActive = useRef(false);
    // Replace state
    const [replaceText, setReplaceText] = useState('');
    const [isReplaceMode, setIsReplaceMode] = useState(false);
    const replaceInputRef = useRef<HTMLInputElement>(null);

    // Sync the ref whenever book content changes
    useEffect(() => {
        canvasContentRef.current = book?.[contentField] || '';
    }, [book?.[contentField], contentField]);

    // ── IntersectionObserver setup ──────────────────────────────────────────
    useEffect(() => {
        if (viewMode !== 'all') return;

        const observer = new IntersectionObserver(
            (entries) => {
                setVisibleChapters(prev => {
                    const next = new Set(prev);
                    for (const entry of entries) {
                        const el = entry.target as HTMLElement;
                        const idx = parseInt(el.dataset.chapterIndex || '-1', 10);
                        if (idx < 0) continue;
                        if (entry.isIntersecting) {
                            next.add(idx);
                        } else {
                            next.delete(idx);
                        }
                    }
                    // Check if sets are equal to avoid unnecessary re-renders
                    if (next.size === prev.size && [...next].every(v => prev.has(v))) {
                        return prev;
                    }
                    return next;
                });
            },
            {
                root: scrollContainerRef.current,
                rootMargin: '1200px 0px', // Pre-load chapters 1200px above/below viewport
                threshold: 0,
            }
        );

        observerRef.current = observer;
        return () => {
            observer.disconnect();
            observerRef.current = null;
        };
    }, [viewMode, bookId]);

    // ── Load content into editor ──────────────────────────────────────────
    useEffect(() => {
        const bookChanged = lastBookId.current !== bookId;
        const modeChanged = lastViewMode.current !== viewMode;
        const chapterChanged = viewMode === 'single' ? lastChapterIdx.current !== selectedChapterIndex : false;

        // Sync ref from store
        const storeHtml = book?.[contentField] || '';
        const refOutOfSync = canvasContentRef.current !== storeHtml;
        if (refOutOfSync) {
            canvasContentRef.current = storeHtml;
        }

        const navigationChanged = bookChanged || modeChanged || chapterChanged;

        // If actively editing and no navigation change, skip reload
        if (isEditing.current && !navigationChanged) {
            return;
        }

        const needsReload = navigationChanged || refOutOfSync;
        if (!needsReload) return;

        // Force save before switching if editing
        if (isEditing.current && (modeChanged || chapterChanged)) {
            if (lastViewMode.current === 'all') {
                // In all mode, assemble from chapter htmls
                const assembledHtml = chapterHtmlsRef.current.join('');
                if (assembledHtml) {
                    updateBook(bookId, { [contentField]: assembledHtml });
                    canvasContentRef.current = assembledHtml;
                    if (contentType === 'characters') {
                        syncCharactersFromHtml(bookId, assembledHtml);
                    }
                }
            } else if (lastViewMode.current === 'single' && lastChapterIdx.current !== null && singleEditorRef.current) {
                const currentHtml = singleEditorRef.current.innerHTML;
                const fullHtml = book?.[contentField] || canvasContentRef.current;
                if (fullHtml) {
                    const safeHtml = ensureChapterHeading(currentHtml, fullHtml, lastChapterIdx.current);
                    const newFullHtml = replaceChapterHtml(fullHtml, lastChapterIdx.current, safeHtml);
                    updateBook(bookId, { [contentField]: newFullHtml });
                    canvasContentRef.current = newFullHtml;
                    if (contentType === 'characters') {
                        syncCharactersFromHtml(bookId, newFullHtml);
                    }
                }
            }
        }

        lastBookId.current = bookId;
        lastViewMode.current = viewMode;
        lastChapterIdx.current = selectedChapterIndex;
        isEditing.current = false;

        let html = canvasContentRef.current;

        // Migration: if no content but has legacy data, migrate
        if (!html) {
            if (contentType === 'characters') {
                const legacyChars = state.characters.filter(c => c.bookId === bookId);
                if (legacyChars.length > 0) {
                    html = migrateCharactersToHtml(legacyChars);
                    updateBook(bookId, { charactersCanvasContent: html });
                    canvasContentRef.current = html;
                }
            } else if (contentType === 'chapters') {
                if (chapters.length > 0) {
                    html = migrateChaptersToHtml(chapters.map(c => ({ title: c.title, content: c.content })));
                    updateBook(bookId, { canvasContent: html });
                    canvasContentRef.current = html;
                }
            }
        }

        if (viewMode === 'all') {
            // Split into chapter fragments for virtualized rendering
            const splitChapters = splitHtmlIntoChapters(html);
            chapterHtmlsRef.current = splitChapters;
            setChapterHtmls(splitChapters);
            chapterDirtyRef.current.clear();
            // Reset visibility for new content
            setVisibleChapters(new Set());
        } else if (viewMode === 'single' && selectedChapterIndex !== null && singleEditorRef.current) {
            singleEditorRef.current.innerHTML = extractChapterHtml(html, selectedChapterIndex);
        } else if (singleEditorRef.current) {
            singleEditorRef.current.innerHTML = '';
        }

        // Parse & report chapters
        const parsed = parseChaptersFromHtml(html);
        onChaptersChange(parsed);
    }, [bookId, viewMode, selectedChapterIndex, book?.[contentField], contentType]);

    // ── Save to store (single mode) ─────────────────────────────────────────
    const saveToStoreSingle = useCallback(() => {
        if (!singleEditorRef.current) return;
        if (isSearchActive.current) return;

        const currentHtml = singleEditorRef.current.innerHTML;

        if (viewMode === 'single' && selectedChapterIndex !== null) {
            const fullHtml = book?.[contentField] || canvasContentRef.current || '';
            if (!fullHtml) return;
            const safeHtml = ensureChapterHeading(currentHtml, fullHtml, selectedChapterIndex);
            const newFullHtml = replaceChapterHtml(fullHtml, selectedChapterIndex, safeHtml);
            updateBook(bookId, { [contentField]: newFullHtml });
            canvasContentRef.current = newFullHtml;
            const parsed = parseChaptersFromHtml(newFullHtml);
            onChaptersChange(parsed);
            if (contentType === 'characters') {
                syncCharactersFromHtml(bookId, newFullHtml);
            }
        }
    }, [bookId, viewMode, selectedChapterIndex, book?.[contentField], updateBook, onChaptersChange, contentType, contentField, syncCharactersFromHtml]);

    const saveToStoreSingleRef = useRef(saveToStoreSingle);
    useEffect(() => { saveToStoreSingleRef.current = saveToStoreSingle; }, [saveToStoreSingle]);

    // ── Save to store (all mode — virtualized) ────────────────────────────
    const saveToStoreAll = useCallback(() => {
        if (isSearchActive.current) return;

        // Update dirty chapters from their DOM refs
        for (const idx of chapterDirtyRef.current) {
            const el = chapterEditorRefs.current[idx];
            if (el) {
                chapterHtmlsRef.current[idx] = el.innerHTML;
            }
        }
        chapterDirtyRef.current.clear();

        const assembledHtml = chapterHtmlsRef.current.join('');
        updateBook(bookId, { [contentField]: assembledHtml });
        canvasContentRef.current = assembledHtml;
        const parsed = parseChaptersFromHtml(assembledHtml);
        onChaptersChange(parsed);
        if (contentType === 'characters') {
            syncCharactersFromHtml(bookId, assembledHtml);
        }
    }, [bookId, updateBook, onChaptersChange, contentType, contentField, syncCharactersFromHtml]);

    const saveToStoreAllRef = useRef(saveToStoreAll);
    useEffect(() => { saveToStoreAllRef.current = saveToStoreAll; }, [saveToStoreAll]);

    // ── Chapter input handler (all mode) ──────────────────────────────────
    const handleChapterInput = useCallback((index: number, html: string) => {
        chapterHtmlsRef.current[index] = html;
        chapterDirtyRef.current.add(index);
        isEditing.current = true;

        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
            if (typeof requestIdleCallback !== 'undefined') {
                requestIdleCallback(() => saveToStoreAllRef.current(), { timeout: 3000 });
            } else {
                saveToStoreAllRef.current();
            }
        }, 1500); // Increased debounce for all mode
    }, []);

    // ── Chapter height tracking ──────────────────────────────────────────
    const handleHeightMeasured = useCallback((index: number, height: number) => {
        chapterHeightsRef.current[index] = height;
    }, []);

    // ── Focus request between chapters ──────────────────────────────────
    const handleFocusRequest = useCallback((targetIndex: number, position: 'start' | 'end') => {
        const el = chapterEditorRefs.current[targetIndex];
        if (!el) return;
        el.focus();
        const sel = window.getSelection();
        if (!sel) return;
        const range = document.createRange();
        if (position === 'start') {
            range.selectNodeContents(el);
            range.collapse(true);
        } else {
            range.selectNodeContents(el);
            range.collapse(false);
        }
        sel.removeAllRanges();
        sel.addRange(range);
    }, []);

    // ── Register chapter editor refs ──────────────────────────────────────
    const registerChapterRef = useCallback((index: number, el: HTMLDivElement | null) => {
        if (el) {
            chapterEditorRefs.current[index] = el;
        } else {
            delete chapterEditorRefs.current[index];
        }
    }, []);

    // ── Autoformat handler (shared) ──────────────────────────────────────
    const autoformatRef = useRef(false);
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const REPLACEMENTS: [string, string][] = [
            ['<<', '\u00AB'],
            ['>>', '\u00BB'],
            ['--', '\u2014'],
        ];

        const handleAutoformat = (e: Event) => {
            const inputEvent = e as InputEvent;
            if (autoformatRef.current) { autoformatRef.current = false; return; }
            if (inputEvent.inputType !== 'insertText' || !inputEvent.data) return;

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            const node = range.startContainer;
            if (node.nodeType !== Node.TEXT_NODE) return;

            const text = node.textContent || '';
            const offset = range.startOffset;

            for (const [trigger, replacement] of REPLACEMENTS) {
                if (offset >= trigger.length && text.substring(offset - trigger.length, offset) === trigger) {
                    autoformatRef.current = true;
                    const before = text.substring(0, offset - trigger.length);
                    const after = text.substring(offset);
                    node.textContent = before + replacement + after;

                    const newRange = document.createRange();
                    newRange.setStart(node, before.length + replacement.length);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    break;
                }
            }
        };

        container.addEventListener('input', handleAutoformat);
        return () => container.removeEventListener('input', handleAutoformat);
    }, [bookId]);

    // ── Debounced input handler for single mode ──────────────────────────
    useEffect(() => {
        if (viewMode !== 'single') return;
        const editor = singleEditorRef.current;
        if (!editor) return;

        let timeoutId: any;

        const handleInput = () => {
            isEditing.current = true;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                saveToStoreSingleRef.current();
            }, 800);
        };

        editor.addEventListener('input', handleInput);
        return () => {
            editor.removeEventListener('input', handleInput);
            clearTimeout(timeoutId);
        };
    }, [bookId, viewMode]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.code === 'KeyF') {
                e.preventDefault();
                setIsReplaceMode(false);
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            } else if ((e.ctrlKey || e.metaKey) && e.code === 'KeyH') {
                e.preventDefault();
                setIsReplaceMode(true);
                setIsSearchOpen(true);
                setTimeout(() => searchInputRef.current?.focus(), 50);
            } else if (e.key === 'Escape' && isSearchOpen) {
                handleCloseSearch();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen]);

    // ── Search — works across all visible chapter editors ──────────────────
    const getAllEditorRoots = useCallback((): HTMLElement[] => {
        if (viewMode === 'all') {
            const roots: HTMLElement[] = [];
            const count = chapterHtmlsRef.current.length;
            for (let i = 0; i < count; i++) {
                const el = chapterEditorRefs.current[i];
                if (el) roots.push(el);
            }
            return roots;
        } else if (singleEditorRef.current) {
            return [singleEditorRef.current];
        }
        return [];
    }, [viewMode]);

    const handleSearch = (text: string, jump: boolean = true, forward: boolean = true) => {
        isSearchActive.current = true;
        setSearchText(text);

        if ((CSS as any).highlights) {
            (CSS as any).highlights.delete('search-match');
            (CSS as any).highlights.delete('search-active');
        }

        if (!text) {
            setTotalMatches(0);
            setMatchIndex(0);
            return;
        }

        const editorRoots = getAllEditorRoots();
        if (editorRoots.length === 0) return;

        const ranges: Range[] = [];
        for (const root of editorRoots) {
            const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let currentNode = treeWalker.nextNode();

            while (currentNode) {
                const content = currentNode.textContent?.toLowerCase() || '';
                const query = text.toLowerCase();
                let startPos = 0;

                while ((startPos = content.indexOf(query, startPos)) !== -1) {
                    try {
                        const range = new Range();
                        range.setStart(currentNode, startPos);
                        range.setEnd(currentNode, startPos + text.length);
                        ranges.push(range);
                    } catch (e) {
                        // Skip invalid ranges
                    }
                    startPos += text.length;
                }
                currentNode = treeWalker.nextNode();
            }
        }

        setTotalMatches(ranges.length);

        if (ranges.length > 0 && (CSS as any).highlights) {
            const matchHighlight = new (window as any).Highlight(...ranges);
            (CSS as any).highlights.set('search-match', matchHighlight);

            if (jump) {
                let nextIndex = forward ? matchIndex : matchIndex - 2;
                if (nextIndex >= ranges.length) nextIndex = 0;
                if (nextIndex < 0) nextIndex = ranges.length - 1;

                const activeRange = ranges[nextIndex];
                const activeHighlight = new (window as any).Highlight(activeRange);
                (CSS as any).highlights.set('search-active', activeHighlight);

                if (activeRange.startContainer.parentElement) {
                    activeRange.startContainer.parentElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }

                setMatchIndex(nextIndex + 1);
            }
        } else if (ranges.length > 0 && !jump) {
            setMatchIndex(0);
        }

        searchInputRef.current?.focus();
    };

    const handleCloseSearch = () => {
        if ((CSS as any).highlights) {
            (CSS as any).highlights.delete('search-match');
            (CSS as any).highlights.delete('search-active');
        }
        isSearchActive.current = false;
        setIsSearchOpen(false);
        setSearchText('');
        setReplaceText('');
        setIsReplaceMode(false);
        setTotalMatches(0);
        setMatchIndex(0);
    };

    // Replace current match
    const handleReplace = () => {
        if (!searchText || totalMatches === 0) return;
        const editorRoots = getAllEditorRoots();
        if (editorRoots.length === 0) return;

        isSearchActive.current = false;

        const ranges: Range[] = [];
        for (const root of editorRoots) {
            const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let currentNode = treeWalker.nextNode();

            while (currentNode) {
                const content = currentNode.textContent?.toLowerCase() || '';
                const query = searchText.toLowerCase();
                let startPos = 0;

                while ((startPos = content.indexOf(query, startPos)) !== -1) {
                    try {
                        const range = new Range();
                        range.setStart(currentNode, startPos);
                        range.setEnd(currentNode, startPos + searchText.length);
                        ranges.push(range);
                    } catch (e) {}
                    startPos += searchText.length;
                }
                currentNode = treeWalker.nextNode();
            }
        }

        if (ranges.length === 0) return;

        const activeIdx = Math.max(0, Math.min((matchIndex || 1) - 1, ranges.length - 1));
        const activeRange = ranges[activeIdx];
        activeRange.deleteContents();
        activeRange.insertNode(document.createTextNode(replaceText));

        for (const root of editorRoots) {
            root.normalize();
        }

        isEditing.current = true;
        if (viewMode === 'all') {
            saveToStoreAllRef.current();
        } else {
            saveToStoreSingleRef.current();
        }
        setTimeout(() => handleSearch(searchText, true, true), 50);
    };

    // Replace all matches
    const handleReplaceAll = () => {
        if (!searchText || totalMatches === 0) return;
        const editorRoots = getAllEditorRoots();
        if (editorRoots.length === 0) return;

        isSearchActive.current = false;

        const ranges: Range[] = [];
        for (const root of editorRoots) {
            const treeWalker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
            let currentNode = treeWalker.nextNode();

            while (currentNode) {
                const content = currentNode.textContent?.toLowerCase() || '';
                const query = searchText.toLowerCase();
                let startPos = 0;

                while ((startPos = content.indexOf(query, startPos)) !== -1) {
                    try {
                        const range = new Range();
                        range.setStart(currentNode, startPos);
                        range.setEnd(currentNode, startPos + searchText.length);
                        ranges.push(range);
                    } catch (e) {}
                    startPos += searchText.length;
                }
                currentNode = treeWalker.nextNode();
            }
        }

        for (let i = ranges.length - 1; i >= 0; i--) {
            ranges[i].deleteContents();
            ranges[i].insertNode(document.createTextNode(replaceText));
        }

        for (const root of editorRoots) {
            root.normalize();
        }

        isEditing.current = true;
        if (viewMode === 'all') {
            saveToStoreAllRef.current();
        } else {
            saveToStoreSingleRef.current();
        }
        setTimeout(() => handleSearch(searchText, false), 50);
    };

    // Handle paste
    const handlePaste = (e: React.ClipboardEvent, _chapterIndex?: number) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');

        const sel = window.getSelection();
        const activeEditor = viewMode === 'all' && _chapterIndex !== undefined
            ? chapterEditorRefs.current[_chapterIndex]
            : singleEditorRef.current;
        if (!sel || !sel.rangeCount || !activeEditor) return;
        const range = sel.getRangeAt(0);

        let heading: HTMLElement | null = null;
        let current: Node | null = range.startContainer;
        while (current && current !== activeEditor) {
            if (current instanceof HTMLElement && current.tagName === 'H2') {
                heading = current;
                break;
            }
            current = current.parentNode;
        }

        if (heading) {
            const rawText = text || '';
            const lines = rawText.split(/\r?\n/).map(l => l.trim());
            const firstLine = lines[0] || '';
            const otherLines = lines.slice(1).filter(l => l.length > 0 || lines.indexOf(l) !== 0);

            if (firstLine) {
                document.execCommand('insertText', false, firstLine);
            }

            if (otherLines.length > 0) {
                const cleanHtml = otherLines.map(line => {
                    const trimmed = line.trim();
                    return trimmed ? `<div>${escapeHtml(trimmed)}</div>` : '<div><br></div>';
                }).join('');

                const afterRange = document.createRange();
                afterRange.setStartAfter(heading);
                afterRange.collapse(true);

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanHtml;

                const fragment = document.createDocumentFragment();
                while (tempDiv.firstChild) {
                    fragment.appendChild(tempDiv.firstChild);
                }

                afterRange.insertNode(fragment);

                const lastInserted = fragment.lastChild || tempDiv.lastChild;
                if (lastInserted) {
                    const newSelRange = document.createRange();
                    newSelRange.selectNodeContents(lastInserted);
                    newSelRange.collapse(false);
                    sel.removeAllRanges();
                    sel.addRange(newSelRange);
                }
            }
        } else {
            if (html) {
                let cleanHtml = html.replace(/^[\s\S]*?<!--StartFragment-->/i, '');
                cleanHtml = cleanHtml.replace(/<!--EndFragment-->[\s\S]*$/i, '');

                const temp = document.createElement('div');
                temp.innerHTML = cleanHtml;

                temp.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                    const h2 = document.createElement('h2');
                    h2.innerHTML = h.innerHTML;
                    h.parentNode?.replaceChild(h2, h);
                });

                temp.querySelectorAll('p').forEach(p => {
                    const div = document.createElement('div');
                    div.innerHTML = p.innerHTML;
                    p.parentNode?.replaceChild(div, p);
                });

                temp.querySelectorAll('*').forEach(el => {
                    el.removeAttribute('style');
                    el.removeAttribute('class');
                });

                temp.querySelectorAll('div:empty').forEach(el => el.remove());

                document.execCommand('insertHTML', false, temp.innerHTML);
            } else if (text) {
                const textLines = text.split(/\r?\n/);
                const cleanHtml = textLines.map(line => {
                    const trimmed = line.trim();
                    return trimmed ? `<div>${escapeHtml(trimmed)}</div>` : '<div><br></div>';
                }).join('');

                document.execCommand('insertHTML', false, cleanHtml);
            }
        }

        isEditing.current = true;
        const wasSearchActive = isSearchActive.current;
        isSearchActive.current = false;
        if (viewMode === 'all') {
            saveToStoreAllRef.current();
        } else {
            saveToStoreSingleRef.current();
        }
        if (wasSearchActive) {
            isSearchActive.current = true;
            if (searchText) {
                setTimeout(() => handleSearch(searchText, false), 50);
            }
        }
    };

    // Toggle heading
    const toggleHeading = () => {
        const sel = window.getSelection();
        const activeEditor = viewMode === 'all'
            ? Object.values(chapterEditorRefs.current).find(el => el && el.contains(sel?.anchorNode || null))
            : singleEditorRef.current;
        if (!sel || !sel.rangeCount || !activeEditor) return;

        const range = sel.getRangeAt(0);
        let node: Node | null = range.startContainer;

        let heading: HTMLElement | null = null;
        let current: Node | null = node;
        while (current && current !== activeEditor) {
            if (current instanceof HTMLElement && current.tagName === HEADING_TAG) {
                heading = current;
                break;
            }
            current = current.parentNode;
        }

        const wasHeading = !!heading;

        if (heading) {
            const div = document.createElement('div');
            div.innerHTML = heading.innerHTML;
            heading.parentNode!.replaceChild(div, heading);

            const newRange = document.createRange();
            newRange.selectNodeContents(div);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            document.execCommand('formatBlock', false, HEADING_TAG);
        }

        activeEditor.focus();
        isEditing.current = true;

        setTimeout(() => {
            if (viewMode === 'all') {
                // Sync all visible editors
                for (const [idxStr, el] of Object.entries(chapterEditorRefs.current)) {
                    if (el) {
                        chapterHtmlsRef.current[parseInt(idxStr)] = el.innerHTML;
                    }
                }
                chapterDirtyRef.current.clear();

                const assembledHtml = chapterHtmlsRef.current.join('');
                updateBook(bookId, { [contentField]: assembledHtml });
                canvasContentRef.current = assembledHtml;

                // Re-split and update state
                const newSplit = splitHtmlIntoChapters(assembledHtml);
                chapterHtmlsRef.current = newSplit;
                setChapterHtmls(newSplit);

                const parsed = parseChaptersFromHtml(assembledHtml);
                onChaptersChange(parsed);
                if (contentType === 'characters') {
                    syncCharactersFromHtml(bookId, assembledHtml);
                }
            } else if (viewMode === 'single' && selectedChapterIndex !== null && singleEditorRef.current) {
                const currentHtml = singleEditorRef.current.innerHTML;
                const fullHtml = canvasContentRef.current;
                if (!fullHtml) return;
                const newFullHtml = replaceChapterHtml(fullHtml, selectedChapterIndex, currentHtml);
                updateBook(bookId, { [contentField]: newFullHtml });
                canvasContentRef.current = newFullHtml;
                const parsed = parseChaptersFromHtml(newFullHtml);
                onChaptersChange(parsed);
                if (contentType === 'characters') {
                    syncCharactersFromHtml(bookId, newFullHtml);
                }

                if (wasHeading) {
                    const newIdx = selectedChapterIndex > 0
                        ? Math.min(selectedChapterIndex - 1, parsed.length - 1)
                        : (parsed.length > 0 ? 0 : null);
                    lastChapterIdx.current = newIdx;
                    if (newIdx !== null && singleEditorRef.current) {
                        singleEditorRef.current.innerHTML = extractChapterHtml(newFullHtml, newIdx);
                    }
                } else {
                    lastChapterIdx.current = selectedChapterIndex;
                    if (singleEditorRef.current) {
                        singleEditorRef.current.innerHTML = extractChapterHtml(newFullHtml, selectedChapterIndex);
                    }
                }
            }
            isEditing.current = false;
        }, 50);
    };

    const execPreservingSelection = (command: string, value?: string) => {
        const sel = window.getSelection();
        const activeEditor = viewMode === 'all'
            ? Object.values(chapterEditorRefs.current).find(el => el && el.contains(sel?.anchorNode || null))
            : singleEditorRef.current;
        if (!sel || !sel.rangeCount || !activeEditor) return;
        const range = sel.getRangeAt(0).cloneRange();

        document.execCommand(command, false, value);

        try {
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (_) {}
    };

    const formatBold = () => { execPreservingSelection('bold'); };
    const formatItalic = () => { execPreservingSelection('italic'); };
    const formatUnderline = () => { execPreservingSelection('underline'); };
    const formatStrikethrough = () => { execPreservingSelection('strikeThrough'); };

    const applyFontFamily = (font: string) => {
        setEditorFontFamily(font);
        localStorage.setItem('pisaka-editor-fontfamily', font);
    };

    const applyFontSize = (size: string) => {
        const px = parseInt(size, 10);
        if (!isNaN(px)) {
            setEditorFontSize(px);
            localStorage.setItem('pisaka-editor-fontsize', String(px));
        }
    };

    const applyLineHeight = (height: string) => {
        setEditorLineHeight(height);
        localStorage.setItem('pisaka-editor-lineheight', height);
    };

    const applyHighlight = (color: string) => {
        execPreservingSelection('hiliteColor', color);
        isEditing.current = true;
        setTimeout(() => {
            if (viewMode === 'all') {
                saveToStoreAllRef.current();
            } else {
                saveToStoreSingleRef.current();
            }
        }, 100);
    };

    const cleanHtmlForClipboard = (htmlString: string): string => {
        const temp = document.createElement('div');
        temp.innerHTML = htmlString;

        const iterator = document.createNodeIterator(temp, NodeFilter.SHOW_COMMENT, null);
        let currentNode;
        const comments: Node[] = [];
        while ((currentNode = iterator.nextNode())) {
            comments.push(currentNode);
        }
        comments.forEach(c => c.parentNode?.removeChild(c));

        temp.querySelectorAll('*').forEach(el => {
            el.removeAttribute('style');
            el.removeAttribute('class');
        });

        return temp.innerHTML;
    };

    const getFormattedText = (htmlString: string) => {
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        temp.style.whiteSpace = 'pre-wrap';
        temp.innerHTML = htmlString;

        const iterator = document.createNodeIterator(temp, NodeFilter.SHOW_COMMENT, null);
        let currentNode;
        const comments: Node[] = [];
        while ((currentNode = iterator.nextNode())) {
            comments.push(currentNode);
        }
        comments.forEach(c => c.parentNode?.removeChild(c));

        document.body.appendChild(temp);
        let text = temp.innerText || '';
        document.body.removeChild(temp);

        text = text.replace(/\s*(Start|End)\s*Fragment\s*/gi, '');

        return text.replace(/^\n+|\n+$/g, '');
    };

    const copyToClipboard = async (text: string, type: string, html?: string) => {
        try {
            if (html && typeof ClipboardItem !== 'undefined') {
                const cleanedHtml = cleanHtmlForClipboard(html);
                const htmlBlob = new Blob([cleanedHtml], { type: 'text/html' });
                const textBlob = new Blob([text], { type: 'text/plain' });
                const item = new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob,
                });
                await navigator.clipboard.write([item]);
            } else {
                await navigator.clipboard.writeText(text);
            }
            setCopiedType(type);
            setTimeout(() => setCopiedType(null), 2000);
        } catch (err) {
            console.error('Clipboard API failed', err);
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                setCopiedType(type);
                setTimeout(() => setCopiedType(null), 2000);
            } catch (fallbackErr) {
                console.error('Fallback copy failed', fallbackErr);
            }
            document.body.removeChild(textArea);
        }
    };

    const handleCopy = () => {
        let htmlSnippet = '';
        if (viewMode === 'single' && selectedChapterIndex !== null) {
            htmlSnippet = extractChapterHtml(canvasContentRef.current, selectedChapterIndex);
        } else {
            htmlSnippet = chapterHtmlsRef.current.join('');
        }

        const text = getFormattedText(htmlSnippet);
        copyToClipboard(text, 'chapter', htmlSnippet);
    };

    const handleCopyHeading = () => {
        if (viewMode !== 'single' || selectedChapterIndex === null) return;
        const htmlSnippet = extractChapterHtml(canvasContentRef.current, selectedChapterIndex);
        const temp = document.createElement('div');
        temp.innerHTML = htmlSnippet;
        const h2 = temp.querySelector(HEADING_SELECTOR);
        if (h2) {
            const text = h2.textContent?.trim() || '';
            copyToClipboard(text, 'heading');
        }
    };

    const handleCopyChapterText = () => {
        if (viewMode !== 'single' || selectedChapterIndex === null) return;
        const htmlSnippet = extractChapterHtml(canvasContentRef.current, selectedChapterIndex);
        const temp = document.createElement('div');
        temp.innerHTML = htmlSnippet;
        const headings = temp.querySelectorAll(HEADING_SELECTOR);
        headings.forEach(h => h.remove());
        const textOnlyHtml = temp.innerHTML;
        const text = getFormattedText(textOnlyHtml);
        copyToClipboard(text, 'text', textOnlyHtml);
    };

    const handleCopyAll = () => {
        const htmlSnippet = viewMode === 'all'
            ? chapterHtmlsRef.current.join('')
            : (book?.[contentField] || '');
        if (!htmlSnippet) return;
        const text = getFormattedText(htmlSnippet);
        copyToClipboard(text, 'all', htmlSnippet);
    };

    const handleCopyDateTime = () => {
        if (viewMode !== 'single' || selectedChapterIndex === null) return;
        const chapter = chapters[selectedChapterIndex];
        if (!chapter?.scheduledDate) return;
        const dateStr = format(new Date(chapter.scheduledDate), "d MMMM yyyy, HH:mm", { locale: ru });
        copyToClipboard(dateStr, 'datetime');
    };

    const headingStyles = cn(
        "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-emerald-100",
        "[&_div]:my-1 [&_p]:my-1 [&_div]:font-normal [&_p]:font-normal",
        "[&_h2:first-child]:mt-2"
    );

    // ── Sticky chapter heading on scroll ─────────────────────────────────
    const [stickyChapter, setStickyChapter] = useState<string | null>(null);
    const onActiveChapterChangeRef = useRef(onActiveChapterChange);
    useEffect(() => { onActiveChapterChangeRef.current = onActiveChapterChange; }, [onActiveChapterChange]);

    useImperativeHandle(ref, () => ({
        scrollToChapter: (index: number) => {
            const scrollEl = scrollContainerRef.current;
            if (!scrollEl) return;

            if (viewMode === 'all') {
                const chapterContainer = scrollEl.querySelector(`[data-chapter-index="${index}"]`) as HTMLElement;
                if (chapterContainer) {
                    const containerTop = chapterContainer.offsetTop - scrollEl.offsetTop;
                    scrollEl.scrollTo({ top: containerTop - 20, behavior: 'smooth' });
                }
            } else if (singleEditorRef.current) {
                const headings = singleEditorRef.current.querySelectorAll(HEADING_SELECTOR);
                if (index < 0 || index >= headings.length) return;
                const heading = headings[index] as HTMLElement;
                const hTop = heading.offsetTop - scrollEl.offsetTop;
                scrollEl.scrollTo({ top: hTop - 20, behavior: 'smooth' });
            }
        },
    }), [viewMode]);

    useEffect(() => {
        if (viewMode !== 'all') {
            setStickyChapter(null);
            onActiveChapterChangeRef.current?.(null);
            return;
        }
        const scrollEl = scrollContainerRef.current;
        if (!scrollEl) return;

        const handleScroll = () => {
            const chapterContainers = scrollEl.querySelectorAll('[data-chapter-index]');
            if (chapterContainers.length === 0) {
                setStickyChapter(null);
                onActiveChapterChangeRef.current?.(null);
                return;
            }

            const scrollTop = scrollEl.scrollTop;
            let current: string | null = null;
            let currentIdx: number | null = null;

            for (let i = 0; i < chapterContainers.length; i++) {
                const container = chapterContainers[i] as HTMLElement;
                const cTop = container.offsetTop - scrollEl.offsetTop;
                if (cTop <= scrollTop + 60) {
                    const idx = parseInt(container.dataset.chapterIndex || '-1', 10);
                    if (idx >= 0 && idx < chapterHtmlsRef.current.length) {
                        const titleMatch = chapterHtmlsRef.current[idx].match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
                        current = titleMatch ? fastStripHtml(titleMatch[1]).trim() : null;
                        currentIdx = idx;
                    }
                } else {
                    break;
                }
            }

            if (scrollTop < 40) { current = null; currentIdx = null; }
            setStickyChapter(current);
            onActiveChapterChangeRef.current?.(currentIdx);
        };

        scrollEl.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollEl.removeEventListener('scroll', handleScroll);
    }, [viewMode, bookId, chapterHtmls]);

    // Font options
    const FONT_OPTIONS = [
        { label: 'По умолчанию', value: '' },
        { label: 'Georgia', value: 'Georgia, serif' },
        { label: 'Times New Roman', value: 'Times New Roman, serif' },
        { label: 'Arial', value: 'Arial, sans-serif' },
        { label: 'Roboto', value: 'Roboto, sans-serif' },
        { label: 'Inter', value: 'Inter, sans-serif' },
        { label: 'Lora', value: 'Lora, serif' },
        { label: 'PT Serif', value: 'PT Serif, serif' },
        { label: 'Merriweather', value: 'Merriweather, serif' },
        { label: 'Source Sans 3', value: 'Source Sans 3, sans-serif' },
    ];

    const SIZE_OPTIONS = [
        { label: '12', value: '12px' },
        { label: '14', value: '14px' },
        { label: '16', value: '16px' },
        { label: '18', value: '18px' },
        { label: '20', value: '20px' },
        { label: '24', value: '24px' },
        { label: '28', value: '28px' },
    ];

    const LINE_HEIGHT_OPTIONS = [
        { label: '1.0', value: '1' },
        { label: '1.15', value: '1.15' },
        { label: '1.5', value: '1.5' },
        { label: '2.0', value: '2' },
        { label: '2.5', value: '2.5' },
    ];

    const [showFontMenu, setShowFontMenu] = useState(false);
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const [showLineHeightMenu, setShowLineHeightMenu] = useState(false);
    const [showHighlightMenu, setShowHighlightMenu] = useState(false);

    const HIGHLIGHT_OPTIONS = [
        { label: 'Желтый маркер', value: 'rgba(234, 179, 8, 0.35)', colorClass: 'bg-yellow-500/35 border-yellow-500' },
        { label: 'Зеленый маркер', value: 'rgba(34, 197, 94, 0.35)', colorClass: 'bg-green-500/35 border-green-500' },
        { label: 'Синий маркер', value: 'rgba(59, 130, 246, 0.35)', colorClass: 'bg-blue-500/35 border-blue-500' },
        { label: 'Розовый маркер', value: 'rgba(236, 72, 153, 0.35)', colorClass: 'bg-pink-500/35 border-pink-500' },
        { label: 'Без выделения', value: 'transparent', colorClass: 'bg-transparent border-zinc-700 border-dashed' },
    ];

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden relative">
            <div className="absolute top-0 right-0 z-10 w-full bg-gradient-to-b from-zinc-950/80 to-transparent h-8 pointer-events-none" />

            {/* Search & Replace Bar */}
            {isSearchOpen && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[30] flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 pl-3 pr-2 border-r border-zinc-800">
                            <Search className="w-4 h-4 text-emerald-500" />
                            <input
                                ref={searchInputRef}
                                type="text"
                                value={searchText}
                                onChange={(e) => handleSearch(e.target.value, false)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleSearch(searchText, true, !e.shiftKey);
                                    }
                                }}
                                placeholder="Найти в тексте..."
                                className="bg-transparent border-none text-sm text-zinc-100 outline-none w-48 placeholder:text-zinc-600"
                            />
                            <div className="text-[10px] font-bold text-zinc-500 min-w-[40px] text-right tabular-nums">
                                {totalMatches > 0 ? `${matchIndex || 1}/${totalMatches}` : '0/0'}
                            </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                            <button
                                onClick={() => handleSearch(searchText, true, false)}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleSearch(searchText, true, true)}
                                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-zinc-800 mx-1" />
                            <button
                                onClick={() => setIsReplaceMode(m => !m)}
                                className={cn(
                                    'p-1.5 rounded-lg transition-colors',
                                    isReplaceMode
                                        ? 'text-emerald-400 bg-emerald-400/10'
                                        : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                                )}
                                title="Показать замену (Ctrl+H)"
                            >
                                <Replace className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleCloseSearch}
                                className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                    {/* Replace row */}
                    {isReplaceMode && (
                        <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-zinc-800">
                            <div className="flex items-center gap-2 pl-3 pr-2 flex-1">
                                <Replace className="w-4 h-4 text-amber-500/70" />
                                <input
                                    ref={replaceInputRef}
                                    type="text"
                                    value={replaceText}
                                    onChange={(e) => setReplaceText(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleReplace();
                                        }
                                    }}
                                    placeholder="Заменить на..."
                                    className="bg-transparent border-none text-sm text-zinc-100 outline-none flex-1 placeholder:text-zinc-600"
                                />
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleReplace}
                                    disabled={totalMatches === 0}
                                    className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Заменить"
                                >
                                    Заменить
                                </button>
                                <button
                                    onClick={handleReplaceAll}
                                    disabled={totalMatches === 0}
                                    className="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-amber-400 hover:bg-zinc-800 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                    title="Заменить все"
                                >
                                    Все
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Sticky chapter indicator */}
            {stickyChapter && viewMode === 'all' && (
                <div className="absolute top-0 left-0 right-0 z-[25] flex items-center justify-center">
                    <div className="mt-2 px-4 py-1.5 bg-zinc-900/90 backdrop-blur-md border border-zinc-800/60 rounded-full shadow-lg text-xs font-semibold text-emerald-300/80 max-w-[50%] truncate transition-all animate-in fade-in slide-in-from-top-1 duration-200">
                        {stickyChapter}
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="absolute top-4 right-10 z-20 flex gap-1 bg-zinc-900/90 py-1.5 px-2 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md flex-wrap items-center transition-all duration-300">
                {!showToolbar ? (
                    <button
                        onClick={toggleToolbar}
                        className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-emerald-400 rounded-lg transition-all"
                        title="Показать панель форматирования"
                    >
                        <Type className="w-4 h-4" />
                    </button>
                ) : (
                    <>
                        <button
                            onClick={toggleToolbar}
                            className="flex items-center justify-center p-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all"
                            title="Скрыть панель форматирования"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                        <div className="w-px h-5 bg-zinc-800 self-center mx-0.5" />
                        <button
                            onClick={toggleHeading}
                            className="flex items-center gap-1 px-2 py-1.5 text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm font-medium"
                            title="Заголовок (тогл)"
                        >
                            <Heading className="w-4 h-4" />
                        </button>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                <button onClick={formatBold} className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm font-bold" title="Жирный (Ctrl+B)"><Bold className="w-4 h-4" /></button>
                <button onClick={formatItalic} className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm italic" title="Курсив (Ctrl+I)"><Italic className="w-4 h-4" /></button>
                <button onClick={formatUnderline} className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title="Подчёркнутый (Ctrl+U)"><Underline className="w-4 h-4" /></button>
                <button onClick={formatStrikethrough} className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title="Зачёркнутый"><Strikethrough className="w-4 h-4" /></button>
                <div className="relative">
                    <button onClick={() => { setShowHighlightMenu(m => !m); setShowFontMenu(false); setShowSizeMenu(false); setShowLineHeightMenu(false); }} className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title="Маркер (Выделить текст)">
                        <Highlighter className="w-4 h-4" /><ChevronDown className="w-3 h-3 animate-pulse" />
                    </button>
                    {showHighlightMenu && (
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2.5 min-w-[200px] z-50 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="text-[10px] font-bold text-zinc-505 uppercase tracking-wider mb-1 px-1">Цвет маркера</div>
                            {HIGHLIGHT_OPTIONS.map(opt => (
                                <button key={opt.label} onMouseDown={(e) => { e.preventDefault(); applyHighlight(opt.value); setShowHighlightMenu(false); }} className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors text-left font-medium">
                                    <div className={cn("w-4 h-4 rounded-full border border-zinc-800 shrink-0", opt.colorClass)} />
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                <div className="relative">
                    <button onClick={() => { setShowFontMenu(m => !m); setShowSizeMenu(false); setShowLineHeightMenu(false); setShowHighlightMenu(false); }} className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-xs" title="Шрифт"><Type className="w-3.5 h-3.5" /><ChevronDown className="w-3 h-3" /></button>
                    {showFontMenu && (<div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[180px] max-h-[280px] overflow-y-auto z-50">{FONT_OPTIONS.map(f => (<button key={f.label} onMouseDown={(e) => { e.preventDefault(); applyFontFamily(f.value || 'inherit'); setShowFontMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors" style={{ fontFamily: f.value || 'inherit' }}>{f.label}</button>))}</div>)}
                </div>
                <div className="relative">
                    <button onClick={() => { setShowSizeMenu(m => !m); setShowFontMenu(false); setShowLineHeightMenu(false); setShowHighlightMenu(false); }} className="flex items-center gap-0.5 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-xs tabular-nums" title="Размер шрифта"><span className="text-[10px] font-bold">Aa</span><ChevronDown className="w-3 h-3" /></button>
                    {showSizeMenu && (<div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[80px] z-50">{SIZE_OPTIONS.map(s => (<button key={s.label} onMouseDown={(e) => { e.preventDefault(); applyFontSize(s.value); setShowSizeMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors">{s.label}px</button>))}</div>)}
                </div>
                <div className="relative">
                    <button onClick={() => { setShowLineHeightMenu(m => !m); setShowFontMenu(false); setShowSizeMenu(false); setShowHighlightMenu(false); }} className="flex items-center gap-0.5 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-xs" title="Межстрочный интервал">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="12" x2="3" y2="12" /><line x1="21" y1="18" x2="3" y2="18" /></svg>
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {showLineHeightMenu && (<div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[90px] z-50">{LINE_HEIGHT_OPTIONS.map(lh => (<button key={lh.label} onMouseDown={(e) => { e.preventDefault(); applyLineHeight(lh.value); setShowLineHeightMenu(false); }} className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors">{lh.label}×</button>))}</div>)}
                </div>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                {viewMode === 'single' ? (
                    <>
                        <button onClick={handleCopyHeading} className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title="Копировать заголовок">
                            {copiedType === 'heading' ? (<><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Название</span></>) : (<><Heading className="w-4 h-4" /><span className="hidden sm:inline">Название</span></>)}
                        </button>
                        <button onClick={handleCopyChapterText} className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title={contentType === 'characters' ? "Копировать описание" : contentType === 'annotation' ? "Копировать аннотацию" : contentType === 'short_description' ? "Копировать краткое описание" : contentType === 'chapter_plan' ? "Копировать план главы" : "Копировать текст главы"}>
                            {copiedType === 'text' ? (<><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Текст</span></>) : (<><FileText className="w-4 h-4" /><span className="hidden sm:inline">Текст</span></>)}
                        </button>
                        <button onClick={handleCopy} className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title={contentType === 'characters' ? "Копировать карточку" : contentType === 'annotation' ? "Копировать аннотацию" : contentType === 'short_description' ? "Копировать краткое описание" : contentType === 'chapter_plan' ? "Копировать план главы" : "Копировать главу"}>
                            {copiedType === 'chapter' ? (<><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">{contentType === 'characters' ? "Персонаж" : contentType === 'annotation' ? "Аннотация" : contentType === 'short_description' ? "Описание" : contentType === 'chapter_plan' ? "План главы" : "Вся глава"}</span></>) : (<><Copy className="w-4 h-4" /><span className="hidden sm:inline">{contentType === 'characters' ? "Персонаж" : contentType === 'annotation' ? "Аннотация" : contentType === 'short_description' ? "Описание" : contentType === 'chapter_plan' ? "План главы" : "Вся глава"}</span></>)}
                        </button>
                        {contentType !== 'characters' && contentType !== 'annotation' && contentType !== 'short_description' && contentType !== 'chapter_plan' && chapters[selectedChapterIndex!]?.scheduledDate && (
                            <button onClick={handleCopyDateTime} className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title="Копировать дату и время выкладки">
                                {copiedType === 'datetime' ? (<><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Дата</span></>) : (<><Clock className="w-4 h-4" /><span className="hidden sm:inline">Дата</span></>)}
                            </button>
                        )}
                    </>
                ) : (
                    <button onClick={handleCopyAll} className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm" title="Копировать всё">
                        {copiedType === 'all' ? (<><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Скопировано</span></>) : (<><Copy className="w-4 h-4" /><span className="hidden sm:inline">Всё</span></>)}
                    </button>
                )}
                    </>
                )}
            </div>

            {/* Editor Content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full px-8 pb-32">
                {viewMode === 'all' ? (
                    <div className="min-h-full max-w-3xl mx-auto py-12">
                        {chapterHtmls.length === 0 ? (
                            <div
                                ref={singleEditorRef}
                                contentEditable
                                onPaste={(e) => handlePaste(e)}
                                onBlur={() => {
                                    if (!singleEditorRef.current) return;
                                    const currentHtml = singleEditorRef.current.innerHTML;
                                    if (currentHtml.trim()) {
                                        updateBook(bookId, { [contentField]: currentHtml });
                                        canvasContentRef.current = currentHtml;
                                        const newSplit = splitHtmlIntoChapters(currentHtml);
                                        if (newSplit.length > 0) {
                                            chapterHtmlsRef.current = newSplit;
                                            setChapterHtmls(newSplit);
                                        }
                                        const parsed = parseChaptersFromHtml(currentHtml);
                                        onChaptersChange(parsed);
                                    }
                                }}
                                onInput={() => {
                                    isEditing.current = true;
                                    if (singleEditorRef.current) {
                                        const html = singleEditorRef.current.innerHTML;
                                        const splits = splitHtmlIntoChapters(html);
                                        if (splits.length > 0) {
                                            updateBook(bookId, { [contentField]: html });
                                            canvasContentRef.current = html;
                                            chapterHtmlsRef.current = splits;
                                            setChapterHtmls(splits);
                                            const parsed = parseChaptersFromHtml(html);
                                            onChaptersChange(parsed);
                                        }
                                    }
                                }}
                                style={{
                                    fontSize: `${editorFontSize}px`,
                                    fontFamily: editorFontFamily || 'inherit',
                                    lineHeight: editorLineHeight
                                }}
                                className={cn(
                                    "min-h-full outline-none text-zinc-200 font-sans font-normal leading-relaxed text-base",
                                    headingStyles
                                )}
                                spellCheck={true}
                                data-placeholder={
                                    contentType === 'characters'
                                        ? "Начните писать. Используйте кнопку H для создания персонажей."
                                        : contentType === 'chapter_plan'
                                            ? "Начните писать поглавный план. Используйте кнопку H для создания глав плана."
                                            : contentType === 'annotation'
                                                ? "Введите аннотацию книги..."
                                                : contentType === 'short_description'
                                                    ? "Введите краткое описание книги..."
                                                    : "Начните писать. Используйте кнопку H для создания глав."
                                }
                            />
                        ) : (
                            chapterHtmls.map((chHtml, idx) => (
                                <VirtualChapterBlock
                                    key={`ch-${idx}-${chapterHtmls.length}`}
                                    index={idx}
                                    html={chHtml}
                                    isVisible={visibleChapters.has(idx)}
                                    cachedHeight={chapterHeightsRef.current[idx] || null}
                                    editorFontSize={editorFontSize}
                                    editorFontFamily={editorFontFamily}
                                    editorLineHeight={editorLineHeight}
                                    headingStyles={headingStyles}
                                    onInput={handleChapterInput}
                                    onHeightMeasured={handleHeightMeasured}
                                    onFocusRequest={handleFocusRequest}
                                    onPaste={handlePaste}
                                    registerRef={registerChapterRef}
                                    observerRef={observerRef}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    <div
                        ref={singleEditorRef}
                        contentEditable
                        onPaste={(e) => handlePaste(e)}
                        onBlur={() => { isEditing.current = false; saveToStoreSingleRef.current(); }}
                        style={{
                            fontSize: `${editorFontSize}px`,
                            fontFamily: editorFontFamily || 'inherit',
                            lineHeight: editorLineHeight
                        }}
                        className={cn(
                            "min-h-full max-w-3xl mx-auto py-12 outline-none text-zinc-200 font-sans font-normal leading-relaxed text-base",
                            headingStyles
                        )}
                        spellCheck={true}
                        data-placeholder={
                            contentType === 'characters'
                                ? "Выберите персонажа справа для редактирования."
                                : contentType === 'chapter_plan'
                                    ? "Выберите главу плана справа для редактирования."
                                    : "Выберите главу справа для редактирования."
                        }
                    />
                )}
            </div>
        </div>
    );
});
