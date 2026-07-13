import { Check, Copy, Eye, EyeOff, Key, Plus, Trash2, ExternalLink } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useAppStore } from '../store';
import { Credential } from '../types';

const CredentialRow: React.FC<{
    cred: Credential;
    onUpdate: (id: string, updates: Partial<Credential>) => void;
    onDelete: (id: string) => void;
}> = ({ cred, onUpdate, onDelete }) => {
    const [localServiceName, setLocalServiceName] = useState(cred.serviceName);
    const [localLogin, setLocalLogin] = useState(cred.login);
    const [localPassword, setLocalPassword] = useState(cred.password || '');
    const [localLink, setLocalLink] = useState(cred.link || '');
    const [pwVisible, setPwVisible] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Sync from props when they change externally (though unlikely in this simplistic model)
    useEffect(() => { setLocalServiceName(cred.serviceName); }, [cred.serviceName]);
    useEffect(() => { setLocalLogin(cred.login); }, [cred.login]);
    useEffect(() => { setLocalPassword(cred.password || ''); }, [cred.password]);
    useEffect(() => { setLocalLink(cred.link || ''); }, [cred.link]);

    const handleCopy = (text: string, type: 'login' | 'pass') => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedId(type);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleBlur = () => {
        if (
            localServiceName !== cred.serviceName ||
            localLogin !== cred.login ||
            localPassword !== (cred.password || '') ||
            localLink !== (cred.link || '')
        ) {
            onUpdate(cred.id, {
                serviceName: localServiceName,
                login: localLogin,
                password: localPassword,
                link: localLink,
            });
        }
    };

    const confirmDelete = () => {
        if (window.confirm('Вы уверены, что хотите удалить этот доступ?')) {
            onDelete(cred.id);
        }
    };

    return (
        <div className="grid grid-cols-[1.2fr_1.2fr_1.5fr_1.5fr_auto] gap-2 items-center hover:bg-zinc-800/40 p-1.5 rounded-lg transition-colors group">
            {/* Платформа */}
            <input
                value={localServiceName}
                onChange={e => setLocalServiceName(e.target.value)}
                onBlur={handleBlur}
                placeholder="Платформа"
                className="bg-transparent border border-transparent hover:border-zinc-700/50 focus:bg-zinc-950 focus:border-emerald-500 rounded-md px-2 py-1 text-sm text-emerald-400 font-medium outline-none w-full transition-colors"
            />

            {/* Ссылка */}
            <div className="flex items-center gap-1 overflow-hidden relative group/input">
                <input
                    value={localLink}
                    onChange={e => setLocalLink(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Ссылка"
                    className="bg-transparent border border-transparent hover:border-zinc-700/50 focus:bg-zinc-950 focus:border-emerald-500 rounded-md px-2 py-1 text-sm text-zinc-300 outline-none w-full transition-colors pr-8"
                />
                {localLink && (
                    <a
                        href={localLink.startsWith('http') ? localLink : `https://${localLink}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute right-1 p-1 text-zinc-500 hover:text-emerald-400 bg-zinc-900 rounded transition-colors hidden group-hover/input:block focus:block"
                        title="Открыть ссылку"
                        tabIndex={-1}
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                )}
            </div>

            {/* Логин */}
            <div className="flex items-center gap-1 overflow-hidden relative group/input">
                <input
                    value={localLogin}
                    onChange={e => setLocalLogin(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Логин"
                    className="bg-transparent border border-transparent hover:border-zinc-700/50 focus:bg-zinc-950 focus:border-emerald-500 rounded-md px-2 py-1 text-sm text-zinc-200 font-mono outline-none w-full transition-colors"
                />
                <button
                    onClick={() => handleCopy(localLogin, 'login')}
                    className={`absolute right-1 p-1 text-zinc-500 hover:text-emerald-400 bg-zinc-900 rounded ${!localLogin ? 'hidden' : 'opacity-0 group-hover/input:opacity-100 focus:opacity-100'} transition-opacity`}
                    title="Копировать логин"
                    tabIndex={-1}
                >
                    {copiedId === 'login' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
            </div>

            {/* Пароль */}
            <div className="flex items-center gap-1 overflow-hidden relative group/input">
                <input
                    type={pwVisible ? "text" : "password"}
                    value={localPassword}
                    onChange={e => setLocalPassword(e.target.value)}
                    onBlur={handleBlur}
                    placeholder="Пароль"
                    className="bg-transparent border border-transparent hover:border-zinc-700/50 focus:bg-zinc-950 focus:border-emerald-500 rounded-md px-2 py-1 text-sm text-zinc-400 font-mono outline-none w-full transition-colors pr-14"
                />
                <div className={`absolute right-1 flex items-center gap-0.5 ${!localPassword ? 'hidden' : 'opacity-0 group-hover/input:opacity-100 focus-within:opacity-100'} transition-opacity`}>
                    <button
                        onClick={() => setPwVisible(!pwVisible)}
                        className="p-1 text-zinc-500 hover:text-zinc-300 bg-zinc-900 rounded"
                        title={pwVisible ? "Скрыть" : "Показать"}
                        tabIndex={-1}
                    >
                        {pwVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={() => handleCopy(localPassword, 'pass')}
                        className="p-1 text-zinc-500 hover:text-emerald-400 bg-zinc-900 rounded"
                        title="Копировать пароль"
                        tabIndex={-1}
                    >
                        {copiedId === 'pass' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </div>

            {/* Действия (только при наведении или фокусе) */}
            <div className="flex items-center gap-1 pr-1 shrink-0 w-8 justify-end opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <button
                    onClick={confirmDelete}
                    className="p-1 text-zinc-500 hover:text-red-400 rounded"
                    title="Удалить"
                    tabIndex={-1}
                >
                    <Trash2 className="w-3.5 h-3.5" />
                </button>
            </div>
        </div>
    );
};

export const CredentialsView: React.FC = () => {
    const { state, addCredential, updateCredential, deleteCredential } = useAppStore();

    const handleAdd = (accountId: string) => {
        addCredential({
            accountId,
            serviceName: '',
            login: '',
            password: '',
            notes: '',
            link: '',
        });
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 pb-32 max-w-5xl mx-auto flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between mb-8 shrink-0">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-3">
                        <Key className="w-8 h-8 text-emerald-400" />
                        Доступы
                    </h1>
                    <p className="text-zinc-500 mt-2">Логины и пароли по аккаунтам-жанрам</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin">
                {state.accounts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-zinc-500 border-2 border-dashed border-zinc-800 rounded-2xl">
                        <Key className="w-12 h-12 mb-4 opacity-20" />
                        <p className="text-lg font-medium">Сначала создайте аккаунт</p>
                        <p className="text-sm mt-1">Доступы привязываются к аккаунтам</p>
                    </div>
                ) : (
                    <div className="space-y-6">
                        {state.accounts.map((account) => {
                            const accountCreds = (state.credentials || []).filter(c => c.accountId === account.id);

                            return (
                                <div key={account.id} className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl overflow-hidden p-4">

                                    {/* Заголовок аккаунта */}
                                    <div className="flex items-center gap-3 mb-4 pl-2">
                                        <div className="w-6 h-6 rounded-md bg-emerald-500/10 text-emerald-400 flex items-center justify-center text-sm font-bold border border-emerald-500/20">
                                            {account.name.charAt(0).toUpperCase()}
                                        </div>
                                        <h3 className="text-base font-bold text-zinc-200">{account.name}</h3>
                                    </div>

                                    {/* Сетка доступов */}
                                    <div className="space-y-1">
                                        {accountCreds.map(cred => (
                                            <CredentialRow
                                                key={cred.id}
                                                cred={cred}
                                                onUpdate={updateCredential}
                                                onDelete={deleteCredential}
                                            />
                                        ))}

                                        {/* Кнопка добавления новой связки */}
                                        <div className="pl-1 pt-2">
                                            <button
                                                onClick={() => handleAdd(account.id)}
                                                className="flex items-center gap-1.5 text-xs font-medium text-emerald-500/70 hover:text-emerald-400 transition-colors px-2 py-1"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Добавить связку
                                            </button>
                                        </div>
                                    </div>

                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
