const { google } = require('googleapis');
const db = require('../db');

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const SHEET_TAB = '記帳備份';

let sheetsClient = null;

/**
 * 取得 Google Sheets API Client (使用 ADC 認證)
 */
async function getSheets() {
    if (sheetsClient) return sheetsClient;

    const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheetsClient = google.sheets({ version: 'v4', auth });
    return sheetsClient;
}

/**
 * 確保「記帳備份」工作表存在，若不存在則建立
 */
async function ensureSheet(sheets) {
    try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
        const exists = meta.data.sheets.some(s => s.properties.title === SHEET_TAB);

        if (!exists) {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: SHEET_ID,
                requestBody: {
                    requests: [{
                        addSheet: {
                            properties: { title: SHEET_TAB }
                        }
                    }]
                }
            });
            console.log(`📊 已建立工作表: ${SHEET_TAB}`);
        }
    } catch (err) {
        console.error('❌ 確認工作表失敗:', err.message);
        throw err;
    }
}

/**
 * 全量同步所有交易到 Google Sheets
 * 策略：清空 → 寫入標題列 → 寫入全部資料
 */
async function syncToSheets() {
    if (!SHEET_ID) {
        console.warn('⚠️ GOOGLE_SHEET_ID 未設定，跳過備份');
        return;
    }

    try {
        const sheets = await getSheets();
        await ensureSheet(sheets);

        // 查詢所有交易（含帳戶、分類名稱）
        const rows = db.prepare(`
            SELECT t.id, t.date, t.time, t.item, t.amount,
                   a.name as account_name,
                   c.name as category_name,
                   t.description, t.created_at
            FROM transactions t
            LEFT JOIN accounts a ON t.account_id = a.id
            LEFT JOIN categories c ON t.category_id = c.id
            ORDER BY t.date DESC, t.time DESC, t.id DESC
        `).all();

        // 準備寫入資料
        const header = ['ID', '日期', '時間', '品項', '金額', '帳戶', '分類', '備註', '建立時間'];
        const data = rows.map(r => [
            r.id, r.date, r.time, r.item, r.amount,
            r.account_name || '', r.category_name || '',
            r.description || '', r.created_at || ''
        ]);

        const range = `${SHEET_TAB}!A1`;

        // 清空工作表
        await sheets.spreadsheets.values.clear({
            spreadsheetId: SHEET_ID,
            range: `${SHEET_TAB}!A:Z`,
        });

        // 寫入標題 + 資料
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [header, ...data]
            }
        });

        console.log(`📊 備份完成: ${rows.length} 筆交易已同步至 Google Sheets`);
    } catch (err) {
        // 備份失敗不影響主功能，僅記錄錯誤
        console.error('❌ Google Sheets 備份失敗:', err.message);
    }
}

/**
 * 非同步觸發備份 (fire-and-forget)
 * 不阻塞主要的 API 回應
 */
function triggerBackup() {
    setImmediate(() => {
        syncToSheets().catch(err => {
            console.error('❌ 備份觸發失敗:', err.message);
        });
    });
}

module.exports = { triggerBackup, syncToSheets };
