const db = require('../db');

const BOT_TOKEN = process.env.BOT_ACCESS_TOKEN;
if (!BOT_TOKEN) console.warn('⚠️ BOT_ACCESS_TOKEN 未設定，Bot 認證功能將無法使用');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

/**
 * 精簡版 Bot Handler — 僅用於 /start 和 /help 導引開啟 Mini App
 * 文字記帳指令已移至 Mini App 介面
 */
async function handleUpdate(update) {
    const msg = update.message;
    if (!msg || !msg.text) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text === '/start') {
        await sendMessage(chatId,
            '👋 歡迎使用記帳助手！\n\n' +
            '請點擊下方的「📊 開啟記帳」按鈕來使用 Mini App。\n\n' +
            '首次使用需要輸入存取碼進行授權。',
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '📊 開啟記帳', web_app: { url: process.env.MINI_APP_URL || '' } }
                    ]]
                }
            }
        );
        return;
    }

    if (text === '/help') {
        await sendMessage(chatId,
            '📖 使用說明\n\n' +
            '1️⃣ 點擊「📊 開啟記帳」按鈕\n' +
            '2️⃣ 首次需輸入存取碼授權\n' +
            '3️⃣ 輸入 TOTP 驗證碼登入\n' +
            '4️⃣ 開始記帳！\n\n' +
            '📌 所有記帳操作均在 Mini App 中完成'
        );
        return;
    }

    // 其他訊息：導引到 Mini App
    await sendMessage(chatId, '請使用 Mini App 進行記帳操作 👇', {
        reply_markup: {
            inline_keyboard: [[
                { text: '📊 開啟記帳', web_app: { url: process.env.MINI_APP_URL || '' } }
            ]]
        }
    });
}

/**
 * 發送 Telegram 訊息
 */
async function sendMessage(chatId, text, extra = {}) {
    if (!TELEGRAM_TOKEN) return;

    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                ...extra
            })
        });
    } catch (err) {
        console.error('sendMessage error:', err);
    }
}

module.exports = { handleUpdate };
