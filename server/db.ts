import { Pool } from 'pg';
import { AIProvider, DatabaseConfig, GatewaySettings, RequestLog, VirtualApiKey, AdminUser } from './types.js';
import { encryptSecret, maskApiKey, hashPassword } from './crypto.js';

interface DatabaseStore {
  admin: AdminUser;
  providers: AIProvider[];
  virtualKeys: VirtualApiKey[];
  settings: GatewaySettings;
  dbConfig: DatabaseConfig;
  requestLogs: RequestLog[];
}

const initialAdminHash = hashPassword('admin123456');

class DatabaseManager {
  private pool: Pool | null = null;
  private memoryCache: DatabaseStore;
  private isConnected: boolean = false;
  private connectionError: string | null = null;

  constructor() {
    this.memoryCache = {
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
        type: 'supabase-direct',
        host: process.env.SUPABASE_HOST || process.env.PGHOST || '',
        port: parseInt(process.env.SUPABASE_PORT || process.env.PGPORT || '5432', 10),
        database: process.env.SUPABASE_DATABASE || process.env.PGDATABASE || 'postgres',
        user: process.env.SUPABASE_USER || process.env.PGUSER || 'postgres',
        password: process.env.SUPABASE_PASSWORD || process.env.PGPASSWORD || '',
        connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '',
        ssl: true,
        connected: false
      },
      providers: [],
      virtualKeys: [],
      requestLogs: []
    };

