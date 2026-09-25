# ⚡ EdgeAI Nexus Gateway

> **企業級邊緣 AI 多提供商負載均衡與容災閘道 (Enterprise Edge AI Load Balancer & Fallback Gateway)**
> 
> 提供全球低延遲、相容 OpenAI API 標準規範之多模型分發路由，具備硬體級 **AES-256-GCM / PBKDF2 Web Crypto** 金鑰加密金庫、自動故障轉移 (Failover Cascade)、Supabase 資料庫雙向同動以及原生 **Cloudflare Workers 邊緣部署** 與 **GitHub CI/CD 自動化發布**。

---

## 🌟 核心特色 (Core Features)

- 🛡️ **AES-256-GCM 零信任金鑰保險庫**：所有上游 API 金鑰在進入資料庫或邊緣前均經過 PBKDF2 (100,000 次疊代) + AES-256-GCM 獨立 IV/AuthTag 加密，前端與通訊鏈路永不暴露明文金鑰。
- ⚡ **全球邊緣極速路由 (Cloudflare Workers)**：編譯為相容 Cloudflare Workers 原生邊緣腳本，利用 Web Crypto Subtle API 於邊緣節點極速解密，路由延遲低於 5ms。
- 🔄 **五大負載均衡與容災策略**：
  - `fallback-cascade`：優先級容災轉移（首選失敗自動秒級切換至備援提供商）
  - `least-latency`：最低延遲動態路由
  - `weighted`：權重隨機負載分流
  - `round-robin`：循環輪詢平衡
  - `random`：純隨機負載均衡
- 🤖 **全面支援主流與免費 AI 提供商**：
  - **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`)
  - **Groq** (`llama-3.3-70b-versatile`, `mixtral-8x7b-32768`)
  - **Cerebras** (`llama3.1-70b`, `llama3.1-8b`)
  - **Ollama Cloud** (`llama3.3`, `qwen2.5-coder:32b`, `deepseek-r1:70b`)
  - **Hugging Face Model Router** (`meta-llama/Llama-3.3-70B-Instruct`, `deepseek-ai/DeepSeek-R1`)
  - **AgnesAI APIHub** (`agnes-chat`, `agnes-pro`, `gpt-4o-mini`, `claude-3-5-sonnet`)
  - **Cloudflare Workers AI** (邊緣原生 `env.AI` 繫結，免金鑰直連)
  - **OpenRouter / Mistral / DeepSeek / Together AI / 自訂端點**
- 🗄️ **Supabase / PostgreSQL 即時雙向同動**：原生相容 Supabase Direct SQL (pg Pool) 與 REST PostgREST 端點，提供一鍵資料庫結構初始化。
- 🔑 **虛擬 API Key 隔離與頻率限制 (RPM)**：針對客戶端應用核發專屬虛擬金鑰，支援細粒度模型白名單與用量統計。
- 📊 **完整遙測監控與即時對話測試台**：內建全功能 SSE 串流 Chat Playground、TTFT (首字延遲) 監控、熔斷器狀態儀表板。

---

## 🚀 部署方式指南 (Deployment Guides)

本專案支援 **全端控制台應用程式部署** 與 **純邊緣 Cloudflare Worker 閘道部署** 兩種模式：

### 途徑一：連結 GitHub 自動部署至 Cloudflare Workers (推薦)

本專案已為您生成完整的 GitHub Actions CI/CD 工作流程檔與 Wrangler 配置。

#### 步驟 1：建立 GitHub 倉庫並推送代碼
在控制台「Cloudflare Worker」標籤頁下載生成的 Worker 檔案或於本機專案目錄執行：
```bash
git init
git add .
git commit -m "feat: initial edge ai gateway"
git branch -M main
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/<YOUR_REPO_NAME>.git
git push -u origin main
```

#### 步驟 2：設定 GitHub Actions 機密變數 (Secrets)
進入 GitHub 倉庫頁面 -> **Settings** -> **Secrets and variables** -> **Actions** -> 點擊 **New repository secret**，新增以下機密：

| Secret 變數名稱 | 說明 | 取得方式 |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 存取權杖 | 前往 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)，選擇 **Edit Cloudflare Workers** 範本建立 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳戶 ID | 登入 Cloudflare 後於 Workers & Pages 右側欄位複製 **Account ID** |
| `GATEWAY_ENCRYPTION_KEY` | 主加密金鑰 | 於控制台「主加密金鑰」設定的 Passphrase |

#### 步驟 3：自動化 CI/CD 執行
專案中內建的 `.github/workflows/deploy.yml` 將在每次 `git push` 時自動驗證並調用 `cloudflare/wrangler-action` 發布至 Cloudflare 全球 300+ 邊緣節點！

---

### 途徑二：Cloudflare Dashboard 直接連接 GitHub 倉庫 (Workers Builds)

若您偏好使用 Cloudflare 官方原生的 Git 整合功能：

1. 開啟 [Cloudflare Dashboard](https://dash.cloudflare.com/) -> 前往 **Workers & Pages**。
2. 點擊 **Create application** -> 切換至 **Workers** 標籤頁 -> 點擊 **Connect to Git**。
3. 授權 Cloudflare 存取您的 GitHub 帳號並選取本專案倉庫。
4. 設定建置參數：
   - **Production Branch**: `main`
   - **Root directory**: `/`
   - **Build command**: `npm install`
   - **Deploy command**: `npx wrangler deploy`
5. 在 **Environment Variables & Secrets** 新增：
   - 變數名稱：`GATEWAY_ENCRYPTION_KEY`
   - 數值：填入您的主加密金鑰字串
6. 點擊 **Save and Deploy**，日後只要推送至 GitHub，Cloudflare 便會自動觸發邊緣建置！

---

### 途徑三：本機使用 Cloudflare Wrangler CLI 手動部署

```bash
# 1. 安裝 Cloudflare Wrangler
npm install -g wrangler

