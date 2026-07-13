import { Bold, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Copy, FileText, Heading, Highlighter, Italic, Replace, Search, Strikethrough, Type, Underline, X } from 'lucide-react';
import React, { useCallback, useEffect, useImperativeHandle, useRef, useState, forwardRef } from 'react';
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

/** Parse headings from an HTML string and return chapter descriptors */
export function parseChaptersFromHtml(html: string): CanvasChapter[] {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    return parseChaptersFromElement(temp);
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
            // Select until the end of the root container
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
    const temp = document.createElement('div');
    temp.innerHTML = fullHtml;
    // Append to body temporarily so DOM operations work reliably
    document.body.appendChild(temp);

    try {
        const headings = Array.from(temp.querySelectorAll(HEADING_SELECTOR));
        if (chapterIndex < 0 || chapterIndex >= headings.length) return '';

        const startHeading = headings[chapterIndex];
        const nextHeading = headings[chapterIndex + 1] || null;

        const range = document.createRange();
        range.setStartBefore(startHeading);
        if (nextHeading) {
            range.setEndBefore(nextHeading);
        } else {
            range.setEnd(temp, temp.childNodes.length);
        }

        const fragment = range.cloneContents();
        const wrapper = document.createElement('div');
        wrapper.appendChild(fragment);
        return wrapper.innerHTML;
    } finally {
        document.body.removeChild(temp);
    }
}

/** Replace the chapter's HTML in the full canvas content */
function replaceChapterHtml(fullHtml: string, chapterIndex: number, newChapterHtml: string): string {
    const temp = document.createElement('div');
    temp.innerHTML = fullHtml;
    // Append to body temporarily so DOM operations work reliably
    document.body.appendChild(temp);

    try {
        const headings = Array.from(temp.querySelectorAll(HEADING_SELECTOR));
        if (chapterIndex < 0 || chapterIndex >= headings.length) return fullHtml;

        const startHeading = headings[chapterIndex];
        const nextHeading = headings[chapterIndex + 1] || null;

        const range = document.createRange();
        range.setStartBefore(startHeading);
        if (nextHeading) {
            range.setEndBefore(nextHeading);
        } else {
            range.setEnd(temp, temp.childNodes.length);
        }

        range.deleteContents();

        const newTemp = document.createElement('div');
        newTemp.innerHTML = newChapterHtml;
        const fragment = document.createDocumentFragment();
        Array.from(newTemp.childNodes).forEach(n => fragment.appendChild(n));

        range.insertNode(fragment);

        return temp.innerHTML;
    } finally {
        document.body.removeChild(temp);
    }
}

/** Reorder chapters: move chapter at fromIndex to toIndex */
export function reorderChapterHtml(fullHtml: string, fromIndex: number, toIndex: number): string {
    if (fromIndex === toIndex) return fullHtml;

    const temp = document.createElement('div');
    temp.innerHTML = fullHtml;
    document.body.appendChild(temp);

    try {
        const headings = Array.from(temp.querySelectorAll(HEADING_SELECTOR));
        if (fromIndex < 0 || fromIndex >= headings.length || toIndex < 0 || toIndex >= headings.length) {
            return fullHtml;
        }

        // Extract each chapter as an array of DOM nodes
        const chapterFragments: DocumentFragment[] = [];
        for (let i = 0; i < headings.length; i++) {
            const range = document.createRange();
            range.setStartBefore(headings[i]);
            if (i + 1 < headings.length) {
                range.setEndBefore(headings[i + 1]);
            } else {
                range.setEnd(temp, temp.childNodes.length);
            }
            chapterFragments.push(range.extractContents());
        }

        // Reorder
        const [moved] = chapterFragments.splice(fromIndex, 1);
        chapterFragments.splice(toIndex, 0, moved);

        // Clear and rebuild
        temp.innerHTML = '';
        chapterFragments.forEach(f => temp.appendChild(f));

        return temp.innerHTML;
    } finally {
        document.body.removeChild(temp);
    }
}

