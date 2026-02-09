export default function TransactionList({ transactions, total, onEdit }) {
    if (transactions.length === 0) {
        return (
            <div className="glass rounded-2xl p-10 text-center">
                <p className="text-3xl mb-3">📝</p>
                <p className="text-text-dim text-sm">尚無交易記錄</p>
                <p className="text-xs text-text-dim/50 mt-1">點擊右下角 + 新增</p>
            </div>
        );
    }

    const grouped = {};
    transactions.forEach(tx => {
        if (!grouped[tx.date]) grouped[tx.date] = [];
        grouped[tx.date].push(tx);
    });

    return (
        <div className="space-y-5">
            <p className="text-xs text-text-dim px-1">共 {total} 筆</p>

            {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                    {/* 日期標題 */}
                    <div className="flex items-center gap-3 mb-2 px-1">
                        <p className="text-xs font-medium text-text-secondary">{formatDate(date)}</p>
                        <div className="flex-1 h-px bg-border" />
                        <p className="text-xs text-text-dim tabular-nums">{formatDayTotal(txs)}</p>
                    </div>

                    {/* 交易項目 */}
                    <div className="glass rounded-2xl divide-y divide-border overflow-hidden">
                        {txs.map(tx => (
                            <div
                                key={tx.id}
                                className="flex items-center px-4 py-3.5 gap-3 active:bg-surface-2 transition-colors"
                                onClick={() => onEdit(tx)}
                            >
                                {/* 左側 */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium text-sm truncate">{tx.item}</p>
                                        {tx.category_name && (
                                            <span className="text-[10px] bg-surface-3 text-text-dim px-1.5 py-0.5 rounded-md flex-shrink-0">
                                                {tx.category_name}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-text-dim mt-0.5">
                                        {tx.time?.slice(0, 5)} · {tx.account_name}
                                        {tx.description ? ` · ${tx.description}` : ''}
                                    </p>
                                </div>

                                {/* 右側金額 */}
                                <p className={`font-semibold text-sm tabular-nums flex-shrink-0 ${tx.type === 'income' ? 'text-income' : 'text-expense'
                                    }`}>
                                    {tx.type === 'income' ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) return '今天';
    if (dateStr === yesterday.toISOString().split('T')[0]) return '昨天';

    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getMonth() + 1}/${d.getDate()} 週${weekdays[d.getDay()]}`;
}

function formatDayTotal(txs) {
    const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + Math.abs(t.amount), 0);
    const expense = txs.filter(t => t.type !== 'income').reduce((s, t) => s + Math.abs(t.amount), 0);

    const parts = [];
    if (expense > 0) parts.push(`-$${expense.toLocaleString()}`);
    if (income > 0) parts.push(`+$${income.toLocaleString()}`);
    return parts.join(' / ') || '$0';
}
