import { Copy, ImageIcon, Megaphone, Plus, Settings, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useAppStore } from '../store';
import { AdBlock } from '../types';
import { cn, formatFilePath } from '../utils';
import { ConfirmationModal } from './ConfirmationModal';

export const AdBlocksView: React.FC = () => {
    const { state, addAdBlock, updateAdBlock, deleteAdBlock } = useAppStore();
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const shortenAccountName = (name: string) => name.split(':')[0].trim();

    const [formData, setFormData] = useState<Omit<AdBlock, 'id'>>({
        title: '',
        content: '',
        coverPath: '',
        accountId: '',
    });

    const [selectedAccountId, setSelectedAccountId] = useState<string>('all');

    const [confirmModal, setConfirmModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        onConfirm: () => { },
    });

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleDuplicate = (block: AdBlock) => {
        addAdBlock({
            title: `${block.title} (копия)`,
            content: block.content,
            coverPath: block.coverPath,
            accountId: block.accountId,
        });
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingId) {
            updateAdBlock(editingId, formData);
            setEditingId(null);
        } else {
            addAdBlock(formData);
        }
        setFormData({ title: '', content: '', coverPath: '', accountId: (selectedAccountId !== 'all' && selectedAccountId !== 'general') ? selectedAccountId : '' });
        setIsAdding(false);
    };

    const startEdit = (block: AdBlock) => {
        setFormData({
            title: block.title,
            content: block.content,
            coverPath: block.coverPath || '',
            accountId: block.accountId || '',
        });
        setEditingId(block.id);
        setIsAdding(true);
    };

    return (
        <div className="p-8 max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Рекламные блоки</h1>
                    <p className="text-zinc-400">Управляйте рекламными материалами и обложками</p>
                </div>
                <button
                    onClick={() => {
                        setIsAdding(true);
                        setEditingId(null);
                        setFormData({
                            title: '',
                            content: '',
                            coverPath: '',
                            accountId: (selectedAccountId !== 'all' && selectedAccountId !== 'general') ? selectedAccountId : ''
                        });
                    }}
                    className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Добавить блок
                </button>
            </div>

            <div className="flex items-center gap-2 mb-6 bg-zinc-900/50 p-1.5 rounded-xl border border-zinc-800/50 overflow-x-auto shrink-0 scrollbar-none w-full max-w-full">
                <button
                    onClick={() => setSelectedAccountId('all')}
                    className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                        selectedAccountId === 'all'
                            ? "bg-emerald-600 text-white shadow shadow-emerald-900/20"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    )}
                >
                    Все
                </button>
                <button
                    onClick={() => setSelectedAccountId('general')}
                    className={cn(
                        "px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                        selectedAccountId === 'general'
                            ? "bg-zinc-100 text-zinc-950 shadow shadow-black/20"
                            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                    )}
                >
                    Общие
                </button>
                {state.accounts.map((acc) => (
                    <button
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={cn(
                            "px-3 py-1 rounded-lg text-xs font-semibold transition-all duration-200 whitespace-nowrap",
                            selectedAccountId === acc.id
                                ? "bg-zinc-100 text-zinc-950 shadow shadow-black/20"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                        )}
                    >
                        {shortenAccountName(acc.name)}
                    </button>
                ))}
            </div>

            {isAdding && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden motion-safe:animate-in motion-safe:zoom-in-95">
                        <div className="p-6 border-b border-zinc-800 flex items-center justify-between">
                            <h2 className="text-xl font-bold text-white">
                                {editingId ? 'Редактировать блок' : 'Новый рекламный блок'}
                            </h2>
                            <button
                                onClick={() => setIsAdding(false)}
                                className="text-zinc-400 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Название</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                    placeholder="Название рекламного блока..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Текст блока</label>
                                <textarea
                                    required
                                    rows={6}
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                                    placeholder="Введите текст рекламы..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Путь к обложке (локальный)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={formData.coverPath}
                                        onChange={(e) => setFormData({ ...formData, coverPath: e.target.value })}
                                        className="flex-1 bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                        placeholder="C:\Users\...\cover.jpg"
                                    />
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const path = await window.electron.selectFile();
                                            if (path) {
                                                setFormData({ ...formData, coverPath: path });
                                            }
                                        }}
                                        className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg border border-zinc-700"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-xs text-zinc-500 mt-1">
                                    Укажите полный путь к файлу изображения на вашем компьютере.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-1">Жанр / Аккаунт</label>
                                <select
                                    value={formData.accountId || ''}
                                    onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                                    className="w-full bg-zinc-800 border-zinc-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 outline-none"
                                >
                                    <option value="">Без привязки (Общие)</option>
                                    {state.accounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {formData.coverPath && (
                                <div className="bg-zinc-800 rounded-lg p-2 border border-zinc-700">
                                    <p className="text-xs text-zinc-500 mb-2">Предпросмотр обложки:</p>
                                    <img
                                        src={formatFilePath(formData.coverPath)}
                                        alt="Preview"
                                        className="max-h-64 mx-auto rounded overflow-hidden object-contain shadow-2xl bg-black/20"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                            )}
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsAdding(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-white transition-colors"
                                >
                                    Отмена
                                </button>
                                <button
                                    type="submit"
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                                >
                                    {editingId ? 'Сохранить' : 'Создать'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {state.adBlocks
                    .filter(block => {
                        if (selectedAccountId === 'all') return true;
                        if (selectedAccountId === 'general') return !block.accountId;
                        return block.accountId === selectedAccountId;
                    })
                    .map((block) => (
                        <div
                            key={block.id}
                            className="group bg-zinc-900 border border-zinc-800 rounded-xl hover:border-emerald-500/30 transition-all overflow-hidden"
                        >
                            <div className="flex h-24">
                                {/* Cover — left side */}
                                {block.coverPath ? (
                                    <div className="w-20 flex-shrink-0 bg-zinc-950 overflow-hidden">
                                        <img
                                            src={formatFilePath(block.coverPath)}
                                            alt={block.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    </div>
                                ) : (
                                    <div className="w-20 flex-shrink-0 bg-zinc-950/50 flex items-center justify-center">
                                        <Megaphone className="w-5 h-5 text-zinc-700" />
                                    </div>
                                )}

                                {/* Content — right side */}
                                <div className="flex-1 p-3 flex flex-col min-w-0">
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="text-sm font-bold text-white group-hover:text-emerald-400 transition-colors line-clamp-1">
                                            {block.title}
                                        </h3>
                                        <div className="flex gap-1 shrink-0 ml-2">
                                            <button
                                                onClick={() => handleDuplicate(block)}
                                                className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                                                title="Дублировать"
                                            >
                                                <Copy className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => startEdit(block)}
                                                className="p-1 text-zinc-500 hover:text-white transition-colors"
                                            >
                                                <Settings className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setConfirmModal({
                                                        isOpen: true,
                                                        title: 'Удалить блок?',
                                                        message: `Вы уверен, что хотите удалить рекламный блок "${block.title}"?`,
                                                        onConfirm: () => deleteAdBlock(block.id),
                                                    });
                                                }}
                                                className="p-1 text-zinc-500 hover:text-red-400 transition-colors"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="bg-zinc-800/40 rounded-lg p-1.5 relative group/content flex-1 overflow-hidden">
                                        <pre className="text-[10px] text-zinc-300 whitespace-pre-wrap font-sans line-clamp-3">
                                            {block.content}
                                        </pre>
                                        <button
                                            onClick={() => handleCopy(block.content)}
                                            className="absolute top-1 right-1 p-1 bg-zinc-900/90 backdrop-blur rounded border border-zinc-700 text-zinc-400 hover:text-emerald-400 hover:border-emerald-500/50 transition-all opacity-0 group-hover/content:opacity-100"
                                            title="Копировать текст"
                                        >
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>

                                    {block.coverPath && (
                                        <div className="mt-1 flex items-center justify-between text-[9px]">
                                            <span className="text-zinc-600 truncate mr-2" title={block.coverPath}>
                                                {block.coverPath}
                                            </span>
                                            <button
                                                onClick={() => handleCopy(block.coverPath || '')}
                                                className="text-emerald-500 hover:text-emerald-400 font-medium shrink-0"
                                            >
                                                Копия
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                {state.adBlocks.length === 0 && !isAdding && (
                    <div className="col-span-full border-2 border-dashed border-zinc-800 rounded-3xl p-12 text-center">
                        <Megaphone className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-zinc-400 mb-2">У вас пока нет рекламных блоков</h3>
                        <p className="text-zinc-600 mb-6">Создайте свой первый блок, чтобы быстро копировать его текст и обложку</p>
                        <button
                            onClick={() => setIsAdding(true)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-emerald-400 px-6 py-2 rounded-xl transition-colors border border-zinc-700"
                        >
                            Создать блок
                        </button>
                    </div>
                )}
            </div>

            <ConfirmationModal
                isOpen={confirmModal.isOpen}
                title={confirmModal.title}
                message={confirmModal.message}
                onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                onConfirm={confirmModal.onConfirm}
            />
        </div>
    );
};
