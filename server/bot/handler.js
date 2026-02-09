const db = require('../db');

const BOT_TOKEN = process.env.BOT_ACCESS_TOKEN;
if (!BOT_TOKEN) console.warn('⚠️ BOT_ACCESS_TOKEN 未設定，Bot 認證功能將無法使用');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;

/**
 * 發送 Telegram 訊息
 */
async function sendMessage(chatId, text, options = {}) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...options
    };

    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await res.json();
    } catch (err) {
        console.error('Telegram sendMessage error:', err);
    }
}

/**
 * 回覆 callback query（消除按鈕 loading）
 */
async function answerCallback(callbackQueryId, text = '') {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/answerCallbackQuery`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ callback_query_id: callbackQueryId, text })
        });
    } catch (err) {
        console.error('answerCallback error:', err);
    }
}

/**
 * 編輯訊息
 */
async function editMessage(chatId, messageId, text, options = {}) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text,
                parse_mode: 'HTML',
                ...options
            })
        });
    } catch (err) {
        console.error('editMessage error:', err);
    }
}

/**
 * 檢查用戶是否已授權
 */
function isAuthorized(chatId) {
    const user = db.prepare('SELECT * FROM bot_users WHERE chat_id = ? AND authorized = 1').get(String(chatId));
    return !!user;
}

/**
 * 授權用戶
 */
function authorizeUser(chatId) {
    db.prepare(`
    INSERT INTO bot_users (chat_id, authorized, authorized_at)
    VALUES (?, 1, datetime('now', 'localtime'))
    ON CONFLICT(chat_id) DO UPDATE SET authorized = 1, authorized_at = datetime('now', 'localtime')
  `).run(String(chatId));
}

/**
 * 解析記帳訊息
 * 格式: [+]品項 金額 帳戶 [分類]
 * 範例: 早餐 50 現金
 *       +薪水 30000 銀行
 *       午餐 120 信用卡 飲食
 */
function parseExpenseMessage(text) {
    const parts = text.trim().split(/\s+/);
    if (parts.length < 3) return null;

    let item = parts[0];
    let type = 'expense';

    // 收入：+品項 或 品項前有 +
    if (item.startsWith('+')) {
        type = 'income';
        item = item.substring(1);
    }

    const amountStr = parts[1];
    let amount = Math.abs(parseFloat(amountStr));
    if (isNaN(amount)) return null;

    const accountName = parts[2];
    const categoryName = parts.length >= 4 ? parts[3] : null;

    // 查詢帳戶
    const account = db.prepare('SELECT * FROM accounts WHERE name = ?').get(accountName);
    if (!account) return { error: `找不到帳戶「${accountName}」` };

    // 查詢/建立分類
    let category = null;
    if (categoryName) {
        category = db.prepare('SELECT * FROM categories WHERE name = ?').get(categoryName);
        if (!category) {
            // 自動建立分類
            const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(categoryName);
            category = { id: result.lastInsertRowid, name: categoryName };
        }
    }

    return { item, amount, type, account, category };
}

/**
 * 格式化交易為文字
 */
function formatTransaction(tx) {
    const typeLabel = tx.type === 'income' ? '💰 收入' : '💸 支出';
    const absAmount = Math.abs(tx.amount);
    const cat = tx.category_name ? ` | 📂 ${tx.category_name}` : '';
    return `${typeLabel}: <b>${tx.item}</b>\n💵 $${absAmount.toLocaleString()} | 🏦 ${tx.account_name}${cat}\n📅 ${tx.date} ${tx.time}`;
}

/**
 * 處理一般文字訊息
 */
async function handleTextMessage(chatId, text) {
    // Token 驗證
    if (!isAuthorized(chatId)) {
        if (text === BOT_TOKEN) {
            authorizeUser(chatId);
            await sendMessage(chatId, '✅ 驗證成功！你可以開始記帳了。\n\n輸入 /help 查看使用說明。');
        } else {
            await sendMessage(chatId, '🔒 請輸入 8 位數存取 Token 來啟用 Bot：');
        }
        return;
    }

    // 指令處理
    if (text.startsWith('/')) {
        await handleCommand(chatId, text);
        return;
    }

    // 嘗試解析記帳
    const parsed = parseExpenseMessage(text);

    if (!parsed) {
        await sendMessage(chatId, '❌ 格式不正確\n\n正確格式：<code>品項 金額 帳戶 [分類]</code>\n範例：<code>早餐 50 現金 飲食</code>\n收入：<code>+薪水 30000 銀行</code>');
        return;
    }

    if (parsed.error) {
        // 列出可用帳戶
        const accounts = db.prepare('SELECT name FROM accounts').all();
        const accountList = accounts.map(a => a.name).join('、') || '（無）';
        await sendMessage(chatId, `❌ ${parsed.error}\n\n可用帳戶：${accountList}\n\n使用 /accounts 查看或先在 Web 新增帳戶。`);
        return;
    }

    // 寫入交易
    // F-04: 使用本地時區避免跨日錯誤
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const result = db.prepare(`
    INSERT INTO transactions (date, time, item, amount, type, description, account_id, category_id)
    VALUES (?, ?, ?, ?, ?, '', ?, ?)
  `).run(date, time, parsed.item, parsed.amount, parsed.type, parsed.account.id, parsed.category ? parsed.category.id : null);

    const tx = db.prepare(`
    SELECT t.*, a.name as account_name, c.name as category_name
    FROM transactions t
    LEFT JOIN accounts a ON t.account_id = a.id
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

    const msg = `✅ 已記錄 #${tx.id}\n\n${formatTransaction(tx)}`;

    await sendMessage(chatId, msg, {
        reply_markup: {
            inline_keyboard: [[
                { text: '✏️ 編輯', callback_data: `edit_${tx.id}` },
                { text: '❌ 刪除', callback_data: `del_${tx.id}` }
            ]]
        }
    });
}

