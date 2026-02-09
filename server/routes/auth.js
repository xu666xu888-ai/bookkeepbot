const express = require('express');
const { authenticator } = require('otplib');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

const TOTP_SECRET = process.env.ADMIN_TOTP_SECRET;

/**
 * POST /api/auth/login
 * Body: { code: "123456" }
 */
router.post('/login', (req, res) => {
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
