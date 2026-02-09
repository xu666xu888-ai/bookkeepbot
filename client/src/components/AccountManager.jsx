import { useState } from 'react';
import { api } from '../api';

export default function AccountManager({ accounts, onUpdate, onClose }) {
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            await api.createAccount(newName.trim());
            setNewName('');
            onUpdate();
        } catch (err) { alert(err.message); }
    };

    const handleUpdate = async (id) => {
        if (!editName.trim()) return;
        try {
            await api.updateAccount(id, editName.trim());
            setEditingId(null);
            onUpdate();
        } catch (err) { alert(err.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('確定要刪除此帳戶？')) return;
        try {
            await api.deleteAccount(id);
            onUpdate();
        } catch (err) { alert(err.message); }
    };

    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-fade-in"
            onClick={handleBackdrop}
        >
            <div className="w-full max-w-lg bg-bg rounded-t-3xl border-t border-x border-border
                        max-h-[80dvh] overflow-y-auto animate-slide-up safe-bottom">
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-surface-3" />
                </div>

                <div className="flex items-center justify-between px-5 pb-3">
                    <h2 className="font-semibold text-base">🏦 帳戶管理</h2>
                    <button onClick={onClose} className="text-text-dim hover:text-text text-sm p-1">✕</button>
                </div>

                <div className="px-5 pb-6 space-y-3">
                    {/* 新增 */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder="新帳戶名稱"
                            className="flex-1 bg-surface border border-border rounded-xl px-4 py-3 text-sm
                             focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow transition-all"
                        />
                        <button
                            onClick={handleCreate}
                            className="px-4 py-3 bg-accent text-white text-sm rounded-xl
                             hover:bg-accent-hover active:scale-[0.98] transition-all"
                        >
                            新增
                        </button>
                    </div>

                    {/* 帳戶列表 */}
                    <div className="space-y-1">
                        {accounts.map(a => (
                            <div key={a.id} className="flex items-center gap-3 py-3 px-1">
                                {editingId === a.id ? (
                                    <>
                                        <input
                                            type="text"
                                            value={editName}
                                            onChange={e => setEditName(e.target.value)}
                                            onKeyDown={e => e.key === 'Enter' && handleUpdate(a.id)}
                                            className="flex-1 bg-surface border border-accent rounded-xl px-3 py-2 text-sm
                                             focus:outline-none"
                                            autoFocus
                                        />
                                        <button onClick={() => handleUpdate(a.id)}
                                            className="text-accent text-sm font-medium px-2">儲存</button>
                                        <button onClick={() => setEditingId(null)}
                                            className="text-text-dim text-sm px-2">取消</button>
                                    </>
                                ) : (
                                    <>
                                        <span className="flex-1 text-sm font-medium">{a.name}</span>
                                        <span className="text-xs text-text-dim tabular-nums">
                                            ${Math.abs(a.balance || 0).toLocaleString()}
                                        </span>
                                        <button
                                            onClick={() => { setEditingId(a.id); setEditName(a.name); }}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg
                                             text-text-dim hover:bg-surface-2 text-xs transition-all"
                                        >✏️</button>
                                        <button
                                            onClick={() => handleDelete(a.id)}
                                            className="w-8 h-8 flex items-center justify-center rounded-lg
                                             text-text-dim hover:bg-expense-bg hover:text-expense text-xs transition-all"
                                        >🗑️</button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>

                    {accounts.length === 0 && (
                        <p className="text-xs text-text-dim text-center py-4">尚無帳戶，請新增一個</p>
                    )}
                </div>
            </div>
        </div>
    );
}
