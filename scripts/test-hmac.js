/**
 * HMAC 驗證測試腳本
 * 用法：node scripts/test-hmac.js
 * 
 * 這個腳本會用本地 .env 裡的 TELEGRAM_TOKEN 來驗算 HMAC，
 * 如果本地也失敗，表示 Token 本身就是錯的。
 * 如果本地成功，表示 Cloud Run 的 Token 有問題（可能有隱藏字元）。
 */
require('dotenv').config();
const crypto = require('crypto');

const botToken = process.env.TELEGRAM_TOKEN;

console.log('=== HMAC 驗證測試 ===');
console.log('Token 長度:', botToken?.length);
console.log('Token 前10字:', botToken?.substring(0, 10) + '...');
console.log('Token 後5字: ...' + botToken?.substring(botToken.length - 5));
console.log('');

// 模擬 validateInitData 的計算過程
function testHMAC(initDataRaw) {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');

    if (!hash) {
        console.log('❌ 找不到 hash 欄位');
        return;
    }

    params.delete('hash');
    params.delete('signature');

    const dataCheckString = [...params.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');

    console.log('data-check-string 欄位:');
    dataCheckString.split('\n').forEach(line => {
        const key = line.split('=')[0];
        const val = line.substring(key.length + 1);
        console.log(`  ${key} = ${val.substring(0, 50)}${val.length > 50 ? '...' : ''}`);
    });
    console.log('');

    const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(botToken)
        .digest();

    const computed = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

    console.log('expected (from Telegram):', hash);
    console.log('computed (by us):        ', computed);
    console.log('');

    if (computed === hash) {
        console.log('✅ 驗證成功！本地 Token 是正確的。');
        console.log('→ 問題出在 Cloud Run 的環境變數設定（可能有隱藏字元）');
    } else {
        console.log('❌ 驗證失敗！本地 Token 也算不出正確的 HMAC。');
        console.log('→ Token 本身可能是錯的，請去 BotFather 重新取得');
    }
}

// 請在這裡貼上從瀏覽器 DevTools 或 Cloud Run logs 拿到的完整 initData
// 可以從 Telegram Mini App 的 console 中取得: window.Telegram.WebApp.initData
const testInitData = process.argv[2] || '';

if (!testInitData) {
    console.log('用法: node scripts/test-hmac.js "完整的initData字串"');
    console.log('');
    console.log('你可以從 Telegram Mini App 的瀏覽器 Console 中執行:');
    console.log('  copy(window.Telegram.WebApp.initData)');
    console.log('來取得完整的 initData 字串。');
} else {
    testHMAC(testInitData);
}
