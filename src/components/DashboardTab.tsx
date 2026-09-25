import React, { useState } from 'react';
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Zap, 
  Clock, 
  RotateCcw, 
  Flame,
  Layers,
  ArrowUpRight,
  TrendingUp,
  Server
} from 'lucide-react';
import { TelemetryStats, AIProvider } from '../types';

interface DashboardTabProps {
  stats: TelemetryStats | null;
  providers: AIProvider[];
  onRefresh: () => void;
  onNavigateToTab: (tab: any) => void;
  onClearLogs: () => void;
  loading: boolean;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  stats,
  providers,
  onRefresh,
  onNavigateToTab,
  onClearLogs,
  loading
}) => {
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const kpis = stats?.kpis || {
    totalRequests: 0,
    successRate: '100.0',
    errorCount: 0,
    avgLatency: 0,
    totalTokens: 0,
    activeProviders: 0,
    trippedProviders: 0
  };

  const healthMap = stats?.healthMap || {};
  const logs = stats?.recentLogs || [];
  const timeline = stats?.trafficTimeline || [];

  const maxRequests = Math.max(1, ...timeline.map(t => t.requests));

  return (
    <div className="space-y-6">
      
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">AI 負載平衡網關即時監控</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>邊緣節點狀態監控</span>
            <span aria-hidden="true">·</span>
            <span>熔斷器自動恢復機制</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-cyan-400">/v1/chat/completions</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>重新整理數據</span>
          </button>

          <button
            onClick={() => onNavigateToTab('chat-playground')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>發送測試請求</span>
          </button>
        </div>
      </div>

      {/* KPI 4-Column Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* KPI 1: Total Requests */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span>總請求次數 (Requests)</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums">
            {kpis.totalRequests.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <span className="text-emerald-400 font-mono">{(kpis.totalRequests - kpis.errorCount)} 成功</span>
            <span aria-hidden="true">·</span>
            <span className={kpis.errorCount > 0 ? 'text-red-400 font-mono' : 'text-neutral-500 font-mono'}>
              {kpis.errorCount} 錯誤/熔斷
            </span>
          </div>
        </div>

        {/* KPI 2: Success Rate */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span>負載轉移成功率</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 tabular-nums">
            {kpis.successRate}%
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            <span>故障自動串聯轉移</span>
          </div>
        </div>

        {/* KPI 3: Average Latency */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span>平均響應延遲 (Latency)</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
            {kpis.avgLatency} <span className="text-xs font-normal text-neutral-400">ms</span>
          </div>
          <div className="mt-1 text-xs text-neutral-400">
            <span>端到端 TTFT + 生成流</span>
          </div>
        </div>

        {/* KPI 4: Active Providers & Health */}
        <div className="bg-neutral-900/90 border border-neutral-800 p-4 rounded-xl">
          <div className="flex items-center justify-between text-neutral-400 text-xs mb-1.5">
            <span>線上提供商與熔斷器</span>
            <Server className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white tabular-nums flex items-center gap-2">
            <span>{kpis.activeProviders}</span>
            <span className="text-xs font-normal text-neutral-400">/ {providers.length} 啟動</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-xs">
            {kpis.trippedProviders > 0 ? (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> {kpis.trippedProviders} 暫時熔斷冷卻中
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> 所有提供商運作正常
              </span>
            )}
          </div>
        </div>

      </div>

      {/* Traffic Bar Timeline Chart */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">即時流量分佈 (15 分鐘窗口)</h2>
            <p className="text-xs text-neutral-400">每分鐘請求負載與錯誤監控</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-neutral-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-500"></span> 成功請求
            </span>
            <span className="flex items-center gap-1.5 text-neutral-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-red-500"></span> 錯誤 / 限流
            </span>
          </div>
        </div>

        <div className="h-32 flex items-end gap-1 sm:gap-2 pt-4 pb-2 border-b border-neutral-800">
          {timeline.map((item, idx) => {
            const successHeight = ((item.requests - item.errors) / maxRequests) * 100;
            const errorHeight = (item.errors / maxRequests) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                {/* Tooltip on hover */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute bottom-full mb-2 bg-neutral-950 border border-neutral-700 text-white text-[11px] p-2 rounded shadow-xl whitespace-nowrap z-20 pointer-events-none font-mono">
                  <p className="font-bold text-cyan-300">{item.time}</p>
                  <p>請求數: {item.requests}</p>
                  <p className="text-emerald-400">成功: {item.requests - item.errors}</p>
                  {item.errors > 0 && <p className="text-red-400">錯誤: {item.errors}</p>}
                  {item.avgLatency > 0 && <p className="text-neutral-400">延遲: {item.avgLatency}ms</p>}
                </div>

                <div className="w-full max-w-[24px] flex flex-col justify-end h-full">
                  {item.errors > 0 && (
                    <div 
                      style={{ height: `${Math.max(errorHeight, 6)}%` }} 
                      className="bg-red-500 rounded-t-sm w-full transition-all"
                    />
                  )}
                  {item.requests > item.errors && (
                    <div 
                      style={{ height: `${Math.max(successHeight, 6)}%` }} 
                      className={`bg-cyan-500/80 group-hover:bg-cyan-400 w-full transition-all ${item.errors === 0 ? 'rounded-t-sm' : ''}`}
                    />
                  )}
                  {item.requests === 0 && (
                    <div className="h-1 bg-neutral-800 rounded-sm w-full" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[10px] text-neutral-500 font-mono mt-2">
          <span>15 分鐘前</span>
          <span>即時</span>
        </div>
      </div>

      {/* AI Providers Live Health & Circuit Breaker Grid */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">AI 提供商狀態與熔斷矩陣 (Circuit Breakers)</h2>
            <p className="text-xs text-neutral-400">各免費/付費提供商的即時健康度、限流命中次數與延遲統計</p>
          </div>
          <button
            onClick={() => onNavigateToTab('providers')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
          >
            <span>管理提供商金鑰</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {providers.map((provider) => {
            const health = healthMap[provider.id];
            const isEnabled = provider.enabled && provider.hasApiKey;
            const status = !isEnabled ? 'disabled' : health?.status || 'healthy';

            let statusBadge = (
              <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> 正常運作 (Healthy)
              </span>
            );

            if (status === 'tripped') {
              statusBadge = (
                <span className="flex items-center gap-1 text-red-400 text-xs font-medium">
                  <Flame className="w-3.5 h-3.5 animate-pulse" /> 熔斷冷卻中 (Tripped)
                </span>
              );
            } else if (status === 'degraded') {
              statusBadge = (
                <span className="flex items-center gap-1 text-amber-400 text-xs font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> 降級中 (Degraded)
                </span>
              );
            } else if (status === 'disabled') {
              statusBadge = (
                <span className="flex items-center gap-1 text-neutral-500 text-xs">
                  <XCircle className="w-3.5 h-3.5" /> 未啟用或無金鑰
                </span>
              );
            }

            return (
              <div 
                key={provider.id}
                className={`p-3.5 rounded-lg border transition-all ${
                  status === 'tripped'
                    ? 'border-red-800/80 bg-red-950/20'
                    : status === 'healthy'
                    ? 'border-neutral-800 bg-neutral-950/60'
                    : 'border-neutral-800/60 bg-neutral-950/30 opacity-75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-xs font-semibold text-white tracking-tight">{provider.name}</h3>
                    <p className="text-[11px] text-neutral-400 font-mono mt-0.5 truncate max-w-[180px]">
                      {provider.model}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400">
                    優先級 P{provider.priority}
                  </span>
                </div>

                <div className="mt-3 pt-2.5 border-t border-neutral-800/80 flex items-center justify-between">
                  {statusBadge}
                  <span className="text-xs font-mono tabular-nums text-neutral-300">
                    {health?.averageLatencyMs ? `${health.averageLatencyMs}ms` : '未測試'}
                  </span>
                </div>

                {health && (
                  <div className="mt-2 text-[10px] text-neutral-500 font-mono flex items-center justify-between">
                    <span>請求: {health.totalRequests} (成功 {health.successfulRequests})</span>
                    {health.rateLimitHits > 0 && (
                      <span className="text-amber-400">429 限流: {health.rateLimitHits}次</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Request Logs Table */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">即時請求日誌 (Live Gateway Logs)</h2>
            <p className="text-xs text-neutral-400">所有通過本網關的請求、路由目標、轉移軌跡與延遲</p>
          </div>
          {logs.length > 0 && (
            <button
              onClick={onClearLogs}
              className="text-xs text-neutral-400 hover:text-red-400 transition-colors"
            >
              清除日誌
            </button>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-xs">
            尚無請求紀錄。可切換至「測試聊天實驗室」發送第一筆負載平衡請求。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-2.5 px-4">時間</th>
                  <th className="py-2.5 px-3">狀態</th>
                  <th className="py-2.5 px-3">解析提供商</th>
                  <th className="py-2.5 px-3">請求模型</th>
                  <th className="py-2.5 px-3 text-right">延遲 (TTFT)</th>
                  <th className="py-2.5 px-3 text-right">Tokens</th>
                  <th className="py-2.5 px-4 text-right">串聯軌跡</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {logs.map((log) => (
                  <tr 
                    key={log.id} 
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-neutral-800/40 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-neutral-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {log.success ? (
                        <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> 200 OK
                        </span>
                      ) : (
                        <span className="text-red-400 font-mono font-semibold flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {log.statusCode || 502}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-white whitespace-nowrap">
                      {log.resolvedProviderName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-neutral-400 whitespace-nowrap">
                      {log.resolvedModel}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-right text-cyan-300 whitespace-nowrap">
                      {log.durationMs}ms {log.ttftMs ? `(${log.ttftMs}ms)` : ''}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-right text-neutral-400 whitespace-nowrap">
                      {log.totalTokens || '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                      {log.fallbackCount > 0 ? (
                        <span className="text-amber-400 font-semibold">轉移 {log.fallbackCount} 次</span>
                      ) : (
                        <span className="text-emerald-500">直連成功</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-lg w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white">請求詳細資訊</h3>
              <button 
                onClick={() => setSelectedLog(null)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">請求 ID:</span>
                <span className="text-white">{selectedLog.id}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">時間:</span>
                <span className="text-white">{new Date(selectedLog.timestamp).toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">提供商:</span>
                <span className="text-cyan-300 font-semibold">{selectedLog.resolvedProviderName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">模型:</span>
                <span className="text-white">{selectedLog.resolvedModel}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">總耗時:</span>
                <span className="text-white">{selectedLog.durationMs}ms</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">首字響應 (TTFT):</span>
                <span className="text-white">{selectedLog.ttftMs ? `${selectedLog.ttftMs}ms` : 'N/A'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">Tokens:</span>
                <span className="text-white">{selectedLog.totalTokens} (Prompt: {selectedLog.promptTokens}, Completion: {selectedLog.completionTokens})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-neutral-800">
                <span className="text-neutral-500">流式傳輸 (Stream):</span>
                <span className="text-white">{selectedLog.streaming ? 'True (SSE)' : 'False'}</span>
              </div>

              {selectedLog.fallbackTrace && selectedLog.fallbackTrace.length > 0 && (
                <div className="pt-2">
                  <span className="text-neutral-500 block mb-1">路由轉移軌跡 (Fallback Cascade Trace):</span>
                  <div className="bg-neutral-950 p-2.5 rounded border border-neutral-800 text-[11px] text-amber-300 space-y-1">
                    {selectedLog.fallbackTrace.map((trace: string, i: number) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="text-neutral-500">#{i + 1}</span>
                        <span>{trace}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedLog.errorMessage && (
                <div className="pt-2">
                  <span className="text-red-400 block mb-1">錯誤訊息:</span>
                  <div className="bg-red-950/40 p-2.5 rounded border border-red-800 text-red-300 text-[11px]">
                    {selectedLog.errorMessage}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
