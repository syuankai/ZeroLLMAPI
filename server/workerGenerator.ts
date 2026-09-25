import { db } from './db.js';
import { getRuntimeMasterKey } from './crypto.js';

export function generateCloudflareWorkerCode(): { 
  workerTs: string; 
  wranglerToml: string; 
  devVars: string;
  githubWorkflow: string;
  packageJson: string;
  readmeMd: string;
} {
  const providers = db.getProviders();
  const settings = db.getSettings();
  const masterKey = getRuntimeMasterKey();
  const dbConfig = db.getDbConfig();

  const providersJson = JSON.stringify(
    providers.map((p) => ({
      id: p.id,
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl,
      encryptedApiKey: p.encryptedApiKey,
      model: p.model,
      supportedModels: p.supportedModels,
      enabled: p.enabled,
      weight: p.weight,
      priority: p.priority,
      authHeaderType: p.authHeaderType,
      customAuthHeaderName: p.customAuthHeaderName,
      customHeaders: p.customHeaders
    })),
    null,
    2
  );

  const wranglerToml = `name = "edgeai-nexus-gateway"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

# Cloudflare Workers AI Direct Binding (Free Tier: 10k neurons/day)
[ai]
binding = "AI"

[vars]
GATEWAY_ENCRYPTION_KEY = "${masterKey}"
DEFAULT_MODEL = "${settings.defaultModel || 'gemini-2.5-flash'}"
LB_STRATEGY = "${settings.loadBalancingStrategy}"
SUPABASE_HOST = "${dbConfig.host || ''}"
SUPABASE_PORT = "${dbConfig.port || 5432}"
SUPABASE_USER = "${dbConfig.user || 'postgres'}"
`;

  const devVars = `GATEWAY_ENCRYPTION_KEY="${masterKey}"
DEFAULT_MODEL="${settings.defaultModel}"
`;

  const workerTs = `/**
 * EdgeAI Nexus Gateway - Cloudflare Worker Edition
 * AI Load Balancing Gateway with AES-256-GCM Decryption & Multi-Provider Cascade
 * Deployable directly on Cloudflare Workers edge network.
 */

export interface Env {
  AI: any; // Cloudflare Workers AI Binding
  GATEWAY_ENCRYPTION_KEY: string;
  DEFAULT_MODEL?: string;
  LB_STRATEGY?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  type: string;
  baseUrl: string;
  encryptedApiKey: string;
  model: string;
  supportedModels: string[];
  enabled: boolean;
  weight: number;
  priority: number;
  authHeaderType?: string;
  customAuthHeaderName?: string;
  customHeaders?: Record<string, string>;
}

// Bundled providers with encrypted API keys
const BUNDLED_PROVIDERS: ProviderConfig[] = ${providersJson};

// Web Crypto AES-256-GCM Decryptor for Cloudflare Workers
async function decryptSecretWebCrypto(encryptedPayload: string, passphrase: string): Promise<string> {
  if (!encryptedPayload || !encryptedPayload.startsWith('aes256gcm:')) {
    return encryptedPayload;
  }
  const parts = encryptedPayload.split(':');
  if (parts.length !== 5) return '';
  const [, saltHex, ivHex, authTagHex, ciphertextHex] = parts;

  const enc = new TextEncoder();
  const passphraseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  const salt = hexToBytes(saltHex);
  const iv = hexToBytes(ivHex);
  const authTag = hexToBytes(authTagHex);
  const cipher = hexToBytes(ciphertextHex);

  const combinedCipher = new Uint8Array(cipher.length + authTag.length);
  combinedCipher.set(cipher, 0);
  combinedCipher.set(authTag, cipher.length);

  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passphraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decryptedBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    aesKey,
    combinedCipher
  );

  return new TextDecoder().decode(decryptedBuf);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, apikey',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, apikey',
    };

    // Health & Info Endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'online',
        runtime: 'Cloudflare Workers Edge Network',
        providers_count: BUNDLED_PROVIDERS.length,
        version: '2.0.0'
      }, null, 2), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // OpenAI Models list
    if (url.pathname === '/v1/models' && request.method === 'GET') {
      const models = BUNDLED_PROVIDERS.flatMap(p => 
        p.supportedModels.map(m => ({
          id: m,
          object: 'model',
          created: 1700000000,
          owned_by: p.name,
          permission: []
        }))
      );
      return new Response(JSON.stringify({ object: 'list', data: models }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // OpenAI Chat Completions Proxy with Multi-Provider Cascade
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const activeProviders = BUNDLED_PROVIDERS.filter(p => p.enabled);

        if (activeProviders.length === 0) {
          return new Response(JSON.stringify({ error: { message: 'No enabled AI providers found in configuration' } }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const sorted = [...activeProviders].sort((a, b) => a.priority - b.priority);
        let lastError: any = null;

        for (const provider of sorted) {
          try {
            // Check for Cloudflare Workers AI direct binding (@cf models)
            if (provider.type === 'cloudflare' && env.AI) {
              const cfModel = provider.supportedModels.includes(body.model) ? body.model : '@cf/meta/llama-3.3-70b-instruct';
              const aiResponse = await env.AI.run(cfModel, {
                messages: body.messages,
                stream: !!body.stream
              });

              if (body.stream) {
                return new Response(aiResponse, {
                  headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' }
                });
              }

              return new Response(JSON.stringify({
                choices: [{ message: { role: 'assistant', content: aiResponse.response } }],
                model: cfModel
              }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }

            const masterKey = env.GATEWAY_ENCRYPTION_KEY || 'edgeai-default-master-key-change-in-ui-vault-9902';
            const apiKey = await decryptSecretWebCrypto(provider.encryptedApiKey, masterKey);

            let targetUrl = '';
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              ...(provider.customHeaders || {})
            };

            if (provider.type === 'gemini') {
              targetUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'groq') {
              targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'ollama_cloud') {
              targetUrl = 'https://ollama.com/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'huggingface') {
              targetUrl = 'https://router.huggingface.co/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'agnes') {
              targetUrl = 'https://apihub.agnes-ai.com/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'openrouter') {
              targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else {
              const base = provider.baseUrl.replace(/\\/$/, '');
              targetUrl = base.endsWith('/chat/completions') ? base : \`\${base}/chat/completions\`;
              if (apiKey) {
                if (provider.authHeaderType === 'x-api-key') headers['x-api-key'] = apiKey;
                else if (provider.authHeaderType === 'api-key') headers['api-key'] = apiKey;
                else if (provider.authHeaderType === 'custom' && provider.customAuthHeaderName) headers[provider.customAuthHeaderName] = apiKey;
                else headers['Authorization'] = \`Bearer \${apiKey}\`;
              }
            }

            const forwardBody = {
              model: provider.supportedModels.includes(body.model) ? body.model : provider.model,
              messages: body.messages,
              stream: !!body.stream,
              temperature: body.temperature ?? 0.7,
              max_tokens: body.max_tokens
            };

            const upstreamRes = await fetch(targetUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(forwardBody)
            });

            if (upstreamRes.ok) {
              const responseHeaders = new Headers(upstreamRes.headers);
              responseHeaders.set('Access-Control-Allow-Origin', '*');
              responseHeaders.set('x-gateway-provider', provider.name);
              responseHeaders.set('x-gateway-runtime', 'Cloudflare-Worker-Edge');

              return new Response(upstreamRes.body, {
                status: upstreamRes.status,
                headers: responseHeaders
              });
            } else {
              lastError = await upstreamRes.text();
            }
          } catch (err: any) {
            lastError = err.message;
          }
        }

        return new Response(JSON.stringify({
          error: {
            message: 'All upstream AI providers failed in fallback cascade.',
            details: lastError
          }
        }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

      } catch (err: any) {
        return new Response(JSON.stringify({ error: { message: err.message } }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
};
`;

  const githubWorkflow = `name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main
      - master
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Build & Deploy Edge Gateway
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Dependencies
        run: npm ci || npm install

      - name: Publish to Cloudflare Workers Edge
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          secrets: |
            GATEWAY_ENCRYPTION_KEY
        env:
          GATEWAY_ENCRYPTION_KEY: \${{ secrets.GATEWAY_ENCRYPTION_KEY }}
`;

  const packageJson = JSON.stringify(
    {
      name: 'edgeai-nexus-gateway-worker',
      version: '1.0.0',
      description: 'Ultra-fast OpenAI-compatible AI Gateway deployed on Cloudflare Workers',
      main: 'src/index.ts',
      scripts: {
        dev: 'wrangler dev',
        deploy: 'wrangler deploy',
        types: 'wrangler types'
      },
      dependencies: {},
      devDependencies: {
        '@cloudflare/workers-types': '^4.20240923.0',
        typescript: '^5.5.4',
        wrangler: '^3.80.0'
      }
    },
    null,
    2
  );

  const readmeMd = `# EdgeAI Nexus Gateway - Cloudflare Worker Edition ⚡

本專案為自動生成的 **Cloudflare Workers 邊緣 AI 負載均衡閘道 (Serverless Edge Gateway)**。支援自動金鑰解密 (AES-256-GCM)、多提供商自動故障轉移 (Failover Cascade) 以及 Cloudflare Workers AI 原生邊緣模型直連。

---

## 🚀 方式一：GitHub 倉庫自動化 CI/CD 部署 (推薦)

### 1. 將此資料夾推送至 GitHub 倉庫
\`\`\`bash
git init
git add .
git commit -m "feat: initial edge gateway commit"
git branch -M main
git remote add origin https://github.com/<YOUR_USER>/<YOUR_REPO>.git
git push -u origin main
\`\`\`

### 2. 設定 GitHub Repository Secrets
進入 GitHub 倉庫 -> **Settings** -> **Secrets and variables** -> **Actions** -> 點擊 **New repository secret**：

| Secret 名稱 | 說明 | 取得方式 |
| :--- | :--- | :--- |
| \`CLOUDFLARE_API_TOKEN\` | Cloudflare API 存取權杖 | [Cloudflare Dashboard 建立 Token](https://dash.cloudflare.com/profile/api-tokens) (選擇 *Edit Cloudflare Workers* 範本) |
| \`CLOUDFLARE_ACCOUNT_ID\` | Cloudflare 帳戶 ID | Cloudflare Workers Dashboard 右側欄位中的 **Account ID** |
| \`GATEWAY_ENCRYPTION_KEY\` | 主加密金鑰 | \`${masterKey}\` (於 EdgeAI 控制台設定之金鑰) |

### 3. 自動部署
每當您推送更新至 \`main\` 分支，GitHub Actions 將會自動執行 \`.github/workflows/deploy.yml\` 並將 Worker 發布至全球 300+ 邊緣節點！

---

## 🌐 方式二：Cloudflare Dashboard 直接連接 GitHub 倉庫 (Workers Builds)

1. 開啟 [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **Workers & Pages**。
2. 點擊 **Create Application** -> 選擇 **Workers** 標籤頁 -> 點擊 **Connect to Git**。
3. 授權並選擇您的 GitHub 倉庫。
4. 設定建置參數：
   - **Production Branch**: \`main\`
   - **Root directory**: \`./\`
   - **Build command**: (留空或 \`npm install\`)
   - **Deploy command**: \`npx wrangler deploy\`
5. 在 **Variables and Secrets** 區塊新增密鑰：
   - 變數名：\`GATEWAY_ENCRYPTION_KEY\`
   - 數值：\`${masterKey}\`
6. 點擊 **Save and Deploy** 完成部署！

---

## 💻 方式三：本機使用 Wrangler CLI 快速手動部署

\`\`\`bash
# 1. 安裝依賴
npm install

# 2. 本地預覽測試
npm run dev

# 3. 部署至 Cloudflare 邊緣網路
npm run deploy
\`\`\`
`;

  return { workerTs, wranglerToml, devVars, githubWorkflow, packageJson, readmeMd };
}
