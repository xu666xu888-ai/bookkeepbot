import { useState } from 'react';

export default function SearchFilter({ accounts, categories, onFilter, onClose }) {
    const [search, setSearch] = useState('');
    const [accountId, setAccountId] = useState('');
    const [categoryId, setCategoryId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const apply = () => {
        const f = {
            search, account_id: accountId, category_id: categoryId,
            date_from: dateFrom, date_to: dateTo,
        };
        Object.keys(f).forEach(k => { if (!f[k]) delete f[k]; });
        onFilter(f);
        onClose();
    };

    const reset = () => {
        setSearch(''); setAccountId(''); setCategoryId('');
        setDateFrom(''); setDateTo('');
        onFilter({});
        onClose();
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
                {/* 拉桿 */}
                <div className="flex justify-center pt-3 pb-2">
                    <div className="w-10 h-1 rounded-full bg-surface-3" />
                </div>

                {/* 標題 */}
                <div className="flex items-center justify-between px-5 pb-3">
                    <h2 className="font-semibold text-base">搜尋與篩選</h2>
                    <button onClick={onClose} className="text-text-dim hover:text-text text-sm p-1">✕</button>
                </div>

                <div className="px-5 pb-6 space-y-4">
                    {/* 搜尋 */}
                    <div>
                        <label className="text-xs text-text-dim mb-1.5 block">關鍵字</label>
                        <input
                            type="text"
                            placeholder="搜尋品項或描述..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm
                             placeholder:text-text-dim/40 focus:outline-none focus:border-accent
                             focus:ring-2 focus:ring-accent-glow transition-all"
                        />
                    </div>

                    {/* 帳戶 + 分類 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-text-dim mb-1.5 block">帳戶</label>
                            <select
                                value={accountId}
                                onChange={e => setAccountId(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm
                                 text-text focus:outline-none focus:border-accent transition-all"
                            >
                                <option value="">全部</option>
                                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-text-dim mb-1.5 block">分類</label>
                            <select
                                value={categoryId}
                                onChange={e => setCategoryId(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm
                                 text-text focus:outline-none focus:border-accent transition-all"
                            >
                                <option value="">全部</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* 日期 */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-text-dim mb-1.5 block">起始</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm
                                 text-text focus:outline-none focus:border-accent transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-text-dim mb-1.5 block">結束</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm
                                 text-text focus:outline-none focus:border-accent transition-all"
                            />
                        </div>
                    </div>

                    {/* 按鈕列 */}
                    <div className="flex gap-3 pt-1">
                        <button
                            onClick={reset}
                            className="flex-1 py-3 text-sm rounded-xl bg-surface-2 text-text-dim
                             hover:text-text active:scale-[0.98] transition-all"
                        >
                            清除
                        </button>
                        <button
                            onClick={apply}
                            className="flex-1 py-3 text-sm rounded-xl bg-accent text-white font-medium
                             hover:bg-accent-hover active:scale-[0.98] transition-all"
                        >
                            套用
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
