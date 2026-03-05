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
    icon: path.join(__dirname, '../public/icon.ico'),
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
    chapters: any[];
    characters: any[];
    settings: any[];
    tokens: any;
  }) => {
    try {
      const { book, chapters, characters, settings, tokens } = payload;

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

      let docId: string = book.googleDocId;

      // Create new document if none exists
      if (!docId) {
        const createRes = await docs.documents.create({
          requestBody: { title: book.title },
        });
        docId = createRes.data.documentId!;
      }

      // Get current document to find content length for clearing
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
