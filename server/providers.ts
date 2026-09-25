import { AIProvider } from './types.js';
import { decryptSecret } from './crypto.js';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionRequest {
  model?: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  presence_penalty?: number;
  frequency_penalty?: number;
}

/**
 * Normalizes OpenAI-compatible Chat Payload for the targeted AI provider
 */
export async function forwardChatCompletion(
  provider: AIProvider,
  request: ChatCompletionRequest,
  signal?: AbortSignal
): Promise<Response> {
  const plainApiKey = decryptSecret(provider.encryptedApiKey);
  
  if (!plainApiKey && provider.type !== 'custom') {
    throw new Error(`API key for provider "${provider.name}" is missing or cannot be decrypted.`);
  }

  const effectiveModel = request.model && provider.supportedModels.includes(request.model) 
    ? request.model 
    : provider.model;

  // Clone and sanitize request body
  const bodyPayload: any = {
    model: effectiveModel,
    messages: request.messages,
    stream: !!request.stream,
    temperature: request.temperature ?? 0.7,
  };
  if (request.max_tokens) {
    bodyPayload.max_tokens = request.max_tokens;
  }

  let targetUrl = '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(provider.customHeaders || {})
  };

  switch (provider.type) {
    case 'gemini': {
      // Google Gemini supports OpenAI-compatible endpoint at /v1beta/openai/chat/completions
      // Or standard gemini models
      targetUrl = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'groq': {
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'openrouter': {
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      headers['HTTP-Referer'] = 'https://edgeai-nexus-gateway.dev';
      headers['X-Title'] = 'EdgeAI Nexus Gateway';
      break;
    }

    case 'mistral': {
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'cerebras': {
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'deepseek': {
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'huggingface': {
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/v1/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'github': {
      targetUrl = `https://models.inference.ai.azure.com/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'cloudflare': {
      // Cloudflare Workers AI OpenAI-compatible endpoint
      targetUrl = `${provider.baseUrl.replace(/\/$/, '')}/chat/completions`;
      headers['Authorization'] = `Bearer ${plainApiKey}`;
      break;
    }

    case 'custom':
    default: {
      const base = provider.baseUrl.replace(/\/$/, '');
      targetUrl = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
      if (plainApiKey) {
        headers['Authorization'] = `Bearer ${plainApiKey}`;
      }
      break;
    }
  }

  return await fetch(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyPayload),
    signal
  });
}

/**
 * Performs a quick probe / test ping on a provider
 */
export async function testProviderConnection(provider: AIProvider): Promise<{
  success: boolean;
  latencyMs: number;
  sampleReply?: string;
  statusCode?: number;
  errorMessage?: string;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const testReq: ChatCompletionRequest = {
      model: provider.model,
      messages: [
        { role: 'user', content: 'Say "Gateway OK" in exactly 3 words.' }
      ],
      max_tokens: 20,
      temperature: 0.1,
      stream: false
    };

    const res = await forwardChatCompletion(provider, testReq, controller.signal);
    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      let parsedMsg = errorText;
      try {
        const json = JSON.parse(errorText);
        parsedMsg = json.error?.message || json.message || errorText;
      } catch {}
      return {
        success: false,
        latencyMs,
        statusCode: res.status,
        errorMessage: `HTTP ${res.status}: ${parsedMsg.slice(0, 200)}`
      };
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || JSON.stringify(data).slice(0, 100);

    return {
      success: true,
      latencyMs,
      statusCode: res.status,
      sampleReply: reply
    };
  } catch (err: any) {
    return {
      success: false,
      latencyMs: Date.now() - start,
      errorMessage: err.name === 'AbortError' ? 'Connection timed out (>15s)' : (err.message || String(err))
    };
  }
}
