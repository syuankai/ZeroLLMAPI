import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  RotateCcw, 
  Sliders, 
  Bot, 
  User, 
  Zap, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Layers, 
  ChevronDown,
  Sparkles,
  Terminal,
  Activity
} from 'lucide-react';
import { AIProvider } from '../types';

interface ChatPlaygroundTabProps {
  providers: AIProvider[];
  masterKeySet: boolean;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  providerUsed?: string;
  modelUsed?: string;
  latencyMs?: number;
  ttftMs?: number;
  fallbackTrace?: string[];
  streaming?: boolean;
}

export const ChatPlaygroundTab: React.FC<ChatPlaygroundTabProps> = ({
  providers
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content: '👋 你好！我是 EdgeAI Nexus Gateway 的測試助理。你可以直接選擇「⚖️ 負載平衡網關」進行容錯測試，或切換至特定提供商單獨進行健康度檢測。',
      providerUsed: 'EdgeAI Gateway Engine'
    }
  ]);

  const [input, setInput] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<string>('gateway-auto'); // 'gateway-auto' or provider.id
  const [systemPrompt, setSystemPrompt] = useState('You are a helpful, precise AI assistant.');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [streamEnabled, setStreamEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Inspector details from last response
  const [lastTrace, setLastTrace] = useState<{
    providerName: string;
    model: string;
    totalMs: number;
    ttftMs?: number;
    fallbackTrace?: string[];
    status: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend?: string) => {
    const content = textToSend || input;
    if (!content.trim() || isSending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim()
    };

    const assistantMsgId = `asst-${Date.now()}`;
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      streaming: streamEnabled
    };

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg]);
    setInput('');
    setIsSending(true);

    const startTime = Date.now();
    let ttftRecorded = false;
    let ttftValue = 0;

    try {
      const messagesPayload = [
        ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
        ...messages.filter(m => m.id !== 'welcome-msg').map(m => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content: content.trim() }
      ];

      if (selectedTarget === 'gateway-auto') {
        // Send to Unified Load-Balanced Gateway Endpoint /v1/chat/completions
        const res = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: messagesPayload,
            temperature,
            max_tokens: maxTokens,
            stream: streamEnabled
          })
        });

        const providerHeader = res.headers.get('x-gateway-provider') || 'Unified Gateway';
        const latencyHeader = res.headers.get('x-gateway-latency-ms');

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `HTTP ${res.status}: Gateway request failed`);
        }

        if (streamEnabled && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder('utf-8');
          let accumulated = '';
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            if (!ttftRecorded) {
              ttftValue = Date.now() - startTime;
              ttftRecorded = true;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed.startsWith(':')) continue;
              if (trimmed === 'data: [DONE]') continue;

              if (trimmed.startsWith('data: ')) {
                try {
                  const json = JSON.parse(trimmed.slice(6));
                  const delta = json.choices?.[0]?.delta?.content || json.choices?.[0]?.text || '';
                  if (delta) {
                    accumulated += delta;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMsgId ? { ...m, content: accumulated } : m
                      )
                    );
                  }
                } catch {
                  // Fallback plain chunk
                  accumulated += trimmed.slice(6);
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsgId ? { ...m, content: accumulated } : m
                    )
                  );
                }
              }
            }
          }

          const totalMs = Date.now() - startTime;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    providerUsed: providerHeader,
                    latencyMs: totalMs,
                    ttftMs: ttftValue,
                    streaming: false
                  }
                : m
            )
          );

          setLastTrace({
            providerName: providerHeader,
            model: 'auto-load-balanced',
            totalMs,
            ttftMs: ttftValue,
            status: 200
          });
        } else {
          // Non-streaming
          const data = await res.json();
          const replyText = data.choices?.[0]?.message?.content || JSON.stringify(data);
          const totalMs = Date.now() - startTime;

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: replyText,
                    providerUsed: providerHeader,
                    latencyMs: totalMs,
                    streaming: false
                  }
                : m
            )
          );

          setLastTrace({
            providerName: providerHeader,
            model: data.model || 'auto',
            totalMs,
            status: 200
          });
        }
      } else {
        // Test a specific AI provider directly
        const targetProvider = providers.find((p) => p.id === selectedTarget);
        if (!targetProvider) throw new Error('Selected provider not found');

        const testRes = await fetch(`/api/providers/test/${targetProvider.id}`, {
          method: 'POST'
        });
        const result = await testRes.json();

        const totalMs = Date.now() - startTime;

        if (result.success) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: result.sampleReply || '連線測試成功 (Connection probe successful)!',
                    providerUsed: targetProvider.name,
                    latencyMs: result.latencyMs || totalMs,
                    streaming: false
                  }
                : m
            )
          );

          setLastTrace({
            providerName: targetProvider.name,
            model: targetProvider.model,
            totalMs: result.latencyMs || totalMs,
            status: 200
          });
        } else {
          throw new Error(result.errorMessage || 'Provider test failed');
        }
      }
    } catch (err: any) {
      const totalMs = Date.now() - startTime;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: `❌ 請求失敗: ${err.message}`,
                providerUsed: 'Error',
                latencyMs: totalMs,
                streaming: false
              }
            : m
        )
      );

      setLastTrace({
        providerName: 'Failed',
        model: 'unknown',
        totalMs,
        status: 500
      });
    } finally {
      setIsSending(false);
    }
  };

  const activeProviders = providers.filter((p) => p.enabled && p.hasApiKey);

  return (
    <div className="space-y-4">
      
      {/* Top Header & Target Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">測試聊天實驗室 (Playground)</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>即時流式 (SSE) 響應</span>
            <span aria-hidden="true">·</span>
            <span>首字延遲 (TTFT) 評測</span>
            <span aria-hidden="true">·</span>
            <span>串聯容錯轉移驗證</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Target Provider Dropdown */}
          <div className="relative">
            <select
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 text-cyan-300 text-xs font-semibold rounded-lg px-3 py-2 pr-8 appearance-none focus:outline-none focus:border-cyan-500 cursor-pointer shadow-sm"
            >
              <option value="gateway-auto">⚖️ 網關負載平衡 (自動容錯與路由)</option>
              <optgroup label="單一提供商直連測試">
                {providers.map((p) => (
                  <option key={p.id} value={p.id} disabled={!p.hasApiKey}>
                    {p.name} {!p.hasApiKey ? '(無金鑰)' : ''}
                  </option>
                ))}
              </optgroup>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-neutral-400 absolute right-2.5 top-3 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg border transition-colors ${
              showSettings ? 'bg-cyan-950 border-cyan-800 text-cyan-300' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:text-white'
            }`}
            title="調整參數 (Temperature, Max Tokens, System Prompt)"
          >
            <Sliders className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setMessages([]);
              setLastTrace(null);
            }}
            className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors border border-neutral-800"
            title="清空聊天記錄"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Optional Settings Drawer */}
      {showSettings && (
        <div className="bg-neutral-900/95 border border-neutral-800 p-4 rounded-xl space-y-3 text-xs">
          <div className="flex items-center justify-between font-semibold text-white border-b border-neutral-800 pb-2">
            <span>測試參數設定 (Inference Parameters)</span>
            <span className="text-[11px] font-mono text-cyan-400">即時生效</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-neutral-300 mb-1">
                Temperature (隨機度): <span className="font-mono text-cyan-300">{temperature}</span>
              </label>
              <input
                type="range"
                min="0"
                max="1.5"
                step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-neutral-300 mb-1">
                Max Tokens: <span className="font-mono text-cyan-300">{maxTokens}</span>
              </label>
              <input
                type="number"
                min="64"
                max="8192"
                step="128"
                value={maxTokens}
                onChange={(e) => setMaxTokens(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1 text-white font-mono"
              />
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 cursor-pointer pt-3">
                <input
                  type="checkbox"
                  checked={streamEnabled}
                  onChange={(e) => setStreamEnabled(e.target.checked)}
                  className="rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-0"
                />
                <span className="text-neutral-300 font-medium">啟用流式傳輸 (SSE Stream)</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-neutral-300 mb-1">System Prompt (系統提示詞)</label>
            <input
              type="text"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-700 rounded px-3 py-1.5 text-white"
            />
          </div>
        </div>
      )}

      {/* Main Chat Viewport + Side Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Left 3 Cols: Chat Message Feed */}
        <div className="lg:col-span-3 flex flex-col h-[520px] bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden">
          
          {/* Messages Scroll Area */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                      isUser
                        ? 'bg-neutral-700 text-white'
                        : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>

                  <div className={`max-w-[82%] ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div
                      className={`p-3.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-neutral-800 text-white rounded-tr-none'
                          : 'bg-neutral-950/80 border border-neutral-800 text-neutral-100 rounded-tl-none'
                      }`}
                    >
                      {msg.content || (msg.streaming ? '▍' : '')}
                    </div>

                    {/* Metadata Footer */}
                    {!isUser && msg.providerUsed && (
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-neutral-400 font-mono">
                        <span className="text-cyan-400 font-medium">{msg.providerUsed}</span>
                        {msg.latencyMs && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{msg.latencyMs}ms</span>
                          </>
                        )}
                        {msg.ttftMs && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="text-emerald-400 tabular-nums">TTFT {msg.ttftMs}ms</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="px-4 py-2 border-t border-neutral-800/80 bg-neutral-950/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
            <span className="text-[11px] text-neutral-500 shrink-0">範例提示:</span>
            <button
              onClick={() => handleSendMessage('請簡短自我介紹，並說出你使用的底層模型名稱。')}
              className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 whitespace-nowrap text-[11px] transition-colors"
            >
              自我介紹與模型確認
            </button>
            <button
              onClick={() => handleSendMessage('用 50 個字寫一首描繪邊緣計算網關的簡短詩。')}
              className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 whitespace-nowrap text-[11px] transition-colors"
            >
              測試創作與生成速度
            </button>
            <button
              onClick={() => handleSendMessage('請列出 3 個保護 API 金鑰安全的最佳實踐。')}
              className="px-2.5 py-1 rounded bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 whitespace-nowrap text-[11px] transition-colors"
            >
              安全最佳實踐
            </button>
          </div>

          {/* Input Box Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="p-3 border-t border-neutral-800 bg-neutral-950/80 flex items-center gap-2"
          >
            <input
              type="text"
              placeholder={
                activeProviders.length === 0
                  ? '請先至「AI 提供商」配置至少一個有效 API 金鑰...'
                  : '輸入測試訊息... (Enter 發送)'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isSending}
              className="flex-1 bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
            />

            <button
              type="submit"
              disabled={isSending || !input.trim()}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
              <span>{isSending ? '發送中' : '發送'}</span>
            </button>
          </form>

        </div>

        {/* Right 1 Col: Live Inspector Panel */}
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
              <Terminal className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold text-white">網關執行檢查儀 (Inspector)</h3>
            </div>

            {lastTrace ? (
              <div className="space-y-2.5 text-xs font-mono">
                <div>
                  <span className="text-neutral-500 block text-[10px]">響應提供商:</span>
                  <span className="text-cyan-300 font-semibold">{lastTrace.providerName}</span>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10px]">模型名稱:</span>
                  <span className="text-white truncate block">{lastTrace.model}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">總耗時 (Total)</span>
                    <span className="text-sm font-bold text-white tabular-nums">{lastTrace.totalMs}ms</span>
                  </div>

                  <div className="bg-neutral-950 p-2 rounded border border-neutral-800">
                    <span className="text-[10px] text-neutral-500 block">首字延遲 (TTFT)</span>
                    <span className="text-sm font-bold text-emerald-400 tabular-nums">
                      {lastTrace.ttftMs ? `${lastTrace.ttftMs}ms` : 'N/A'}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-neutral-500 block text-[10px]">狀態碼:</span>
                  <span className="text-emerald-400 font-bold">HTTP {lastTrace.status} OK</span>
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-neutral-500 text-xs">
                發送測試訊息後，此處將即時呈現提供商轉移鏈、TTFT 首字延遲及詳細路由決策。
              </div>
            )}
          </div>

          <div className="p-3 bg-neutral-950/70 border border-neutral-800/80 rounded-lg text-[11px] text-neutral-400 space-y-1">
            <span className="font-semibold text-neutral-300 block">💡 容錯測試小技巧:</span>
            <p>可刻意將首選提供商填寫無效金鑰，觀察網關是否自動在 50ms 內無縫轉移至備援提供商。</p>
          </div>
        </div>

      </div>

    </div>
  );
};
