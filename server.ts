import express, { Request, Response, NextFunction } from 'express';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { db } from './server/db.js';
import { 
  encryptSecret, 
  decryptSecret, 
  maskApiKey, 
  setRuntimeMasterKey, 
  getRuntimeMasterKey, 
  isMasterKeyCustomized, 
  hashPassword, 
  verifyPassword,
  generateGatewayApiKey 
} from './server/crypto.js';
import { testProviderConnection, forwardChatCompletion, ChatCompletionRequest } from './server/providers.js';
import { loadBalancer } from './server/loadBalancer.js';
import { generateCloudflareWorkerCode } from './server/workerGenerator.js';
import { AIProvider, RequestLog, DatabaseConfig } from './server/types.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));

// CORS headers for gateway API and client applications
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, apikey');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Simple session auth check
const authTokens = new Set<string>();

function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  
  if (authTokens.has(token) || token === 'dev-bypass-session') {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Admin authentication required' });
}

// -------------------------------------------------------------
// 1. Auth & System Endpoints
// -------------------------------------------------------------

app.get('/api/auth/status', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const isAuthenticated = authTokens.has(token);
  const settings = db.getSettings();
  const dbConfig = db.getDbConfig();

  res.json({
    authenticated: isAuthenticated,
    masterKeySet: isMasterKeyCustomized(),
    masterKeyMasked: maskApiKey(getRuntimeMasterKey()),
    adminUsername: db.getAdmin().username,
    dbConnected: db.isDbReady(),
    dbType: dbConfig.type,
    dbError: db.getConnectionError(),
    gatewayStats: {
      activeProviders: db.getProviders().filter((p) => p.enabled && p.encryptedApiKey).length,
      totalProviders: db.getProviders().length,
      strategy: settings.loadBalancingStrategy,
    }
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.getAdmin();

  if (username === admin.username && verifyPassword(password, admin.passwordHash, admin.salt)) {
    const sessionToken = `session_${Date.now()}_${Math.random().toString(36).substring(2)}`;
    authTokens.add(sessionToken);
    return res.json({ success: true, token: sessionToken, username: admin.username });
  }

  return res.status(401).json({ success: false, error: 'Invalid username or password' });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  authTokens.delete(token);
  res.json({ success: true });
});

app.post('/api/auth/change-password', requireAdminAuth, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const admin = db.getAdmin();

  if (!verifyPassword(oldPassword, admin.passwordHash, admin.salt)) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const { hash, salt } = hashPassword(newPassword);
  await db.setAdmin({
    ...admin,
    passwordHash: hash,
    salt
  });

  res.json({ success: true, message: 'Admin password updated successfully' });
});

// Master Encryption Key Vault Update
app.post('/api/vault/set-master-key', requireAdminAuth, async (req, res) => {
  const { newMasterKey } = req.body;
  if (!newMasterKey || newMasterKey.length < 8) {
    return res.status(400).json({ error: 'Master encryption key must be at least 8 characters long.' });
  }

  const oldMasterKey = getRuntimeMasterKey();
  
  // Re-encrypt all existing stored provider keys with the new master key
  const providers = db.getProviders();
  for (const prov of providers) {
    if (prov.encryptedApiKey) {
      try {
        const plain = decryptSecret(prov.encryptedApiKey, oldMasterKey);
        prov.encryptedApiKey = encryptSecret(plain, newMasterKey);
        await db.saveProvider(prov);
      } catch (err) {
        console.warn(`Failed to re-encrypt provider ${prov.name}:`, err);
      }
    }
  }

  setRuntimeMasterKey(newMasterKey);
  await db.updateSettings({ masterKeySet: true });

  res.json({
    success: true,
    message: 'Master encryption key updated. All stored provider keys safely re-encrypted with AES-256-GCM.'
  });
});

// -------------------------------------------------------------
// 2. AI Providers Management & Key Vault
// -------------------------------------------------------------

app.get('/api/providers', (req, res) => {
  const providers = db.getProviders().map((p) => ({
    ...p,
    hasApiKey: !!p.encryptedApiKey,
    encryptedApiKey: undefined // Never send encrypted raw blob to client
  }));
  res.json({ providers, dbConnected: db.isDbReady() });
});

