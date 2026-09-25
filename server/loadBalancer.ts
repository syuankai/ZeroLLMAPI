import { AIProvider, ProviderHealth, RequestLog } from './types.js';
import { db } from './db.js';
import { forwardChatCompletion, ChatCompletionRequest } from './providers.js';

class LoadBalancerManager {
  private healthMap: Map<string, ProviderHealth> = new Map();
  private roundRobinIndex: number = 0;

  constructor() {
    this.initHealthMap();
  }

  private initHealthMap() {
    const providers = db.getProviders();
    for (const p of providers) {
      if (!this.healthMap.has(p.id)) {
        this.healthMap.set(p.id, {
          id: p.id,
          name: p.name,
          status: p.enabled ? 'healthy' : 'disabled',
          lastPingMs: 0,
          lastTestedAt: Date.now(),
          consecutiveFailures: 0,
          trippedUntil: 0,
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          rateLimitHits: 0,
          averageLatencyMs: 0,
          p95LatencyMs: 0
        });
      }
    }
  }

  public getHealthMap(): Record<string, ProviderHealth> {
    this.initHealthMap();
    const result: Record<string, ProviderHealth> = {};
    const now = Date.now();

    for (const [id, health] of this.healthMap.entries()) {
      const provider = db.getProvider(id);
      if (!provider || !provider.enabled) {
        health.status = 'disabled';
      } else if (health.trippedUntil > now) {
        health.status = 'tripped';
      } else if (health.consecutiveFailures > 0) {
        health.status = 'degraded';
      } else {
        health.status = 'healthy';
      }
      result[id] = { ...health };
    }
    return result;
  }

  public recordSuccess(providerId: string, latencyMs: number) {
    const health = this.healthMap.get(providerId);
    if (health) {
      health.consecutiveFailures = 0;
      health.trippedUntil = 0;
      health.totalRequests += 1;
      health.successfulRequests += 1;
      health.lastPingMs = latencyMs;
      health.lastTestedAt = Date.now();

      // Exponential moving average for latency
      if (health.averageLatencyMs === 0) {
        health.averageLatencyMs = latencyMs;
        health.p95LatencyMs = latencyMs;
      } else {
        health.averageLatencyMs = Math.round(health.averageLatencyMs * 0.8 + latencyMs * 0.2);
        health.p95LatencyMs = Math.round(Math.max(health.p95LatencyMs * 0.9, latencyMs));
      }
    }
  }

  public recordFailure(providerId: string, isRateLimit: boolean = false) {
    const settings = db.getSettings();
    const health = this.healthMap.get(providerId);
    if (health) {
      health.totalRequests += 1;
      health.failedRequests += 1;
      health.consecutiveFailures += 1;
      if (isRateLimit) {
        health.rateLimitHits += 1;
      }

      if (health.consecutiveFailures >= settings.circuitBreakerThreshold || isRateLimit) {
        // Trip circuit breaker
        const cooldownMs = (isRateLimit ? 45 : settings.circuitBreakerCooldownSec) * 1000;
        health.trippedUntil = Date.now() + cooldownMs;
        health.status = 'tripped';
      }
    }
  }

  /**
   * Sorts or filters providers based on the configured Load Balancing Strategy
   */
  public selectCandidateProviders(requestedModel?: string): AIProvider[] {
    const allProviders = db.getProviders().filter((p) => p.enabled && p.encryptedApiKey);
    if (allProviders.length === 0) {
      return [];
    }

    const settings = db.getSettings();
    const now = Date.now();

    // Separate healthy vs tripped
    const available = allProviders.filter((p) => {
      const health = this.healthMap.get(p.id);
      if (!health) return true;
      // If tripped until future, skip (unless in fallback emergency)
      return health.trippedUntil <= now;
    });

    const candidates = available.length > 0 ? available : allProviders;

    switch (settings.loadBalancingStrategy) {
      case 'fallback-cascade': {
        // Order by priority (1 is highest), then lowest average latency
        return [...candidates].sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          const hA = this.healthMap.get(a.id)?.averageLatencyMs || 999;
          const hB = this.healthMap.get(b.id)?.averageLatencyMs || 999;
          return hA - hB;
        });
      }