/** Delete a chapter/character fragment from HTML */
export function deleteChapterHtml(fullHtml: string, chapterIndex: number): string {
    const temp = document.createElement('div');
    temp.innerHTML = fullHtml;
    document.body.appendChild(temp);

    try {
        const headings = Array.from(temp.querySelectorAll(HEADING_SELECTOR));
        if (chapterIndex < 0 || chapterIndex >= headings.length) return fullHtml;

        const startHeading = headings[chapterIndex];
        const nextHeading = headings[chapterIndex + 1] || null;

        const range = document.createRange();
        range.setStartBefore(startHeading);
        if (nextHeading) {
            range.setEndBefore(nextHeading);
        } else {
            range.setEnd(temp, temp.childNodes.length);
        }

        range.deleteContents();
        return temp.innerHTML;
    } finally {
        document.body.removeChild(temp);
    }
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
 * the heading, we must restore it to prevent chapter-index shifts that cause
 * cascading data corruption when switching chapters.
 */
function ensureChapterHeading(chapterHtml: string, fullHtml: string, chapterIndex: number): string {
    const hasHeading = /<h[1-6][^>]*>/i.test(chapterHtml);
    if (hasHeading) return chapterHtml;

    // Extract original heading text from the full HTML
    const originalChapter = extractChapterHtml(fullHtml, chapterIndex);
    const match = originalChapter.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
    const headingTag = match ? match[0] : '<h2>Без названия</h2>';

    // If the remaining content is empty / just whitespace / just <br>, keep only the heading
    const stripped = chapterHtml.replace(/<br\s*\/?>/gi, '').replace(/<div>\s*<\/div>/gi, '').trim();
    if (!stripped) {
        return headingTag + '<div><br></div>';
    }

    return headingTag + chapterHtml;
}

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

    const editorRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isEditing = useRef(false);
    const lastBookId = useRef<string | null>(null);
    const lastViewMode = useRef<string>('all');
    const lastChapterIdx = useRef<number | null>(null);
    const canvasContentRef = useRef<string>(book?.[contentField] || '');
    const [copiedType, setCopiedType] = useState<string | null>(null);

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

    // Sync the ref whenever book.canvasContent or book.charactersCanvasContent changes
    useEffect(() => {
        canvasContentRef.current = book?.[contentField] || '';
    }, [book?.[contentField], contentField]);

    // Load content into the editor
    useEffect(() => {
        if (!editorRef.current) return;

        const bookChanged = lastBookId.current !== bookId;
        const modeChanged = lastViewMode.current !== viewMode;
        // In 'all' mode, changing chapter index via sidebar does not change what should be in the editor
        const chapterChanged = viewMode === 'single' ? lastChapterIdx.current !== selectedChapterIndex : false;

        // Always sync ref from store — external changes (handleAddChapter etc.) may
        // have updated canvasContent without going through saveToStore.
        const storeHtml = book?.[contentField] || '';
        const refOutOfSync = canvasContentRef.current !== storeHtml;
        if (refOutOfSync) {
            canvasContentRef.current = storeHtml;
        }

        // If we are actively editing, NEVER reload the editor DOM content unless the book, viewMode, or active chapter changed.
        // This prevents cursor resetting, double pastes, and undo/redo breaking.
        const navigationChanged = bookChanged || modeChanged || chapterChanged;
        if (isEditing.current && !navigationChanged) {
            return;
        }

        // Otherwise, reload if book, mode, active chapter changed, or content is out of sync
        const needsReload = navigationChanged || refOutOfSync;
        if (!needsReload) return;

        // If switching chapter/mode while editing, force save first
        if (isEditing.current && (modeChanged || chapterChanged) && editorRef.current) {
            const currentHtml = editorRef.current.innerHTML;
            if (lastViewMode.current === 'all') {
                updateBook(bookId, { [contentField]: currentHtml });
                canvasContentRef.current = currentHtml;
                if (contentType === 'characters') {
                    syncCharactersFromHtml(bookId, currentHtml);
                }
            } else if (lastViewMode.current === 'single' && lastChapterIdx.current !== null) {
                // Always use store value as base for single-mode saves
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

        // Migration: if no content but has legacy data, migrate from them
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
            editorRef.current.innerHTML = html;
        } else if (viewMode === 'single' && selectedChapterIndex !== null) {
            editorRef.current.innerHTML = extractChapterHtml(html, selectedChapterIndex);
        } else {
            editorRef.current.innerHTML = '';
        }

        // Parse & report chapters
        const parsed = parseChaptersFromHtml(html);
        onChaptersChange(parsed);
    }, [bookId, viewMode, selectedChapterIndex, book?.[contentField], contentType]);

    const saveToStore = useCallback(() => {
        if (!editorRef.current) return;
        // Don't save during search — search highlights alter the DOM temporarily
        if (isSearchActive.current) return;

        const currentHtml = editorRef.current.innerHTML;

        if (viewMode === 'all') {
            updateBook(bookId, { [contentField]: currentHtml });
            canvasContentRef.current = currentHtml;
            const parsed = parseChaptersFromElement(editorRef.current);
            onChaptersChange(parsed);
            if (contentType === 'characters') {
                syncCharactersFromHtml(bookId, currentHtml);
            }
        } else if (viewMode === 'single' && selectedChapterIndex !== null) {
            // ALWAYS use the store's latest content as base
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

        // Do not force isEditing to false. It will be reset onBlur. 
        // This prevents race conditions where React re-renders while typing.
    }, [bookId, viewMode, selectedChapterIndex, book?.[contentField], updateBook, onChaptersChange, contentType, contentField, syncCharactersFromHtml]);

    // Keep a ref to saveToStore so the debounced handler always calls the latest version
    const saveToStoreRef = useRef(saveToStore);
    useEffect(() => { saveToStoreRef.current = saveToStore; }, [saveToStore]);

    // ── Autoformat: << → «, >> → », -- → — ──────────────────────────────
    const autoformatRef = useRef(false); // flag to skip input handler re-trigger
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        const REPLACEMENTS: [string, string][] = [
            ['<<', '«'],
            ['>>', '»'],
            ['--', '—'],
        ];

        const handleAutoformat = (e: InputEvent) => {
            if (autoformatRef.current) { autoformatRef.current = false; return; }
            if (e.inputType !== 'insertText' || !e.data) return;

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            const node = range.startContainer;
            if (node.nodeType !== Node.TEXT_NODE) return;

            const text = node.textContent || '';
            const offset = range.startOffset;

            for (const [trigger, replacement] of REPLACEMENTS) {
                if (offset >= trigger.length && text.substring(offset - trigger.length, offset) === trigger) {
                    // Replace the trigger with the typographic character
                    autoformatRef.current = true;
                    const before = text.substring(0, offset - trigger.length);
                    const after = text.substring(offset);
                    node.textContent = before + replacement + after;

                    // Restore cursor position
                    const newRange = document.createRange();
                    newRange.setStart(node, before.length + replacement.length);
                    newRange.collapse(true);
                    sel.removeAllRanges();
                    sel.addRange(newRange);
                    break;
                }
            }
        };

        editor.addEventListener('input', handleAutoformat as EventListener);
        return () => editor.removeEventListener('input', handleAutoformat as EventListener);
    }, [bookId]);

    // Debounced input handler — installed ONCE per editor mount, uses ref for stability
    useEffect(() => {
        const editor = editorRef.current;
        if (!editor) return;

        let timeoutId: any;

        const handleInput = () => {
            isEditing.current = true;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                saveToStoreRef.current();
            }, 800);
        };

        editor.addEventListener('input', handleInput);
        return () => {
            editor.removeEventListener('input', handleInput);
            clearTimeout(timeoutId);
        };
    }, [bookId]); // Only reinstall when book changes

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Use e.code instead of e.key for layout independence (KeyF works on any layout)
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

    const handleSearch = (text: string, jump: boolean = true, forward: boolean = true) => {
        isSearchActive.current = true;
        setSearchText(text);

        // Clear previous highlights
        if ((CSS as any).highlights) {
            (CSS as any).highlights.delete('search-match');
            (CSS as any).highlights.delete('search-active');
        }

        if (!text) {
            setTotalMatches(0);
            setMatchIndex(0);
            return;
        }

        if (!editorRef.current) return;

        // Find all matches using TreeWalker for robust range creation
        const ranges: Range[] = [];
        const treeWalker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
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

                // Safe scroll
                if (activeRange.startContainer.parentElement) {
                    activeRange.startContainer.parentElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }

                setMatchIndex(nextIndex + 1);
            }
        } else if (ranges.length > 0 && !jump) {
            // If jump is false (typing), we still might want to show matches count
            // but keep matchIndex at 0 or 1
            setMatchIndex(0);
        }

        // Ensure focus stays in search
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
        editorRef.current?.focus();
    };

    // Replace current match
    const handleReplace = () => {
        if (!editorRef.current || !searchText || totalMatches === 0) return;

        // Temporarily disable search active to allow save
        isSearchActive.current = false;

        // Find all text nodes and their matches
        const ranges: Range[] = [];
        const treeWalker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
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
                } catch (e) {
                    // Skip invalid ranges
                }
                startPos += searchText.length;
            }
            currentNode = treeWalker.nextNode();
        }

        if (ranges.length === 0) return;

        // Replace the current active match
        const activeIdx = Math.max(0, Math.min((matchIndex || 1) - 1, ranges.length - 1));
        const activeRange = ranges[activeIdx];
        activeRange.deleteContents();
        activeRange.insertNode(document.createTextNode(replaceText));

        // Normalize text nodes to merge adjacent ones
        editorRef.current.normalize();

        // Save and re-search
        isEditing.current = true;
        saveToStoreRef.current();
        setTimeout(() => handleSearch(searchText, true, true), 50);
    };

    // Replace all matches
    const handleReplaceAll = () => {
        if (!editorRef.current || !searchText || totalMatches === 0) return;

        isSearchActive.current = false;

        // Find all matches in reverse order so indices stay valid
        const ranges: Range[] = [];
        const treeWalker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT);
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
                } catch (e) {
                    // Skip invalid ranges
                }
                startPos += searchText.length;
            }
            currentNode = treeWalker.nextNode();
        }

        // Replace in reverse order to preserve positions
        for (let i = ranges.length - 1; i >= 0; i--) {
            ranges[i].deleteContents();
            ranges[i].insertNode(document.createTextNode(replaceText));
        }

        editorRef.current.normalize();

        isEditing.current = true;
        saveToStoreRef.current();
        setTimeout(() => handleSearch(searchText, false), 50);
    };

    // Handle paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');

        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !editorRef.current) return;
        const range = sel.getRangeAt(0);

        // Find if we are currently inside an H2 heading
        let heading: HTMLElement | null = null;
        let current: Node | null = range.startContainer;
        while (current && current !== editorRef.current) {
            if (current instanceof HTMLElement && current.tagName === 'H2') {
                heading = current;
                break;
            }
            current = current.parentNode;
        }

        if (heading) {
            // We are inside an H2 heading.
            // Only paste the first line inside the heading. Put subsequent lines as regular text below the heading.
            const rawText = text || '';
            const lines = rawText.split(/\r?\n/).map(l => l.trim());
            const firstLine = lines[0] || '';
            const otherLines = lines.slice(1).filter(l => l.length > 0 || lines.indexOf(l) !== 0); // Keep empty lines but clean up padding

            // Paste first line inside H2 at cursor position
            if (firstLine) {
                document.execCommand('insertText', false, firstLine);
            }

            // Paste other lines after H2 as regular divs
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
                
                // Move selection/cursor to the end of the last inserted div
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
            // Not inside a heading. Paste normally.
            if (html) {
                // Remove MS Clipboard HTML header metadata if present
                let cleanHtml = html.replace(/^[\s\S]*?<!--StartFragment-->/i, '');
                cleanHtml = cleanHtml.replace(/<!--EndFragment-->[\s\S]*$/i, '');

                const temp = document.createElement('div');
                temp.innerHTML = cleanHtml;

                // Normalize all headings (h1-h6) to h2
                temp.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                    const h2 = document.createElement('h2');
                    h2.innerHTML = h.innerHTML;
                    h.parentNode?.replaceChild(h2, h);
                });

                // Convert paragraphs/spans to divs to avoid excessive margins
                temp.querySelectorAll('p').forEach(p => {
                    const div = document.createElement('div');
                    div.innerHTML = p.innerHTML;
                    p.parentNode?.replaceChild(div, p);
                });

                // Clean up styles
                temp.querySelectorAll('*').forEach(el => {
                    el.removeAttribute('style');
                    el.removeAttribute('class');
                });

                // Remove empty divs
                temp.querySelectorAll('div:empty').forEach(el => el.remove());

                document.execCommand('insertHTML', false, temp.innerHTML);
            } else if (text) {
                // Split plain text by newlines and wrap each line in a div
                const textLines = text.split(/\r?\n/);
                const cleanHtml = textLines.map(line => {
                    const trimmed = line.trim();
                    return trimmed ? `<div>${escapeHtml(trimmed)}</div>` : '<div><br></div>';
                }).join('');

                document.execCommand('insertHTML', false, cleanHtml);
            }
        }

        // Force save even when search is active — the search uses CSS Highlight API
        // which doesn't alter the DOM, so saving is safe
        isEditing.current = true;
        const wasSearchActive = isSearchActive.current;
        isSearchActive.current = false;
        saveToStoreRef.current();
        if (wasSearchActive) {
            isSearchActive.current = true;
            // Re-apply search highlights after save
            if (searchText) {
                setTimeout(() => handleSearch(searchText, false), 50);
            }
        }
    };

    // Toggle heading: if current block is a heading, convert to div; if div/p, convert to heading
    const toggleHeading = () => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !editorRef.current) return;

        const range = sel.getRangeAt(0);
        let node: Node | null = range.startContainer;

        // Search for the closest h2 ancestor
        let heading: HTMLElement | null = null;
        let current: Node | null = node;
        while (current && current !== editorRef.current) {
            if (current instanceof HTMLElement && current.tagName === HEADING_TAG) {
                heading = current;
                break;
            }
            current = current.parentNode;
        }

        const wasHeading = !!heading;

        if (heading) {
            // Remove heading → convert h2 to div
            const div = document.createElement('div');
            div.innerHTML = heading.innerHTML;
            heading.parentNode!.replaceChild(div, heading);

            // Restore cursor
            const newRange = document.createRange();
            newRange.selectNodeContents(div);
            newRange.collapse(false);
            sel.removeAllRanges();
            sel.addRange(newRange);
        } else {
            // Add heading
            document.execCommand('formatBlock', false, HEADING_TAG);
        }

        editorRef.current.focus();
        isEditing.current = true;

        // Save immediately (not debounced) to persist the heading change
        setTimeout(() => {
            if (!editorRef.current) return;
            const currentHtml = editorRef.current.innerHTML;

            if (viewMode === 'all') {
                updateBook(bookId, { canvasContent: currentHtml });
                canvasContentRef.current = currentHtml;
                const parsed = parseChaptersFromElement(editorRef.current);
                onChaptersChange(parsed);
            } else if (viewMode === 'single' && selectedChapterIndex !== null) {
                const fullHtml = canvasContentRef.current;
                if (!fullHtml) return; // safety: no base content, skip
                const newFullHtml = replaceChapterHtml(fullHtml, selectedChapterIndex, currentHtml);
                updateBook(bookId, { canvasContent: newFullHtml });
                canvasContentRef.current = newFullHtml;
                const parsed = parseChaptersFromHtml(newFullHtml);
                onChaptersChange(parsed);

                if (wasHeading) {
                    // Heading removed → chapter merged into previous one.
                    // Figure out which chapter index now holds the merged content.
                    const newIdx = selectedChapterIndex > 0
                        ? Math.min(selectedChapterIndex - 1, parsed.length - 1)
                        : (parsed.length > 0 ? 0 : null);
                    lastChapterIdx.current = newIdx;
                    if (newIdx !== null && editorRef.current) {
                        editorRef.current.innerHTML = extractChapterHtml(newFullHtml, newIdx);
                    }
                } else {
                    // Heading added → chapter split into two.
                    // Stay on the current chapter (same index), update lastChapterIdx so
                    // the navigation effect doesn't reload with stale index.
                    lastChapterIdx.current = selectedChapterIndex;
                    // Show only the first part (up to the new heading) in the editor
                    if (editorRef.current) {
                        editorRef.current.innerHTML = extractChapterHtml(newFullHtml, selectedChapterIndex);
                    }
                }
            }
            isEditing.current = false;
        }, 50);
    };

    /** Run a document.execCommand while preserving the user's current selection.
     *  The old code called editorRef.current.focus() after execCommand which
     *  collapsed the selection to the start of the contentEditable, losing the
     *  user's cursor position. Instead we save/restore the selection range. */
    const execPreservingSelection = (command: string, value?: string) => {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !editorRef.current) return;
        const range = sel.getRangeAt(0).cloneRange();

        document.execCommand(command, false, value);

        // Restore selection — execCommand may have changed it
        try {
            sel.removeAllRanges();
            sel.addRange(range);
        } catch (_) {
            // Ignore — range may have become invalid
        }
    };

    const formatBold = () => {
        execPreservingSelection('bold');
    };

    const formatItalic = () => {
        execPreservingSelection('italic');
    };

    const formatUnderline = () => {
        execPreservingSelection('underline');
    };

    const formatStrikethrough = () => {
        execPreservingSelection('strikeThrough');
    };

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
        setTimeout(() => saveToStoreRef.current(), 100);
    };

    // Helper to clean HTML for rich clipboard copy
    const cleanHtmlForClipboard = (htmlString: string): string => {
        const temp = document.createElement('div');
        temp.innerHTML = htmlString;

        // Strip HTML comments (like <!--EndFragment-->)
        const iterator = document.createNodeIterator(temp, NodeFilter.SHOW_COMMENT, null);
        let currentNode;
        const comments: Node[] = [];
        while ((currentNode = iterator.nextNode())) {
            comments.push(currentNode);
        }
        comments.forEach(c => c.parentNode?.removeChild(c));

        // Strip any inline styles/classes that could mess up pasting
        temp.querySelectorAll('*').forEach(el => {
            el.removeAttribute('style');
            el.removeAttribute('class');
        });

        return temp.innerHTML;
    };

    // Helper to format HTML into clean plain text for copying
    const getFormattedText = (htmlString: string) => {
        const temp = document.createElement('div');
        temp.style.position = 'absolute';
        temp.style.left = '-9999px';
        temp.style.whiteSpace = 'pre-wrap';
        temp.innerHTML = htmlString;

        // Strip HTML comments (like <!--EndFragment-->)
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

        // Strip literal End Fragment / StartFragment that may survive as text
        text = text.replace(/\s*(Start|End)\s*Fragment\s*/gi, '');

        return text.replace(/^\n+|\n+$/g, '');
    };

    const copyToClipboard = async (text: string, type: string, html?: string) => {
        try {
            // Try rich copy with both HTML and plain text
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
            // Fallback for older environments or when Clipboard API throws
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
        if (!editorRef.current) return;

        let htmlSnippet = '';
        if (viewMode === 'single' && selectedChapterIndex !== null) {
            htmlSnippet = extractChapterHtml(canvasContentRef.current, selectedChapterIndex);
        } else {
            htmlSnippet = editorRef.current.innerHTML;
        }

        const text = getFormattedText(htmlSnippet);
        copyToClipboard(text, 'chapter', htmlSnippet);
    };

    const handleCopyHeading = () => {
        if (!editorRef.current || viewMode !== 'single' || selectedChapterIndex === null) return;
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
        if (!editorRef.current || viewMode !== 'single' || selectedChapterIndex === null) return;
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
        if (!book?.canvasContent) return;
        const htmlSnippet = book.canvasContent;
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

    // Determine which heading levels to show in toolbar hints
    const headingStyles = cn(
        "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-emerald-100",
        "[&_div]:my-1 [&_p]:my-1 [&_div]:font-normal [&_p]:font-normal",
        "[&_h2:first-child]:mt-2"
    );

    // ── Sticky chapter heading on scroll ("all" mode) ─────────────────────
    const [stickyChapter, setStickyChapter] = useState<string | null>(null);
    const onActiveChapterChangeRef = useRef(onActiveChapterChange);
    useEffect(() => { onActiveChapterChangeRef.current = onActiveChapterChange; }, [onActiveChapterChange]);

    // Expose scrollToChapter to parent via ref
    useImperativeHandle(ref, () => ({
        scrollToChapter: (index: number) => {
            const editorEl = editorRef.current;
            const scrollEl = scrollContainerRef.current;
            if (!editorEl || !scrollEl) return;

            const headings = editorEl.querySelectorAll(HEADING_SELECTOR);
            if (index < 0 || index >= headings.length) return;

            const heading = headings[index] as HTMLElement;
            const hTop = heading.offsetTop - scrollEl.offsetTop;
            scrollEl.scrollTo({ top: hTop - 20, behavior: 'smooth' });
        },
    }), []);

    useEffect(() => {
        if (viewMode !== 'all') {
            setStickyChapter(null);
            onActiveChapterChangeRef.current?.(null);
            return;
        }
        const scrollEl = scrollContainerRef.current;
        const editorEl = editorRef.current;
        if (!scrollEl || !editorEl) return;

        const handleScroll = () => {
            const headings = editorEl.querySelectorAll(HEADING_SELECTOR);
            if (headings.length === 0) { setStickyChapter(null); onActiveChapterChangeRef.current?.(null); return; }

            const scrollTop = scrollEl.scrollTop;
            let current: string | null = null;
            let currentIdx: number | null = null;

            for (let i = 0; i < headings.length; i++) {
                const h = headings[i] as HTMLElement;
                // offsetTop is relative to editorEl parent, adjust by scrollEl offset
                const hTop = h.offsetTop - scrollEl.offsetTop;
                if (hTop <= scrollTop + 60) {
                    current = h.textContent?.trim() || null;
                    currentIdx = i;
                } else {
                    break;
                }
            }

            // Only show sticky when scrolled past the first heading
            if (scrollTop < 40) { current = null; currentIdx = null; }
            setStickyChapter(current);
            onActiveChapterChangeRef.current?.(currentIdx);
        };

        scrollEl.addEventListener('scroll', handleScroll, { passive: true });
        return () => scrollEl.removeEventListener('scroll', handleScroll);
    }, [viewMode, bookId]);

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
            <div className="absolute top-4 right-10 z-20 flex gap-1 bg-zinc-900/90 py-1.5 px-2 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md flex-wrap items-center">
                <button
                    onClick={toggleHeading}
                    className="flex items-center gap-1 px-2 py-1.5 text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm font-medium"
                    title="Заголовок (тогл)"
                >
                    <Heading className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                <button
                    onClick={formatBold}
                    className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm font-bold"
                    title="Жирный (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={formatItalic}
                    className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm italic"
                    title="Курсив (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </button>
                <button
                    onClick={formatUnderline}
                    className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                    title="Подчёркнутый (Ctrl+U)"
                >
                    <Underline className="w-4 h-4" />
                </button>
                <button
                    onClick={formatStrikethrough}
                    className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                    title="Зачёркнутый"
                >
                    <Strikethrough className="w-4 h-4" />
                </button>
                <div className="relative">
                    <button
                        onClick={() => { setShowHighlightMenu(m => !m); setShowFontMenu(false); setShowSizeMenu(false); setShowLineHeightMenu(false); }}
                        className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                        title="Маркер (Выделить текст)"
                    >
                        <Highlighter className="w-4 h-4" />
                        <ChevronDown className="w-3 h-3 animate-pulse" />
                    </button>
                    {showHighlightMenu && (
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-2.5 min-w-[200px] z-50 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                            <div className="text-[10px] font-bold text-zinc-505 uppercase tracking-wider mb-1 px-1">Цвет маркера</div>
                            {HIGHLIGHT_OPTIONS.map(opt => (
                                <button
                                    key={opt.label}
                                    onMouseDown={(e) => { e.preventDefault(); applyHighlight(opt.value); setShowHighlightMenu(false); }}
                                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors text-left font-medium"
                                >
                                    <div className={cn("w-4 h-4 rounded-full border border-zinc-800 shrink-0", opt.colorClass)} />
                                    <span>{opt.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                {/* Font family */}
                <div className="relative">
                    <button
                        onClick={() => { setShowFontMenu(m => !m); setShowSizeMenu(false); setShowLineHeightMenu(false); setShowHighlightMenu(false); }}
                        className="flex items-center gap-1 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-xs"
                        title="Шрифт"
                    >
                        <Type className="w-3.5 h-3.5" />
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {showFontMenu && (
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[180px] max-h-[280px] overflow-y-auto z-50">
                            {FONT_OPTIONS.map(f => (
                                <button
                                    key={f.label}
                                    onMouseDown={(e) => { e.preventDefault(); applyFontFamily(f.value || 'inherit'); setShowFontMenu(false); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors"
                                    style={{ fontFamily: f.value || 'inherit' }}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Font size */}
                <div className="relative">
                    <button
                        onClick={() => { setShowSizeMenu(m => !m); setShowFontMenu(false); setShowLineHeightMenu(false); setShowHighlightMenu(false); }}
                        className="flex items-center gap-0.5 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-xs tabular-nums"
                        title="Размер шрифта"
                    >
                        <span className="text-[10px] font-bold">Aa</span>
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {showSizeMenu && (
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[80px] z-50">
                            {SIZE_OPTIONS.map(s => (
                                <button
                                    key={s.label}
                                    onMouseDown={(e) => { e.preventDefault(); applyFontSize(s.value); setShowSizeMenu(false); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors"
                                >
                                    {s.label}px
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                {/* Line height */}
                <div className="relative">
                    <button
                        onClick={() => { setShowLineHeightMenu(m => !m); setShowFontMenu(false); setShowSizeMenu(false); setShowHighlightMenu(false); }}
                        className="flex items-center gap-0.5 px-2 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-xs"
                        title="Межстрочный интервал"
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="21" y1="6" x2="3" y2="6" /><line x1="21" y1="12" x2="3" y2="12" /><line x1="21" y1="18" x2="3" y2="18" />
                        </svg>
                        <ChevronDown className="w-3 h-3" />
                    </button>
                    {showLineHeightMenu && (
                        <div className="absolute top-full right-0 mt-1 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl py-1 min-w-[90px] z-50">
                            {LINE_HEIGHT_OPTIONS.map(lh => (
                                <button
                                    key={lh.label}
                                    onMouseDown={(e) => { e.preventDefault(); applyLineHeight(lh.value); setShowLineHeightMenu(false); }}
                                    className="w-full text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-emerald-400 transition-colors"
                                >
                                    {lh.label}×
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                {/* Copy buttons */}
                {viewMode === 'single' ? (
                    <>
                        <button
                            onClick={handleCopyHeading}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                            title="Копировать заголовок"
                        >
                            {copiedType === 'heading' ? (
                                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Название</span></>
                            ) : (
                                <><Heading className="w-4 h-4" /><span className="hidden sm:inline">Название</span></>
                            )}
                        </button>
                        <button
                            onClick={handleCopyChapterText}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                            title={
                                contentType === 'characters' ? "Копировать описание" :
                                contentType === 'annotation' ? "Копировать аннотацию" :
                                contentType === 'short_description' ? "Копировать краткое описание" :
                                contentType === 'chapter_plan' ? "Копировать план главы" :
                                "Копировать текст главы"
                            }
                        >
                            {copiedType === 'text' ? (
                                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Текст</span></>
                            ) : (
                                <><FileText className="w-4 h-4" /><span className="hidden sm:inline">Текст</span></>
                            )}
                        </button>
                        <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                            title={
                                contentType === 'characters' ? "Копировать карточку" :
                                contentType === 'annotation' ? "Копировать аннотацию" :
                                contentType === 'short_description' ? "Копировать краткое описание" :
                                contentType === 'chapter_plan' ? "Копировать план главы" :
                                "Копировать главу"
                            }
                        >
                            {copiedType === 'chapter' ? (
                                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">
                                    {contentType === 'characters' ? "Персонаж" :
                                     contentType === 'annotation' ? "Аннотация" :
                                     contentType === 'short_description' ? "Описание" :
                                     contentType === 'chapter_plan' ? "План главы" :
                                     "Вся глава"}
                                </span></>
                            ) : (
                                <><Copy className="w-4 h-4" /><span className="hidden sm:inline">
                                    {contentType === 'characters' ? "Персонаж" :
                                     contentType === 'annotation' ? "Аннотация" :
                                     contentType === 'short_description' ? "Описание" :
                                     contentType === 'chapter_plan' ? "План главы" :
                                     "Вся глава"}
                                </span></>
                            )}
                        </button>
                        {contentType !== 'characters' && contentType !== 'annotation' && contentType !== 'short_description' && contentType !== 'chapter_plan' && chapters[selectedChapterIndex!]?.scheduledDate && (
                            <button
                                onClick={handleCopyDateTime}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-amber-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                                title="Копировать дату и время выкладки"
                            >
                                {copiedType === 'datetime' ? (
                                    <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Дата</span></>
                                ) : (
                                    <><Clock className="w-4 h-4" /><span className="hidden sm:inline">Дата</span></>
                                )}
                            </button>
                        )}
                    </>
                ) : (
                    <button
                        onClick={handleCopyAll}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm"
                        title="Копировать всё"
                    >
                        {copiedType === 'all' ? (
                            <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Скопировано</span></>
                        ) : (
                            <><Copy className="w-4 h-4" /><span className="hidden sm:inline">Всё</span></>
                        )}
                    </button>
                )}
            </div>

            {/* Editor Content */}
            <div ref={scrollContainerRef} className="flex-1 overflow-y-auto w-full px-8 pb-32">
                <div
                    ref={editorRef}
                    contentEditable
                    onPaste={handlePaste}
                    onBlur={() => { isEditing.current = false; saveToStoreRef.current(); }}
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
                    data-placeholder={viewMode === 'all'
                        ? (contentType === 'characters'
                            ? "Начните писать. Используйте кнопку H для создания персонажей."
                            : contentType === 'chapter_plan'
                                ? "Начните писать поглавный план. Используйте кнопку H для создания глав плана."
                                : contentType === 'annotation'
                                    ? "Введите аннотацию книги..."
                                    : contentType === 'short_description'
                                        ? "Введите краткое описание книги..."
                                        : "Начните писать. Используйте кнопку H для создания глав.")
                        : (contentType === 'characters'
                            ? "Выберите персонажа справа для редактирования."
                            : contentType === 'chapter_plan'
                                ? "Выберите главу плана справа для редактирования."
                                : "Выберите главу справа для редактирования.")
                    }
                />
            </div>
        </div>
    );
});