/**
 * 處理指令
 */
async function handleCommand(chatId, text) {
    const cmd = text.split(' ')[0].split('@')[0].toLowerCase();

    switch (cmd) {
        case '/start':
            if (!isAuthorized(chatId)) {
                await sendMessage(chatId, '👋 歡迎使用記帳 Bot！\n\n🔒 請輸入 8 位數存取 Token 來啟用：');
            } else {
                await sendMessage(chatId, '👋 歡迎回來！輸入 /help 查看使用說明。');
            }
            break;

        case '/help':
            await sendMessage(chatId,
                '📖 <b>使用說明</b>\n\n' +
                '💸 <b>記帳格式</b>\n' +
                '<code>品項 金額 帳戶 [分類]</code>\n\n' +
                '範例：\n' +
                '• <code>早餐 50 現金 飲食</code>\n' +
                '• <code>+薪水 30000 銀行</code>\n\n' +
                '📋 <b>指令</b>\n' +
                '/list - 最近 10 筆交易\n' +
                '/accounts - 帳戶餘額\n' +
                '/help - 使用說明'
            );
            break;

        case '/list': {
            const rows = db.prepare(`
        SELECT t.*, a.name as account_name, c.name as category_name
        FROM transactions t
        LEFT JOIN accounts a ON t.account_id = a.id
        LEFT JOIN categories c ON t.category_id = c.id
        ORDER BY t.date DESC, t.time DESC, t.id DESC
        LIMIT 10
      `).all();

            if (rows.length === 0) {
                await sendMessage(chatId, '📋 尚無交易記錄');
                return;
            }

            for (const tx of rows) {
                await sendMessage(chatId, `#${tx.id}\n${formatTransaction(tx)}`, {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✏️ 編輯', callback_data: `edit_${tx.id}` },
                            { text: '❌ 刪除', callback_data: `del_${tx.id}` }
                        ]]
                    }
                });
            }
            break;
        }

        case '/accounts': {
            const accounts = db.prepare(`
        SELECT a.name,
          COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN t.type != 'income' THEN t.amount ELSE 0 END), 0) as balance
        FROM accounts a
        LEFT JOIN transactions t ON a.id = t.account_id
        GROUP BY a.id
        ORDER BY a.name
      `).all();

            if (accounts.length === 0) {
                await sendMessage(chatId, '🏦 尚未建立任何帳戶\n請先在 Web 介面新增帳戶。');
                return;
            }

            let msg = '🏦 <b>帳戶餘額</b>\n\n';
            let totalBalance = 0;
            for (const a of accounts) {
                const sign = a.balance >= 0 ? '' : '-';
                msg += `• ${a.name}：${sign}$${Math.abs(a.balance).toLocaleString()}\n`;
                totalBalance += a.balance;
            }
            const totalSign = totalBalance >= 0 ? '' : '-';
            msg += `\n💰 <b>總計：${totalSign}$${Math.abs(totalBalance).toLocaleString()}</b>`;

            await sendMessage(chatId, msg);
            break;
        }

        default:
            await sendMessage(chatId, '❓ 未知指令，輸入 /help 查看說明。');
    }
}