    // Attempt auto-connection if ENV vars are provided
    this.autoConnectFromEnv();
  }

  private async autoConnectFromEnv() {
    const { host, port, database, user, password, connectionString } = this.memoryCache.dbConfig;
    if (connectionString || (host && user && password)) {
      console.log('[DB] Auto-connecting to PostgreSQL/Supabase database from environment variables...');
      await this.connectPostgresDirect({
        type: 'supabase-direct',
        host,
        port,
        database,
        user,
        password,
        connectionString,
        ssl: true,
        connected: false
      });
    }
  }

  public isDbReady(): boolean {
    return this.isConnected;
  }

  public getConnectionError(): string | null {
    return this.connectionError;
  }

  /**
   * Connects directly to Supabase / PostgreSQL using pg.Pool
   */
  public async connectPostgresDirect(config: DatabaseConfig): Promise<{ success: boolean; message: string; latencyMs: number }> {
    const start = Date.now();
    try {
      if (this.pool) {
        await this.pool.end().catch(() => {});
        this.pool = null;
      }

      let poolConfig: any;

      if (config.connectionString && config.connectionString.trim().startsWith('postgres')) {
        poolConfig = {
          connectionString: config.connectionString.trim(),
          ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000,
        };
      } else {
        if (!config.host || !config.user || !config.password) {
          throw new Error('Host, User, and Password are required for Supabase/PostgreSQL connection.');
        }

        poolConfig = {
          host: config.host.trim(),
          port: Number(config.port) || 5432,
          database: (config.database || 'postgres').trim(),
          user: config.user.trim(),
          password: config.password.trim(),
          ssl: config.ssl !== false ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 10000,
        };
      }

      const testPool = new Pool(poolConfig);
      const client = await testPool.connect();
      const latencyMs = Date.now() - start;

      // Initialize database schema tables if not exist
      await this.initSchema(client);
      client.release();

      this.pool = testPool;
      this.isConnected = true;
      this.connectionError = null;

      this.memoryCache.dbConfig = {
        ...config,
        connected: true,
        lastSyncedAt: Date.now(),
        error: undefined
      };

      // Load all records from DB into cache
      await this.loadFromDatabase();

      return {
        success: true,
        message: `Successfully connected to Supabase/PostgreSQL! Schema tables verified.`,
        latencyMs
      };
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message || String(err);
      this.memoryCache.dbConfig.connected = false;
      this.memoryCache.dbConfig.error = this.connectionError || undefined;

      return {
        success: false,
        message: `Connection failed: ${err.message}`,
        latencyMs: Date.now() - start
      };
    }
  }

  /**
   * Initializes PostgreSQL / Supabase database tables
   */
  private async initSchema(client: any) {
    await client.query(`
      CREATE TABLE IF NOT EXISTS nexus_gateway_settings (
        id VARCHAR(32) PRIMARY KEY,
        settings JSONB NOT NULL,
        admin JSONB NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nexus_providers (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(64) NOT NULL,
        base_url TEXT NOT NULL,
        encrypted_api_key TEXT NOT NULL,
        api_key_masked VARCHAR(64),
        model VARCHAR(128) NOT NULL,
        supported_models JSONB NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        weight INTEGER NOT NULL DEFAULT 50,
        priority INTEGER NOT NULL DEFAULT 1,
        max_tokens INTEGER,
        rate_limit_rpm INTEGER,
        custom_headers JSONB,
        auth_header_type VARCHAR(32),
        custom_auth_header_name VARCHAR(128),
        request_body_format VARCHAR(32),
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS nexus_virtual_keys (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        key_hash VARCHAR(128) NOT NULL,
        key_prefix VARCHAR(64) NOT NULL,
        allowed_models JSONB NOT NULL,
        rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
        total_usage_tokens BIGINT NOT NULL DEFAULT 0,
        total_requests BIGINT NOT NULL DEFAULT 0,
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at BIGINT NOT NULL,
        last_used_at BIGINT
      );

      CREATE TABLE IF NOT EXISTS nexus_request_logs (
        id VARCHAR(64) PRIMARY KEY,
        timestamp BIGINT NOT NULL,
        client_ip VARCHAR(64),
        virtual_key_prefix VARCHAR(64),
        requested_model VARCHAR(128) NOT NULL,
        resolved_provider_id VARCHAR(64) NOT NULL,
        resolved_provider_name VARCHAR(255) NOT NULL,
        resolved_model VARCHAR(128) NOT NULL,
        duration_ms INTEGER NOT NULL,
        ttft_ms INTEGER,
        status_code INTEGER NOT NULL,
        success BOOLEAN NOT NULL,
        fallback_count INTEGER NOT NULL DEFAULT 0,
        fallback_trace JSONB,
        prompt_tokens INTEGER NOT NULL DEFAULT 0,
        completion_tokens INTEGER NOT NULL DEFAULT 0,
        total_tokens INTEGER NOT NULL DEFAULT 0,
        streaming BOOLEAN NOT NULL DEFAULT false,
        error_message TEXT
      );
    `);
  }

  /**
   * Loads all active data from Supabase/PostgreSQL into memory
   */
  public async loadFromDatabase() {
    if (!this.pool || !this.isConnected) return;

    try {
      // 1. Load Settings & Admin
      const settingsRes = await this.pool.query(`SELECT settings, admin FROM nexus_gateway_settings WHERE id = 'main'`);
      if (settingsRes.rows.length > 0) {
        this.memoryCache.settings = { ...this.memoryCache.settings, ...settingsRes.rows[0].settings };
        this.memoryCache.admin = { ...this.memoryCache.admin, ...settingsRes.rows[0].admin };
      } else {
        // Insert default initial settings
        await this.pool.query(
          `INSERT INTO nexus_gateway_settings (id, settings, admin, updated_at) VALUES ($1, $2, $3, $4)`,
          ['main', JSON.stringify(this.memoryCache.settings), JSON.stringify(this.memoryCache.admin), Date.now()]
        );
      }

      // 2. Load Providers
      const provRes = await this.pool.query(`SELECT * FROM nexus_providers ORDER BY priority ASC, weight DESC`);
      this.memoryCache.providers = provRes.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        type: row.type,
        baseUrl: row.base_url,
        encryptedApiKey: row.encrypted_api_key,
        apiKeyMasked: row.api_key_masked,
        model: row.model,
        supportedModels: Array.isArray(row.supported_models) ? row.supported_models : JSON.parse(row.supported_models || '[]'),
        enabled: row.enabled,
        weight: row.weight,
        priority: row.priority,
        maxTokens: row.max_tokens,
        rateLimitRpm: row.rate_limit_rpm,
        customHeaders: typeof row.custom_headers === 'object' ? row.custom_headers : JSON.parse(row.custom_headers || '{}'),
        authHeaderType: row.auth_header_type,
        customAuthHeaderName: row.custom_auth_header_name,
        requestBodyFormat: row.request_body_format,
        createdAt: Number(row.created_at),
        updatedAt: Number(row.updated_at)
      }));

      // If GEMINI_API_KEY from env exists and no gemini provider exists, create default Gemini in DB
      if (process.env.GEMINI_API_KEY && !this.memoryCache.providers.some(p => p.type === 'gemini')) {
        const defaultGemini: AIProvider = {
          id: 'prov-gemini-default',
          name: 'Google Gemini 2.5 Flash',
          type: 'gemini',
          baseUrl: 'https://generativelanguage.googleapis.com',
          encryptedApiKey: encryptSecret(process.env.GEMINI_API_KEY),
          apiKeyMasked: maskApiKey(process.env.GEMINI_API_KEY),
          model: 'gemini-2.5-flash',
          supportedModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
          enabled: true,
          weight: 40,
          priority: 1,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        await this.saveProvider(defaultGemini);
      }

      // 3. Load Virtual Keys
      const keysRes = await this.pool.query(`SELECT * FROM nexus_virtual_keys ORDER BY created_at DESC`);
      this.memoryCache.virtualKeys = keysRes.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        keyHash: row.key_hash,
        keyPrefix: row.key_prefix,
        allowedModels: Array.isArray(row.allowed_models) ? row.allowed_models : JSON.parse(row.allowed_models || '[]'),
        rateLimitRpm: row.rate_limit_rpm,
        totalUsageTokens: Number(row.total_usage_tokens),
        totalRequests: Number(row.total_requests),
        enabled: row.enabled,
        createdAt: Number(row.created_at),
        lastUsedAt: row.last_used_at ? Number(row.last_used_at) : undefined
      }));

      // 4. Load Recent Logs (last 100)
      const logsRes = await this.pool.query(`SELECT * FROM nexus_request_logs ORDER BY timestamp DESC LIMIT 100`);
      this.memoryCache.requestLogs = logsRes.rows.map((row: any) => ({
        id: row.id,
        timestamp: Number(row.timestamp),
        clientIp: row.client_ip,
        virtualKeyPrefix: row.virtual_key_prefix,
        requestedModel: row.requested_model,
        resolvedProviderId: row.resolved_provider_id,
        resolvedProviderName: row.resolved_provider_name,
        resolvedModel: row.resolved_model,
        durationMs: row.duration_ms,
        ttftMs: row.ttft_ms,
        statusCode: row.status_code,
        success: row.success,
        fallbackCount: row.fallback_count,
        fallbackTrace: Array.isArray(row.fallback_trace) ? row.fallback_trace : JSON.parse(row.fallback_trace || '[]'),
        promptTokens: row.prompt_tokens,
        completionTokens: row.completion_tokens,
        totalTokens: row.total_tokens,
        streaming: row.streaming,
        errorMessage: row.error_message
      }));

      console.log(`[DB] Loaded ${this.memoryCache.providers.length} providers, ${this.memoryCache.virtualKeys.length} keys from Supabase/PostgreSQL.`);
    } catch (err: any) {
      console.error('[DB] Error loading from database:', err.message);
    }
  }

  // Admin User operations
  public getAdmin(): AdminUser {
    return this.memoryCache.admin;
  }

  public async setAdmin(admin: AdminUser) {
    this.memoryCache.admin = admin;
    if (this.pool && this.isConnected) {
      await this.pool.query(
        `UPDATE nexus_gateway_settings SET admin = $1, updated_at = $2 WHERE id = 'main'`,
        [JSON.stringify(admin), Date.now()]
      ).catch((e: any) => console.error('Error saving admin to DB:', e));
    }
  }

  // Providers operations
  public getProviders(): AIProvider[] {
    return this.memoryCache.providers;
  }

  public getProvider(id: string): AIProvider | undefined {
    return this.memoryCache.providers.find((p) => p.id === id);
  }

  public async saveProvider(provider: AIProvider) {
    const idx = this.memoryCache.providers.findIndex((p) => p.id === provider.id);
    if (idx >= 0) {
      this.memoryCache.providers[idx] = { ...provider, updatedAt: Date.now() };
    } else {
      this.memoryCache.providers.push({ ...provider, createdAt: Date.now(), updatedAt: Date.now() });
    }

    if (this.pool && this.isConnected) {
      const p = this.memoryCache.providers.find((item) => item.id === provider.id)!;
      await this.pool.query(`
        INSERT INTO nexus_providers (
          id, name, type, base_url, encrypted_api_key, api_key_masked,
          model, supported_models, enabled, weight, priority, max_tokens,
          rate_limit_rpm, custom_headers, auth_header_type, custom_auth_header_name,
          request_body_format, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          type = EXCLUDED.type,
          base_url = EXCLUDED.base_url,
          encrypted_api_key = EXCLUDED.encrypted_api_key,
          api_key_masked = EXCLUDED.api_key_masked,
          model = EXCLUDED.model,
          supported_models = EXCLUDED.supported_models,
          enabled = EXCLUDED.enabled,
          weight = EXCLUDED.weight,
          priority = EXCLUDED.priority,
          max_tokens = EXCLUDED.max_tokens,
          rate_limit_rpm = EXCLUDED.rate_limit_rpm,
          custom_headers = EXCLUDED.custom_headers,
          auth_header_type = EXCLUDED.auth_header_type,
          custom_auth_header_name = EXCLUDED.custom_auth_header_name,
          request_body_format = EXCLUDED.request_body_format,
          updated_at = EXCLUDED.updated_at
      `, [
        p.id,
        p.name,
        p.type,
        p.baseUrl,
        p.encryptedApiKey,
        p.apiKeyMasked || '',
        p.model,
        JSON.stringify(p.supportedModels),
        p.enabled,
        p.weight,
        p.priority,
        p.maxTokens || null,
        p.rateLimitRpm || null,
        JSON.stringify(p.customHeaders || {}),
        p.authHeaderType || null,
        p.customAuthHeaderName || null,
        p.requestBodyFormat || null,
        p.createdAt,
        p.updatedAt
      ]).catch((e: any) => console.error('Error persisting provider to DB:', e));
    }
  }

  public async deleteProvider(id: string) {
    this.memoryCache.providers = this.memoryCache.providers.filter((p) => p.id !== id);
    if (this.pool && this.isConnected) {
      await this.pool.query(`DELETE FROM nexus_providers WHERE id = $1`, [id]).catch((e: any) => console.error('Error deleting provider from DB:', e));
    }
  }

  // Virtual Keys
  public getVirtualKeys(): VirtualApiKey[] {
    return this.memoryCache.virtualKeys;
  }

  public async addVirtualKey(key: VirtualApiKey) {
    this.memoryCache.virtualKeys.push(key);
    if (this.pool && this.isConnected) {
      await this.pool.query(`
        INSERT INTO nexus_virtual_keys (
          id, name, key_hash, key_prefix, allowed_models, rate_limit_rpm,
          total_usage_tokens, total_requests, enabled, created_at, last_used_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        key.id,
        key.name,
        key.keyHash,
        key.keyPrefix,
        JSON.stringify(key.allowedModels),
        key.rateLimitRpm,
        key.totalUsageTokens,
        key.totalRequests,
        key.enabled,
        key.createdAt,
        key.lastUsedAt || null
      ]).catch((e: any) => console.error('Error inserting key to DB:', e));
    }
  }

  public async deleteVirtualKey(id: string) {
    this.memoryCache.virtualKeys = this.memoryCache.virtualKeys.filter((k) => k.id !== id);
    if (this.pool && this.isConnected) {
      await this.pool.query(`DELETE FROM nexus_virtual_keys WHERE id = $1`, [id]).catch((e: any) => console.error('Error deleting key from DB:', e));
    }
  }

  public async incrementKeyUsage(keyPrefix: string, tokens: number) {
    const key = this.memoryCache.virtualKeys.find((k) => k.keyPrefix === keyPrefix);
    if (key) {
      key.totalRequests += 1;
      key.totalUsageTokens += tokens;
      key.lastUsedAt = Date.now();

      if (this.pool && this.isConnected) {
        await this.pool.query(`
          UPDATE nexus_virtual_keys 
          SET total_requests = total_requests + 1, total_usage_tokens = total_usage_tokens + $1, last_used_at = $2
          WHERE key_prefix = $3
        `, [tokens, key.lastUsedAt, keyPrefix]).catch(() => {});
      }
    }
  }

  // Settings
  public getSettings(): GatewaySettings {
    return this.memoryCache.settings;
  }

  public async updateSettings(settings: Partial<GatewaySettings>) {
    this.memoryCache.settings = { ...this.memoryCache.settings, ...settings };
    if (this.pool && this.isConnected) {
      await this.pool.query(`
        UPDATE nexus_gateway_settings 
        SET settings = $1, updated_at = $2 
        WHERE id = 'main'
      `, [JSON.stringify(this.memoryCache.settings), Date.now()]).catch((e: any) => console.error('Error updating settings in DB:', e));
    }
  }

  // Database Config
  public getDbConfig(): DatabaseConfig {
    return {
      ...this.memoryCache.dbConfig,
      connected: this.isConnected,
      error: this.connectionError || undefined
    };
  }

  // Request Logs (Stored in memory and persisted into PostgreSQL)
  public async addLog(log: RequestLog) {
    this.memoryCache.requestLogs.unshift(log);
    if (this.memoryCache.requestLogs.length > 200) {
      this.memoryCache.requestLogs = this.memoryCache.requestLogs.slice(0, 200);
    }

    if (this.pool && this.isConnected) {
      await this.pool.query(`
        INSERT INTO nexus_request_logs (
          id, timestamp, client_ip, virtual_key_prefix, requested_model,
          resolved_provider_id, resolved_provider_name, resolved_model,
          duration_ms, ttft_ms, status_code, success, fallback_count,
          fallback_trace, prompt_tokens, completion_tokens, total_tokens,
          streaming, error_message
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      `, [
        log.id,
        log.timestamp,
        log.clientIp || null,
        log.virtualKeyPrefix || null,
        log.requestedModel,
        log.resolvedProviderId,
        log.resolvedProviderName,
        log.resolvedModel,
        log.durationMs,
        log.ttftMs || null,
        log.statusCode,
        log.success,
        log.fallbackCount,
        JSON.stringify(log.fallbackTrace || []),
        log.promptTokens,
        log.completionTokens,
        log.totalTokens,
        log.streaming,
        log.errorMessage || null
      ]).catch((e: any) => console.error('Error saving request log to DB:', e.message));
    }
  }

  public getLogs(limit = 50): RequestLog[] {
    return this.memoryCache.requestLogs.slice(0, limit);
  }

  public async clearLogs() {
    this.memoryCache.requestLogs = [];
    if (this.pool && this.isConnected) {
      await this.pool.query(`TRUNCATE TABLE nexus_request_logs`).catch(() => {});
    }
  }
}

export const db = new DatabaseManager();
