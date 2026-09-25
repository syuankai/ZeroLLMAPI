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
  RefreshCw,
  Layers
} from 'lucide-react';
import { AIProvider } from '../types';

interface ProvidersTabProps {
  providers: AIProvider[];
  onSaveProvider: (providerData: any) => Promise<boolean>;
  onDeleteProvider: (id: string) => Promise<boolean>;
  onTestProvider: (id: string) => Promise<{ success: boolean; latencyMs: number; sampleReply?: string; errorMessage?: string }>;
  masterKeySet: boolean;
}

// Preset Free Tier Providers Catalogue for quick 1-click addition
const FREE_TIER_PRESETS = [
  {
    name: 'Google Gemini 2.5 Flash',
    type: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-2.5-flash',
    supportedModels: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
    freeTierInfo: '慷慨免費額度 (15 RPM / 100 萬 TPM)，支援多模態與高吞吐',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    priority: 1,
    weight: 40
  },
  {
    name: 'Groq (Llama 3.3 70B)',
    type: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    supportedModels: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    freeTierInfo: 'LPU 極速硬體推理，每日提供高達數千次免費請求 (30 RPM)',
    getKeyUrl: 'https://console.groq.com/keys',
    priority: 2,
    weight: 35
  },
  {
    name: 'OpenRouter Free Models',
    type: 'openrouter',
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
    weight: 25
  },
  {
    name: 'Mistral AI (La Plateforme)',
    type: 'mistral',
    baseUrl: 'https://api.mistral.ai/v1',
    model: 'mistral-small-latest',
    supportedModels: ['mistral-small-latest', 'codestral-latest', 'open-mistral-nemo'],
    freeTierInfo: '提供免費測試額度，歐洲頂尖代碼與語言推理模型',
    getKeyUrl: 'https://console.mistral.ai/api-keys/',
    priority: 4,
    weight: 20
  },
  {
    name: 'Cerebras Ultra-Fast',
    type: 'cerebras',
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama3.3-70b',
    supportedModels: ['llama3.3-70b', 'llama3.1-8b'],
    freeTierInfo: '世界級晶圓級引擎晶片推理 (高達 1800 tokens/s)',
    getKeyUrl: 'https://cloud.cerebras.ai/',
    priority: 2,
    weight: 30
  },
  {
    name: 'GitHub Models (Azure)',
    type: 'github',
    baseUrl: 'https://models.inference.ai.azure.com',
    model: 'gpt-4o-mini',
    supportedModels: ['gpt-4o-mini', 'Meta-Llama-3.1-70B-Instruct', 'Mistral-large-2407'],
    freeTierInfo: 'GitHub 個人開發者免費測試 Playground 與 API',
    getKeyUrl: 'https://github.com/marketplace/models',
    priority: 3,
    weight: 25
  }
];

