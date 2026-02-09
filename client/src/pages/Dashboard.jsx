import { useState, useEffect, useCallback } from 'react';
import { api, logout } from '../api';
import TransactionList from '../components/TransactionList';
import TransactionForm from '../components/TransactionForm';
import BalanceSummary from '../components/BalanceSummary';
import SearchFilter from '../components/SearchFilter';
import AccountManager from '../components/AccountManager';
import CategoryManager from '../components/CategoryManager';

export default function Dashboard() {
    const [transactions, setTransactions] = useState([]);
    const [accounts, setAccounts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({});
    const [hasFilters, setHasFilters] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingTx, setEditingTx] = useState(null);

    // 彈窗控制
    const [showSearch, setShowSearch] = useState(false);
    const [showAccounts, setShowAccounts] = useState(false);
    const [showCategories, setShowCategories] = useState(false);

    const fetchTransactions = useCallback(async (f = filters) => {
        try {
            const params = {};
            if (f.search) params.search = f.search;
            if (f.account_id) params.account_id = f.account_id;
            if (f.category_id) params.category_id = f.category_id;
            if (f.date_from) params.date_from = f.date_from;
            if (f.date_to) params.date_to = f.date_to;

            const res = await api.getTransactions(params);
            setTransactions(res.data);
            setTotal(res.total);
        } catch (err) { console.error(err); }
    }, [filters]);

    const fetchAccounts = useCallback(async () => {
        try { setAccounts(await api.getAccounts()); }
        catch (err) { console.error(err); }
    }, []);

    const fetchCategories = useCallback(async () => {
        try { setCategories(await api.getCategories()); }
        catch (err) { console.error(err); }
    }, []);

    useEffect(() => {
        Promise.all([fetchTransactions(), fetchAccounts(), fetchCategories()])
            .finally(() => setLoading(false));
    }, []);

    // 監聽交易刪除事件（從 TransactionForm 觸發）
    useEffect(() => {
        const handler = async (e) => {
            try {
                await api.deleteTransaction(e.detail);
                fetchTransactions();
                fetchAccounts();
            } catch (err) { alert(err.message); }
        };
        window.addEventListener('delete-tx', handler);
        return () => window.removeEventListener('delete-tx', handler);
    }, [fetchTransactions, fetchAccounts]);

    const handleFilter = (f) => {
        setFilters(f);
        setHasFilters(Object.keys(f).length > 0);
        fetchTransactions(f);
    };

    const handleSave = async (data) => {
        try {
            if (editingTx) {
                await api.updateTransaction(editingTx.id, data);
            } else {
                await api.createTransaction(data);
            }
            setShowForm(false);
            setEditingTx(null);
            fetchTransactions();
            fetchAccounts();
        } catch (err) { alert(err.message); }
    };

    const handleDelete = async (id) => {
        if (!confirm('確定要刪除這筆交易嗎？')) return;
        try {
            await api.deleteTransaction(id);
            fetchTransactions();
            fetchAccounts();
        } catch (err) { alert(err.message); }
    };

    const handleEdit = (tx) => {
        setEditingTx(tx);
        setShowForm(true);
    };

    if (loading) {
        return (
            <div className="min-h-dvh flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-dvh pb-24 safe-top">
            {/* Header */}
            <header className="sticky top-0 z-30 glass safe-top">
                <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
                    <h1 className="text-base font-semibold tracking-tight">史萊姆-好玩遊戲區</h1>
                    <div className="flex items-center gap-1.5">
                        {/* 搜尋按鈕 */}
                        <button
                            onClick={() => setShowSearch(true)}
                            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-all text-sm
                            ${hasFilters
                                    ? 'bg-accent/20 text-accent'
                                    : 'bg-surface-2 text-text-dim hover:text-text'}`}
                        >
                            🔍
                        </button>
                        <button
                            onClick={() => setShowAccounts(true)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-2
                             text-text-dim hover:text-text transition-all text-sm"
                        >🏦</button>
                        <button
                            onClick={() => setShowCategories(true)}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-2
                             text-text-dim hover:text-text transition-all text-sm"
                        >📂</button>
                        <button
                            onClick={logout}
                            className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-2
                             text-text-dim hover:text-expense transition-all text-xs"
                        >⏻</button>
                    </div>
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-4 mt-4 space-y-4">
                <BalanceSummary accounts={accounts} transactions={transactions} />

                {/* 篩選狀態提示 */}
                {hasFilters && (
                    <div className="flex items-center gap-2 px-1">
                        <span className="text-xs text-accent">已套用篩選</span>
                        <button
                            onClick={() => handleFilter({})}
                            className="text-xs text-text-dim hover:text-text"
                        >清除</button>
                    </div>
                )}

                <TransactionList
                    transactions={transactions}
                    total={total}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </main>

            {/* 彈窗們 */}
            {showSearch && (
                <SearchFilter
                    accounts={accounts}
                    categories={categories}
                    onFilter={handleFilter}
                    onClose={() => setShowSearch(false)}
                />
            )}

            {showAccounts && (
                <AccountManager
                    accounts={accounts}
                    onUpdate={() => { fetchAccounts(); fetchTransactions(); }}
                    onClose={() => setShowAccounts(false)}
                />
            )}

            {showCategories && (
                <CategoryManager
                    categories={categories}
                    onUpdate={fetchCategories}
                    onClose={() => setShowCategories(false)}
                />
            )}

            {showForm && (
                <TransactionForm
                    accounts={accounts}
                    categories={categories}
                    transaction={editingTx}
                    onSave={handleSave}
                    onClose={() => { setShowForm(false); setEditingTx(null); }}
                />
            )}

            {/* FAB */}
            {!showForm && (
                <button
                    onClick={() => { setEditingTx(null); setShowForm(true); }}
                    className="fixed bottom-6 right-6 w-14 h-14 rounded-2xl
                     bg-accent hover:bg-accent-hover
                     text-white text-2xl shadow-lg shadow-accent/20
                     flex items-center justify-center transition-all duration-200
                     active:scale-90 z-40"
                >
                    +
                </button>
            )}
        </div>
    );
}