/**
 * 處理 Callback Query（Inline 按鈕）
 */
async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery.message.chat.id;
    const messageId = callbackQuery.message.message_id;
    const data = callbackQuery.data;

    if (!isAuthorized(chatId)) {
        await answerCallback(callbackQuery.id, '⚠️ 未授權');
        return;
    }

    // 刪除交易
    if (data.startsWith('del_')) {
        const txId = Number(data.split('_')[1]);
        const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);

        if (!tx) {
            await answerCallback(callbackQuery.id, '交易已不存在');
            return;
        }

        await answerCallback(callbackQuery.id);
        await editMessage(chatId, messageId, `⚠️ 確定要刪除 #${txId} 嗎？`, {
            reply_markup: {
                inline_keyboard: [[
                    { text: '✅ 確定刪除', callback_data: `confirm_del_${txId}` },
                    { text: '🚫 取消', callback_data: `cancel_${messageId}` }
                ]]
            }
        });
        return;
    }

    // 確認刪除
    if (data.startsWith('confirm_del_')) {
        const txId = Number(data.split('_')[2]);
        db.prepare('DELETE FROM transactions WHERE id = ?').run(txId);
        await answerCallback(callbackQuery.id, '已刪除');
        await editMessage(chatId, messageId, `🗑️ 交易 #${txId} 已刪除`);
        return;
    }

    // 取消
    if (data.startsWith('cancel_')) {
        await answerCallback(callbackQuery.id, '已取消');
        await editMessage(chatId, messageId, '🚫 操作已取消');
        return;
    }

    // 編輯交易 - 顯示選單
    if (data.startsWith('edit_') && !data.startsWith('edit_field_')) {
        const txId = Number(data.split('_')[1]);
        const tx = db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(txId);

        if (!tx) {
            await answerCallback(callbackQuery.id, '交易已不存在');
            return;
        }

        await answerCallback(callbackQuery.id);
        await editMessage(chatId, messageId,
            `✏️ 編輯 #${txId}\n\n${formatTransaction(tx)}\n\n選擇要修改的欄位：`,
            {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '📝 品項', callback_data: `edit_field_item_${txId}` },
                            { text: '💵 金額', callback_data: `edit_field_amount_${txId}` }
                        ],
                        [
                            { text: '🏦 帳戶', callback_data: `edit_field_account_${txId}` },
                            { text: '📂 分類', callback_data: `edit_field_category_${txId}` }
                        ],
                        [
                            { text: '📅 日期', callback_data: `edit_field_date_${txId}` },
                            { text: '🕐 時間', callback_data: `edit_field_time_${txId}` }
                        ],
                        [{ text: '🚫 取消', callback_data: `cancel_${messageId}` }]
                    ]
                }
            }
        );
        return;
    }

    // 編輯欄位提示
    if (data.startsWith('edit_field_')) {
        const parts = data.split('_');
        const field = parts[2];
        const txId = parts[3];

        const fieldNames = {
            item: '品項', amount: '金額', account: '帳戶',
            category: '分類', date: '日期 (YYYY-MM-DD)', time: '時間 (HH:mm)'
        };

        // 儲存編輯狀態到一個臨時記憶（用 bot_users 的 chat_id 作為 key）
        editStates.set(String(chatId), { txId: Number(txId), field, messageId });

        await answerCallback(callbackQuery.id);
        await sendMessage(chatId, `請輸入新的 <b>${fieldNames[field]}</b>：\n\n（輸入 /cancel 取消）`);
        return;
    }
}

