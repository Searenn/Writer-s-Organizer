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

export function stripHtml(html: string): string {
  if (!html) return '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || '';
}

export function formatFilePath(path: string | undefined): string {
  if (!path) return '';
  // Convert backslashes to forward slashes and add file:// protocol
  const normalizedPath = path.replace(/\\/g, '/');
  return normalizedPath.startsWith('file://') ? normalizedPath : `file:///${normalizedPath}`;
}

export function parseChapters(text: string): { title: string; content: string }[] {
  // Matches "Глава 1", "Глава 1.", "Глава 1:", "Глава 1. Название"
  const chapterRegex = /^(Глава\s+\d+[\.:]?\s*.*)$/gim;
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
