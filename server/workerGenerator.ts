import { db } from './db.js';
import { getRuntimeMasterKey } from './crypto.js';

export function generateCloudflareWorkerCode(): { workerTs: string; wranglerToml: string; devVars: string } {
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
    })),
    null,
    2
  );

  const wranglerToml = `name = "edgeai-nexus-gateway"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
GATEWAY_ENCRYPTION_KEY = "${masterKey}"
DEFAULT_MODEL = "${settings.defaultModel || 'gemini-2.5-flash'}"
LB_STRATEGY = "${settings.loadBalancingStrategy}"
REST_DB_ENDPOINT = "${dbConfig.restEndpoint || ''}"
REST_DB_API_KEY = "${dbConfig.restApiKey || ''}"
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
  GATEWAY_ENCRYPTION_KEY: string;
  DEFAULT_MODEL?: string;
  LB_STRATEGY?: string;
  REST_DB_ENDPOINT?: string;
  REST_DB_API_KEY?: string;
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
}

// Statically bundled or dynamically fetched providers
const BUNDLED_PROVIDERS: ProviderConfig[] = ${providersJson};

// Helper: Web Crypto AES-256-GCM Decryptor for Cloudflare Workers
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

  // Combine ciphertext and authTag for Web Crypto standard GCM format
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

    // Handle CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
    };

    // Health & Info Endpoint
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'online',
        runtime: 'Cloudflare Workers Edge',
        providers_active: BUNDLED_PROVIDERS.filter(p => p.enabled).length,
        version: '1.0.0'
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

    // OpenAI Chat Completions Proxy with Multi-Provider Failover
    if (url.pathname === '/v1/chat/completions' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const activeProviders = BUNDLED_PROVIDERS.filter(p => p.enabled && p.encryptedApiKey);

        if (activeProviders.length === 0) {
          return new Response(JSON.stringify({ error: { message: 'No enabled AI providers found in Worker config' } }), {
            status: 503,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Sort by priority for fallback cascade
        const sorted = [...activeProviders].sort((a, b) => a.priority - b.priority);
        let lastError: any = null;

        for (const provider of sorted) {
          try {
            const masterKey = env.GATEWAY_ENCRYPTION_KEY || 'edgeai-default-master-key-change-in-ui-vault-9902';
            const apiKey = await decryptSecretWebCrypto(provider.encryptedApiKey, masterKey);

            let targetUrl = '';
            const headers: Record<string, string> = {
              'Content-Type': 'application/json'
            };

            if (provider.type === 'gemini') {
              targetUrl = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'groq') {
              targetUrl = 'https://api.groq.com/openai/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else if (provider.type === 'openrouter') {
              targetUrl = 'https://openrouter.ai/api/v1/chat/completions';
              headers['Authorization'] = \`Bearer \${apiKey}\`;
            } else {
              targetUrl = \`\${provider.baseUrl.replace(/\\/$/, '')}/chat/completions\`;
              headers['Authorization'] = \`Bearer \${apiKey}\`;
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
              // Inject custom gateway headers
              const responseHeaders = new Headers(upstreamRes.headers);
              responseHeaders.set('Access-Control-Allow-Origin', '*');
              responseHeaders.set('x-gateway-provider', provider.name);
              responseHeaders.set('x-gateway-runtime', 'Cloudflare-Worker-Edge');

              return new Response(upstreamRes.body, {
                status: upstreamRes.status,
                headers: responseHeaders
              });
            } else {
              console.warn(\`Provider \${provider.name} returned HTTP \${upstreamRes.status}, cascading to next...\`);
              lastError = await upstreamRes.text();
            }
          } catch (err: any) {
            console.error(\`Failover from \${provider.name}: \${err.message}\`);
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

  return { workerTs, wranglerToml, devVars };
}
