/**
 * 數據匯入腳本 — 匯入用戶歷史記帳數據
 * 執行: node scripts/seed-data.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_DIR = process.env.DB_PATH || './data';
const DB_FILE = path.join(DB_DIR, 'expense.db');
const db = new Database(DB_FILE);
db.pragma('foreign_keys = ON');

// ============ 1. 建立帳戶 ============
const insertAccount = db.prepare('INSERT OR IGNORE INTO accounts (name) VALUES (?)');
insertAccount.run('公積金');
const account = db.prepare('SELECT id FROM accounts WHERE name = ?').get('公積金');
const ACCOUNT_ID = account.id;
console.log(`✅ 帳戶「公積金」 ID=${ACCOUNT_ID}`);

// ============ 2. 建立分類 ============
const categoryNames = ['公積金', '房租押金', '薪水津貼', '加油費', '電費', '水費', '送禮', '其他', '雜支'];
const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (name) VALUES (?)');
for (const name of categoryNames) {
    insertCategory.run(name);
}
// 取得分類 ID 對應
const categories = {};
for (const row of db.prepare('SELECT id, name FROM categories').all()) {
    categories[row.name] = row.id;
}
console.log(`✅ 分類建立完成:`, Object.keys(categories).join(', '));

// ============ 3. 匯入交易 ============
const insertTx = db.prepare(`
    INSERT INTO transactions (date, time, item, amount, description, account_id, category_id)
    VALUES (@date, @time, @item, @amount, @description, @account_id, @category_id)
`);

// 收入: amount 為負數
// 支出: amount 為正數
const transactions = [
    // ===== 收入（公積金）1月 =====
    { date: '2026-01-31', time: '00:00', item: '牛公積金', amount: -500000, description: '', category: '公積金' },
    { date: '2026-01-31', time: '00:00', item: '666公積金', amount: -500000, description: '', category: '公積金' },
    { date: '2026-01-31', time: '00:00', item: '777公積金', amount: -500000, description: '', category: '公積金' },
    { date: '2026-01-31', time: '00:00', item: '888公積金', amount: -500000, description: '', category: '公積金' },
    { date: '2026-01-31', time: '00:00', item: 'JY公積金', amount: -500000, description: '', category: '公積金' },
    { date: '2026-01-31', time: '00:00', item: '印度公積金', amount: -500000, description: '', category: '公積金' },

    // ===== 支出 — 1月 =====
    { date: '2026-01-31', time: '00:00', item: '送禮（單位）', amount: 190000, description: '', category: '送禮' },
    { date: '2026-01-31', time: '00:00', item: '雜支', amount: 50000, description: '', category: '雜支' },
    { date: '2026-01-31', time: '00:00', item: '送禮（單位）', amount: 124000, description: '', category: '送禮' },
    { date: '2026-01-31', time: '00:00', item: '四支刀', amount: 360000, description: '', category: '其他' },
    { date: '2026-01-31', time: '00:00', item: '宿舍房租', amount: 28000, description: '', category: '房租押金' },
    { date: '2026-01-31', time: '00:00', item: '舊房租A', amount: 20000, description: '', category: '房租押金' },
    { date: '2026-01-31', time: '00:00', item: '押二付一', amount: 45000, description: '', category: '房租押金' },
    { date: '2026-01-31', time: '00:00', item: '薪水+津貼', amount: 240000, description: '薪水20萬+津貼4萬', category: '薪水津貼' },
    { date: '2026-01-31', time: '00:00', item: '送禮（單位）', amount: 106500, description: '', category: '送禮' },
    { date: '2026-01-31', time: '00:00', item: '垃圾車年費', amount: 65000, description: '', category: '雜支' },
    { date: '2026-01-31', time: '00:00', item: '雜支', amount: 39000, description: '', category: '雜支' },
    { date: '2026-01-31', time: '00:00', item: '送禮', amount: 50000, description: '', category: '送禮' },
    { date: '2026-01-31', time: '00:00', item: '公祭雜支西裝費用', amount: 28000, description: '', category: '雜支' },
    { date: '2026-01-31', time: '00:00', item: '公祭雜支西裝費用', amount: 30000, description: '', category: '雜支' },
    { date: '2026-01-31', time: '00:00', item: '公祭雜支西裝費用', amount: 40000, description: '', category: '雜支' },

    // ===== 支出 — 2月 =====
    { date: '2026-02-05', time: '00:00', item: '公祭雜支西裝費用', amount: 62150, description: '', category: '雜支' },
    { date: '2026-02-05', time: '00:00', item: '宿舍房租', amount: 28000, description: '', category: '房租押金' },
    { date: '2026-02-05', time: '00:00', item: '舊房租', amount: 20000, description: '', category: '房租押金' },
    { date: '2026-02-05', time: '00:00', item: '188房租', amount: 60000, description: '', category: '房租押金' },
    { date: '2026-02-06', time: '00:00', item: '公祭雜支西裝費用', amount: 15863, description: '', category: '雜支' },
    { date: '2026-02-08', time: '00:00', item: '白車啊法加油', amount: 1200, description: '', category: '加油費' },
    { date: '2026-02-08', time: '00:00', item: '阿倫4支刀', amount: 138000, description: '', category: '其他' },
    { date: '2026-02-09', time: '00:00', item: '房租A', amount: 15000, description: '', category: '房租押金' },
    { date: '2026-02-09', time: '00:00', item: '電費', amount: 2000, description: '', category: '電費' },
    { date: '2026-02-09', time: '00:00', item: '水費', amount: 100, description: '', category: '水費' },
];

const insertMany = db.transaction(() => {
    let count = 0;
    for (const tx of transactions) {
        insertTx.run({
            date: tx.date,
            time: tx.time,
            item: tx.item,
            amount: tx.amount,
            description: tx.description,
            account_id: ACCOUNT_ID,
            category_id: categories[tx.category] || null,
        });
        count++;
        const type = tx.amount < 0 ? '收入' : '支出';
        const display = Math.abs(tx.amount).toLocaleString();
        console.log(`  ${type} | ${tx.date} | ${tx.item} | $${display}`);
    }
    return count;
});

const total = insertMany();

// 統計
const incomeTotal = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
const expenseTotal = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);

console.log(`\n✅ 匯入完成！共 ${total} 筆`);
console.log(`   收入: $${incomeTotal.toLocaleString()}`);
console.log(`   支出: $${expenseTotal.toLocaleString()}`);
console.log(`   淨額: $${(incomeTotal - expenseTotal).toLocaleString()}`);

db.close();
