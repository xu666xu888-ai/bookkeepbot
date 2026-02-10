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
            '👋 Welcome.\n\n' +
            'Tap the button below to continue.',
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔧 Open Tool', web_app: { url: process.env.MINI_APP_URL || '' } }
                    ]]
                }
            }
        );
        return;
    }

    if (text === '/help') {
        await sendMessage(chatId,
            '📖 Guide\n\n' +
            '1️⃣ Tap the button below\n' +
            '2️⃣ Enter your access code\n' +
            '3️⃣ Enter verification code\n' +
            '4️⃣ Done'
        );
        return;
    }

    // 其他訊息：導引到 Mini App
    await sendMessage(chatId, 'Please use the button below 👇', {
        reply_markup: {
            inline_keyboard: [[
                { text: '🔧 Open Tool', web_app: { url: process.env.MINI_APP_URL || '' } }
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