export const ProvidersTab: React.FC<ProvidersTabProps> = ({
  providers,
  onSaveProvider,
  onDeleteProvider,
  onTestProvider,
  masterKeySet,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    type: 'gemini',
    baseUrl: '',
    apiKey: '',
    model: '',
    supportedModels: '',
    enabled: true,
    weight: 50,
    priority: 1
  });

  const [testResults, setTestResults] = useState<Record<string, { loading?: boolean; success?: boolean; latencyMs?: number; sampleReply?: string; errorMessage?: string }>>({});
  const [submitting, setSubmitting] = useState(false);

  const handleOpenAdd = (preset?: typeof FREE_TIER_PRESETS[0]) => {
    setEditingProvider(null);
    if (preset) {
      setFormData({
        name: preset.name,
        type: preset.type,
        baseUrl: preset.baseUrl,
        apiKey: '',
        model: preset.model,
        supportedModels: preset.supportedModels.join(', '),
        enabled: true,
        weight: preset.weight,
        priority: preset.priority
      });
    } else {
      setFormData({
        name: '',
        type: 'custom',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
        supportedModels: 'gpt-4o-mini, gpt-3.5-turbo',
        enabled: true,
        weight: 50,
        priority: 1
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
      priority: p.priority
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const modelsArr = formData.supportedModels.split(',').map((s) => s.trim()).filter(Boolean);
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
      priority: Number(formData.priority)
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
          <h1 className="text-xl font-bold text-white tracking-tight">AI 提供商與 AES 金鑰保管庫</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span className="flex items-center gap-1 text-cyan-400">
              <Shield className="w-3.5 h-3.5" /> AES-256-GCM 軍規加密存儲
            </span>
            <span aria-hidden="true">·</span>
            <span>支援免費與付費 API 負載平衡</span>
          </div>
        </div>

        <button
          onClick={() => handleOpenAdd()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>新增自訂提供商</span>
        </button>
      </div>

      {/* Free Tier 1-Click Quick Add Carousel */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">內建免費提供商快速配給庫 (Free Tier Catalog)</h2>
        </div>
        <p className="text-xs text-neutral-400 mb-4">
          點擊即可快速建立配置，多個免費提供商串聯後可組成高可用、零中斷的負載平衡網關。
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FREE_TIER_PRESETS.map((preset, idx) => {
            const isConfigured = providers.some((p) => p.type === preset.type);
            return (
              <div 
                key={idx}
                className="bg-neutral-950/70 border border-neutral-800/80 p-3.5 rounded-lg flex flex-col justify-between hover:border-neutral-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{preset.name}</span>
                    <a
                      href={preset.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
                    >
                      <span>獲取免費金鑰</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                    {preset.freeTierInfo}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono text-neutral-500">
                    預設優先級 P{preset.priority}
                  </span>
                  <button
                    onClick={() => handleOpenAdd(preset)}
                    className={`px-2.5 py-1 text-xs rounded font-medium transition-colors ${
                      isConfigured
                        ? 'bg-neutral-800 hover:bg-neutral-700 text-neutral-300'
                        : 'bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/30'
                    }`}
                  >
                    {isConfigured ? '再次新增' : '+ 快速配置'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Current Configured Providers Table */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">已配置的提供商金鑰清單</h2>
            <p className="text-xs text-neutral-400">所有 API 金鑰在儲存至資料庫前均通過 AES-256-GCM 加密</p>
          </div>
          <span className="text-xs font-mono text-neutral-400">
            共 {providers.length} 個提供商 ({providers.filter(p => p.enabled && p.hasApiKey).length} 個就緒)
          </span>
        </div>

        {providers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-xs">
            目前尚未配置任何 AI 提供商。請從上方快速加入免費提供商或點擊「新增自訂提供商」。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-2.5 px-4">提供商名稱</th>
                  <th className="py-2.5 px-3">類型</th>
                  <th className="py-2.5 px-3">預設模型</th>
                  <th className="py-2.5 px-3">API 金鑰狀態 (AES)</th>
                  <th className="py-2.5 px-3 text-center">優先級 (Cascade)</th>
                  <th className="py-2.5 px-3 text-center">權重</th>
                  <th className="py-2.5 px-3 text-center">狀態</th>
                  <th className="py-2.5 px-4 text-right">操作與測試</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {providers.map((p) => {
                  const test = testResults[p.id];
                  return (
                    <tr key={p.id} className="hover:bg-neutral-800/30 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-semibold text-white">{p.name}</div>
                        <div className="text-[11px] font-mono text-neutral-400 truncate max-w-[200px]">
                          {p.baseUrl}
                        </div>
                      </td>
                      <td className="py-3 px-3 uppercase font-mono text-[11px] text-cyan-400">
                        {p.type}
                      </td>
                      <td className="py-3 px-3 font-mono text-neutral-300">
                        {p.model}
                      </td>
                      <td className="py-3 px-3">
                        {p.hasApiKey ? (
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
                      <td className="py-3 px-3 text-center font-mono font-bold text-white">
                        P{p.priority}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-neutral-300">
                        {p.weight}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          onClick={() => onSaveProvider({ ...p, enabled: !p.enabled })}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            p.enabled
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800'
                              : 'bg-neutral-800 text-neutral-500'
                          }`}
                        >
                          {p.enabled ? '啟用中' : '已停用'}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Ping Button */}
                          <button
                            onClick={() => handleTest(p.id)}
                            disabled={test?.loading || !p.hasApiKey}
                            title="發送測試請求檢測響應時間"
                            className="px-2.5 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-neutral-700 rounded flex items-center gap-1 disabled:opacity-40 transition-colors"
                          >
                            <Play className={`w-3 h-3 ${test?.loading ? 'animate-spin' : ''}`} />
                            <span>{test?.loading ? '測試中...' : '連線測試'}</span>
                          </button>

                          <button
                            onClick={() => handleOpenEdit(p)}
                            title="編輯提供商"
                            className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded transition-colors"
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
                            className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Test Result Toast/Row */}
                        {test && !test.loading && (
                          <div className="mt-1.5 text-[11px] text-right font-mono">
                            {test.success ? (
                              <span className="text-emerald-400 flex items-center justify-end gap-1">
                                <CheckCircle2 className="w-3 h-3" /> 連線成功 ({test.latencyMs}ms)
                              </span>
                            ) : (
                              <span className="text-red-400 flex items-center justify-end gap-1" title={test.errorMessage}>
                                <XCircle className="w-3 h-3" /> 失敗: {test.errorMessage?.slice(0, 30)}...
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                {editingProvider ? '編輯 AI 提供商配置' : '新增 AI 提供商與金鑰'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white"
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
                  placeholder="例如: Groq Llama 3.3 Free"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">提供商類型</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="gemini">Google Gemini</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="cerebras">Cerebras</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="github">GitHub Models</option>
                    <option value="huggingface">Hugging Face</option>
                    <option value="cloudflare">Cloudflare Workers AI</option>
                    <option value="custom">自訂 OpenAI 相容端點</option>
                  </select>
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">預設模型 ID</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: llama-3.3-70b-versatile"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">API Base URL</label>
                <input
                  type="text"
                  required
                  placeholder="https://api.groq.com/openai/v1"
                  value={formData.baseUrl}
                  onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1 flex items-center justify-between">
                  <span>API Key (將立即使用 AES-256-GCM 加密)</span>
                  {editingProvider?.hasApiKey && (
                    <span className="text-[10px] text-neutral-500">留空代表不修改目前金鑰</span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder={editingProvider?.hasApiKey ? '•••••••••••••••• (已加密)' : '輸入 API Key (如 gsk_... / AIzaSy...)'}
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1">支援的模型清單 (以逗號分隔)</label>
                <input
                  type="text"
                  placeholder="llama-3.3-70b-versatile, llama-3.1-8b-instant"
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
                    <option value={2}>P2 (第二梯隊 - 首選限流後轉移)</option>
                    <option value={3}>P3 (第三梯隊 - 備用備援)</option>
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
                    className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg shadow-sm disabled:opacity-50"
                  >
                    {submitting ? '儲存中...' : '儲存並加密金鑰'}
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