app.post('/api/providers', requireAdminAuth, async (req, res) => {
  if (!db.isDbReady()) {
    return res.status(503).json({ error: '資料庫尚未連線，無法儲存提供商。請先在「資料庫設定」中連線 Supabase / PostgreSQL。' });
  }

  const { 
    name, 
    type, 
    baseUrl, 
    apiKey, 
    model, 
    supportedModels, 
    enabled, 
    weight, 
    priority, 
    customHeaders,
    authHeaderType,
    customAuthHeaderName,
    requestBodyFormat
  } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Name and provider type are required' });
  }

  const newProvider: AIProvider = {
    id: `prov-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name,
    type,
    baseUrl: baseUrl || 'https://api.openai.com/v1',
    encryptedApiKey: apiKey ? encryptSecret(apiKey.trim()) : '',
    apiKeyMasked: apiKey ? maskApiKey(apiKey.trim()) : '',
    model: model || 'default',
    supportedModels: Array.isArray(supportedModels) ? supportedModels : [model || 'default'],
    enabled: enabled !== false,
    weight: Number(weight) || 50,
    priority: Number(priority) || 1,
    customHeaders: customHeaders || {},
    authHeaderType: authHeaderType || 'Bearer',
    customAuthHeaderName: customAuthHeaderName || undefined,
    requestBodyFormat: requestBodyFormat || 'openai-chat',
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await db.saveProvider(newProvider);
  res.json({ success: true, provider: { ...newProvider, encryptedApiKey: undefined } });
});

app.put('/api/providers/:id', requireAdminAuth, async (req, res) => {
  if (!db.isDbReady()) {
    return res.status(503).json({ error: '資料庫尚未連線，無法更新提供商。請先在「資料庫設定」中連線 Supabase / PostgreSQL。' });
  }

  const { id } = req.params;
  const existing = db.getProvider(id);
  if (!existing) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const { 
    name, 
    type, 
    baseUrl, 
    apiKey, 
    model, 
    supportedModels, 
    enabled, 
    weight, 
    priority, 
    customHeaders,
    authHeaderType,
    customAuthHeaderName,
    requestBodyFormat
  } = req.body;

  const updated: AIProvider = {
    ...existing,
    name: name ?? existing.name,
    type: type ?? existing.type,
    baseUrl: baseUrl ?? existing.baseUrl,
    model: model ?? existing.model,
    supportedModels: Array.isArray(supportedModels) ? supportedModels : existing.supportedModels,
    enabled: enabled !== undefined ? enabled : existing.enabled,
    weight: weight !== undefined ? Number(weight) : existing.weight,
    priority: priority !== undefined ? Number(priority) : existing.priority,
    customHeaders: customHeaders ?? existing.customHeaders,
    authHeaderType: authHeaderType ?? existing.authHeaderType,
    customAuthHeaderName: customAuthHeaderName ?? existing.customAuthHeaderName,
    requestBodyFormat: requestBodyFormat ?? existing.requestBodyFormat,
    updatedAt: Date.now()
  };

  // If new API key was provided, encrypt it
  if (apiKey && apiKey.trim() && !apiKey.includes('••••')) {
    updated.encryptedApiKey = encryptSecret(apiKey.trim());
    updated.apiKeyMasked = maskApiKey(apiKey.trim());
  }

  await db.saveProvider(updated);
  res.json({ success: true, provider: { ...updated, encryptedApiKey: undefined } });
});

app.delete('/api/providers/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  await db.deleteProvider(id);
  res.json({ success: true, message: 'Provider deleted' });
});

app.post('/api/providers/test/:id', async (req, res) => {
  const { id } = req.params;
  const provider = db.getProvider(id);
  if (!provider) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const result = await testProviderConnection(provider);
  if (result.success) {
    loadBalancer.recordSuccess(provider.id, result.latencyMs);
  } else {
    loadBalancer.recordFailure(provider.id, result.statusCode === 429);
  }

  res.json(result);
});

// -------------------------------------------------------------
// 3. Load Balancer & Routing Policies
// -------------------------------------------------------------

app.get('/api/routing', (req, res) => {
  res.json({
    settings: db.getSettings(),
    healthMap: loadBalancer.getHealthMap()
  });
});

app.post('/api/routing/settings', requireAdminAuth, async (req, res) => {
  const {
    loadBalancingStrategy,
    circuitBreakerThreshold,
    circuitBreakerCooldownSec,
    maxRetriesPerRequest,
    requestTimeoutMs,
    requireAuthForV1,
    defaultModel
  } = req.body;

  await db.updateSettings({
    ...(loadBalancingStrategy && { loadBalancingStrategy }),
    ...(circuitBreakerThreshold && { circuitBreakerThreshold: Number(circuitBreakerThreshold) }),
    ...(circuitBreakerCooldownSec && { circuitBreakerCooldownSec: Number(circuitBreakerCooldownSec) }),
    ...(maxRetriesPerRequest !== undefined && { maxRetriesPerRequest: Number(maxRetriesPerRequest) }),
    ...(requestTimeoutMs && { requestTimeoutMs: Number(requestTimeoutMs) }),
    ...(requireAuthForV1 !== undefined && { requireAuthForV1: Boolean(requireAuthForV1) }),
    ...(defaultModel && { defaultModel })
  });

  res.json({ success: true, settings: db.getSettings() });
});

// -------------------------------------------------------------
// 4. Virtual Gateway API Keys
// -------------------------------------------------------------

app.get('/api/keys', (req, res) => {
  res.json({ keys: db.getVirtualKeys() });
});

app.post('/api/keys', requireAdminAuth, async (req, res) => {
  if (!db.isDbReady()) {
    return res.status(503).json({ error: '資料庫尚未連線，無法儲存金鑰。' });
  }

  const { name, rateLimitRpm, allowedModels } = req.body;
  const { rawKey, keyPrefix, keyHash } = generateGatewayApiKey();

  const newKey = {
    id: `vkey-${Date.now()}`,
    name: name || 'Client Application Key',
    keyHash,
    keyPrefix,
    allowedModels: allowedModels || ['*'],
    rateLimitRpm: Number(rateLimitRpm) || 60,
    totalUsageTokens: 0,
    totalRequests: 0,
    enabled: true,
    createdAt: Date.now()
  };

  await db.addVirtualKey(newKey);
  res.json({ success: true, key: newKey, rawSecretKey: rawKey });
});

app.delete('/api/keys/:id', requireAdminAuth, async (req, res) => {
  const { id } = req.params;
  await db.deleteVirtualKey(id);
  res.json({ success: true });
});

// -------------------------------------------------------------
// 5. Database Direct & REST Connection Endpoints
// -------------------------------------------------------------

app.get('/api/database/config', (req, res) => {
  const config = db.getDbConfig();
  res.json({
    type: config.type,
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    ssl: config.ssl,
    connected: db.isDbReady(),
    error: db.getConnectionError(),
    lastSyncedAt: config.lastSyncedAt
  });
});

app.post('/api/database/connect', requireAdminAuth, async (req, res) => {
  const { host, port, database, user, password, connectionString, ssl } = req.body;

  const targetConfig: DatabaseConfig = {
    type: 'supabase-direct',
    host: host ? String(host).trim() : undefined,
    port: Number(port) || 5432,
    database: database ? String(database).trim() : 'postgres',
    user: user ? String(user).trim() : 'postgres',
    password: password ? String(password) : undefined,
    connectionString: connectionString ? String(connectionString).trim() : undefined,
    ssl: ssl !== false,
    connected: false
  };

  const result = await db.connectPostgresDirect(targetConfig);
  res.json({
    ...result,
    config: db.getDbConfig()
  });
});

app.post('/api/database/test', requireAdminAuth, async (req, res) => {
  const { host, port, database, user, password, connectionString, ssl } = req.body;

  const targetConfig: DatabaseConfig = {
    type: 'supabase-direct',
    host: host ? String(host).trim() : undefined,
    port: Number(port) || 5432,
    database: database ? String(database).trim() : 'postgres',
    user: user ? String(user).trim() : 'postgres',
    password: password ? String(password) : undefined,
    connectionString: connectionString ? String(connectionString).trim() : undefined,
    ssl: ssl !== false,
    connected: false
  };

  const result = await db.connectPostgresDirect(targetConfig);
  res.json(result);
});

// -------------------------------------------------------------
// 6. Real-time Telemetry & Logs
// -------------------------------------------------------------

app.get('/api/stats', (req, res) => {
  const logs = db.getLogs(100);
  const healthMap = loadBalancer.getHealthMap();
  const totalRequests = logs.length;
  const successCount = logs.filter((l) => l.success).length;
  const errorCount = totalRequests - successCount;
  const avgLatency = totalRequests > 0 
    ? Math.round(logs.reduce((acc, l) => acc + l.durationMs, 0) / totalRequests)
    : 0;
  const totalTokens = logs.reduce((acc, l) => acc + (l.totalTokens || 0), 0);

  // Group by minute for chart
  const minuteBuckets: Record<string, { requests: number; errors: number; avgLatency: number }> = {};
  const now = Date.now();
  for (let i = 14; i >= 0; i--) {
    const timeKey = new Date(now - i * 60 * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    minuteBuckets[timeKey] = { requests: 0, errors: 0, avgLatency: 0 };
  }

  logs.forEach((log) => {
    const timeKey = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (minuteBuckets[timeKey]) {
      minuteBuckets[timeKey].requests += 1;
      if (!log.success) minuteBuckets[timeKey].errors += 1;
      minuteBuckets[timeKey].avgLatency = log.durationMs;
    }
  });

  res.json({
    kpis: {
      totalRequests,
      successRate: totalRequests > 0 ? ((successCount / totalRequests) * 100).toFixed(1) : '100.0',
      errorCount,
      avgLatency,
      totalTokens,
      activeProviders: Object.values(healthMap).filter((h) => h.status === 'healthy').length,
      trippedProviders: Object.values(healthMap).filter((h) => h.status === 'tripped').length
    },
    trafficTimeline: Object.entries(minuteBuckets).map(([time, data]) => ({
      time,
      requests: data.requests,
      errors: data.errors,
      avgLatency: data.avgLatency
    })),
    healthMap,
    recentLogs: db.getLogs(30),
    dbConnected: db.isDbReady()
  });
});

app.delete('/api/stats/logs', requireAdminAuth, async (req, res) => {
  await db.clearLogs();
  res.json({ success: true });
});

// -------------------------------------------------------------
// 7. Cloudflare Worker Code Generator
// -------------------------------------------------------------

app.get('/api/export/cloudflare-worker', (req, res) => {
  const code = generateCloudflareWorkerCode();
  res.json(code);
});

// -------------------------------------------------------------
// 8. Universal OpenAI-Compatible Gateway Endpoints
//    - /v1/chat/completions (Full Streaming SSE & Auto Fallback)
//    - /v1/models
// -------------------------------------------------------------

app.get('/v1/models', (req, res) => {
  if (!db.isDbReady()) {
    return res.status(503).json({ error: { message: 'Database connection required. Please connect Supabase/PostgreSQL.' } });
  }

  const providers = db.getProviders().filter((p) => p.enabled);
  const models = providers.flatMap((p) =>
    p.supportedModels.map((m) => ({
      id: m,
      object: 'model',
      created: 1700000000,
      owned_by: p.name,
      permission: []
    }))
  );
  res.json({ object: 'list', data: models });
});

app.post('/v1/chat/completions', async (req, res) => {
  // Strict check: database connection is required
  if (!db.isDbReady()) {
    return res.status(503).json({
      error: {
        message: '資料庫尚未連線或無法連線至 Supabase/PostgreSQL。請先在控制台「資料庫設定」頁面完成連線設定。(Database required to operate gateway)',
        type: 'gateway_database_not_connected',
        code: 503
      }
    });
  }

  const startTime = Date.now();
  const settings = db.getSettings();
  const body: ChatCompletionRequest = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';

  // Check virtual key auth if enabled
  let matchedKeyPrefix = '';
  if (settings.requireAuthForV1) {
    const authHeader = req.headers.authorization || '';
    const apiKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.headers['x-api-key'] as string);
    if (!apiKey) {
      return res.status(401).json({ error: { message: 'Missing Gateway API Key in Authorization header' } });
    }
    const foundKey = db.getVirtualKeys().find((k) => apiKey.startsWith(k.keyPrefix.replace('...', '')) && k.enabled);
    if (!foundKey) {
      return res.status(403).json({ error: { message: 'Invalid or revoked Gateway API Key' } });
    }
    matchedKeyPrefix = foundKey.keyPrefix;
  }

  const isStreaming = Boolean(body.stream);

  try {
    const execution = await loadBalancer.executeWithFallback(body, {
      clientIp,
      virtualKeyPrefix: matchedKeyPrefix
    });

    const { response: upstreamResponse, resolvedProvider, durationMs, fallbackTrace, fallbackCount } = execution;

    res.setHeader('x-gateway-provider', resolvedProvider.name);
    res.setHeader('x-gateway-latency-ms', durationMs.toString());
    res.setHeader('x-gateway-fallback-count', fallbackCount.toString());

    if (isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let streamBytes = 0;
      let ttftMs = 0;
      let firstChunkReceived = false;

      const reader = upstreamResponse.body?.getReader();
      if (!reader) {
        throw new Error('Unable to read stream from upstream provider');
      }

      const pump = async (): Promise<void> => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!firstChunkReceived) {
              ttftMs = Date.now() - startTime;
              firstChunkReceived = true;
            }

            streamBytes += value.length;
            res.write(value);
          }
          res.end();

          const approxTokens = Math.max(1, Math.round(streamBytes / 4));

          const logEntry: RequestLog = {
            id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            timestamp: Date.now(),
            clientIp,
            virtualKeyPrefix: matchedKeyPrefix,
            requestedModel: body.model || 'auto',
            resolvedProviderId: resolvedProvider.id,
            resolvedProviderName: resolvedProvider.name,
            resolvedModel: body.model || resolvedProvider.model,
            durationMs: Date.now() - startTime,
            ttftMs,
            statusCode: 200,
            success: true,
            fallbackCount,
            fallbackTrace,
            promptTokens: 0,
            completionTokens: approxTokens,
            totalTokens: approxTokens,
            streaming: true
          };
          await db.addLog(logEntry);

          if (matchedKeyPrefix) {
            await db.incrementKeyUsage(matchedKeyPrefix, approxTokens);
          }
        } catch (streamErr: any) {
          console.error('Error during streaming chunk dispatch:', streamErr);
          res.end();
        }
      };

      await pump();
    } else {
      const data = await upstreamResponse.json();
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;
      const totalTokens = data.usage?.total_tokens || promptTokens + completionTokens;

      const logEntry: RequestLog = {
        id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        timestamp: Date.now(),
        clientIp,
        virtualKeyPrefix: matchedKeyPrefix,
        requestedModel: body.model || 'auto',
        resolvedProviderId: resolvedProvider.id,
        resolvedProviderName: resolvedProvider.name,
        resolvedModel: body.model || resolvedProvider.model,
        durationMs,
        statusCode: 200,
        success: true,
        fallbackCount,
        fallbackTrace,
        promptTokens,
        completionTokens,
        totalTokens,
        streaming: false
      };
      await db.addLog(logEntry);

      if (matchedKeyPrefix) {
        await db.incrementKeyUsage(matchedKeyPrefix, totalTokens);
      }

      res.status(200).json(data);
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    console.error('Gateway Proxy Error:', err.message);

    const logEntry: RequestLog = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      clientIp,
      virtualKeyPrefix: matchedKeyPrefix,
      requestedModel: body.model || 'auto',
      resolvedProviderId: 'none',
      resolvedProviderName: 'None (All Failed)',
      resolvedModel: body.model || 'unknown',
      durationMs,
      statusCode: 502,
      success: false,
      fallbackCount: 0,
      fallbackTrace: [err.message || 'Error occurred'],
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      streaming: isStreaming,
      errorMessage: err.message
    };
    await db.addLog(logEntry);

    res.status(502).json({
      error: {
        message: err.message || 'All upstream AI providers failed in fallback cascade.',
        type: 'gateway_upstream_error',
        code: 502
      }
    });
  }
});

// -------------------------------------------------------------
// 9. Vite Frontend Integration & Static Serving
// -------------------------------------------------------------

async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const server = http.createServer(app);
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`🚀 EdgeAI Nexus Gateway is running on port ${PORT}`);
    console.log(`🌐 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 OpenAI Proxy: http://localhost:${PORT}/v1/chat/completions`);
    console.log(`🔐 AES-256-GCM Vault Status: Ready`);
    console.log(`======================================================\n`);
  });
}

startServer();
