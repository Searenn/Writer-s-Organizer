import { AlertTriangle, X } from 'lucide-react';
import React from 'react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = 'Удалить',
    cancelText = 'Отмена',
    isDanger = true,
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div
                className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 rounded-2xl ${isDanger ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'}`}>
                            <AlertTriangle className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white leading-tight">{title}</h2>
                        </div>
                    </div>

                    <p className="text-zinc-400 text-sm leading-relaxed mb-8">
                        {message}
                    </p>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-semibold transition-all duration-200"
                        >
                            {cancelText}
                        </button>
                        <button
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`flex-1 px-4 py-3 rounded-2xl font-semibold text-white transition-all duration-200 shadow-lg ${isDanger
                                    ? 'bg-red-600 hover:bg-red-700 shadow-red-900/10'
                                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/10'
                                }`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors p-1"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
};
