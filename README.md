# 史萊姆-好玩遊戲區

個人專用記帳系統，結合 Web 介面與 Telegram Bot，使用 TOTP 驗證確保安全。

## 快速開始 (本地開發)

```bash
# 1. 安裝依賴
npm install
cd client && npm install && cd ..

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env，填入你的 TOTP Secret 和 Telegram Bot Token

# 3. 生成 TOTP Secret（加入 Google Authenticator）
node -e "const { authenticator } = require('otplib'); const s = authenticator.generateSecret(); console.log('Secret:', s); console.log('URI:', authenticator.keyuri('admin', 'Bookkeeping', s))"

# 4. 啟動開發伺服器
npm run dev
```

## 環境變數

| 變數 | 說明 | 範例 |
|------|------|------|
| `ADMIN_TOTP_SECRET` | TOTP Secret (Google Authenticator) | `JBSWY3DPEHPK3PXP` |
| `JWT_SECRET` | JWT 簽名密鑰 | 隨機長字串 |
| `TELEGRAM_TOKEN` | Telegram Bot Token | `123456:ABC...` |
| `BOT_ACCESS_TOKEN` | Bot 8 位數存取 Token | `12345678` |
| `DB_PATH` | SQLite 資料庫目錄 | `./data` 或 `/mnt/data` |
| `PORT` | 伺服器埠 | `3000` |

## Cloud Run 部署

### 1. 建立 GCS Bucket
```bash
gsutil mb -l asia-east1 gs://YOUR_BUCKET_NAME
```

### 2. Build 並推送 Docker Image
```bash
# 設定專案
export PROJECT_ID=your-gcp-project-id
export REGION=asia-east1

# Build & Push
gcloud builds submit --tag ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/bookkeeping
```

### 3. 部署到 Cloud Run (含 GCS FUSE 掛載)
```bash
gcloud run deploy bookkeeping \
  --image ${REGION}-docker.pkg.dev/${PROJECT_ID}/cloud-run-source-deploy/bookkeeping \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 1 \
  --execution-environment gen2 \
  --set-env-vars "ADMIN_TOTP_SECRET=YOUR_SECRET,JWT_SECRET=YOUR_JWT_SECRET,TELEGRAM_TOKEN=YOUR_BOT_TOKEN,BOT_ACCESS_TOKEN=YOUR_8_DIGIT_TOKEN,DB_PATH=/mnt/data" \
  --add-volume name=gcs-volume,type=cloud-storage,bucket=YOUR_BUCKET_NAME \
  --add-volume-mount volume=gcs-volume,mount-path=/mnt/data
```

### 4. 設定 Telegram Webhook
```bash
export CLOUD_RUN_URL=$(gcloud run services describe bookkeeping --region ${REGION} --format='value(status.url)')

curl -X POST "https://api.telegram.org/bot${TELEGRAM_TOKEN}/setWebhook?url=${CLOUD_RUN_URL}/api/telegram/webhook"
```

## 技術棧

- **前端:** React 19 + Vite 6 + Tailwind CSS 4
- **後端:** Express 4 + better-sqlite3
- **認證:** TOTP (otplib) + JWT (15 分鐘滑動視窗)
- **部署:** Google Cloud Run Gen2 + GCS FUSE
