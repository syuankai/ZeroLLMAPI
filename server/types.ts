export type LoadBalancingStrategy =
  | 'fallback-cascade' // Try primary, fallback to secondary on error/rate limit
  | 'least-latency'    // Send to fastest responding provider
  | 'weighted'         // Distribute according to configured weights
  | 'round-robin'      // Sequential rotation
  | 'random';          // Uniform random

export interface AIProvider {
  id: string;
  name: string;
  type: 'gemini' | 'groq' | 'openrouter' | 'mistral' | 'cerebras' | 'deepseek' | 'cloudflare' | 'huggingface' | 'github' | 'custom';
  baseUrl: string;
  encryptedApiKey: string; // Stored as aes256:iv:authTag:ciphertext
  apiKeyMasked?: string;   // e.g. "AIzaSy...4x0A"
  model: string;           // Default model ID
  supportedModels: string[];
  enabled: boolean;
  weight: number;          // 1 - 100 for weighted routing
  priority: number;        // 1 = highest, 2, 3... for fallback cascade
  maxTokens?: number;
  rateLimitRpm?: number;
  customHeaders?: Record<string, string>;
  createdAt: number;
  updatedAt: number;
}

export interface ProviderHealth {
  id: string;
  name: string;
  status: 'healthy' | 'degraded' | 'tripped' | 'disabled';
  lastPingMs: number;
  lastTestedAt: number;
  consecutiveFailures: number;
  trippedUntil: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rateLimitHits: number;
  averageLatencyMs: number;
  p95LatencyMs: number;
}

export interface VirtualApiKey {
  id: string;
  name: string;
  keyHash: string;
  keyPrefix: string;       // e.g. "gw-live-abc..."
  allowedModels: string[]; // ["*"] for all
  rateLimitRpm: number;
  totalUsageTokens: number;
  totalRequests: number;
  enabled: boolean;
  createdAt: number;
  lastUsedAt?: number;
}

export interface DatabaseConfig {
  type: 'sqlite-local' | 'postgres-rest' | 'mysql-rest' | 'cloudflare-d1';
  restEndpoint?: string;
  restApiKey?: string;
  tableNamePrefix?: string;
  connected: boolean;
  lastSyncedAt?: number;
}

export interface GatewaySettings {
  masterKeySet: boolean;
  loadBalancingStrategy: LoadBalancingStrategy;
  circuitBreakerThreshold: number; // e.g. 3 consecutive failures trips circuit
  circuitBreakerCooldownSec: number; // e.g. 30s
  maxRetriesPerRequest: number; // e.g. 2 fallbacks
  requestTimeoutMs: number; // e.g. 20000ms
  requireAuthForV1: boolean; // if true, /v1/* needs a Virtual API Key
  defaultModel: string;
}

export interface RequestLog {
  id: string;
  timestamp: number;
  clientIp?: string;
  virtualKeyPrefix?: string;
  requestedModel: string;
  resolvedProviderId: string;
  resolvedProviderName: string;
  resolvedModel: string;
  durationMs: number;
  ttftMs?: number;
  statusCode: number;
  success: boolean;
  fallbackCount: number;
  fallbackTrace: string[];
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  streaming: boolean;
  errorMessage?: string;
}

export interface AdminUser {
  username: string;
  passwordHash: string;
  salt: string;
  createdAt: number;
}
