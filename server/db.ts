import fs from 'node:fs';
import path from 'node:path';
import { AIProvider, DatabaseConfig, GatewaySettings, ProviderHealth, RequestLog, VirtualApiKey, AdminUser } from './types.js';
import { encryptSecret, maskApiKey, hashPassword } from './crypto.js';

// Local storage path for fallback persistence
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'nexus_gateway_store.json');

interface DatabaseStore {
  admin: AdminUser;
  providers: AIProvider[];
  virtualKeys: VirtualApiKey[];
  settings: GatewaySettings;
  dbConfig: DatabaseConfig;
  requestLogs: RequestLog[];
}

// Initial default seed state
const initialAdminHash = hashPassword('admin123456');
const DEFAULT_STORE: DatabaseStore = {
  admin: {
    username: 'admin',
    passwordHash: initialAdminHash.hash,
    salt: initialAdminHash.salt,
    createdAt: Date.now()
  },
  settings: {
    masterKeySet: false,
    loadBalancingStrategy: 'fallback-cascade',
    circuitBreakerThreshold: 3,
    circuitBreakerCooldownSec: 30,
    maxRetriesPerRequest: 2,
    requestTimeoutMs: 25000,
    requireAuthForV1: false,
    defaultModel: 'gemini-2.5-flash'
  },
  dbConfig: {
    type: 'sqlite-local',
    connected: true,
    lastSyncedAt: Date.now()
  },
  providers: [
    {
      id: 'prov-gemini',
      name: 'Google Gemini (Official Free Tier)',
      type: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com',
      encryptedApiKey: process.env.GEMINI_API_KEY ? encryptSecret(process.env.GEMINI_API_KEY) : '',
      apiKeyMasked: process.env.GEMINI_API_KEY ? maskApiKey(process.env.GEMINI_API_KEY) : '',
      model: 'gemini-2.5-flash',
      supportedModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
      enabled: !!process.env.GEMINI_API_KEY,
      weight: 40,
      priority: 1,
      rateLimitRpm: 60,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'prov-groq',
      name: 'Groq (Ultra-Fast Free Tier)',
      type: 'groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      encryptedApiKey: '',
      apiKeyMasked: '',
      model: 'llama-3.3-70b-versatile',
      supportedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
      enabled: false,
      weight: 35,
      priority: 2,
      rateLimitRpm: 30,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'prov-openrouter',
      name: 'OpenRouter (Free Router Tier)',
      type: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      encryptedApiKey: '',
      apiKeyMasked: '',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      supportedModels: [
        'meta-llama/llama-3.3-70b-instruct:free',
        'deepseek/deepseek-r1:free',
        'google/gemini-2.0-flash-lite-preview:free',
        'mistralai/mistral-7b-instruct:free'
      ],
      enabled: false,
      weight: 25,
      priority: 3,
      rateLimitRpm: 20,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'prov-mistral',
      name: 'Mistral AI (La Plateforme Free Tier)',
      type: 'mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      encryptedApiKey: '',
      apiKeyMasked: '',
      model: 'mistral-small-latest',
      supportedModels: ['mistral-small-latest', 'codestral-latest', 'mistral-large-latest', 'open-mistral-nemo'],
      enabled: false,
      weight: 20,
      priority: 4,
      rateLimitRpm: 30,
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'prov-cerebras',
      name: 'Cerebras (Ultra-Fast Hardware Inference)',
      type: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      encryptedApiKey: '',
      apiKeyMasked: '',
      model: 'llama3.3-70b',
      supportedModels: ['llama3.3-70b', 'llama3.1-8b'],
      enabled: false,
      weight: 30,
      priority: 2,
      rateLimitRpm: 30,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ],
  virtualKeys: [
    {
      id: 'key-default-demo',
      name: 'Default Client Key',
      keyHash: 'sha256-demo-placeholder',
      keyPrefix: 'gw-live-demo...',
      allowedModels: ['*'],
      rateLimitRpm: 120,
      totalUsageTokens: 0,
      totalRequests: 0,
      enabled: true,
      createdAt: Date.now()
    }
  ],
  requestLogs: []
};

class DatabaseManager {
  private store: DatabaseStore;

  constructor() {
    this.store = this.loadLocalStore();
  }

  private loadLocalStore(): DatabaseStore {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        // If GEMINI_API_KEY is available from ENV and gemini provider has no key, inject it
        if (process.env.GEMINI_API_KEY) {
          const gemini = parsed.providers?.find((p: AIProvider) => p.type === 'gemini');
          if (gemini && !gemini.encryptedApiKey) {
            gemini.encryptedApiKey = encryptSecret(process.env.GEMINI_API_KEY);
            gemini.apiKeyMasked = maskApiKey(process.env.GEMINI_API_KEY);
            gemini.enabled = true;
          }
        }
        return {
          ...DEFAULT_STORE,
          ...parsed,
          settings: { ...DEFAULT_STORE.settings, ...(parsed.settings || {}) },
          dbConfig: { ...DEFAULT_STORE.dbConfig, ...(parsed.dbConfig || {}) }
        };
      }
    } catch (err) {
      console.warn('Could not load local database store, initializing default:', err);
    }
    this.saveLocalStore(DEFAULT_STORE);
    return DEFAULT_STORE;
  }

  private saveLocalStore(data: DatabaseStore) {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to save local store:', err);
    }
  }

  public getStore(): DatabaseStore {
    return this.store;
  }

  public save() {
    this.saveLocalStore(this.store);
    // If external REST DB is configured and connected, trigger async sync in background
    if (this.store.dbConfig.type !== 'sqlite-local' && this.store.dbConfig.restEndpoint) {
      this.syncToExternalRestDb().catch((e) => console.warn('Background REST DB sync warning:', e.message));
    }
  }

  // Admin User operations
  public getAdmin(): AdminUser {
    return this.store.admin;
  }

  public setAdmin(admin: AdminUser) {
    this.store.admin = admin;
    this.save();
  }

  // Providers operations
  public getProviders(): AIProvider[] {
    return this.store.providers;
  }

  public getProvider(id: string): AIProvider | undefined {
    return this.store.providers.find((p) => p.id === id);
  }

  public saveProvider(provider: AIProvider) {
    const idx = this.store.providers.findIndex((p) => p.id === provider.id);
    if (idx >= 0) {
      this.store.providers[idx] = { ...provider, updatedAt: Date.now() };
    } else {
      this.store.providers.push({ ...provider, createdAt: Date.now(), updatedAt: Date.now() });
    }
    this.save();
  }

  public deleteProvider(id: string) {
    this.store.providers = this.store.providers.filter((p) => p.id !== id);
    this.save();
  }

  // Virtual Keys
  public getVirtualKeys(): VirtualApiKey[] {
    return this.store.virtualKeys;
  }

  public addVirtualKey(key: VirtualApiKey) {
    this.store.virtualKeys.push(key);
    this.save();
  }

  public deleteVirtualKey(id: string) {
    this.store.virtualKeys = this.store.virtualKeys.filter((k) => k.id !== id);
    this.save();
  }

  public incrementKeyUsage(keyPrefix: string, tokens: number) {
    const key = this.store.virtualKeys.find((k) => k.keyPrefix === keyPrefix);
    if (key) {
      key.totalRequests += 1;
      key.totalUsageTokens += tokens;
      key.lastUsedAt = Date.now();
      this.save();
    }
  }

  // Settings
  public getSettings(): GatewaySettings {
    return this.store.settings;
  }

  public updateSettings(settings: Partial<GatewaySettings>) {
    this.store.settings = { ...this.store.settings, ...settings };
    this.save();
  }

  // Database Config
  public getDbConfig(): DatabaseConfig {
    return this.store.dbConfig;
  }

  public updateDbConfig(config: Partial<DatabaseConfig>) {
    this.store.dbConfig = { ...this.store.dbConfig, ...config };
    this.save();
  }

  // Request Logs (Keeps last 200 logs in memory/disk)
  public addLog(log: RequestLog) {
    this.store.requestLogs.unshift(log);
    if (this.store.requestLogs.length > 200) {
      this.store.requestLogs = this.store.requestLogs.slice(0, 200);
    }
    this.save();
  }

  public getLogs(limit = 50): RequestLog[] {
    return this.store.requestLogs.slice(0, limit);
  }

  public clearLogs() {
    this.store.requestLogs = [];
    this.save();
  }

  // External REST DB Sync & Connection Test (PostgreSQL / PostgREST / MySQL REST)
  public async testRestDbConnection(endpoint: string, apiKey?: string, dbType: string = 'postgres-rest'): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['apikey'] = apiKey; // Standard PostgREST header
      }

      // Check URL connectivity
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const resp = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;

      if (resp.status < 500) {
        return {
          success: true,
          message: `REST API Endpoint connected successfully (${resp.status} ${resp.statusText})`,
          latencyMs
        };
      } else {
        return {
          success: false,
          message: `Endpoint returned error HTTP ${resp.status}: ${resp.statusText}`,
          latencyMs
        };
      }
    } catch (err: any) {
      return {
        success: false,
        message: `Connection failed: ${err.message || String(err)}`,
        latencyMs: Date.now() - start
      };
    }
  }

  public async syncToExternalRestDb(): Promise<{ success: boolean; message: string }> {
    const { restEndpoint, restApiKey, type } = this.store.dbConfig;
    if (!restEndpoint) {
      return { success: false, message: 'No REST API endpoint configured' };
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates'
      };
      if (restApiKey) {
        headers['Authorization'] = `Bearer ${restApiKey}`;
        headers['apikey'] = restApiKey;
      }

      // Payload contains only encrypted API keys and gateway state
      const payload = {
        app_id: 'edgeai_nexus_gateway',
        synced_at: new Date().toISOString(),
        settings: this.store.settings,
        providers_encrypted: this.store.providers.map(p => ({
          id: p.id,
          name: p.name,
          type: p.type,
          baseUrl: p.baseUrl,
          encryptedApiKey: p.encryptedApiKey, // Guaranteed AES-256-GCM encrypted
          model: p.model,
          enabled: p.enabled,
          weight: p.weight,
          priority: p.priority,
          supportedModels: p.supportedModels
        })),
        virtual_keys: this.store.virtualKeys
      };

      const resp = await fetch(restEndpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      if (resp.ok || resp.status === 201 || resp.status === 200 || resp.status === 204) {
        this.store.dbConfig.connected = true;
        this.store.dbConfig.lastSyncedAt = Date.now();
        this.saveLocalStore(this.store);
        return { success: true, message: `Synced successfully to external ${type} at ${new Date().toLocaleTimeString()}` };
      } else {
        const text = await resp.text().catch(() => '');
        return { success: false, message: `Sync failed with status ${resp.status}: ${text.slice(0, 100)}` };
      }
    } catch (err: any) {
      return { success: false, message: `Sync error: ${err.message || String(err)}` };
    }
  }
}

export const db = new DatabaseManager();
