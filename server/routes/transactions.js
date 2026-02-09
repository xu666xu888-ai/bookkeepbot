const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');
const { triggerBackup } = require('../services/sheetsBackup');

const router = express.Router();

// 所有路由需要認證
router.use(authMiddleware);

/**
 * GET /api/transactions
 * 查詢參數: search, account_id, category_id, date_from, date_to, page, limit
 */
router.get('/', (req, res) => {
    try {
        const {
            search, account_id, category_id,
            date_from, date_to,
            page = 1, limit = 50
        } = req.query;

        let where = [];
        let params = {};

        if (search) {
            where.push("(t.item LIKE @search OR t.description LIKE @search)");
            params.search = `%${search}%`;
        }
        if (account_id) {
            where.push("t.account_id = @account_id");
            params.account_id = Number(account_id);
        }
        if (category_id) {
            where.push("t.category_id = @category_id");
            params.category_id = Number(category_id);
        }
        if (date_from) {
            where.push("t.date >= @date_from");
            params.date_from = date_from;
        }
        if (date_to) {
            where.push("t.date <= @date_to");
            params.date_to = date_to;
        }

        const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';
        const offset = (Number(page) - 1) * Number(limit);

        // 取得總數
        const countRow = db.prepare(`
      SELECT COUNT(*) as total FROM transactions t ${whereClause}
    `).get(params);

        // 取得資料（含帳戶、分類名稱）
        const rows = db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      ${whereClause}
      ORDER BY t.date DESC, t.time DESC, t.id DESC
      LIMIT @limit OFFSET @offset
    `).all({ ...params, limit: Number(limit), offset });

        res.json({
            data: rows,
            total: countRow.total,
            page: Number(page),
            limit: Number(limit)
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/transactions
 * Body: { date, time, item, amount, description, account_id, category_id }
 */
router.post('/', (req, res) => {
    try {
        const { date, time, item, amount, type, description, account_id, category_id } = req.body;

        // F-03: 嚴格輸入校驗
        if (!date || !time || !item || amount === undefined || !account_id) {
            return res.status(400).json({ error: '缺少必要欄位：date, time, item, amount, account_id' });
        }
        const parsedAmount = Math.abs(Number(amount));
        if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
            return res.status(400).json({ error: '金額必須為有效正數' });
        }
        if (type && !['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'type 僅允許 income 或 expense' });
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: '日期格式錯誤，請使用 YYYY-MM-DD' });
        }
        if (!/^\d{2}:\d{2}$/.test(time)) {
            return res.status(400).json({ error: '時間格式錯誤，請使用 HH:mm' });
        }

        const stmt = db.prepare(`
      INSERT INTO transactions (date, time, item, amount, type, description, account_id, category_id)
      VALUES (@date, @time, @item, @amount, @type, @description, @account_id, @category_id)
    `);

        const result = stmt.run({
            date, time, item,
            amount: parsedAmount,
            type: type || 'expense',
            description: description || '',
            account_id: Number(account_id),
            category_id: category_id ? Number(category_id) : null
        });

        const newRow = db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

        res.status(201).json(newRow);
        triggerBackup();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * PUT /api/transactions/:id
 */
router.put('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { date, time, item, amount, type, description, account_id, category_id } = req.body;

        const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: '交易記錄不存在' });
        }

        const stmt = db.prepare(`
      UPDATE transactions SET
        date = @date, time = @time, item = @item, amount = @amount, type = @type,
        description = @description, account_id = @account_id, category_id = @category_id
      WHERE id = @id
    `);

        // F-03: PUT 輸入校驗
        if (amount !== undefined) {
            const parsedAmt = Math.abs(Number(amount));
            if (!Number.isFinite(parsedAmt) || parsedAmt <= 0) {
                return res.status(400).json({ error: '金額必須為有效正數' });
            }
        }
        if (type && !['income', 'expense'].includes(type)) {
            return res.status(400).json({ error: 'type 僅允許 income 或 expense' });
        }
        if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return res.status(400).json({ error: '日期格式錯誤' });
        }
        if (time && !/^\d{2}:\d{2}$/.test(time)) {
            return res.status(400).json({ error: '時間格式錯誤' });
        }

        stmt.run({
            id: Number(id),
            date: date || existing.date,
            time: time || existing.time,
            item: item || existing.item,
            amount: amount !== undefined ? Math.abs(Number(amount)) : existing.amount,
            type: type || existing.type || 'expense',
            description: description !== undefined ? description : existing.description,
            account_id: account_id ? Number(account_id) : existing.account_id,
            category_id: category_id !== undefined ? (category_id ? Number(category_id) : null) : existing.category_id
        });

        const updated = db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(id);

        res.json(updated);
        triggerBackup();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/transactions/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;
        const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: '交易記錄不存在' });
        }

        db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
        res.json({ message: '已刪除', id: Number(id) });
        triggerBackup();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
