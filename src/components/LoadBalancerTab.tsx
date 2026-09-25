import React, { useState } from 'react';
import { 
  Scale, 
  Flame, 
  ShieldAlert, 
  Timer, 
  RotateCw, 
  Zap, 
  Check, 
  Sliders, 
  ArrowDownCircle, 
  Clock, 
  CheckCircle2
} from 'lucide-react';
import { GatewaySettings, LoadBalancingStrategy, AIProvider, ProviderHealth } from '../types';

interface LoadBalancerTabProps {
  settings: GatewaySettings;
  providers: AIProvider[];
  healthMap: Record<string, ProviderHealth>;
  onUpdateSettings: (newSettings: Partial<GatewaySettings>) => Promise<boolean>;
}

const STRATEGIES: Array<{
  id: LoadBalancingStrategy;
  title: string;
  tag: string;
  description: string;
  bestFor: string;
}> = [
  {
    id: 'fallback-cascade',
    title: '優先級故障轉移串聯 (Priority Fallback Cascade)',
    tag: '免費額度首選推薦',
    description: '依據優先級 (P1 > P2 > P3) 順序調用。若首選提供商遇到 429 限流、500 報錯或超時，立即毫秒級無縫轉移至下一個備援提供商。',
    bestFor: '組合多個免費 AI 提供商 (如 Gemini + Groq + OpenRouter) 實現 100% 零中斷高可用'
  },
  {
    id: 'least-latency',
    title: '最低延遲優先 (Lowest Latency First)',
    tag: '極速響應',
    description: '動態追蹤每個提供商的指數移動平均延遲 (EMA)，自動將流量導向當前響應最快的節點。',
    bestFor: '即時聊天與對延遲敏感的交互式應用'
  },
  {
    id: 'weighted',
    title: '加權負載分配 (Weighted Round-Robin)',
    tag: '流量按比分流',
    description: '根據每個提供商配置的權重比例 (例如 40% : 35% : 25%) 進行隨機抽樣分發，平攤各提供商的 RPM 限制。',
    bestFor: '擁有多個提供商並希望按配額比例消耗 token'
  },
  {
    id: 'round-robin',
    title: '循環輪詢 (Round Robin)',
    tag: '均勻分流',
    description: '依序將請求均勻輪流指派給所有啟用的提供商。',
    bestFor: '提供商規格與限額均等的多節點集群'
  },
  {
    id: 'random',
    title: '隨機分發 (Random Distribution)',
    tag: '均勻隨機',
    description: '隨機均勻挑選一個健康的提供商節點。',
    bestFor: '快速測試與開發環境'
  }
];

