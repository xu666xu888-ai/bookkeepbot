# ===== Build Stage =====
FROM node:20-alpine AS builder

WORKDIR /app

# 安裝根依賴
COPY package*.json ./
RUN npm ci --omit=dev

# 安裝前端依賴並 build
COPY client/package*.json ./client/
RUN cd client && npm ci
COPY client/ ./client/
RUN cd client && npm run build

# ===== Production Stage =====
FROM node:20-alpine

WORKDIR /app

# 只複製必要檔案
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/client/dist ./client/dist
COPY server/ ./server/
COPY package.json .

# 建立資料目錄（GCS FUSE 掛載點）
RUN mkdir -p /mnt/data

ENV NODE_ENV=production
ENV PORT=8080
ENV DB_PATH=/mnt/data

EXPOSE 8080

CMD ["node", "server/server.js"]
