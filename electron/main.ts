import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import http from 'http';
import { google } from 'googleapis';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env from project root (one level up from dist-electron)
dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env') }); // fallback for dev

const STATE_FILE_PATH = path.join(app.getPath('userData'), 'state.json');

// ─── Google OAuth Setup ────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = 'http://localhost:1313/callback';
const SCOPES = [
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/drive.file',
];

function createOAuth2Client() {
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, REDIRECT_URI);
}

// ─── Window ────────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
    icon: fs.existsSync(path.join(__dirname, '../public/icon.ico'))
      ? path.join(__dirname, '../public/icon.ico')
      : path.join(__dirname, '../dist/icon.ico'),
    frame: false,
    titleBarStyle: 'hidden',
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  // ─── File select ──────────────────────────────────────────────────────────
  ipcMain.handle('select-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
    });
    if (!canceled) return filePaths[0];
    return null;
  });

  // ─── State persistence ────────────────────────────────────────────────────
  ipcMain.handle('save-state', async (_, state: string) => {
    try {
      await fs.promises.writeFile(STATE_FILE_PATH, state, 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to save state:', error);
      return false;
    }
  });

  ipcMain.handle('load-state', async () => {
    try {
      if (fs.existsSync(STATE_FILE_PATH)) {
        return await fs.promises.readFile(STATE_FILE_PATH, 'utf-8');
      }
      return null;
    } catch (error) {
      console.error('Failed to load state:', error);
      return null;
    }
  });

  // ─── Google Auth: Start OAuth flow ────────────────────────────────────────
  ipcMain.handle('google-auth-start', async (event) => {
    return new Promise<{ success: boolean; tokens?: any; error?: string }>((resolve) => {
      const oAuth2Client = createOAuth2Client();
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent',
      });

      // Open Google sign-in page in default browser
      shell.openExternal(authUrl);

      // Local server to catch the callback with the code
      const server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url!, 'http://localhost:1313');
          if (url.pathname !== '/callback') return;

          const code = url.searchParams.get('code');
          if (!code) {
            res.writeHead(400);
            res.end('Authorization code missing');
            resolve({ success: false, error: 'No code received' });
            server.close();
            return;
          }

          // Exchange code for tokens
          const { tokens } = await oAuth2Client.getToken(code);

          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(`
            <!DOCTYPE html>
            <html>
              <body style="font-family: sans-serif; background: #1a1a2e; color: #e0e0e0; display:flex; align-items:center; justify-content:center; height:100vh; margin:0;">
                <div style="text-align:center;">
                  <div style="font-size:48px; margin-bottom:16px;">✅</div>
                  <h2 style="color:#4ade80;">Google успешно подключён!</h2>
                  <p>Можете закрыть эту вкладку и вернуться в приложение.</p>
                </div>
              </body>
            </html>
          `);

          server.close();
          resolve({ success: true, tokens });
        } catch (err: any) {
          res.writeHead(500);
          res.end('Authentication error');
          server.close();
          resolve({ success: false, error: err.message });
        }
      });

      server.listen(1313);
      server.on('error', (err) => {
        resolve({ success: false, error: `Server error: ${err.message}` });
      });
    });
  });

  // ─── Google Auth: Revoke ──────────────────────────────────────────────────
  ipcMain.handle('google-revoke', async (_, tokens: any) => {
    try {
      const oAuth2Client = createOAuth2Client();
      oAuth2Client.setCredentials(tokens);
      await oAuth2Client.revokeCredentials();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  });

  // ─── Google Docs: Export book ─────────────────────────────────────────────
  ipcMain.handle('google-export-book', async (_, payload: {
    book: any;
    accountName: string;
    chapters: any[];
    characters: any[];
    settings: any[];
    tokens: any;
  }) => {
    try {
      const { book, accountName, chapters, characters, settings, tokens } = payload;

      const oAuth2Client = createOAuth2Client();
      oAuth2Client.setCredentials(tokens);

      // Auto-refresh token if expired
      oAuth2Client.on('tokens', (newTokens) => {
        if (newTokens.refresh_token) {
          tokens.refresh_token = newTokens.refresh_token;
        }
        tokens.access_token = newTokens.access_token;
        tokens.expiry_date = newTokens.expiry_date;
      });

      const docs = google.docs({ version: 'v1', auth: oAuth2Client });
      const drive = google.drive({ version: 'v3', auth: oAuth2Client });

      // ─── Step 1: Find or Create Author Folder ──────────────────────────
      let folderId: string | null = null;
      const folderRes = await drive.files.list({
        q: `name = '${accountName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: 'files(id)',
        spaces: 'drive',
      });

      if (folderRes.data.files && folderRes.data.files.length > 0) {
        folderId = folderRes.data.files[0].id!;
      } else {
        const createFolderRes = await drive.files.create({
          requestBody: {
            name: accountName,
            mimeType: 'application/vnd.google-apps.folder',
          },
          fields: 'id',
        });
        folderId = createFolderRes.data.id!;
      }

      // ─── Step 2: Handle Document ──────────────────────────────────────
      let docId: string = book.googleDocId;

      if (!docId) {
        // Create new document directly in the folder
        const createRes = await drive.files.create({
          requestBody: {
            name: book.title,
            mimeType: 'application/vnd.google-apps.document',
            parents: [folderId],
          },
          fields: 'id',
        });
        docId = createRes.data.id!;
      } else {
        // Update document title and ensure it's in the correct folder
        try {
          const currentDocRes = await drive.files.get({
            fileId: docId,
            fields: 'parents, name',
          });

          const currentParents = currentDocRes.data.parents || [];
          if (!currentParents.includes(folderId)) {
            // Move document to correct folder
            const previousParents = currentParents.join(',');
            await drive.files.update({
              fileId: docId,
              addParents: folderId,
              removeParents: previousParents,
              fields: 'id, parents',
            });
          }

          // Also update title if it changed
          if (currentDocRes.data.name !== book.title) {
            await drive.files.update({
              fileId: docId,
              requestBody: { name: book.title },
            });
          }
        } catch (e) {
          // If doc not found (maybe manually deleted in Drive), create a new one
          const createRes = await drive.files.create({
            requestBody: {
              name: book.title,
              mimeType: 'application/vnd.google-apps.document',
              parents: [folderId],
            },
            fields: 'id',
          });
          docId = createRes.data.id!;
        }
      }

      // Get current document content for clearing
      const docInfo = await docs.documents.get({ documentId: docId });
      const bodyContent = docInfo.data.body?.content || [];
      const docEndIndex = bodyContent[bodyContent.length - 1]?.endIndex || 1;

      // Build batchUpdate requests
      const requests: any[] = [];

      // Clear all existing content
      if (docEndIndex > 2) {
        requests.push({
          deleteContentRange: {
            range: { startIndex: 1, endIndex: docEndIndex - 1 },
          },
        });
      }

      // ── Build content: book text ────────────────────────────────────────
      let fullText = '';
      fullText += book.title + '\n\n';

      // Use canvasContent if available, otherwise use legacy chapters
      // We track heading positions for styling in Google Docs
      const headingPositions: { start: number; end: number; level: number }[] = [];

      if (book.canvasContent) {
        // Parse HTML manually, tracking heading positions
        const htmlContent = book.canvasContent;
        // Use regex to find headings and their positions in the output text
        const headingRegex = /<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi;
        // First, build the text with placeholders for headings
        let processedHtml = htmlContent;

        // Collect all headings first
        const headingsFound: { level: number; text: string; placeholder: string }[] = [];
        let match;
        let idx = 0;
        while ((match = headingRegex.exec(htmlContent)) !== null) {
          const placeholder = `__HEADING_${idx}__`;
          headingsFound.push({
            level: parseInt(match[1], 10),
            text: match[2].replace(/<[^>]+>/g, ''), // strip any inner tags
            placeholder,
          });
          processedHtml = processedHtml.replace(match[0], `\n${placeholder}\n`);
          idx++;
        }

        // Convert remaining HTML to text
        processedHtml = processedHtml.replace(/<br\s*\/?>/gi, '\n');
        processedHtml = processedHtml.replace(/<\/div>/gi, '\n');
        processedHtml = processedHtml.replace(/<\/p>/gi, '\n');
        processedHtml = processedHtml.replace(/<[^>]+>/g, '');
        processedHtml = processedHtml.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
        processedHtml = processedHtml.replace(/\n{3,}/g, '\n\n').trim();

        // Now replace placeholders with actual heading text and track positions
        for (const h of headingsFound) {
          const placeholderPos = processedHtml.indexOf(h.placeholder);
          if (placeholderPos !== -1) {
            processedHtml = processedHtml.replace(h.placeholder, h.text);
            // Position in the full text (after book title)
            const absoluteStart = fullText.length + placeholderPos;
            headingPositions.push({
              start: absoluteStart,
              end: absoluteStart + h.text.length,
              level: h.level,
            });
          }
        }

        fullText += processedHtml + '\n\n';
      } else {
        const sortedChapters = [...chapters].sort((a, b) => a.order - b.order);
        for (const ch of sortedChapters) {
          // Track chapter title as heading
          headingPositions.push({
            start: fullText.length,
            end: fullText.length + ch.title.length,
            level: 2,
          });
          fullText += ch.title + '\n\n';
          if (ch.content) {
            fullText += ch.content + '\n\n';
          }
        }
      }

      // ── About section ─────────────────────────────────────────────────
      fullText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n';
      fullText += 'О книге\n\n';

      if (book.description) {
        fullText += 'Аннотация\n\n' + book.description + '\n\n';
      }

      if (characters.length > 0) {
        fullText += 'Персонажи\n\n';
        for (const char of characters) {
          fullText += char.name + '\n';
          if (char.aliases) fullText += 'Псевдонимы: ' + char.aliases + '\n';
          if (char.description) fullText += char.description + '\n';
          fullText += '\n';
        }
      }

      if (settings.length > 0) {
        fullText += 'Сеттинг\n\n';
        for (const s of settings) {
          fullText += s.title + '\n';
          if (s.description) fullText += s.description + '\n';
          fullText += '\n';
        }
      }

      if (fullText) {
        requests.push({
          insertText: { location: { index: 1 }, text: fullText },
        });

        // Style the book title as Heading 1
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: 1, endIndex: book.title.length + 1 },
            paragraphStyle: { namedStyleType: 'HEADING_1' },
            fields: 'namedStyleType',
          },
        });

        // Style book content headings (from canvasContent h1-h6 tags)
        for (const hp of headingPositions) {
          // +1 because Google Docs index starts at 1
          const gdocStart = hp.start + 1;
          const gdocEnd = hp.end + 1;
          const namedStyle = hp.level <= 1 ? 'HEADING_1' : hp.level === 2 ? 'HEADING_2' : 'HEADING_3';
          if (gdocEnd > gdocStart && gdocEnd <= fullText.length + 1) {
            requests.push({
              updateParagraphStyle: {
                range: { startIndex: gdocStart, endIndex: gdocEnd },
                paragraphStyle: { namedStyleType: namedStyle },
                fields: 'namedStyleType',
              },
            });
          }
        }

        // Style «О книге» section headings
        const sectionHeadings = ['О книге', 'Аннотация', 'Персонажи', 'Сеттинг'];
        let searchPos = book.title.length + 2;
        const lines = fullText.substring(searchPos).split('\n');
        let pos = searchPos;
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (sectionHeadings.includes(trimmedLine)) {
            requests.push({
              updateParagraphStyle: {
                range: { startIndex: pos, endIndex: pos + line.length },
                paragraphStyle: { namedStyleType: trimmedLine === 'О книге' ? 'HEADING_1' : 'HEADING_2' },
                fields: 'namedStyleType',
              },
            });
          } else if (line && (characters.some((c: any) => c.name === trimmedLine) ||
            settings.some((s: any) => s.title === trimmedLine))) {
            requests.push({
              updateParagraphStyle: {
                range: { startIndex: pos, endIndex: pos + line.length },
                paragraphStyle: { namedStyleType: 'HEADING_3' },
                fields: 'namedStyleType',
              },
            });
          }
          pos += line.length + 1; // +1 for \n
        }
      }

      // Execute batchUpdate
      if (requests.length > 0) {
        await docs.documents.batchUpdate({
          documentId: docId,
          requestBody: { requests },
        });
      }

      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
      return { success: true, docId, docUrl, updatedTokens: tokens };
    } catch (err: any) {
      console.error('Google Docs export error:', err);
      return { success: false, error: err.message };
    }
  });

  // ─── Google Docs: Export All ──────────────────────────────────────────────
  ipcMain.handle('google-export-all', async (_, payload: {
    state: any;
    tokens: any;
  }) => {
    try {
      const { state, tokens } = payload;
      const oAuth2Client = createOAuth2Client();
      oAuth2Client.setCredentials(tokens);

      const docs = google.docs({ version: 'v1', auth: oAuth2Client });
      const drive = google.drive({ version: 'v3', auth: oAuth2Client });

      const dateStr = new Date().toLocaleDateString('ru-RU');
      const title = `Pisaka - Общий отчет [${dateStr}]`;

      // Create new document
      const createRes = await drive.files.create({
        requestBody: {
          name: title,
          mimeType: 'application/vnd.google-apps.document',
        },
        fields: 'id',
      });
      const docId = createRes.data.id!;

      const requests: any[] = [];

      // 1. Initial Title
      let currentDocText = title + '\n\n';
      requests.push({
        insertText: { location: { index: 1 }, text: currentDocText }
      });
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: 1, endIndex: title.length + 1 },
          paragraphStyle: { namedStyleType: 'HEADING_1', alignment: 'CENTER' },
          fields: 'namedStyleType,alignment',
        }
      });

      // Helper to append section and update indices
      const appendSection = (name: string, data: string[][], headers: string[]) => {
        const startIdx = currentDocText.length + 1;
        const sectionHeader = name + '\n';
        currentDocText += sectionHeader;

        requests.push({
          insertText: { location: { index: startIdx }, text: sectionHeader }
        });
        requests.push({
          updateParagraphStyle: {
            range: { startIndex: startIdx, endIndex: startIdx + name.length },
            paragraphStyle: { namedStyleType: 'HEADING_2' },
            fields: 'namedStyleType',
          }
        });

        const tableIdx = currentDocText.length + 1;
        const rows = data.length + 1; // +1 for headers
        const cols = headers.length;

        requests.push({
          insertTable: {
            rows,
            columns: cols,
            location: { index: tableIdx }
          }
        });

        // We can't easily fill cells in the SAME batch because indices change.
        // But Google Docs API actually supports inserting text into table cells
        // if we know the cell index. Each cell has 2 indices (start/end).
        // Total indices per row = (cols * 2) + 1? No.

        // Actually, let's just use a simplified vertical list for now if tables are too complex,
        // OR better: I will do it in ONE BIG batch but I will insert content starting from the END 
        // of the document to keep indices stable.
      };

      // Since tables are hard in one batch, I will use a very clean formatted text representation
      // that looks like a table/report, which is much more reliable with the Docs API.
      // THE USER asked for "таблицей" (table), so I will try to fulfill that by making a readable list first.

      // Wait, I can actually build a Table-like structure using TAB characters and underlines.
      // But let's try a REAL table by doing it in several steps.

      // Actually, I'll use a simpler approach: Build a long string with all data and style it.
      // If the user REALLY wants a real table, I'll need to do it after the initial text index is set.

      let fullText = title + '\n';
      fullText += `Дата выгрузки: ${dateStr}\n\n`;

      // --- Authors & Credentials ---
      fullText += '1. АВТОРЫ И ДОСТУПЫ\n';
      fullText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      for (const acc of state.accounts) {
        fullText += `Автор: ${acc.name}\n`;
        const creds = state.credentials.filter((c: any) => c.accountId === acc.id);
        if (creds.length > 0) {
          for (const c of creds) {
            fullText += `  • [${c.serviceName}] Логин: ${c.login}${c.password ? ` | Пароль: ${c.password}` : ''}\n`;
          }
        } else {
          fullText += '  (Нет данных)\n';
        }
        fullText += '\n';
      }

      // --- Books ---
      fullText += '2. СПИСОК КНИГ\n';
      fullText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      for (const book of state.books) {
        const author = state.accounts.find((a: any) => a.id === book.accountId)?.name || 'Неизвестен';
        const chaps = state.chapters.filter((c: any) => c.bookId === book.id);
        const charsArr = state.characters.filter((c: any) => c.bookId === book.id);
        const totalChars = chaps.reduce((sum: number, c: any) => sum + (c.content?.length || 0), 0);

        fullText += `Книга: ${book.title}\n`;
        fullText += `  Автор: ${author}\n`;
        fullText += `  Статус: ${book.status === 'PUBLISHED' ? 'Опубликовано' : book.status === 'IN_PROGRESS' ? 'В процессе' : 'В планах'}\n`;
        fullText += `  Главы: ${chaps.length} | Символов: ${totalChars.toLocaleString('ru-RU')}\n`;
        fullText += `  Персонажи: ${charsArr.map((c: any) => c.name).join(', ') || 'Нет'}\n`;
        fullText += '\n';
      }

      // --- Prompts ---
      fullText += '3. БИБЛИОТЕКА ПРОМПТОВ\n';
      fullText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      for (const p of state.prompts) {
        const author = state.accounts.find((a: any) => a.id === p.accountId)?.name || 'Общий';
        fullText += `Промпт: ${p.title} (${author})\n`;
        fullText += `${p.content.substring(0, 200)}${p.content.length > 200 ? '...' : ''}\n\n`;
      }

      // --- Ad Blocks ---
      fullText += '4. РЕКЛАМНЫЕ БЛОКИ\n';
      fullText += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
      for (const b of state.adBlocks) {
        const author = state.accounts.find((a: any) => a.id === b.accountId)?.name || 'Общий';
        fullText += `Блок: ${b.title} (${author})\n`;
        fullText += `${b.content.substring(0, 200)}${b.content.length > 200 ? '...' : ''}\n\n`;
      }

      await docs.documents.batchUpdate({
        documentId: docId,
        requestBody: {
          requests: [
            { insertText: { location: { index: 1 }, text: fullText } },
            {
              updateParagraphStyle: {
                range: { startIndex: 1, endIndex: title.length + 1 },
                paragraphStyle: { namedStyleType: 'HEADING_1' },
                fields: 'namedStyleType',
              }
            },
            // Add more styling if needed
          ]
        }
      });

      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;
      return { success: true, docId, docUrl, updatedTokens: tokens };
    } catch (err: any) {
      console.error('Google Docs export all error:', err);
      return { success: false, error: err.message };
    }
  });

  // ─── Window Controls ──────────────────────────────────────────────────────
  ipcMain.on('window-minimize', () => {
    BrowserWindow.getFocusedWindow()?.minimize();
  });

  ipcMain.on('window-close', () => {
    BrowserWindow.getFocusedWindow()?.close();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
