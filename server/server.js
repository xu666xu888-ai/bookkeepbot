require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    exposedHeaders: ['X-New-Token'] // 讓前端能讀取滑動視窗 JWT
}));
app.use(express.json());

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ai', require('./routes/ai'));

// Debug Info Route
app.get('/api/debug/info', (req, res) => {
    const fs = require('fs');
    try {
        const dbDir = process.env.DB_PATH || './data';
        const dbFile = path.join(dbDir, 'expense.db');
        const dbStat = fs.existsSync(dbFile) ? fs.statSync(dbFile) : null;

        let dirFiles = [];
        try {
            if (fs.existsSync(dbDir)) {
                dirFiles = fs.readdirSync(dbDir);
            } else {
                dirFiles = ['Directory does not exist'];
            }
        } catch (e) {
            dirFiles = [e.message];
        }

        // 查詢 DB 記錄數
        let dbStats = {};
        try {
            const db = require('./db');
            dbStats = {
                transactions: db.prepare('SELECT COUNT(*) as c FROM transactions').get().c,
                accounts: db.prepare('SELECT COUNT(*) as c FROM accounts').get().c,
                categories: db.prepare('SELECT COUNT(*) as c FROM categories').get().c,
                sampleAccounts: db.prepare('SELECT id, name FROM accounts LIMIT 5').all(),
                sampleCategories: db.prepare('SELECT id, name FROM categories LIMIT 10').all(),
            };
        } catch (e) {
            dbStats = { error: e.message };
        }

        res.json({
            timestamp: new Date().toISOString(),
            env: {
                DB_PATH: process.env.DB_PATH,
                NODE_ENV: process.env.NODE_ENV
            },
            database: {
                fullPath: dbFile,
                exists: !!dbStat,
                size: dbStat ? dbStat.size : 0,
                modified: dbStat ? dbStat.mtime : null
            },
            directory: {
                path: dbDir,
                files: dirFiles
            },
            records: dbStats
        });
    } catch (err) {
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// 健康檢查 (必須在 catch-all 之前)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});

// 臨時數據導入端點 (用完即刪)
app.post('/api/debug/import', (req, res) => {
    try {
        const db = require('./db');
        const { accounts, categories, transactions } = req.body;
        if (!accounts || !categories || !transactions) {
            return res.status(400).json({ error: 'Missing data fields' });
        }

        const insertAccount = db.prepare('INSERT OR IGNORE INTO accounts (id, name, created_at) VALUES (?, ?, ?)');
        const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)');
        const insertTransaction = db.prepare('INSERT OR IGNORE INTO transactions (id, date, time, item, amount, description, account_id, category_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

        const importAll = db.transaction(() => {
            for (const a of accounts) {
                insertAccount.run(a.id, a.name, a.created_at);
            }
            for (const c of categories) {
                insertCategory.run(c.id, c.name);
            }
            for (const t of transactions) {
                insertTransaction.run(t.id, t.date, t.time, t.item, t.amount, t.description, t.account_id, t.category_id, t.created_at);
            }
        });

        importAll();

        res.json({
            success: true,
            imported: {
                accounts: accounts.length,
                categories: categories.length,
                transactions: transactions.length
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 生產環境：提供前端靜態檔案 (catch-all 必須放最後)
if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📂 DB path: ${process.env.DB_PATH || './data'}/expense.db`);
});
