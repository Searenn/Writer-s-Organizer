export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '837905096830-dhn2kdp1f6n90ui8nk1cofoccdmc0bm8.apps.googleusercontent.com';

const SCOPES = 'https://www.googleapis.com/auth/documents https://www.googleapis.com/auth/drive.file';

export const loadGisScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Identity Services script'));
    document.head.appendChild(script);
  });
};

export const startGoogleAuth = async (): Promise<{ access_token: string; expires_in: number }> => {
  await loadGisScript();
  return new Promise((resolve, reject) => {
    try {
      const client = (window as any).google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: SCOPES,
        callback: (response: any) => {
          if (response.error !== undefined) {
            reject(new Error(response.error));
          }
          resolve({
            access_token: response.access_token,
            expires_in: response.expires_in
          });
        },
      });
      client.requestAccessToken({ prompt: 'consent' });
    } catch (err: any) {
      reject(err);
    }
  });
};

export const revokeGoogleToken = async (token: string): Promise<void> => {
  await loadGisScript();
  return new Promise((resolve) => {
    try {
      (window as any).google.accounts.oauth2.revoke(token, () => {
        resolve();
      });
    } catch {
      resolve();
    }
  });
};

export const findOrCreateFolder = async (token: string, folderName: string): Promise<string> => {
  const query = `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!searchRes.ok) throw new Error('Failed to search Drive for folder');
  const searchData = await searchRes.json();
  
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Create folder
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });
  if (!createRes.ok) throw new Error('Failed to create Drive folder');
  const createData = await createRes.json();
  return createData.id;
};

export const findOrCreateDocument = async (token: string, docId: string | undefined, title: string, folderId: string): Promise<string> => {
  if (docId) {
    // Check if exists
    const checkRes = await fetch(`https://www.googleapis.com/drive/v3/files/${docId}?fields=id`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (checkRes.ok) {
      return docId;
    }
    // If not found, fall through and create new
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: title,
      mimeType: 'application/vnd.google-apps.document',
      parents: [folderId]
    })
  });
  
  if (!createRes.ok) throw new Error('Failed to create document in Drive');
  const createData = await createRes.json();
  return createData.id;
};

export const clearDocumentAndInsertText = async (token: string, docId: string, title: string, htmlContent: string): Promise<void> => {
  // 1. Get doc length to clear it
  const docRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!docRes.ok) throw new Error('Failed to fetch document info');
  const docData = await docRes.json();
  const bodyContent = docData.body?.content || [];
  const docEndIndex = bodyContent[bodyContent.length - 1]?.endIndex || 1;

  const requests: any[] = [];
  
  // Clear existing content
  if (docEndIndex > 2) {
    requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: docEndIndex - 1 } } });
  }

  // Parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = htmlContent;
  
  // We'll build a plain string and ranges for headers
  let fullText = title + '\n\n';
  const headingRanges: { start: number, end: number }[] = [];
  
  const nodes = Array.from(tempDiv.childNodes);
  nodes.forEach(node => {
    if (node.nodeName.toLowerCase() === 'h2') {
      const text = (node.textContent || '') + '\n\n';
      const start = fullText.length + 1; // +1 because Google Docs is 1-indexed for the body
      fullText += text;
      headingRanges.push({ start, end: start + text.length });
    } else {
      let text = (node.textContent || '').trim();
      if (text) {
        text += '\n\n';
        fullText += text;
      }
    }
  });

  // Insert text
  requests.push({ insertText: { location: { index: 1 }, text: fullText } });

  // Apply TITLE style to the first line
  requests.push({
    updateParagraphStyle: {
      range: { startIndex: 1, endIndex: title.length + 2 },
      paragraphStyle: { namedStyleType: 'TITLE' },
      fields: 'namedStyleType'
    }
  });

  // Apply HEADING_2 to all parsed h2 tags
  headingRanges.forEach(range => {
    requests.push({
      updateParagraphStyle: {
        range: { startIndex: range.start, endIndex: range.end },
        paragraphStyle: { namedStyleType: 'HEADING_2' },
        fields: 'namedStyleType'
      }
    });
  });

  if (requests.length > 0) {
    const batchRes = await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ requests })
    });
    if (!batchRes.ok) {
      const err = await batchRes.json();
      throw new Error(`Failed to update document: ${err.error?.message || 'Unknown error'}`);
    }
  }
};
