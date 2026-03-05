import { Minus, X } from 'lucide-react';
import React from 'react';

export const TitleBar: React.FC = () => {
    const handleMinimize = () => {
        (window as any).electron.windowControl.minimize();
    };

    const handleClose = () => {
        (window as any).electron.windowControl.close();
    };

    return (
        <div className="h-10 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between select-none" style={{ WebkitAppRegion: 'drag' } as any}>
            <div className="flex items-center px-4 gap-2">
                <img src="/icon.ico" className="w-4 h-4" alt="app-icon" />
                <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Writer's Organizer</span>
            </div>

            <div className="flex h-full no-drag" style={{ WebkitAppRegion: 'no-drag' } as any}>
                <button
                    onClick={handleMinimize}
                    className="px-4 h-full hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors flex items-center justify-center"
                    title="Свернуть"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <button
                    onClick={handleClose}
                    className="px-4 h-full hover:bg-red-600 text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
                    title="Закрыть"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
