# 史萊姆-好玩遊戲區 (AI Bookkeeping)

個人專用記帳系統，結合 **React 現代化介面** 與 **Google Gemini AI 智能填入** 功能。

![AI Smart Fill](https://i.imgur.com/example.png)

## 核心功能

- **AI 智能填入**：輸入「早餐 50」或「房租 28000 電費 2000」，自動解析品項、金額、帳戶與分類。
- **多筆批次處理**：支援一次輸入多筆交易，預覽後一鍵儲存。
- **現代化 UI**：採用深色玻璃擬態 (Glassmorphism) 設計，手機操作流暢。
- **安全驗證**：TOTP (Google Authenticator) 雙因素驗證 + JWT 滑動視窗。

## 快速開始 (本地開發)

```bash
# 1. 安裝依賴
npm install
cd client && npm install && cd ..

# 2. 設定環境變數
cp .env.example .env
# 編輯 .env，填入 ADMIN_TOTP_SECRET 和 GEMINI_API_KEY

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
| `GEMINI_API_KEY` | Google Gemini API Key | `AIzaSy...` |
| `DB_PATH` | SQLite 資料庫目錄 | `./data` 或 `/mnt/data` |
| `PORT` | 伺服器埠 | `3000` (Cloud Run 會自動注入) |

## Cloud Run 部署指引

本專案支援 **Cloud Run (Gen2)** 部署，並使用 **GCS FUSE** 掛載 SQLite 資料庫以實現持久化。

### 1. 準備 GCS Bucket

建立一個儲存桶用來放 SQLite 資料庫檔案：

```bash
export PROJECT_ID=你的專案ID
export REGION=asia-east1
export BUCKET_NAME=bookkeeping-db-${PROJECT_ID}

gsutil mb -l ${REGION} gs://${BUCKET_NAME}
```

### 2. 部署到 Cloud Run

直接使用源碼部署（Source Deploy）：

```bash
gcloud run deploy bookkeeping \
  --source . \
  --region ${REGION} \
  --platform managed \
  --allow-unauthenticated \
  --execution-environment gen2 \
  --set-env-vars "ADMIN_TOTP_SECRET=填入你的Secret,JWT_SECRET=填入隨機字串,GEMINI_API_KEY=填入GeminiKey,DB_PATH=/mnt/data" \
  --add-volume name=gcs-data,type=cloud-storage,bucket=${BUCKET_NAME} \
  --add-volume-mount volume=gcs-data,mount-path=/mnt/data
```

> **注意**：
> - `source .` 會自動識別 `Dockerfile` 並構建。
> - `execution-environment gen2` 是必須的，因為需要掛載 GCS FUSE。
> - `DB_PATH` 必須設為 `/mnt/data`，這是 GCS 掛載的路徑。

### 3. (可選) 設定自定義網域

在 Cloud Run 主控台的「整合」或「管理自定義網域」中設定你的網域。

---

## 技術棧

- **前端**: React 19 + Vite 6 + Tailwind CSS 4
- **後端**: Express 4 + better-sqlite3
- **AI**: Google Gemini API (gemini-2.0-flash)
- **部署**: Google Cloud Run Gen2 + GCS FUSE
