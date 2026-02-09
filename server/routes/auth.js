const express = require('express');
const { authenticator } = require('otplib');
const { generateToken } = require('../middleware/auth');
const { loginRateLimit } = require('../middleware/rateLimit');
const { validateInitData } = require('../middleware/telegram');
const db = require('../db');

const router = express.Router();

const TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const BOT_ACCESS_TOKEN = process.env.BOT_ACCESS_TOKEN;

/**
 * POST /api/auth/telegram
 * Body: { initData, accessToken? }
 * 
 * 流程：
 * 1. 驗證 initData 簽名（確認來自 Telegram）
 * 2. 查詢 bot_users 授權狀態
 * 3. 若帶 accessToken → 驗證並授權
 * 4. 回傳狀態：need_token / need_totp
 */
router.post('/telegram', (req, res) => {
    const { initData, accessToken } = req.body;

    if (!TELEGRAM_TOKEN) {
        return res.status(500).json({ error: 'TELEGRAM_TOKEN 未設定' });
    }

    let chatId = null;
    let user = null;

    // 有 initData → 完整 HMAC 驗證
    if (initData && initData.length > 0) {
        const result = validateInitData(initData, TELEGRAM_TOKEN);
        if (!result.valid || !result.user) {
            return res.status(403).json({ error: '無效的 Telegram 認證' });
        }
        chatId = String(result.user.id);
        user = result.user;
    }

    // 無 initData 但有 accessToken → fallback 驗證（僅允許授權操作）
    if (!chatId && accessToken) {
        if (!BOT_ACCESS_TOKEN || accessToken !== BOT_ACCESS_TOKEN) {
            return res.status(401).json({ error: '存取碼錯誤' });
        }
        // 授權成功，跳到 TOTP
        return res.json({
            status: 'need_totp',
            user: { id: 0, first_name: '用戶' }
        });
    }

    // 既無 initData 也無 accessToken
    if (!chatId) {
        return res.status(400).json({ error: '缺少認證資訊' });
    }


    // 2. 查詢用戶授權狀態
    let dbUser = db.prepare('SELECT * FROM bot_users WHERE chat_id = ?').get(chatId);

    // 3. 若帶 accessToken → 驗證並授權
    if (accessToken) {
        if (!BOT_ACCESS_TOKEN) {
            return res.status(500).json({ error: 'BOT_ACCESS_TOKEN 未設定' });
        }

        if (accessToken !== BOT_ACCESS_TOKEN) {
            return res.status(401).json({ error: '存取碼錯誤' });
        }

        // 授權用戶
        const now = new Date().toISOString();
        if (dbUser) {
            db.prepare('UPDATE bot_users SET authorized = 1, authorized_at = ? WHERE chat_id = ?')
                .run(now, chatId);
        } else {
            db.prepare('INSERT INTO bot_users (chat_id, authorized, authorized_at) VALUES (?, 1, ?)')
                .run(chatId, now);
        }
        dbUser = { chat_id: chatId, authorized: 1 };
    }

    // 4. 檢查授權狀態
    if (!dbUser || !dbUser.authorized) {
        return res.json({
            status: 'need_token',
            user: { id: user.id, first_name: user.first_name }
        });
    }

    // 已授權，需要 TOTP
    return res.json({
        status: 'need_totp',
        user: { id: user.id, first_name: user.first_name }
    });
});

/**
 * POST /api/auth/login
 * Body: { code: "123456" }
 */
router.post('/login', loginRateLimit, (req, res) => {
    const { code } = req.body;

    if (!code || code.length !== 6) {
        return res.status(400).json({ error: '請輸入 6 位數驗證碼' });
    }

    if (!TOTP_SECRET) {
        return res.status(500).json({ error: '伺服器未設定 TOTP Secret' });
    }

    const isValid = authenticator.check(code, TOTP_SECRET);

    if (!isValid) {
        return res.status(401).json({ error: '驗證碼錯誤或已過期' });
    }

    const token = generateToken();
    res.json({ token });
});

module.exports = router;
