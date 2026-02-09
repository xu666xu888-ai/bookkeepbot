const express = require('express');
const { handleUpdate } = require('../bot/handler');

const router = express.Router();

/**
 * POST /api/telegram/webhook
 * Telegram Webhook 入口 (不需要 JWT 驗證)
 */
router.post('/webhook', async (req, res) => {
    try {
        await handleUpdate(req.body);
        res.sendStatus(200);
    } catch (err) {
        console.error('Telegram webhook error:', err);
        res.sendStatus(200); // 即使出錯也回 200，避免 Telegram 重試
    }
});

module.exports = router;
