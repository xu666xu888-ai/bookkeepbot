import { useState } from 'react';
import { api } from '../api';
import ActionSheet from './ActionSheet';

export default function TransactionForm({ accounts, categories, transaction, onSave, onClose, onBatchSave }) {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].slice(0, 5);

    const [form, setForm] = useState({
        date: transaction?.date || todayStr,
        time: transaction?.time || timeStr,
        item: transaction?.item || '',
        amount: transaction ? String(Math.abs(transaction.amount)) : '',
        isIncome: transaction ? transaction.amount < 0 : false,
        description: transaction?.description || '',
        account_id: transaction?.account_id || (accounts[0]?.id || ''),
        category_id: transaction?.category_id || '',
    });

    // AI 智能輸入
    const [aiText, setAiText] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const [aiResults, setAiResults] = useState(null); // 多筆解析結果
    const [aiError, setAiError] = useState('');

    // Bottom Sheet 狀態
    const [showAccountSheet, setShowAccountSheet] = useState(false);
    const [showCategorySheet, setShowCategorySheet] = useState(false);

    const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.item || !form.amount || !form.account_id) return;

        let amount = parseFloat(form.amount);
        if (form.isIncome) amount = -amount;

        onSave({
            date: form.date, time: form.time, item: form.item,
            amount, description: form.description,
            account_id: Number(form.account_id),
            category_id: form.category_id ? Number(form.category_id) : null,
        });
    };

    const handleAiParse = async (e) => {
        e?.preventDefault();
        if (!aiText.trim()) return;

        setAiLoading(true);
        setAiError('');
        setAiResults(null);

        try {
            const { transactions } = await api.aiParse(aiText.trim());

            if (!transactions || transactions.length === 0) {
                setAiError('AI 無法解析，請換個說法');
                return;
            }

            if (transactions.length === 1) {
                // 單筆：直接填入表單
                const tx = transactions[0];
                setForm({
                    item: tx.item,
                    amount: String(tx.amount),
                    isIncome: tx.isIncome,
                    account_id: tx.account_id || accounts[0]?.id || '',
                    category_id: tx.category_id || '',
                    date: tx.date || todayStr,
                    time: tx.time || timeStr,
                    description: tx.description || '',
                });
                setAiText('');
            } else {
                // 多筆：顯示預覽列表
                setAiResults(transactions);
            }
        } catch (err) {
            setAiError(err.message || '解析失敗');
        } finally {
            setAiLoading(false);
        }
    };

    const handleBatchSave = async () => {
        if (!aiResults) return;
        for (const tx of aiResults) {
            let amount = tx.amount;
            if (tx.isIncome) amount = -amount;
            await onSave({
                date: tx.date || todayStr,
                time: tx.time || timeStr,
                item: tx.item,
                amount,
                description: tx.description || '',
                account_id: Number(tx.account_id || accounts[0]?.id),
                category_id: tx.category_id ? Number(tx.category_id) : null,
            });
        }
        setAiResults(null);
        setAiText('');
    };

    const handleBackdrop = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    const handleDelete = () => {
        if (transaction && confirm('確定要刪除這筆交易嗎？')) {
            onClose();
            window.dispatchEvent(new CustomEvent('delete-tx', { detail: transaction.id }));
        }
    };

    // 找分類名稱
    const getCategoryName = (id) => categories.find(c => c.id === Number(id))?.name || '';
    const getAccountName = (id) => accounts.find(a => a.id === Number(id))?.name || '';

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center animate-fade-in"
            onClick={handleBackdrop}
        >
            <div className="w-full max-w-lg bg-bg rounded-t-3xl border-t border-x border-border
                        max-h-[92dvh] overflow-y-auto animate-slide-up safe-bottom">
                {/* 拉桿 */}
                <div className="flex justify-center pt-3 pb-1">
                    <div className="w-10 h-1 rounded-full bg-surface-3" />
                </div>

                {/* 標題列 */}
                <div className="flex items-center justify-between px-5 py-2">
                    <h2 className="font-semibold text-base">
                        {transaction ? '編輯交易' : '新增交易'}
                    </h2>
                    <button onClick={onClose} className="text-text-dim hover:text-text p-1 text-sm">✕</button>
                </div>

                {/* AI 智能輸入（僅新增模式） */}
                {!transaction && (
                    <div className="px-5 mb-4">
                        <form onSubmit={handleAiParse} className="flex gap-2">
                            <input
                                type="text"
                                value={aiText}
                                onChange={e => setAiText(e.target.value)}
                                placeholder="✨ 試試「早餐 50」或「房租28000 電費2000」"
                                disabled={aiLoading}
                                className="flex-1 bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 text-sm
                                 placeholder:text-text-dim/40
                                 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow
                                 transition-all disabled:opacity-50"
                            />
                            <button
                                type="submit"
                                disabled={aiLoading || !aiText.trim()}
                                className="px-4 py-3 bg-accent text-white text-sm rounded-xl
                                 hover:bg-accent-hover active:scale-[0.98] transition-all
                                 disabled:opacity-50 flex-shrink-0"
                            >
                                {aiLoading ? (
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : '✨'}
                            </button>
                        </form>

                        {aiError && (
                            <p className="text-xs text-expense mt-2">{aiError}</p>
                        )}

                        {/* 多筆解析預覽 */}
                        {aiResults && (
                            <div className="mt-3 glass rounded-xl p-3 space-y-2">
                                <p className="text-xs text-text-dim">AI 解析出 {aiResults.length} 筆交易：</p>
                                {aiResults.map((tx, i) => (
                                    <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                                        <div>
                                            <p className="text-sm font-medium">{tx.item}</p>
                                            <p className="text-[10px] text-text-dim">
                                                {getCategoryName(tx.category_id) || '無分類'} · {getAccountName(tx.account_id)}
                                            </p>
                                        </div>
                                        <p className={`text-sm font-semibold tabular-nums ${tx.isIncome ? 'text-income' : 'text-expense'}`}>
                                            {tx.isIncome ? '+' : '-'}${tx.amount.toLocaleString()}
                                        </p>
                                    </div>
                                ))}
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={() => setAiResults(null)}
                                        className="flex-1 py-2 text-xs rounded-lg bg-surface-2 text-text-dim
                                         active:scale-[0.98] transition-all"
                                    >取消</button>
                                    <button
                                        onClick={handleBatchSave}
                                        className="flex-1 py-2 text-xs rounded-lg bg-accent text-white
                                         active:scale-[0.98] transition-all"
                                    >全部儲存 ({aiResults.length} 筆)</button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* 分隔線 */}
                {!transaction && !aiResults && (
                    <div className="flex items-center gap-3 px-5 mb-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-text-dim">或手動輸入</span>
                        <div className="flex-1 h-px bg-border" />
                    </div>
                )}

                {/* 手動表單（多筆預覽時隱藏） */}
                {!aiResults && (
                    <form onSubmit={handleSubmit} className="px-5 pb-6 space-y-4">
                        {/* 收入/支出 切換 */}
                        <div className="flex rounded-xl overflow-hidden bg-surface p-1 gap-1">
                            <button
                                type="button"
                                onClick={() => update('isIncome', false)}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${!form.isIncome
                                    ? 'bg-expense text-white shadow-sm'
                                    : 'text-text-dim'
                                    }`}
                            >支出</button>
                            <button
                                type="button"
                                onClick={() => update('isIncome', true)}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${form.isIncome
                                    ? 'bg-income text-white shadow-sm'
                                    : 'text-text-dim'
                                    }`}
                            >收入</button>
                        </div>

                        {/* 品項 + 金額 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-text-dim mb-1.5 block">品項</label>
                                <input
                                    type="text" value={form.item}
                                    onChange={e => update('item', e.target.value)}
                                    placeholder="早餐" required
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm
                                   focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-dim mb-1.5 block">金額</label>
                                <input
                                    type="number" value={form.amount}
                                    onChange={e => update('amount', e.target.value)}
                                    placeholder="50" required min="0" step="0.01"
                                    className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm
                                   focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow transition-all"
                                />
                            </div>
                        </div>

                        {/* 帳戶 + 分類 (改為 Bottom Sheet) */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="relative">
                                <label className="text-xs text-text-dim mb-1.5 block">帳戶</label>
                                <div
                                    onClick={() => setShowAccountSheet(true)}
                                    className="w-full bg-[#1c1c1e] text-white border border-border rounded-xl px-3 py-3 text-sm
                                       flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer select-none"
                                >
                                    <span className={!form.account_id ? 'text-text-dim' : ''}>
                                        {accounts.find(a => a.id == form.account_id)?.name || '選擇'}
                                    </span>
                                    <svg className="fill-current h-4 w-4 text-text-dim" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                </div>
                            </div>
                            <div className="relative">
                                <label className="text-xs text-text-dim mb-1.5 block">分類</label>
                                <div
                                    onClick={() => setShowCategorySheet(true)}
                                    className="w-full bg-[#1c1c1e] text-white border border-border rounded-xl px-3 py-3 text-sm
                                       flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer select-none"
                                >
                                    <span className={!form.category_id ? 'text-text-dim' : ''}>
                                        {categories.find(c => c.id == form.category_id)?.name || '無'}
                                    </span>
                                    <svg className="fill-current h-4 w-4 text-text-dim" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                                </div>
                            </div>
                        </div>

                        {/* 日期 + 時間 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-text-dim mb-1.5 block">日期</label>
                                <input
                                    type="date" value={form.date}
                                    onChange={e => update('date', e.target.value)}
                                    className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm
                                   focus:outline-none focus:border-accent transition-all"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-text-dim mb-1.5 block">時間</label>
                                <input
                                    type="time" value={form.time}
                                    onChange={e => update('time', e.target.value)}
                                    className="w-full bg-surface border border-border rounded-xl px-3 py-3 text-sm
                                   focus:outline-none focus:border-accent transition-all"
                                />
                            </div>
                        </div>

                        {/* 描述 */}
                        <div>
                            <label className="text-xs text-text-dim mb-1.5 block">備註</label>
                            <input
                                type="text" value={form.description}
                                onChange={e => update('description', e.target.value)}
                                placeholder="選填"
                                className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm
                               focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent-glow transition-all"
                            />
                        </div>

                        {/* 按鈕 */}
                        <div className="flex gap-3 pt-1">
                            {transaction && (
                                <button
                                    type="button" onClick={handleDelete}
                                    className="px-5 py-3 text-sm rounded-xl bg-expense-bg text-expense
                                     active:scale-[0.98] transition-all"
                                >刪除</button>
                            )}
                            <button
                                type="submit"
                                className="flex-1 py-3 bg-accent hover:bg-accent-hover text-white font-medium
                               rounded-xl transition-all active:scale-[0.98]"
                            >{transaction ? '更新' : '儲存'}</button>
                        </div>
                    </form>
                )}
            </div>

            <ActionSheet
                visible={showAccountSheet}
                onClose={() => setShowAccountSheet(false)}
                title="選擇帳戶"
                options={accounts.map(a => ({ label: a.name, value: a.id }))}
                onSelect={(val) => update('account_id', val)}
                selectedValue={Number(form.account_id)}
            />

            <ActionSheet
                visible={showCategorySheet}
                onClose={() => setShowCategorySheet(false)}
                title="選擇分類"
                options={[
                    { label: '無', value: '' },
                    ...categories.map(c => ({ label: c.name, value: c.id }))
                ]}
                onSelect={(val) => update('category_id', val)}
                selectedValue={form.category_id ? Number(form.category_id) : ''}
            />
        </div>
    );
}
