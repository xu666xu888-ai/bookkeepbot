/**
 * 清理舊範例數據，只保留用戶匯入的數據
 */
const db = require('../server/db');

const keepCategories = ['公積金', '房租押金', '薪水津貼', '加油費', '電費', '水費', '送禮', '其他', '雜支'];

// 查看現有數據
const accounts = db.prepare('SELECT * FROM accounts').all();
const cats = db.prepare('SELECT * FROM categories').all();
console.log('現有帳戶:', accounts.map(a => `${a.name}(ID:${a.id})`).join(', '));
console.log('現有分類:', cats.map(c => `${c.name}(ID:${c.id})`).join(', '));

// 找到要刪除的帳戶（非「公積金」）
const oldAccounts = accounts.filter(a => a.name !== '公積金');
// 找到要刪除的分類
const oldCats = cats.filter(c => !keepCategories.includes(c.name));

console.log('\n要刪除的帳戶:', oldAccounts.map(a => a.name).join(', ') || '（無）');
console.log('要刪除的分類:', oldCats.map(c => c.name).join(', ') || '（無）');

// 執行刪除
const cleanup = db.transaction(() => {
    let txDeleted = 0;
    for (const a of oldAccounts) {
        const r = db.prepare('DELETE FROM transactions WHERE account_id = ?').run(a.id);
        txDeleted += r.changes;
        db.prepare('DELETE FROM accounts WHERE id = ?').run(a.id);
        console.log(`  刪除帳戶「${a.name}」及其 ${r.changes} 筆交易`);
    }

    for (const c of oldCats) {
        // 先清除關聯交易的 category_id
        db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(c.id);
        db.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
        console.log(`  刪除分類「${c.name}」`);
    }

    return txDeleted;
});

const deleted = cleanup();

// 顯示剩餘數據
const remaining = db.prepare('SELECT COUNT(*) as c FROM transactions').get();
const remAccounts = db.prepare('SELECT * FROM accounts').all();
const remCats = db.prepare('SELECT * FROM categories').all();

console.log('\n✅ 清理完成');
console.log(`剩餘帳戶: ${remAccounts.map(a => a.name).join(', ')}`);
console.log(`剩餘分類: ${remCats.map(c => c.name).join(', ')}`);
console.log(`剩餘交易: ${remaining.c} 筆`);
