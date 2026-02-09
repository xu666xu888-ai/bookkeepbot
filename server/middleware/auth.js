const jwt = require('jsonwebtoken');

// F-01: 強制要求 JWT_SECRET，不允許弱預設值
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error('❌ 致命錯誤：JWT_SECRET 環境變數未設定，服務中止');
    process.exit(1);
}
const JWT_EXPIRY = '15m'; // 15 分鐘過期

/**
 * JWT 驗證中間件
 * - 驗證 Authorization header 中的 Bearer token
 * - 每次請求成功後，在 Response Header 回傳新 Token（滑動視窗）
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未授權，請先登入' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;

        // 滑動視窗：每次請求發送新的 Token
        const newToken = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
        res.setHeader('X-New-Token', newToken);

        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token 已過期或無效，請重新登入' });
    }
}

/**
 * 產生 JWT Token
 */
function generateToken() {
    return jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

module.exports = { authMiddleware, generateToken };
