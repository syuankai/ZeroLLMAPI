import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Code, 
  Copy, 
  Check, 
  Terminal, 
  FileText, 
  ExternalLink, 
  Download, 
  Layers,
  Zap,
  ShieldCheck
} from 'lucide-react';

export const CloudflareWorkerTab: React.FC = () => {
  const [workerCode, setWorkerCode] = useState<{ workerTs: string; wranglerToml: string; devVars: string } | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'workerTs' | 'wranglerToml' | 'devVars'>('workerTs');
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchWorkerCode = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/export/cloudflare-worker');
      const data = await res.json();
      setWorkerCode(data);
    } catch (err) {
      console.error('Failed to load Worker export code:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkerCode();
  }, []);

  const handleCopy = (content: string, key: string) => {
    navigator.clipboard.writeText(content);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleDownloadZip = () => {
    if (!workerCode) return;
    const blob = new Blob([workerCode.workerTs], { type: 'text/typescript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'worker.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Cloudflare Worker 邊緣端一鍵匯出與部署</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>無伺服器 (Serverless Edge)</span>
            <span aria-hidden="true">·</span>
            <span>Web Crypto 原生 AES-256-GCM 解密</span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-400 font-mono">相容 Wrangler 3+</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWorkerCode}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
          >
            重新生成 Worker 代碼
          </button>
          <button
            onClick={handleDownloadZip}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下載 worker.ts 檔案</span>
          </button>
        </div>
      </div>

      {/* Overview Card */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-2">
          <Cloud className="w-4 h-4 text-cyan-400" />
          <span>Cloudflare Workers 全球邊緣無伺服器架構</span>
        </div>
        <p className="text-xs text-neutral-300 leading-relaxed mb-3">
          此生成的 Worker 腳本已自動同步您在控制台內設置的 <strong>AI 提供商優先級</strong>、<strong>AES-256-GCM 加密金鑰串</strong> 與 <strong>故障轉移路由規則</strong>。
          直接部署至 Cloudflare 後，可在全球 300+ 邊緣節點提供低於 5ms 的極速路由分發。
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-2 border-t border-neutral-800/80">
          <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>內建 Web Crypto Subtle API</span>
          </div>
          <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>自動多提供商串聯轉移 (Cascade)</span>
          </div>
          <div className="p-2.5 bg-neutral-950 rounded border border-neutral-800 flex items-center gap-2">
            <Layers className="w-4 h-4 text-purple-400 shrink-0" />
            <span>原生 CORS 與 SSE 流式支援</span>
          </div>
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden">
        
        {/* Sub tabs */}
        <div className="px-4 py-2.5 bg-neutral-950/80 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveSubTab('workerTs')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'workerTs'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>src/index.ts (Worker 核心代碼)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('wranglerToml')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'wranglerToml'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>wrangler.toml (配置檔)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('devVars')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'devVars'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.dev.vars (環境變數)</span>
            </button>
          </div>

          <button
            onClick={() => {
              const code = workerCode ? workerCode[activeSubTab] : '';
              handleCopy(code, activeSubTab);
            }}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
          >
            {copied === activeSubTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied === activeSubTab ? '已複製！' : '複製代碼'}</span>
          </button>
        </div>

        {/* Code Content */}
        <pre className="p-4 text-[11px] font-mono text-cyan-300 bg-neutral-950 overflow-x-auto max-h-[480px] leading-relaxed">
          {workerCode ? workerCode[activeSubTab] : '// 正在生成 Worker 代碼...'}
        </pre>
      </div>

      {/* Step-by-Step Deployment Instructions */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">三步驟快速部署至 Cloudflare Workers</h2>
        </div>

        <div className="space-y-3 text-xs">
          
          <div className="flex items-start gap-3 p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
              1
            </span>
            <div className="space-y-1">
              <span className="font-semibold text-white block">初始化專案資料夾</span>
              <p className="text-neutral-400">在終端機中建立新資料夾並安裝 Cloudflare Wrangler CLI：</p>
              <pre className="p-2 bg-neutral-900 rounded font-mono text-cyan-300 text-[11px]">
                mkdir edgeai-nexus-gateway && cd edgeai-nexus-gateway && npm init -y && npm install -D wrangler
              </pre>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
              2
            </span>
            <div className="space-y-1">
              <span className="font-semibold text-white block">貼上產生的檔案</span>
              <p className="text-neutral-400">將上方產生的 <code className="text-cyan-300 font-mono">src/index.ts</code> 與 <code className="text-cyan-300 font-mono">wrangler.toml</code> 放入專案資料夾。</p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg">
            <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">
              3
            </span>
            <div className="space-y-1">
              <span className="font-semibold text-white block">執行部署指令</span>
              <p className="text-neutral-400">登入 Cloudflare 並一鍵發布至全球邊緣網路：</p>
              <pre className="p-2 bg-neutral-900 rounded font-mono text-emerald-400 text-[11px]">
                npx wrangler deploy
              </pre>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
};
