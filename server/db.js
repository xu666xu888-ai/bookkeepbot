const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = process.env.DB_PATH || './data';
const DB_FILE = path.join(DB_DIR, 'expense.db');

// 確保目錄存在
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

const db = new Database(DB_FILE, {});

console.log(`📂 Connecting to database at: ${DB_FILE}`);

// 禁用 WAL 模式 (GCS FUSE 不支援 WAL/SHM 共享記憶體映射)
db.pragma('journal_mode = DELETE');
db.pragma('foreign_keys = ON');

// 建表
db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    item TEXT NOT NULL,
    amount REAL NOT NULL,
    type TEXT NOT NULL DEFAULT 'expense',
    description TEXT DEFAULT '',
    account_id INTEGER NOT NULL,
    category_id INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (account_id) REFERENCES accounts(id),
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS bot_users (
    chat_id TEXT PRIMARY KEY,
    authorized INTEGER DEFAULT 0,
    authorized_at TEXT
  );
`);

// 自動遷移：為舊表新增 type 欄位（若不存在）
try {
  db.prepare("SELECT type FROM transactions LIMIT 1").get();
} catch (e) {
  // type 欄位不存在，執行遷移
  console.log('🔄 遷移中：新增 type 欄位...');
  db.exec("ALTER TABLE transactions ADD COLUMN type TEXT NOT NULL DEFAULT 'expense'");
  // 將負數金額的記錄標記為 income 並取絕對值
  db.exec("UPDATE transactions SET type = 'income', amount = ABS(amount) WHERE amount < 0");
  console.log('✅ 遷移完成：type 欄位已新增，金額已正規化');
}

module.exports = db;
