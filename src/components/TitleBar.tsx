import React from 'react';

export const TitleBar: React.FC = () => {
    return (
        <div className="h-10 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between select-none">
            <div className="flex items-center px-4 gap-2">
                <img src="icon.png" className="w-4 h-4" alt="app-icon" />
                <span className="text-xs font-semibold text-zinc-500 tracking-wider uppercase">Pisaka</span>
            </div>
        </div>
    );
};
