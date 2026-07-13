import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export function getTextLength(html: string): number {
  if (!html) return 0;
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return (temp.textContent || temp.innerText || '').length;
}

export function getCanvasChaptersLength(html: string): number {
  if (!html) return 0;
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const headings = Array.from(temp.querySelectorAll('h1, h2, h3, h4, h5, h6'));
  if (headings.length === 0) return 0; // If there are no headings, there are no chapters.

  // Count exactly from the first heading to the end
  const range = document.createRange();
  range.setStartBefore(headings[0]);
  range.setEnd(temp, temp.childNodes.length);

  const fragment = range.cloneContents();
  const wrapper = document.createElement('div');
  wrapper.appendChild(fragment);
  return (wrapper.textContent || wrapper.innerText || '').length;
}

export function getLocalISODate(date: Date = new Date()): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

export function stripHtml(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

export function parseChapters(text: string): { title: string; content: string }[] {
  // Matches "Глава 1", "Глава 1.", "Глава 1:", "Глава 1. Название"
  const chapterRegex = /^(Глава\s+\d+[\.:']?\s*.*)$/gim;
  const parts = text.split(chapterRegex);

  const chapters: { title: string; content: string }[] = [];

  // If the text doesn't start with a chapter heading, parts[0] is the prologue/intro
  if (parts[0].trim()) {
    chapters.push({
      title: 'Пролог / Вступление',
      content: parts[0].trim(),
    });
  }

  for (let i = 1; i < parts.length; i += 2) {
    const title = parts[i].trim();
    const content = (parts[i + 1] || '').trim();
    chapters.push({ title, content });
  }

  return chapters;
}

/**
 * Read a file selected by the user and return its content as a data URL.
 * Used as a browser-side replacement for Electron's selectFile().
 */
export function pickFileAsDataUrl(accept: string = 'image/*'): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    };
    // Handle cancel
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}

/**
 * Export text content as a downloadable file via browser Blob.
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert canvas HTML content to plain text for .txt export.
 */
export function canvasHtmlToPlainText(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;

  let result = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName;

      // Add newlines before block elements
      if (/^(H[1-6]|DIV|P|BR)$/.test(tag)) {
        if (result && !result.endsWith('\n')) {
          result += '\n';
        }
        if (/^H[1-6]$/.test(tag)) {
          result += '\n'; // Extra line before headings
        }
      }

      for (const child of Array.from(node.childNodes)) {
        walk(child);
      }

      // Add newline after block elements
      if (/^(H[1-6]|DIV|P)$/.test(tag)) {
        if (!result.endsWith('\n')) {
          result += '\n';
        }
      }
    }
  };

  walk(temp);
  return result.trim();
}

/**
 * Convert canvas HTML content to FB2 XML for .fb2 export.
 */
export function canvasHtmlToFb2(html: string, title: string): string {
  const plainSections = canvasHtmlToFb2Sections(html);

  return `<?xml version="1.0" encoding="utf-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0">
  <description>
    <title-info>
      <book-title>${escapeXml(title)}</book-title>
      <lang>ru</lang>
    </title-info>
    <document-info>
      <program-used>Pisaka Web</program-used>
    </document-info>
  </description>
  <body>
    <title><p>${escapeXml(title)}</p></title>
${plainSections}
  </body>
</FictionBook>`;
}

function canvasHtmlToFb2Sections(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;

  const sections: string[] = [];
  let currentTitle = '';
  let currentParagraphs: string[] = [];

  const flushSection = () => {
    if (currentTitle || currentParagraphs.length > 0) {
      let section = '    <section>\n';
      if (currentTitle) {
        section += `      <title><p>${escapeXml(currentTitle)}</p></title>\n`;
      }
      for (const p of currentParagraphs) {
        if (p.trim()) {
          section += `      <p>${escapeXml(p)}</p>\n`;
        } else {
          section += `      <empty-line/>\n`;
        }
      }
      section += '    </section>';
      sections.push(section);
    }
    currentTitle = '';
    currentParagraphs = [];
  };

  for (const child of Array.from(temp.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      if (/^H[1-6]$/.test(el.tagName)) {
        flushSection();
        currentTitle = el.textContent || '';
      } else {
        const text = el.textContent || '';
        currentParagraphs.push(text);
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim();
      if (text) {
        currentParagraphs.push(text);
      }
    }
  }
  flushSection();

  return sections.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
