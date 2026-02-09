/**
 * F-02: 登入暴力嘗試防護 — 記憶體計數器
 * 同一 IP 連續失敗 5 次後鎖定 15 分鐘
 */
const attempts = new Map();

const MAX_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 分鐘

function loginRateLimit(req, res, next) {
    const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;
    const record = attempts.get(ip);

    if (record && record.locked) {
        const remaining = Math.ceil((record.lockedUntil - Date.now()) / 1000 / 60);
        return res.status(429).json({
            error: `登入嘗試過多，請 ${remaining} 分鐘後再試`
        });
    }

    // 掛載 response 攔截器來追蹤失敗
    const originalJson = res.json.bind(res);
    res.json = function (body) {
        if (res.statusCode === 401) {
            // 登入失敗
            const rec = attempts.get(ip) || { count: 0, locked: false };
            rec.count++;
            if (rec.count >= MAX_ATTEMPTS) {
                rec.locked = true;
                rec.lockedUntil = Date.now() + LOCK_DURATION;
                console.warn(`⚠️ IP ${ip} 登入失敗 ${rec.count} 次，鎖定 15 分鐘`);
            }
            attempts.set(ip, rec);
        } else if (res.statusCode === 200) {
            // 登入成功，清除記錄
            attempts.delete(ip);
        }
        return originalJson(body);
    };

    next();
}

// 定期清理過期鎖定（每 5 分鐘）
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of attempts) {
        if (record.locked && now > record.lockedUntil) {
            attempts.delete(ip);
        }
    }
}, 5 * 60 * 1000);

module.exports = { loginRateLimit };
