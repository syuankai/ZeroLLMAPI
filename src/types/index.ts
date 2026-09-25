export type LoadBalancingStrategy =
  | 'fallback-cascade'
  | 'least-latency'
  | 'weighted'
  | 'round-robin'
  | 'random';

export interface AIProvider {
  id: string;
  name: string;
  type: 'gemini' | 'groq' | 'openrouter' | 'mistral' | 'cerebras' | 'deepseek' | 'cloudflare' | 'huggingface' | 'github' | 'ollama_cloud' | 'agnes' | 'custom';
  baseUrl: string;
  apiKeyMasked?: string;
  hasApiKey?: boolean;
  model: string;
  supportedModels: string[];
  enabled: boolean;
  weight: number;
  priority: number;
  maxTokens?: number;
  rateLimitRpm?: number;
  customHeaders?: Record<string, string>;
  authHeaderType?: 'Bearer' | 'x-api-key' | 'api-key' | 'custom';
  customAuthHeaderName?: string;
  requestBodyFormat?: 'openai-chat' | 'gemini-native' | 'claude-native';
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
  keyPrefix: string;
  allowedModels: string[];
  rateLimitRpm: number;
  totalUsageTokens: number;
  totalRequests: number;
  enabled: boolean;
  createdAt: number;
  lastUsedAt?: number;
}

export interface DatabaseConfig {
  type: 'supabase-direct' | 'postgres-direct' | 'postgres-rest' | 'mysql-rest';
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
  connectionString?: string;
  ssl?: boolean;
  restEndpoint?: string;
  restApiKeyMasked?: string;
  connected: boolean;
  lastSyncedAt?: number;
  error?: string;
}

export interface GatewaySettings {
  masterKeySet: boolean;
  loadBalancingStrategy: LoadBalancingStrategy;
  circuitBreakerThreshold: number;
  circuitBreakerCooldownSec: number;
  maxRetriesPerRequest: number;
  requestTimeoutMs: number;
  requireAuthForV1: boolean;
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

export interface TelemetryStats {
  kpis: {
    totalRequests: number;
    successRate: string;
    errorCount: number;
    avgLatency: number;
    totalTokens: number;
    activeProviders: number;
    trippedProviders: number;
  };
  trafficTimeline: Array<{
    time: string;
    requests: number;
    errors: number;
    avgLatency: number;
  }>;
  healthMap: Record<string, ProviderHealth>;
  recentLogs: RequestLog[];
}
