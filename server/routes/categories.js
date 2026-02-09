const express = require('express');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

/**
 * GET /api/categories
 */
router.get('/', (req, res) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
        res.json(categories);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/categories
 * Body: { name }
 */
router.post('/', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: '分類名稱不可為空' });
        }

        const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name.trim());
        const newCat = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(newCat);
    } catch (err) {
        if (err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: '分類名稱已存在' });
        }
        res.status(500).json({ error: err.message });
    }
});

/**
 * DELETE /api/categories/:id
 */
router.delete('/:id', (req, res) => {
    try {
        const { id } = req.params;

        const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
        if (!existing) {
            return res.status(404).json({ error: '分類不存在' });
        }

        // 將關聯交易的 category_id 設為 null
        db.prepare('UPDATE transactions SET category_id = NULL WHERE category_id = ?').run(id);
        db.prepare('DELETE FROM categories WHERE id = ?').run(id);

        res.json({ message: '已刪除', id: Number(id) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
