import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
    selectFile: () => ipcRenderer.invoke('select-file'),
    saveState: (state: string) => ipcRenderer.invoke('save-state', state),
    loadState: () => ipcRenderer.invoke('load-state'),
    googleAuthStart: () => ipcRenderer.invoke('google-auth-start'),
    googleRevoke: (tokens: any) => ipcRenderer.invoke('google-revoke', tokens),
    googleExportBook: (payload: any) => ipcRenderer.invoke('google-export-book', payload),
    googleExportAll: (payload: any) => ipcRenderer.invoke('google-export-all', payload),
    windowControl: {
        minimize: () => ipcRenderer.send('window-minimize'),
        close: () => ipcRenderer.send('window-close'),
    }
});
