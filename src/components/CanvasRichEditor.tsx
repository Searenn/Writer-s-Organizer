import { Bold, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileText, Heading, Italic, Search, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { cn } from '../utils';

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
};

const HEADING_TAG = 'H2';
const HEADING_SELECTOR = 'h2';

/** Parse headings from an HTML string and return chapter descriptors */
function parseChaptersFromHtml(html: string): CanvasChapter[] {
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

export const CanvasRichEditor: React.FC<Props> = ({ bookId, viewMode, selectedChapterIndex, onChaptersChange }) => {
    const { state, updateBook } = useAppStore();
    const book = state.books.find(b => b.id === bookId);
    const chapters = state.chapters.filter(c => c.bookId === bookId).sort((a, b) => a.order - b.order);

    const editorRef = useRef<HTMLDivElement>(null);
    const isEditing = useRef(false);
    const lastBookId = useRef<string | null>(null);
    const lastViewMode = useRef<string>('all');
    const lastChapterIdx = useRef<number | null>(null);
    // Keep a ref to the latest canvasContent to avoid stale closures in debounced saves
    const canvasContentRef = useRef<string>(book?.canvasContent || '');
    const [copiedType, setCopiedType] = useState<string | null>(null);

    // Search state
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [matchIndex, setMatchIndex] = useState(0);
    const [totalMatches, setTotalMatches] = useState(0);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync the ref whenever book.canvasContent changes
    useEffect(() => {
        canvasContentRef.current = book?.canvasContent || '';
    }, [book?.canvasContent]);

    // Load content into the editor
    useEffect(() => {
        if (!editorRef.current) return;

        const bookChanged = lastBookId.current !== bookId;
        const modeChanged = lastViewMode.current !== viewMode;
        // In 'all' mode, changing chapter index via sidebar does not change what should be in the editor
        const chapterChanged = viewMode === 'single' ? lastChapterIdx.current !== selectedChapterIndex : false;

        // If nothing navigation-related changed and user is editing, don't reload
        if (!bookChanged && !modeChanged && !chapterChanged && isEditing.current) return;

        // If we are in 'all' mode and the only thing that changed was selectedChapterIndex, 
        // we just update the ref and abort reloading so we don't destroy cursor position.
        if (!bookChanged && !modeChanged && viewMode === 'all') {
            lastChapterIdx.current = selectedChapterIndex;
            return;
        }

        // If switching chapter/mode while editing, force save first
        if (isEditing.current && (modeChanged || chapterChanged) && editorRef.current) {
            const currentHtml = editorRef.current.innerHTML;
            if (lastViewMode.current === 'all') {
                updateBook(bookId, { canvasContent: currentHtml });
                canvasContentRef.current = currentHtml;
            } else if (lastViewMode.current === 'single' && lastChapterIdx.current !== null) {
                const fullHtml = canvasContentRef.current;
                if (fullHtml) {
                    const newFullHtml = replaceChapterHtml(fullHtml, lastChapterIdx.current, currentHtml);
                    updateBook(bookId, { canvasContent: newFullHtml });
                    canvasContentRef.current = newFullHtml;
                }
            }
        }

        lastBookId.current = bookId;
        lastViewMode.current = viewMode;
        lastChapterIdx.current = selectedChapterIndex;
        isEditing.current = false;

        let html = canvasContentRef.current;

        // Migration: if no canvasContent but has legacy chapters, build from them
        if (!html && chapters.length > 0) {
            html = migrateChaptersToHtml(chapters.map(c => ({ title: c.title, content: c.content })));
            updateBook(bookId, { canvasContent: html });
            canvasContentRef.current = html;
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
    }, [bookId, viewMode, selectedChapterIndex]);

    const saveToStore = useCallback(() => {
        if (!editorRef.current) return;

        const currentHtml = editorRef.current.innerHTML;

        if (viewMode === 'all') {
            updateBook(bookId, { canvasContent: currentHtml });
            canvasContentRef.current = currentHtml;
            const parsed = parseChaptersFromElement(editorRef.current);
            onChaptersChange(parsed);
        } else if (viewMode === 'single' && selectedChapterIndex !== null) {
            // Use canvasContentRef as base; fall back to store value if ref is stale/empty
            const fullHtml = canvasContentRef.current || book?.canvasContent || '';
            if (!fullHtml) return;
            const newFullHtml = replaceChapterHtml(fullHtml, selectedChapterIndex, currentHtml);
            updateBook(bookId, { canvasContent: newFullHtml });
            canvasContentRef.current = newFullHtml;
            const parsed = parseChaptersFromHtml(newFullHtml);
            onChaptersChange(parsed);
        }

        // Do not force isEditing to false. It will be reset onBlur. 
        // This prevents race conditions where React re-renders while typing.
    }, [bookId, viewMode, selectedChapterIndex, book?.canvasContent, updateBook, onChaptersChange]);

    // Keep a ref to saveToStore so the debounced handler always calls the latest version
    const saveToStoreRef = useRef(saveToStore);
    useEffect(() => { saveToStoreRef.current = saveToStore; }, [saveToStore]);

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
        setIsSearchOpen(false);
        setSearchText('');
        setTotalMatches(0);
        setMatchIndex(0);
        editorRef.current?.focus();
    };

    // Handle paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        let html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');

        if (html) {
            // Remove MS Clipboard HTML header metadata if present
            html = html.replace(/^[\s\S]*?<!--StartFragment-->/i, '');
            html = html.replace(/<!--EndFragment-->[\s\S]*$/i, '');

            const temp = document.createElement('div');
            temp.innerHTML = html;

            // Normalize all headings (h1-h6) to h2
            temp.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(heading => {
                const h2 = document.createElement('h2');
                h2.innerHTML = heading.innerHTML;
                heading.parentNode?.replaceChild(h2, heading);
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
            const textLines = text.split('\n');
            const cleanHtml = textLines.map(line => {
                const trimmed = line.trim();
                return trimmed ? `<div>${escapeHtml(trimmed)}</div>` : '<div><br></div>';
            }).join('');

            document.execCommand('insertHTML', false, cleanHtml);
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

    const formatBold = () => {
        document.execCommand('bold');
        editorRef.current?.focus();
    };

    const formatItalic = () => {
        document.execCommand('italic');
        editorRef.current?.focus();
    };

    // Helper to format HTML into clean text for copying
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

        // Format headings to have extra spacing around them if needed
        // But innerText usually handles H2 block spacing well.

        document.body.appendChild(temp);
        const text = temp.innerText || '';
        document.body.removeChild(temp);

        return text.replace(/^\n+|\n+$/g, '');
    };

    const copyToClipboard = async (text: string, type: string) => {
        try {
            await navigator.clipboard.writeText(text);
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
        copyToClipboard(text, 'chapter');
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
        const textOnlySnippet = temp.innerHTML;
        const text = getFormattedText(textOnlySnippet);
        copyToClipboard(text, 'text');
    };

    const handleCopyAll = () => {
        if (!book?.canvasContent) return;
        const htmlSnippet = book.canvasContent;
        const text = getFormattedText(htmlSnippet);
        copyToClipboard(text, 'all');
    };

    // Determine which heading levels to show in toolbar hints
    const headingStyles = cn(
        "[&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:font-serif [&_h2]:text-emerald-100",
        "[&_div]:my-1 [&_p]:my-1 [&_div]:font-normal [&_p]:font-normal",
        "[&_h2:first-child]:mt-2"
    );

    return (
        <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden relative">
            <div className="absolute top-0 right-0 z-10 w-full bg-gradient-to-b from-zinc-950/80 to-transparent h-8 pointer-events-none" />

            {/* Search Bar */}
            {isSearchOpen && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[30] flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-2xl p-1.5 shadow-2xl animate-in fade-in zoom-in-95 duration-200 backdrop-blur-md">
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
                            onClick={handleCloseSearch}
                            className="p-1.5 text-zinc-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="absolute top-4 right-10 z-20 flex gap-1 bg-zinc-900/90 py-1.5 px-2 rounded-xl border border-zinc-800/80 shadow-lg backdrop-blur-md">
                <button
                    onClick={toggleHeading}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-zinc-300 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm font-medium"
                    title="Заголовок (тогл)"
                >
                    <Heading className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-zinc-800 self-center" />
                <button
                    onClick={formatBold}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm font-bold"
                    title="Жирный (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </button>
                <button
                    onClick={formatItalic}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-zinc-400 hover:text-emerald-400 hover:bg-zinc-800/80 rounded-lg transition-all text-sm italic"
                    title="Курсив (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </button>
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
                            title="Копировать текст главы"
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
                            title="Копировать главу"
                        >
                            {copiedType === 'chapter' ? (
                                <><CheckCircle2 className="w-4 h-4 text-emerald-400" /><span className="hidden sm:inline text-emerald-400">Вся глава</span></>
                            ) : (
                                <><Copy className="w-4 h-4" /><span className="hidden sm:inline">Вся глава</span></>
                            )}
                        </button>
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
            <div className="flex-1 overflow-y-auto w-full px-8 pb-32">
                <div
                    ref={editorRef}
                    contentEditable
                    onPaste={handlePaste}
                    onBlur={() => { isEditing.current = false; saveToStoreRef.current(); }}
                    className={cn(
                        "min-h-full max-w-3xl mx-auto py-12 outline-none text-zinc-200 font-sans font-normal leading-relaxed text-base",
                        headingStyles
                    )}
                    spellCheck={true}
                    data-placeholder={viewMode === 'all'
                        ? "Начните писать. Используйте кнопку H для создания глав."
                        : "Выберите главу справа для редактирования."
                    }
                />
            </div>
        </div>
    );
};
