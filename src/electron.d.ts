declare module '*.png' {
    const src: string;
    export default src;
}
declare module '*.ico' {
    const src: string;
    export default src;
}

export { };

declare global {
    interface Window {
        electron: {
            selectFile: () => Promise<string | null>;
            saveState: (state: string) => Promise<boolean>;
            loadState: () => Promise<string | null>;
            googleAuthStart: () => Promise<{ success: boolean; tokens?: any; error?: string }>;
            googleRevoke: (tokens: any) => Promise<{ success: boolean; error?: string }>;
            googleExportBook: (payload: {
                book: any;
                accountName: string;
                chapters: any[];
                characters: any[];
                settings: any[];
                tokens: any;
            }) => Promise<{ success: boolean; docId?: string; docUrl?: string; updatedTokens?: any; error?: string }>;
            googleExportAll: (payload: {
                state: any;
                tokens: any;
            }) => Promise<{ success: boolean; docId?: string; docUrl?: string; updatedTokens?: any; error?: string }>;
        };
    }
}