      case 'least-latency': {
        // Order strictly by lowest latency
        return [...candidates].sort((a, b) => {
          const hA = this.healthMap.get(a.id)?.averageLatencyMs || 999;
          const hB = this.healthMap.get(b.id)?.averageLatencyMs || 999;
          return hA - hB;
        });
      }

      case 'weighted': {
        // Weighted random shuffle
        const copy = [...candidates];
        return copy.sort(() => Math.random() - 0.5).sort((a, b) => (b.weight || 10) - (a.weight || 10));
      }

      case 'round-robin': {
        this.roundRobinIndex = (this.roundRobinIndex + 1) % candidates.length;
        const rotated = [
          ...candidates.slice(this.roundRobinIndex),
          ...candidates.slice(0, this.roundRobinIndex)
        ];
        return rotated;
      }

      case 'random':
      default: {
        return [...candidates].sort(() => Math.random() - 0.5);
      }
    }
  }

  /**
   * Execute chat completion with automated fallback & circuit breaker protection
   */
  public async executeWithFallback(
    request: ChatCompletionRequest,
    options: { clientIp?: string; virtualKeyPrefix?: string } = {}
  ): Promise<{
    response: Response;
    resolvedProvider: AIProvider;
    durationMs: number;
    fallbackTrace: string[];
    fallbackCount: number;
  }> {
    const candidates = this.selectCandidateProviders(request.model);
    if (candidates.length === 0) {
      throw new Error('No active AI providers available. Please configure API keys in AI Providers vault.');
    }

    const settings = db.getSettings();
    const maxRetries = Math.min(settings.maxRetriesPerRequest, candidates.length - 1);
    const fallbackTrace: string[] = [];
    let lastError: any = null;

    const overallStart = Date.now();

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const provider = candidates[attempt];
      if (!provider) break;

      fallbackTrace.push(`${provider.name} (${provider.type})`);
      const attemptStart = Date.now();

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), settings.requestTimeoutMs);

        const response = await forwardChatCompletion(provider, request, controller.signal);
        clearTimeout(timeoutId);
        const attemptDuration = Date.now() - attemptStart;

        if (response.ok) {
          // Success!
          this.recordSuccess(provider.id, attemptDuration);
          const totalDuration = Date.now() - overallStart;
          return {
            response,
            resolvedProvider: provider,
            durationMs: totalDuration,
            fallbackTrace,
            fallbackCount: attempt
          };
        } else {
          // Upstream returned HTTP error (e.g. 429 Rate Limit, 500, 503)
          const isRateLimit = response.status === 429;
          this.recordFailure(provider.id, isRateLimit);
          const errBody = await response.clone().text().catch(() => '');
          fallbackTrace[fallbackTrace.length - 1] += ` [Failed: HTTP ${response.status}]`;
          lastError = new Error(`Provider ${provider.name} failed (HTTP ${response.status}): ${errBody.slice(0, 150)}`);
          
          // Continue to next provider in cascade
          console.warn(`[Gateway LB] ${provider.name} failed with ${response.status}. Cascading to fallback provider...`);
        }
      } catch (err: any) {
        const attemptDuration = Date.now() - attemptStart;
        this.recordFailure(provider.id, false);
        const isTimeout = err.name === 'AbortError';
        fallbackTrace[fallbackTrace.length - 1] += ` [${isTimeout ? 'Timeout >' + settings.requestTimeoutMs + 'ms' : err.message}]`;
        lastError = err;
        console.warn(`[Gateway LB] Error calling ${provider.name}: ${err.message}. Cascading...`);
      }
    }

    throw lastError || new Error('All AI providers in fallback chain failed.');
  }
}

export const loadBalancer = new LoadBalancerManager();
