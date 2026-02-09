/**
 * AI 智能解析路由 — 使用 Gemini API 解析自然語言記帳
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = 'gemini-2.0-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

/**
 * POST /api/ai/parse
 * Body: { text: "早餐 50" }
 * Returns: { transactions: [{ item, amount, isIncome, category, date, time, description }] }
 */
router.post('/parse', authMiddleware, async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ error: '請輸入內容' });
        }

        if (!GEMINI_API_KEY) {
            return res.status(500).json({ error: 'GEMINI_API_KEY 未設定' });
        }

        // 取得現有帳戶和分類
        const accounts = db.prepare('SELECT id, name FROM accounts').all();
        const categories = db.prepare('SELECT id, name FROM categories').all();

        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0].slice(0, 5);

        const systemPrompt = `你是一個記帳助手。解析用戶的自然語言輸入，轉換為結構化的交易資料。

## 規則
1. 支出的 amount 為正數，收入的 amount 為負數
2. 如果用戶沒提到日期，使用今天 ${today}
3. 如果用戶沒提到時間，使用 ${now}
4. 分類必須從以下清單中選擇最合適的：${categories.map(c => c.name).join('、')}
5. 帳戶必須從以下清單中選擇：${accounts.map(a => a.name).join('、')}。如果用戶沒指定帳戶，使用第一個帳戶「${accounts[0]?.name || ''}」
6. 如果一段文字包含多筆交易，拆分成多筆
7. 金額如果寫「萬」就乘以 10000，如「3.5萬」= 35000
8. 默認為支出，除非用戶明確說到「收入」、「入帳」、「+」等字眼

## 輸出格式
嚴格回傳 JSON，不要有任何其他文字：
{
  "transactions": [
    {
      "item": "品項名稱",
      "amount": 50,
      "isIncome": false,
      "category": "分類名稱",
      "account": "帳戶名稱",
      "date": "YYYY-MM-DD",
      "time": "HH:mm",
      "description": ""
    }
  ]
}`;

        const response = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: `${text}` }]
                }],
                systemInstruction: {
                    parts: [{ text: systemPrompt }]
                },
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                }
            })
        });

        if (!response.ok) {
            const err = await response.text();
            console.error('Gemini API error:', err);

            // === Mock Fallback (當配額超限時讓用戶測試 UI) ===
            if (response.status === 429) {
                console.log('⚠️ 配額超限，使用 Mock Data');
                const mockData = [
                    { item: text.split(' ')[0] || '測試品項', amount: parseFloat(text.match(/\d+/)?.[0]) || 100, isIncome: false, category: '雜支', account: accounts[0]?.name, date: today, time: now, description: '(API 配額超限，這是模擬數據)' }
                ];

                // 嘗試解析多筆
                if (text.includes(' ')) {
                    // 簡單規則：如果包含多個數字，嘗試拆分
                    const parts = text.split(/(\s+)/).filter(p => p.trim());
                    // 這只是一個非常粗略的 mock，只為了展示 UI
                }

                return res.json({
                    transactions: mockData.map(tx => ({
                        ...tx,
                        account_id: accounts.find(a => a.name === tx.account)?.id || accounts[0]?.id,
                        category_id: categories.find(c => c.name === tx.category)?.id
                    }))
                });
            }

            return res.status(502).json({ error: 'AI 服務暫時無法使用' });
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) {
            return res.status(502).json({ error: 'AI 回傳格式異常' });
        }

        // 解析 JSON
        const parsed = JSON.parse(rawText);

        // 匹配帳戶和分類 ID
        const result = (parsed.transactions || []).map(tx => {
            const matchedAccount = accounts.find(a => a.name === tx.account) || accounts[0];
            const matchedCategory = categories.find(c => c.name === tx.category);

            return {
                item: tx.item || '',
                amount: Math.abs(tx.amount || 0),
                isIncome: tx.isIncome || tx.amount < 0 || false,
                account_id: matchedAccount?.id || '',
                category_id: matchedCategory?.id || '',
                date: tx.date || today,
                time: tx.time || now,
                description: tx.description || '',
            };
        });

        res.json({ transactions: result });

    } catch (err) {
        console.error('AI parse error:', err);
        res.status(500).json({ error: '解析失敗，請重試' });
    }
});

module.exports = router;
