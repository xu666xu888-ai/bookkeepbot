/**
 * Telegram initData HMAC-SHA256 驗證模組
 * 確保請求真的來自 Telegram Mini App
 * 
 * 相容 Bot API 8.0+（含 signature 欄位）
 */
const crypto = require('crypto');

/**
 * 驗證 Telegram WebApp initData 簽名
 * @param {string} initData - 原始 initData 字串
 * @param {string} botToken - Telegram Bot Token
 * @returns {{ valid: boolean, user: object|null }}
 */
function validateInitData(initData, botToken) {
    try {
        const params = new URLSearchParams(initData);
        const hash = params.get('hash');
        if (!hash) return { valid: false, user: null };

        // 移除 hash 和 signature（Bot API 8.0+ 新增，不參與 HMAC 計算）
        params.delete('hash');
        params.delete('signature');

        // 按字母排序組成 data-check-string
        const dataCheckString = [...params.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([k, v]) => `${k}=${v}`)
            .join('\n');

        // HMAC-SHA256 驗證
        const secretKey = crypto
            .createHmac('sha256', 'WebAppData')
            .update(botToken)
            .digest();

        const checkHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');

        if (checkHash !== hash) {
            console.log('❌ initData HMAC 不匹配');
            console.log('  expected:', hash);
            console.log('  computed:', checkHash);
            console.log('  dataCheckString:', dataCheckString.substring(0, 100));
            return { valid: false, user: null };
        }

        // 檢查 auth_date 是否過期（24 小時內有效）
        const authDate = Number(params.get('auth_date'));
        const age = Date.now() / 1000 - authDate;
        if (age > 86400) {
            console.log(`❌ initData 已過期: ${age}s`);
            return { valid: false, user: null };
        }

        // 解析 user 資料
        const userStr = params.get('user');
        const user = userStr ? JSON.parse(userStr) : null;

        console.log('✅ initData 驗證成功, user:', user?.first_name);
        return { valid: true, user };
    } catch (err) {
        console.error('validateInitData error:', err);
        return { valid: false, user: null };
    }
}

module.exports = { validateInitData };
