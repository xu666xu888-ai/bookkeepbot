import { useState } from 'react';
import { api } from '../api';

export default function CategoryManager({ categories, onUpdate, onClose }) {
    const [newName, setNewName] = useState('');

    const handleCreate = async () => {
        if (!newName.trim()) return;
        try {
            await api.createCategory(newName.trim());
            setNewName('');
            onUpdate();
        } catch (err) { alert(err.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('確定要刪除此分類？\n（關聯交易的分類將被清除）')) return;
        try {
            await api.deleteCategory(id);
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
                    <h2 className="font-semibold text-base">📂 分類管理</h2>
                    <button onClick={onClose} className="text-text-dim hover:text-text text-sm p-1">✕</button>
                </div>

                <div className="px-5 pb-6 space-y-4">
                    {/* 新增 */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            placeholder="新分類名稱"
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

                    {/* Tag 列表 */}
                    <div className="flex flex-wrap gap-2">
                        {categories.map(c => (
                            <span
                                key={c.id}
                                className="inline-flex items-center gap-2 glass
                                 rounded-xl px-4 py-2.5 text-sm"
                            >
                                {c.name}
                                <button
                                    onClick={() => handleDelete(c.id)}
                                    className="text-text-dim/50 hover:text-expense transition-colors text-xs"
                                >✕</button>
                            </span>
                        ))}
                    </div>

                    {categories.length === 0 && (
                        <p className="text-xs text-text-dim text-center py-4">尚無分類</p>
                    )}
                </div>
            </div>
        </div>
    );
}
