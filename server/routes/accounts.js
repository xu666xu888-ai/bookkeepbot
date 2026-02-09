const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/accounts
 * 回傳帳戶列表，含各帳戶餘額
 */
router.get('/', (req, res) => {
    try {
        const accounts = db.prepare(`
      SELECT
        a.id, a.name, a.created_at,
        COALESCE(SUM(t.amount), 0) as total_spent,
        -COALESCE(SUM(t.amount), 0) as balance
      FROM accounts a
      LEFT JOIN transactions t ON a.id = t.account_id
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `).all();

        res.json(accounts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/accounts
 * Body: { name }
 */
router.post('/', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: '帳戶名稱不可為空' });
        }

        const stmt = db.prepare('INSERT INTO accounts (name) VALUES (?)');
        const result = stmt.run(name.trim());

        const newAccount = db.prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json({ ...newAccount, balance: 0 });
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: '帳戶名稱已存在' });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/accounts/:id
 * Body: { name }
 */
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: '帳戶名稱不可為空' });
        }

        const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: '帳戶不存在' });
        }

        db.prepare('UPDATE accounts SET name = ? WHERE id = ?').run(name.trim(), id);
        const updated = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
        res.json(updated);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: '帳戶名稱已存在' });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/accounts/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        // 檢查是否有交易關聯
        const txCount = db.prepare('SELECT COUNT(*) as count FROM transactions WHERE account_id = ?').get(id);
        if (txCount.count > 0) {
            return res.status(409).json({ error: `此帳戶有 ${txCount.count} 筆交易，無法刪除` });
        }

        const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: '帳戶不存在' });
        }

        db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
        res.json({ message: '已刪除', id: Number(id) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
