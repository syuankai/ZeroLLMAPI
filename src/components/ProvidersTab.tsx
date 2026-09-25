import React, { useState } from 'react';
import { 
  Plus, 
  Key, 
  Lock, 
  Trash2, 
  Edit, 
  Play, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ExternalLink,
  Sparkles,
  Shield,
  Zap,
  Layers,
  Sliders,
  AlertTriangle,
  Server,
  Cloud,
  Cpu,
  Boxes
} from 'lucide-react';
import { AIProvider } from '../types';

interface ProvidersTabProps {
  providers: AIProvider[];
  onSaveProvider: (providerData: any) => Promise<boolean>;
  onDeleteProvider: (id: string) => Promise<boolean>;
  onTestProvider: (id: string) => Promise<{ success: boolean; latencyMs: number; sampleReply?: string; errorMessage?: string }>;
  masterKeySet: boolean;
  dbConnected: boolean;
}

// Preset Free Tier Providers Catalogue including requested new providers
const FREE_TIER_PRESETS = [
  {
    name: 'Google Gemini 2.5 Flash',
    type: 'gemini' as const,
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-flash',
    supportedModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    freeTierInfo: '慷慨免費額度 (15 RPM / 100 萬 TPM)，支援多模態與極高吞吐',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    priority: 1,
    weight: 40,
    authHeaderType: 'Bearer' as const,
    badge: '官方免費首選',
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800'
  },
  {
    name: 'Ollama Cloud API',
    type: 'ollama_cloud' as const,
    baseUrl: 'https://ollama.com/v1',
    model: 'llama3.3',
    supportedModels: ['llama3.3', 'qwen2.5-coder:32b', 'deepseek-r1:70b', 'mistral-nemo'],
    freeTierInfo: 'Ollama 官方雲端 API，免本地顯卡運行頂級開源模型 (Llama 3.3, DeepSeek R1)',
    getKeyUrl: 'https://ollama.com/',
    priority: 1,
    weight: 35,
    authHeaderType: 'Bearer' as const,
    badge: '新支援 · 雲端開源',
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
  },
  {
    name: 'Hugging Face Model Router',
    type: 'huggingface' as const,
    baseUrl: 'https://router.huggingface.co/v1',
    model: 'meta-llama/Llama-3.3-70B-Instruct',
    supportedModels: [
      'meta-llama/Llama-3.3-70B-Instruct',
      'deepseek-ai/DeepSeek-R1',
      'Qwen/Qwen2.5-72B-Instruct',
      'mistralai/Mistral-7B-Instruct-v0.3'
    ],
    freeTierInfo: 'Hugging Face 官方 Serverless 路由端點 (https://router.huggingface.co/v1)，免費 Token 即可調用',
    getKeyUrl: 'https://huggingface.co/settings/tokens',
    priority: 2,
    weight: 30,
    authHeaderType: 'Bearer' as const,
    badge: '新支援 · 免費開源',
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800'
  },
  {
    name: 'AgnesAI APIHub',
    type: 'agnes' as const,
    baseUrl: 'https://apihub.agnes-ai.com/v1',
    model: 'agnes-chat',
    supportedModels: ['agnes-chat', 'agnes-pro', 'gpt-4o-mini', 'claude-3-5-sonnet'],
    freeTierInfo: 'AgnesAI APIHub 聚合網關 (https://apihub.agnes-ai.com/v1)，提供多款頂尖模型免費與優惠調用',
    getKeyUrl: 'https://apihub.agnes-ai.com/',
    priority: 2,
    weight: 30,
    authHeaderType: 'Bearer' as const,
    badge: '新支援 · 聚合網關',
    badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800'
  },
  {
    name: 'Cloudflare Workers AI',
    type: 'cloudflare' as const,
    baseUrl: 'https://api.cloudflare.com/client/v4/accounts/ai/v1',
    model: '@cf/meta/llama-3.3-70b-instruct',
    supportedModels: [
      '@cf/meta/llama-3.3-70b-instruct',
      '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
      '@cf/qwen/qwen2.5-72b-instruct'
    ],
    freeTierInfo: '直接繫結 CF 邊緣原生 AI 函數 (不需驗證金鑰即可直通調用，每日 10k 神經元免費額度)',
    getKeyUrl: 'https://dash.cloudflare.com/',
    priority: 3,
    weight: 25,
    authHeaderType: 'Bearer' as const,
    badge: '邊緣原生 · 免金鑰',
    badgeColor: 'text-orange-400 bg-orange-950/60 border-orange-800',
    warningNotice: '⚠️ 提示：使用 Cloudflare Workers AI 免費每日配額可能造成同 Cloudflare 帳號下其它使用該服務的程式無餘額可使用。'
  },
  {
    name: 'Groq (Llama 3.3 70B)',
    type: 'groq' as const,
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    supportedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    freeTierInfo: 'LPU 極速硬體推理，提供每日免費請求配額 (30 RPM)',
    getKeyUrl: 'https://console.groq.com/keys',
    priority: 2,
    weight: 35,
    authHeaderType: 'Bearer' as const,
    badge: '極速推理',
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800'
  },
  {
    name: 'OpenRouter Free Models',
    type: 'openrouter' as const,
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    supportedModels: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'deepseek/deepseek-r1:free',
      'google/gemini-2.0-flash-lite-preview:free'
    ],
    freeTierInfo: '免費路由多個頂尖開源模型 (DeepSeek R1, Llama 3.3, Gemini Lite)',
    getKeyUrl: 'https://openrouter.ai/keys',
    priority: 3,
    weight: 25,
    authHeaderType: 'Bearer' as const,
    badge: '模型路由',
    badgeColor: 'text-blue-400 bg-blue-950/60 border-blue-800'
  },
  {
    name: 'Mistral AI (La Plateforme)',
    type: 'mistral' as const,
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    supportedModels: ['mistral-small-latest', 'codestral-latest', 'open-mistral-nemo'],
    freeTierInfo: '歐洲頂尖代碼與語言推理模型，提供免費測試額度',
    getKeyUrl: 'https://console.mistral.ai/api-keys/',
    priority: 4,
    weight: 20,
    authHeaderType: 'Bearer' as const,
    badge: '歐洲頂尖',
    badgeColor: 'text-amber-400 bg-amber-950/60 border-amber-800'
  },
  {
    name: 'Cerebras Ultra-Fast',
    type: 'cerebras' as const,
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.3-70b',
    supportedModels: ['llama3.3-70b', 'llama3.1-8b'],
    freeTierInfo: '世界級晶圓級晶片硬體推理 (高達 1800 tok/s)',
    getKeyUrl: 'https://cloud.cerebras.ai/',
    priority: 2,
    weight: 30,
    authHeaderType: 'Bearer' as const,
    badge: '硬體極速',
    badgeColor: 'text-emerald-400 bg-emerald-950/60 border-emerald-800'
  },
  {
    name: 'DeepSeek 官方 API',
    type: 'deepseek' as const,
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    supportedModels: ['deepseek-chat', 'deepseek-reasoner'],
    freeTierInfo: 'DeepSeek-V3 與 DeepSeek-R1 旗艦推理 API',
    getKeyUrl: 'https://platform.deepseek.com/api_keys',
    priority: 2,
    weight: 35,
    authHeaderType: 'Bearer' as const,
    badge: '旗艦推理',
    badgeColor: 'text-cyan-400 bg-cyan-950/60 border-cyan-800'
  },
  {
    name: 'GitHub Models (Azure)',
    type: 'github' as const,
    baseUrl: 'https://models.inference.ai.azure.com',
    model: 'gpt-4o-mini',
    supportedModels: ['gpt-4o-mini', 'Meta-Llama-3.1-70B-Instruct', 'Mistral-large-2407'],
    freeTierInfo: 'GitHub 個人開發者免費測試 Playground 與 API',
    getKeyUrl: 'https://github.com/marketplace/models',
    priority: 3,
    weight: 25,
    authHeaderType: 'Bearer' as const,
    badge: '微軟免費',
    badgeColor: 'text-purple-400 bg-purple-950/60 border-purple-800'
  },
  {
    name: 'Ollama / 本地自建端點 (Local)',
    type: 'custom' as const,
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3:latest',
    supportedModels: ['llama3:latest', 'qwen2.5:latest', 'mistral:latest'],
    freeTierInfo: '本地完全免費開源運行，零 API 費用與隱私自託管',
    getKeyUrl: 'https://ollama.com/',
    priority: 5,
    weight: 20,
    authHeaderType: 'Bearer' as const,
    badge: '本機自託管',
    badgeColor: 'text-neutral-400 bg-neutral-900 border-neutral-700'
  }
];

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onSaveProvider,
  onDeleteProvider,
  onTestProvider,
  masterKeySet,
  dbConnected
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'custom' as AIProvider['type'],
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
    supportedModels: 'gpt-4o-mini, gpt-3.5-turbo',
    enabled: true,
    weight: 50,
    priority: 1,
    authHeaderType: 'Bearer' as 'Bearer' | 'x-api-key' | 'api-key' | 'custom',
    customAuthHeaderName: '',
    customHeadersJson: ''
  });

  const [testResults, setTestResults] = useState<Record<string, { loading?: boolean; success?: boolean; latencyMs?: number; sampleReply?: string; errorMessage?: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = (preset?: typeof FREE_TIER_PRESETS[0]) => {
    setEditingProvider(null);
    if (preset) {
      setFormData({
        name: preset.name,
        type: preset.type as any,
        baseUrl: preset.baseUrl,
        apiKey: '',
        model: preset.model,
        supportedModels: preset.supportedModels.join(', '),
        enabled: true,
        weight: preset.weight,
        priority: preset.priority,
        authHeaderType: preset.authHeaderType || 'Bearer',
        customAuthHeaderName: '',
        customHeadersJson: ''
      });
    } else {
      setFormData({
        name: '自訂 AI 提供商 (Custom)',
        type: 'custom',
        baseUrl: 'https://api.together.xyz/v1',
        apiKey: '',
        model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        supportedModels: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
        enabled: true,
        weight: 50,
        priority: 1,
        authHeaderType: 'Bearer',
        customAuthHeaderName: '',
        customHeadersJson: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: AIProvider) => {
    setEditingProvider(p);
    setFormData({
      name: p.name,
      type: p.type,
      baseUrl: p.baseUrl,
      apiKey: p.apiKeyMasked || '',
      model: p.model,
      supportedModels: p.supportedModels.join(', '),
      enabled: p.enabled,
      weight: p.weight,
      priority: p.priority,
      authHeaderType: p.authHeaderType || 'Bearer',
      customAuthHeaderName: p.customAuthHeaderName || '',
      customHeadersJson: p.customHeaders && Object.keys(p.customHeaders).length > 0 ? JSON.stringify(p.customHeaders, null, 2) : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const modelsArr = formData.supportedModels.split(',').map((s) => s.trim()).filter(Boolean);

    let parsedCustomHeaders = {};
    if (formData.customHeadersJson.trim()) {
      try {
        parsedCustomHeaders = JSON.parse(formData.customHeadersJson.trim());
      } catch {
        alert('自訂 Headers JSON 格式不正確，請檢查格式。');
        setSubmitting(false);
        return;
      }
    }

    const success = await onSaveProvider({
      id: editingProvider?.id,
      name: formData.name,
      type: formData.type,
      baseUrl: formData.baseUrl,
      apiKey: formData.apiKey,
      model: formData.model || modelsArr[0] || 'default',
      supportedModels: modelsArr.length > 0 ? modelsArr : [formData.model || 'default'],
      enabled: formData.enabled,
      weight: Number(formData.weight),
      priority: Number(formData.priority),
      authHeaderType: formData.authHeaderType,
      customAuthHeaderName: formData.customAuthHeaderName,
      customHeaders: parsedCustomHeaders
    });
    setSubmitting(false);
    if (success) {
      setIsModalOpen(false);
    }
  };

  const handleTest = async (id: string) => {
    setTestResults((prev) => ({ ...prev, [id]: { loading: true } }));
    const res = await onTestProvider(id);
    setTestResults((prev) => ({ ...prev, [id]: { ...res, loading: false } }));
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>AI 提供商與金鑰庫管理</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-normal">
              12+ 內建提供商
            </span>
          </h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span className="flex items-center gap-1 text-cyan-400 font-mono">
              <Shield className="w-3.5 h-3.5" /> AES-256-GCM 軍規加密
            </span>
            <span aria-hidden="true">·</span>
            <span>支援 Ollama Cloud, HuggingFace Router, AgnesAI, CF Workers AI</span>
            <span aria-hidden="true">·</span>
            <span className={dbConnected ? 'text-emerald-400 font-medium' : 'text-red-400 font-medium'}>
              {dbConnected ? 'Supabase 持久化已連線' : '資料庫未連線'}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-neutral-950 bg-gradient-to-r from-cyan-400 to-blue-400 hover:from-cyan-300 hover:to-blue-300 rounded-lg transition-all shadow-md shadow-cyan-500/20 hover:scale-[1.02] active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>新增自定義提供商 (Custom)</span>
        </button>
      </div>

      {/* Cloudflare Workers AI Quota Alert Banner */}
      <div className="p-3.5 bg-amber-950/40 border border-amber-800/70 rounded-xl flex items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5 leading-relaxed">
          <span className="font-semibold text-amber-300 block">Cloudflare Workers AI 配額提示：</span>
          <p className="text-neutral-300 text-[11px]">
            Cloudflare Workers AI 支援在邊緣直接繫結 <code className="text-amber-300 font-mono">env.AI</code> 函數進行免 API Key 調用。請注意使用其免費每日配額（10,000 Neurons/日）時，<strong>可能消耗同 Cloudflare 帳號下其他依賴該服務的應用程式之額度</strong>。
          </p>
        </div>
      </div>

      {/* Free Tier 1-Click Quick Add Carousel */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-3.5 h-3.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">免費提供商與自定義範本庫 (Preset Catalogue)</h2>
              <p className="text-xs text-neutral-400">點擊一鍵填入端點設定，串聯多個提供商組成零中斷網關</p>
            </div>
          </div>
          <span className="text-xs font-mono text-neutral-500">12 組熱門預設</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {FREE_TIER_PRESETS.map((preset, idx) => {
            const isConfigured = providers.some((p) => p.type === preset.type);
            return (
              <div 
                key={idx}
                className="bg-neutral-950/80 border border-neutral-800/90 hover:border-neutral-700/90 p-3.5 rounded-xl flex flex-col justify-between transition-all duration-200 hover:shadow-md hover:shadow-cyan-500/5 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-1.5 mb-1.5">
                    <span className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                      {preset.name}
                    </span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${preset.badgeColor}`}>
                      {preset.badge}
                    </span>
                  </div>

                  <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2 mt-1">
                    {preset.freeTierInfo}
                  </p>

                  <div className="mt-2 text-[10px] font-mono text-neutral-500 truncate bg-neutral-900/60 p-1.5 rounded border border-neutral-800/60">
                    {preset.baseUrl}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between">
                  <a
                    href={preset.getKeyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5 font-medium"
                  >
                    <span>獲取金鑰</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>

                  <button
                    onClick={() => handleOpenAdd(preset)}
                    className={`px-2.5 py-1 text-[11px] rounded-lg font-medium transition-all ${
                      isConfigured
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 hover:scale-105 active:scale-95'
                    }`}
                  >
                    {isConfigured ? '再次配置' : '+ 一鍵配置'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Configured Providers Table */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <div>
              <h2 className="text-sm font-semibold text-white">已配置的提供商金鑰清單</h2>
              <p className="text-xs text-neutral-400">所有 API 金鑰在儲存至 Supabase 前均通過 AES-256-GCM 端到端加密</p>
            </div>
          </div>
          <span className="text-xs font-mono text-neutral-400 bg-neutral-950 px-2.5 py-1 rounded-lg border border-neutral-800">
            共 {providers.length} 個提供商 ({providers.filter(p => p.enabled && (p.hasApiKey || p.type === 'cloudflare')).length} 個已就緒)
          </span>
        </div>

        {providers.length === 0 ? (
          <div className="p-12 text-center text-neutral-500 text-xs space-y-2">
            <Boxes className="w-8 h-8 text-neutral-600 mx-auto stroke-1" />
            <p>目前尚未配置任何 AI 提供商。</p>
            <p className="text-neutral-400">請從上方快速加入免費提供商（如 Ollama Cloud, Gemini, HuggingFace）或點擊「新增自定義提供商」。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/80 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-3 px-4">提供商名稱與端點</th>
                  <th className="py-3 px-3">類型</th>
                  <th className="py-3 px-3">預設模型</th>
                  <th className="py-3 px-3">API 金鑰狀態 (AES)</th>
                  <th className="py-3 px-3 text-center">優先級 (Cascade)</th>
                  <th className="py-3 px-3 text-center">權重</th>
                  <th className="py-3 px-3 text-center">狀態</th>
                  <th className="py-3 px-4 text-right">操作與即時測試</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {providers.map((p) => {
                  const test = testResults[p.id];
                  const hasValidKey = p.hasApiKey || p.type === 'cloudflare';
                  return (
                    <tr key={p.id} className="hover:bg-neutral-800/40 transition-colors group">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">{p.name}</div>
                        <div className="text-[11px] font-mono text-neutral-400 truncate max-w-[220px]">
                          {p.baseUrl}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 uppercase font-mono text-[11px] text-cyan-400 font-semibold">
                        {p.type}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-neutral-300">
                        {p.model}
                      </td>
                      <td className="py-3.5 px-3">
                        {p.type === 'cloudflare' && !p.hasApiKey ? (
                          <div className="flex items-center gap-1 text-cyan-400 font-mono text-[11px]">
                            <Cloud className="w-3 h-3 text-cyan-400" />
                            <span>免金鑰 (Worker AI 直通)</span>
                          </div>
                        ) : p.hasApiKey ? (
                          <div className="flex items-center gap-1 text-emerald-400 font-mono text-[11px]">
                            <Lock className="w-3 h-3 text-emerald-400" />
                            <span>{p.apiKeyMasked || '已加密保存'}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-400 text-[11px]">
                            <AlertCircle className="w-3 h-3" />
                            <span>未設定金鑰</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono font-bold text-white">
                        <span className="px-2 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-cyan-300">
                          P{p.priority}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono text-neutral-300">
                        {p.weight}%
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => onSaveProvider({ ...p, enabled: !p.enabled })}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                            p.enabled
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900'
                              : 'bg-neutral-800 text-neutral-500 hover:text-neutral-300'
                          }`}
                        >
                          {p.enabled ? '啟用中' : '已停用'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleTest(p.id)}
                            disabled={test?.loading || !hasValidKey}
                            title="發送真實請求檢測響應時間"
                            className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-neutral-700 rounded-lg flex items-center gap-1 disabled:opacity-40 transition-colors shadow-sm"
                          >
                            <Play className={`w-3 h-3 ${test?.loading ? 'animate-spin' : ''}`} />
                            <span>{test?.loading ? '測試中...' : '連線測試'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="編輯提供商"
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors border border-transparent hover:border-neutral-700"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={() => {
                              if (confirm(`確定要刪除「${p.name}」嗎？`)) {
                                onDeleteProvider(p.id);
                              }
                            }}
                            title="刪除提供商"
                            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors border border-transparent hover:border-neutral-700"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Test Result Feedback */}
                        {test && !test.loading && (
                          <div className="mt-1.5 text-[11px] text-right font-mono">
                            {test.success ? (
                              <span className="text-emerald-400 flex items-center justify-end gap-1 font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> 連線成功 ({test.latencyMs}ms)
                              </span>
                            ) : (
                              <span className="text-red-400 flex items-center justify-end gap-1 font-medium" title={test.errorMessage}>
                                <XCircle className="w-3 h-3" /> 失敗: {test.errorMessage?.slice(0, 32)}...
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Provider Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                {editingProvider ? '編輯 AI 提供商配置' : '新增自定義 AI 提供商與金鑰'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white p-1 rounded hover:bg-neutral-800"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block text-neutral-300 font-medium mb-1">提供商名稱</label>
                <input
                  type="text"
                  required
                  placeholder="例如: Ollama Cloud / HuggingFace / AgnesAI / Azure"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">提供商類型 (Type)</label>
                  <select
                    value={formData.type}
                    onChange={(e) => {
                      const newType = e.target.value as any;
                      let updatedBaseUrl = formData.baseUrl;
                      let updatedModel = formData.model;
                      let updatedSupported = formData.supportedModels;

                      if (newType === 'ollama_cloud') {
                        updatedBaseUrl = 'https://ollama.com/v1';
                        updatedModel = 'llama3.3';
                        updatedSupported = 'llama3.3, qwen2.5-coder:32b, deepseek-r1:70b';
                      } else if (newType === 'huggingface') {
                        updatedBaseUrl = 'https://router.huggingface.co/v1';
                        updatedModel = 'meta-llama/Llama-3.3-70B-Instruct';
                        updatedSupported = 'meta-llama/Llama-3.3-70B-Instruct, deepseek-ai/DeepSeek-R1, Qwen/Qwen2.5-72B-Instruct';
                      } else if (newType === 'agnes') {
                        updatedBaseUrl = 'https://apihub.agnes-ai.com/v1';
                        updatedModel = 'agnes-chat';
                        updatedSupported = 'agnes-chat, agnes-pro, gpt-4o-mini, claude-3-5-sonnet';
                      } else if (newType === 'cloudflare') {
                        updatedBaseUrl = 'https://api.cloudflare.com/client/v4/accounts/ai/v1';
                        updatedModel = '@cf/meta/llama-3.3-70b-instruct';
                        updatedSupported = '@cf/meta/llama-3.3-70b-instruct, @cf/deepseek-ai/deepseek-r1-distill-qwen-32b';
                      }

                      setFormData({ 
                        ...formData, 
                        type: newType,
                        baseUrl: updatedBaseUrl,
                        model: updatedModel,
                        supportedModels: updatedSupported
                      });
                    }}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-medium"
                  >
                    <option value="ollama_cloud">Ollama Cloud (https://ollama.com/v1)</option>
                    <option value="huggingface">Hugging Face Router (https://router.huggingface.co/v1)</option>
                    <option value="agnes">AgnesAI (https://apihub.agnes-ai.com/v1)</option>
                    <option value="cloudflare">Cloudflare Workers AI (免金鑰直通)</option>
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="cerebras">Cerebras</option>
                    <option value="deepseek">DeepSeek 官方 API</option>
                    <option value="github">GitHub Models</option>
                    <option value="custom">自訂 OpenAI 相容端點 (Custom)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">預設模型 ID (Model)</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: llama3.3 / meta-llama/Llama-3.3-70B-Instruct"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              {formData.type === 'cloudflare' && (
                <div className="p-3 bg-amber-950/40 border border-amber-800/80 rounded-lg flex items-start gap-2 text-[11px] text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-amber-300">Cloudflare Workers AI 配額提示：</strong>
                    <p className="text-neutral-300 mt-0.5">
                      Workers AI 可直接於 Cloudflare 邊緣繫結 <code className="text-amber-300 font-mono">env.AI</code> 調用且無需驗證金鑰。請注意使用其免費每日額度可能造成同 Cloudflare 帳號下其它依賴該服務的程式無餘額可使用。
                    </p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-neutral-300 font-medium mb-1">API Base URL (端點)</label>
                <input
                  type="text"
                  required
                  placeholder="https://ollama.com/v1 或 https://router.huggingface.co/v1"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1 flex items-center justify-between">
                  <span>API Key (將立即使用 AES-256-GCM 加密寫入 Supabase)</span>
                  {editingProvider?.hasApiKey && (
                    <span className="text-[10px] text-neutral-500">留空代表不修改現有金鑰</span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={
                    formData.type === 'cloudflare'
                      ? 'Cloudflare Workers AI 可留空 (自動直通)'
                      : editingProvider?.hasApiKey
                      ? '•••••••••••••••• (已加密保存)'
                      : '輸入 API Key (如 gsk_... / hf_... / AIzaSy...)'
                  }
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Custom Authentication Header Settings */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-neutral-950/60 rounded-lg border border-neutral-800">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">驗證 Header 格式</label>
                  <select
                    value={formData.authHeaderType}
                    onChange={(e) => setFormData({ ...formData, authHeaderType: e.target.value as any })}
                    className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                  >
                    <option value="Bearer">Authorization: Bearer &lt;key&gt;</option>
                    <option value="x-api-key">x-api-key: &lt;key&gt;</option>
                    <option value="api-key">api-key: &lt;key&gt; (Azure)</option>
                    <option value="custom">自訂 Header 名稱</option>
                  </select>
                </div>

                {formData.authHeaderType === 'custom' && (
                  <div>
                    <label className="block text-neutral-300 font-medium mb-1">自訂 Header 名稱</label>
                    <input
                      type="text"
                      placeholder="X-Auth-Token"
                      value={formData.customAuthHeaderName}
                      onChange={(e) => setFormData({ ...formData, customAuthHeaderName: e.target.value })}
                      className="w-full bg-neutral-900 border border-neutral-700 rounded px-2.5 py-1.5 text-white font-mono text-[11px]"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">支援的模型清單 (以逗號分隔)</label>
                <input
                  type="text"
                  placeholder="llama3.3, deepseek-r1:70b, qwen2.5-coder:32b"
                  value={formData.supportedModels}
                  onChange={(e) => setFormData({ ...formData, supportedModels: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono text-[11px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    故障轉移優先級 (Priority)
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  >
                    <option value={1}>P1 (第一優先 - 首選提供商)</option>
                    <option value={2}>P2 (第二梯隊 - 限流或報錯時轉移)</option>
                    <option value={3}>P3 (第三梯隊 - 備援備用)</option>
                    <option value={4}>P4 (第四梯隊 - 緊急降級)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">
                    負載權重 (Weight %: 1~100)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: Number(e.target.value) })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-neutral-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.enabled}
                    onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                    className="rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-0"
                  />
                  <span className="text-neutral-300">啟用此提供商</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-3.5 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all"
                  >
                    {submitting ? '儲存中...' : '儲存至 Supabase'}
                  </button>
                </div>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
