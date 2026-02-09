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

        const systemPrompt = `你是一個記帳助手。請將用戶輸入解析為 JSON 格式。

## 當前資訊
- 今天日期：${today} (${new Date().toLocaleDateString('zh-TW', { weekday: 'long' })})
- 現在時間：${now}
- 可用帳戶：${accounts.map(a => a.name).join('、')} (預設：${accounts[0]?.name})
- 可用分類：${categories.map(c => c.name).join('、')}

## 解析規則
1. **金額**：
   - 支出為正數，收入為負數（除非用戶明確指定「+」或「收入」）。
   - 支援「萬」(10000)、「千」(1000) 等單位。
   - 運算：支援簡單運算如「午餐100+飲料50」可解析為 150，或拆分為兩筆。建議拆分。

2. **日期與時間**：
   - 支援「昨天」、「前天」、「上週五」等相對日期，請根據今日 (${today}) 推算準確的 YYYY-MM-DD。
   - 若未指定，預設為今日。

3. **分類與帳戶匹配**：
   - 根據關鍵字自動匹配最接近的分類（例如「拿鐵」->「飲食」、「加油」->「交通」）。
   - 若無法匹配，可匹配最接近的現有分類，或設為空字串讓前端處理。
   - 帳戶必須從「可用帳戶」清單中選擇。

4. **多筆交易**：
   - 若輸入包含多個不同事件（以空格、換行或逗號分隔），請拆分為多筆交易物件。

## 輸出格式 (JSON Only)
{
  "transactions": [
    {
      "item": "品項",
      "amount": 100,
      "isIncome": false,
      "category": "飲食",
      "account": "現金",
      "date": "2023-01-01",
      "time": "12:00",
      "description": "備註"
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
