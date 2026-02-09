require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    exposedHeaders: ['X-New-Token'] // 讓前端能讀取滑動視窗 JWT
}));
app.use(express.json());

// API 路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/telegram', require('./routes/telegram')); // F-07: 掛載 Telegram webhook

// 健康檢查 (必須在 catch-all 之前)
app.get('/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});


// 生產環境：提供前端靜態檔案 (catch-all 必須放最後)
if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
        res.sendFile(path.join(clientDist, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📂 DB path: ${process.env.DB_PATH || './data'}/expense.db`);
});
