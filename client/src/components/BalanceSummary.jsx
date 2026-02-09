export default function BalanceSummary({ accounts, transactions = [] }) {
    const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    // 從交易計算收入/支出（amount < 0 為收入，> 0 為支出）
    const totalIncome = transactions
        .filter(t => t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalExpense = transactions
        .filter(t => t.amount > 0)
        .reduce((s, t) => s + t.amount, 0);

    // 各帳戶的收入/支出
    const accountStats = {};
    transactions.forEach(t => {
        if (!accountStats[t.account_id]) accountStats[t.account_id] = { income: 0, expense: 0 };
        if (t.amount < 0) accountStats[t.account_id].income += Math.abs(t.amount);
        else accountStats[t.account_id].expense += t.amount;
    });

    return (
        <div className="space-y-3">
            {/* 總計卡片 */}
            <div className="glass rounded-2xl p-5">
                <p className="text-xs text-text-dim mb-1 uppercase tracking-wider">總計餘額</p>
                <p className={`text-4xl font-bold tracking-tight ${totalBalance >= 0 ? 'text-income' : 'text-expense'}`}>
                    {totalBalance >= 0 ? '' : '-'}${Math.abs(totalBalance).toLocaleString()}
                </p>
                {/* 收入/支出統計 */}
                <div className="flex gap-4 mt-3 pt-3 border-t border-border">
                    <div className="flex-1">
                        <p className="text-[10px] text-text-dim mb-0.5">收入</p>
                        <p className="text-sm font-semibold text-income tabular-nums">
                            +${totalIncome.toLocaleString()}
                        </p>
                    </div>
                    <div className="flex-1">
                        <p className="text-[10px] text-text-dim mb-0.5">支出</p>
                        <p className="text-sm font-semibold text-expense tabular-nums">
                            -${totalExpense.toLocaleString()}
                        </p>
                    </div>
                </div>
            </div>

            {/* 各帳戶 */}
            {accounts.length > 0 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
                    {accounts.map(a => {
                        const stats = accountStats[a.id] || { income: 0, expense: 0 };
                        return (
                            <div key={a.id}
                                className="flex-shrink-0 glass rounded-xl px-4 py-3 min-w-[140px]"
                            >
                                <p className="text-xs text-text-dim truncate">{a.name}</p>
                                <p className={`text-base font-semibold mt-1 tabular-nums ${(a.balance || 0) >= 0 ? 'text-text' : 'text-expense'}`}>
                                    ${Math.abs(a.balance || 0).toLocaleString()}
                                </p>
                                <div className="flex gap-3 mt-2 pt-2 border-t border-border">
                                    <p className="text-[10px] text-income tabular-nums">
                                        +${stats.income.toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-expense tabular-nums">
                                        -${stats.expense.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