// 編輯狀態暫存（記憶體中）
const editStates = new Map();

/**
 * 處理編輯回覆
 */
async function handleEditReply(chatId, text) {
    const state = editStates.get(String(chatId));
    if (!state) return false;

    if (text === '/cancel') {
        editStates.delete(String(chatId));
        await sendMessage(chatId, '🚫 編輯已取消');
        return true;
    }

    const { txId, field } = state;
    const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId);

    if (!tx) {
        editStates.delete(String(chatId));
        await sendMessage(chatId, '❌ 交易不存在');
        return true;
    }

    try {
        switch (field) {
            case 'item':
                db.prepare('UPDATE transactions SET item = ? WHERE id = ?').run(text, txId);
                break;
            case 'amount': {
                let amt = Math.abs(parseFloat(text));
                if (isNaN(amt)) {
                    await sendMessage(chatId, '❌ 金額格式錯誤，請輸入數字');
                    return true;
                }
                const newType = text.startsWith('+') ? 'income' : undefined;
                db.prepare('UPDATE transactions SET amount = ?' + (newType ? ', type = ?' : '') + ' WHERE id = ?').run(
                    ...(newType ? [amt, newType, txId] : [amt, txId])
                );
                break;
            }
            case 'account': {
                const account = db.prepare('SELECT * FROM accounts WHERE name = ?').get(text);
                if (!account) {
                    const accounts = db.prepare('SELECT name FROM accounts').all();
                    await sendMessage(chatId, `❌ 找不到帳戶「${text}」\n可用：${accounts.map(a => a.name).join('、')}`);
                    return true;
                }
                db.prepare('UPDATE transactions SET account_id = ? WHERE id = ?').run(account.id, txId);
                break;
            }
            case 'category': {
                let cat = db.prepare('SELECT * FROM categories WHERE name = ?').get(text);
                if (!cat) {
                    const result = db.prepare('INSERT INTO categories (name) VALUES (?)').run(text);
                    cat = { id: result.lastInsertRowid };
                }
                db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?').run(cat.id, txId);
                break;
            }
            case 'date':
                if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
                    await sendMessage(chatId, '❌ 日期格式錯誤，請使用 YYYY-MM-DD');
                    return true;
                }
                db.prepare('UPDATE transactions SET date = ? WHERE id = ?').run(text, txId);
                break;
            case 'time':
                if (!/^\d{2}:\d{2}$/.test(text)) {
                    await sendMessage(chatId, '❌ 時間格式錯誤，請使用 HH:mm');
                    return true;
                }
                db.prepare('UPDATE transactions SET time = ? WHERE id = ?').run(text, txId);
                break;
        }

        editStates.delete(String(chatId));

        const updated = db.prepare(`
      SELECT t.*, a.name as account_name, c.name as category_name
      FROM transactions t
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN categories c ON t.category_id = c.id
      WHERE t.id = ?
    `).get(txId);

        await sendMessage(chatId, `✅ 已更新 #${txId}\n\n${formatTransaction(updated)}`);
    } catch (err) {
        await sendMessage(chatId, `❌ 更新失敗：${err.message}`);
    }

    return true;
}

/**
 * 主處理函數
 */
async function handleUpdate(update) {
    // Callback Query（按鈕點擊）
    if (update.callback_query) {
        await handleCallbackQuery(update.callback_query);
        return;
    }

    // 一般訊息
    if (update.message && update.message.text) {
        const chatId = update.message.chat.id;
        const text = update.message.text.trim();

        // 先檢查是否在編輯狀態
        if (isAuthorized(chatId)) {
            const handled = await handleEditReply(chatId, text);
            if (handled) return;
        }

        await handleTextMessage(chatId, text);
    }
}

module.exports = { handleUpdate };