export const LoadBalancerTab: React.FC<LoadBalancerTabProps> = ({
  settings,
  providers,
  healthMap,
  onUpdateSettings
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<LoadBalancingStrategy>(settings.loadBalancingStrategy);
  const [circuitBreakerThreshold, setCircuitBreakerThreshold] = useState(settings.circuitBreakerThreshold || 3);
  const [circuitBreakerCooldownSec, setCircuitBreakerCooldownSec] = useState(settings.circuitBreakerCooldownSec || 30);
  const [maxRetriesPerRequest, setMaxRetriesPerRequest] = useState(settings.maxRetriesPerRequest || 2);
  const [requestTimeoutMs, setRequestTimeoutMs] = useState(settings.requestTimeoutMs || 25000);
  const [requireAuthForV1, setRequireAuthForV1] = useState(settings.requireAuthForV1 || false);
  const [defaultModel, setDefaultModel] = useState(settings.defaultModel || 'gemini-2.5-flash');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const success = await onUpdateSettings({
      loadBalancingStrategy: selectedStrategy,
      circuitBreakerThreshold,
      circuitBreakerCooldownSec,
      maxRetriesPerRequest,
      requestTimeoutMs,
      requireAuthForV1,
      defaultModel
    });
    setSaving(false);
    if (success) {
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    }
  };

  const activeProviders = providers.filter(p => p.enabled && p.hasApiKey);

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">負載平衡策略與錯誤處理機制</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>智慧路由算法</span>
            <span aria-hidden="true">·</span>
            <span>主動熔斷與自動重試</span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-400 font-mono">OpenAI 相容代理層</span>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-950" />
              <span>已成功儲存</span>
            </>
          ) : (
            <>
              <Sliders className="w-3.5 h-3.5" />
              <span>{saving ? '儲存中...' : '儲存策略配置'}</span>
            </>
          )}
        </button>
      </div>

      {/* Strategy Selection Grid */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">選擇負載平衡分發策略</h2>
          <p className="text-xs text-neutral-400">當外部客戶端請求發送至網關時，決定如何調度和故障備援</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STRATEGIES.map((s) => {
            const isSelected = selectedStrategy === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSelectedStrategy(s.id)}
                className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'border-cyan-500 bg-cyan-950/20 shadow-lg shadow-cyan-500/10'
                    : 'border-neutral-800 bg-neutral-950/60 hover:border-neutral-700'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-white">{s.title}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      isSelected ? 'bg-cyan-500/30 text-cyan-200' : 'bg-neutral-800 text-neutral-400'
                    }`}>
                      {s.tag}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-300 leading-relaxed">
                    {s.description}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-neutral-400">適用場景: {s.bestFor}</span>
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center border ${
                    isSelected ? 'border-cyan-400 bg-cyan-400 text-neutral-950' : 'border-neutral-700'
                  }`}>
                    {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Circuit Breaker & Resiliency Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Left: Circuit Breaker Rules */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white">熔斷保護機制 (Circuit Breaker)</h2>
          </div>
          <p className="text-xs text-neutral-400">
            當某個提供商頻繁遇到 429 限流或 5xx 故障時自動將其隔離，避免浪費客戶端等待時間。
          </p>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span>連續失敗熔斷閾值 (Failures before trip):</span>
                <span className="font-mono text-cyan-300">{circuitBreakerThreshold} 次</span>
              </div>
              <input
                type="range"
                min="1"
                max="10"
                value={circuitBreakerThreshold}
                onChange={(e) => setCircuitBreakerThreshold(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[11px] text-neutral-500">連續失敗達指定次數後，將暫停路由至該節點。</span>
            </div>

            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span>熔斷冷卻隔離時間 (Cooldown Period):</span>
                <span className="font-mono text-cyan-300">{circuitBreakerCooldownSec} 秒</span>
              </div>
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={circuitBreakerCooldownSec}
                onChange={(e) => setCircuitBreakerCooldownSec(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[11px] text-neutral-500">冷卻結束後自動發起探針請求進行健康恢復。</span>
            </div>

            <div>
              <div className="flex justify-between text-neutral-300 mb-1">
                <span>單次請求最大轉移重試次數 (Max Fallbacks):</span>
                <span className="font-mono text-cyan-300">{maxRetriesPerRequest} 次</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={maxRetriesPerRequest}
                onChange={(e) => setMaxRetriesPerRequest(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[11px] text-neutral-500">若首選節點失敗，最多允許依序轉移的備援節點數。</span>
            </div>
          </div>
        </div>

        {/* Right: Timeout & Security Settings */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">超時限制與網關安全模式</h2>
          </div>
          <p className="text-xs text-neutral-400">
            防禦連線超時與保護 /v1/* 介面避免未授權調用。
          </p>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">單次上游請求超時限制 (毫秒)</label>
              <input
                type="number"
                min="5000"
                max="120000"
                step="1000"
                value={requestTimeoutMs}
                onChange={(e) => setRequestTimeoutMs(Number(e.target.value))}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono"
              />
              <span className="text-[11px] text-neutral-500">超時後將立即觸發串聯轉移至下一個備援提供商。</span>
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">預設備援模型 (Default Fallback Model)</label>
              <input
                type="text"
                value={defaultModel}
                onChange={(e) => setDefaultModel(e.target.value)}
                placeholder="例如: gemini-2.5-flash"
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white font-mono"
              />
            </div>

            <div className="pt-2 border-t border-neutral-800">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={requireAuthForV1}
                  onChange={(e) => setRequireAuthForV1(e.target.checked)}
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-0"
                />
                <div>
                  <span className="text-white font-semibold block">強制啟用網關 API 金鑰驗證 (Require Gateway Key)</span>
                  <span className="text-neutral-400 text-[11px] block mt-0.5">
                    啟用後，客戶端在調用 <code className="text-cyan-300 font-mono">/v1/chat/completions</code> 時必須在 Header 攜帶有效的虛擬金鑰 (<code className="font-mono text-cyan-300">Authorization: Bearer gw-live-...</code>)。
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

      </div>

      {/* Fallback Hierarchy Preview */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl">
        <h2 className="text-sm font-semibold text-white mb-2">當前串聯轉移鏈預覽 (Cascade Chain Preview)</h2>
        <p className="text-xs text-neutral-400 mb-4">
          當策略為「優先級故障轉移串聯」時，系統將按以下次序進行階梯式請求：
        </p>

        {activeProviders.length === 0 ? (
          <div className="p-4 bg-neutral-950 rounded border border-neutral-800 text-xs text-amber-400">
            尚未有已啟用且具備金鑰的提供商。請先至「AI 提供商」標籤頁加入金鑰。
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {[...activeProviders]
              .sort((a, b) => a.priority - b.priority)
              .map((p, idx) => (
                <React.Fragment key={p.id}>
                  <div className="bg-neutral-950 border border-neutral-700 px-3 py-2 rounded-lg text-xs font-mono flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <div>
                      <span className="text-white font-semibold">{p.name}</span>
                      <span className="text-neutral-400 block text-[10px]">{p.model} (P{p.priority})</span>
                    </div>
                  </div>
                  {idx < activeProviders.length - 1 && (
                    <span className="text-neutral-500 font-bold text-sm">➔</span>
                  )}
                </React.Fragment>
              ))}
          </div>
        )}
      </div>

    </div>
  );
};