# 2. 登入 Cloudflare 帳號
npx wrangler login

# 3. 本地邊緣模擬測試
npx wrangler dev

# 4. 一鍵發布至線上邊緣網路
npx wrangler deploy
```

---

### 途徑四：全端應用程式部署 (Node.js / Docker / Vercel / Railway / Render)

若需要部署包含 React 視覺化管理後台、即時統計儀表板與 Supabase 連線介面的完整服務：

#### 本機開發與啟動
```bash
# 1. 複製環境變數範本
cp .env.example .env

# 2. 安裝套件依賴
npm install

# 3. 啟動全端開發伺服器 (預設 Port 3000)
npm run dev
```

#### Docker 容器化部署
```bash
# 建置 Docker 映像檔
docker build -t edgeai-nexus-gateway .

# 執行容器
docker run -d -p 3000:3000 \
  -e DATABASE_URL="postgres://postgres.xxxx:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?sslmode=require" \
  -e GATEWAY_ENCRYPTION_KEY="your-ultra-secure-passphrase" \
  --name edgeai-gateway edgeai-nexus-gateway
```

---

## 🗄️ Supabase 資料庫快速建立 SQL

於 Supabase Dashboard -> **SQL Editor** 執行以下腳本即可快速完成結構初始化：

```sql
-- 1. 建立 AI 提供商資料表
CREATE TABLE IF NOT EXISTS ai_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  encrypted_api_key TEXT,
  api_key_masked TEXT,
  model TEXT NOT NULL,
  supported_models TEXT[] DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  weight INTEGER DEFAULT 50,
  priority INTEGER DEFAULT 1,
  max_tokens INTEGER,
  rate_limit_rpm INTEGER,
  custom_headers JSONB DEFAULT '{}'::jsonb,
  auth_header_type TEXT DEFAULT 'Bearer',
  custom_auth_header_name TEXT,
  request_body_format TEXT DEFAULT 'openai-chat',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 2. 建立虛擬 API 金鑰表
CREATE TABLE IF NOT EXISTS virtual_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  allowed_models TEXT[] DEFAULT '{"*"}',
  rate_limit_rpm INTEGER DEFAULT 60,
  total_usage_tokens BIGINT DEFAULT 0,
  total_requests BIGINT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT
);

-- 3. 建立請求遙測日誌表
CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  client_ip TEXT,
  virtual_key_prefix TEXT,
  requested_model TEXT NOT NULL,
  resolved_provider_id TEXT NOT NULL,
  resolved_provider_name TEXT NOT NULL,
  resolved_model TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  ttft_ms INTEGER,
  status_code INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  fallback_count INTEGER DEFAULT 0,
  fallback_trace TEXT[] DEFAULT '{}',
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  streaming BOOLEAN DEFAULT false,
  error_message TEXT
);

-- 4. 建立閘道全域設定表
CREATE TABLE IF NOT EXISTS gateway_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  load_balancing_strategy TEXT DEFAULT 'fallback-cascade',
  circuit_breaker_threshold INTEGER DEFAULT 3,
  circuit_breaker_cooldown_sec INTEGER DEFAULT 30,
  max_retries_per_request INTEGER DEFAULT 2,
  request_timeout_ms INTEGER DEFAULT 30000,
  require_auth_for_v1 BOOLEAN DEFAULT false,
  default_model TEXT DEFAULT 'gemini-2.5-flash',
  master_key_set BOOLEAN DEFAULT true,
  updated_at BIGINT NOT NULL
);
```

---

## 📡 OpenAI 相容 API 串接範例

本閘道完全相容標準 OpenAI SDK 與 REST API：

### 1. 使用 cURL 發送對話請求

```bash
curl https://your-gateway-domain.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer vkey-xxxxxxxxxxxx" \
  -d '{
    "model": "llama3.3",
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "Hello! How can you assist me?" }
    ],
    "stream": false
  }'
```

### 2. 使用 Python `openai` 官方 SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://your-gateway-domain.com/v1",
    api_key="vkey-your-virtual-key" # 若未啟用強制鑑權可填任意字串
)

response = client.chat.completions.create(
    model="llama3.3",
    messages=[
        {"role": "user", "content": "為什麼邊緣 AI 負載均衡器很重要？"}
    ],
    stream=True
)

for chunk in response:
    content = chunk.choices[0].delta.content
    if content:
        print(content, end="", flush=True)
```

### 3. 使用 Node.js / TypeScript `openai` SDK

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'https://your-gateway-domain.com/v1',
  apiKey: 'vkey-your-virtual-key'
});

async function main() {
  const completion = await openai.chat.completions.create({
    model: 'gemini-2.5-flash',
    messages: [{ role: 'user', content: '介紹一下 Cloudflare Workers 的優勢' }],
    stream: true,
  });

  for await (const chunk of completion) {
    process.stdout.write(chunk.choices[0]?.delta?.content || '');
  }
}

main();
```

---

## ⚠️ Cloudflare Workers AI 配額提示

使用 **Cloudflare Workers AI** 邊緣原生模型（如 `@cf/meta/llama-3.3-70b-instruct`）時，係調用 Cloudflare 帳戶每日提供之免費神經元配額 (10,000 Neurons/Day)。請留意高負載或連續測試可能消耗配額，進而影響同帳號下其他依賴 Workers AI 的專案服務。

---

## 📄 開源授權 (License)

MIT License © 2026 EdgeAI Nexus Gateway. All rights reserved.
