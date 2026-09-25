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
  ShieldCheck,
  GitBranch,
  Github,
  Key,
  ArrowRight,
  BookOpen,
  Sparkles
} from 'lucide-react';

interface WorkerCodeExport {
  workerTs: string;
  wranglerToml: string;
  devVars: string;
  githubWorkflow?: string;
  packageJson?: string;
  readmeMd?: string;
}

export const CloudflareWorkerTab: React.FC = () => {
  const [workerCode, setWorkerCode] = useState<WorkerCodeExport | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<keyof WorkerCodeExport>('workerTs');
  const [deployMethodTab, setDeployMethodTab] = useState<'github-actions' | 'cloudflare-git' | 'wrangler-cli'>('github-actions');
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

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getActiveFilename = (tab: keyof WorkerCodeExport): string => {
    switch (tab) {
      case 'workerTs': return 'index.ts';
      case 'wranglerToml': return 'wrangler.toml';
      case 'githubWorkflow': return 'deploy.yml';
      case 'packageJson': return 'package.json';
      case 'devVars': return '.dev.vars';
      case 'readmeMd': return 'README.md';
      default: return 'file.txt';
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white tracking-tight">Cloudflare Worker 邊緣端一鍵匯出與部署</h1>
            <span className="px-2 py-0.5 text-[11px] font-semibold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-full flex items-center gap-1">
              <Github className="w-3 h-3" />
              <span>支援 GitHub CI/CD 連線</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>無伺服器 (Serverless Edge)</span>
            <span aria-hidden="true">·</span>
            <span>Web Crypto 原生 AES-256-GCM 解密</span>
            <span aria-hidden="true">·</span>
            <span className="text-cyan-400 font-mono">相容 Wrangler 3+ & GitHub Actions</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchWorkerCode}
            disabled={loading}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs transition-colors"
          >
            {loading ? '正在生成...' : '重新生成 Worker 代碼'}
          </button>
          
          <button
            onClick={() => {
              if (!workerCode) return;
              const content = workerCode[activeSubTab] || '';
              const filename = getActiveFilename(activeSubTab);
              handleDownloadFile(filename, content);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>下載目前檔案 ({getActiveFilename(activeSubTab)})</span>
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
          直接透過 GitHub 連線部署至 Cloudflare 後，可在全球 300+ 邊緣節點提供低於 5ms 的極速路由分發。
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
            <GitBranch className="w-4 h-4 text-purple-400 shrink-0" />
            <span>GitHub Actions Git-Push 自動部署</span>
          </div>
        </div>
      </div>

      {/* Deployment Method Selector */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5 text-white" />
            <div>
              <h2 className="text-sm font-semibold text-white">連結 GitHub 至 Cloudflare Workers 快速部署</h2>
              <p className="text-[11px] text-neutral-400">選擇最適合您的自動化發布方式</p>
            </div>
          </div>

          {/* Tab selector */}
          <div className="flex items-center bg-neutral-950 p-1 rounded-lg border border-neutral-800">
            <button
              onClick={() => setDeployMethodTab('github-actions')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                deployMethodTab === 'github-actions'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              途徑一：GitHub Actions CI/CD (推薦)
            </button>
            <button
              onClick={() => setDeployMethodTab('cloudflare-git')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                deployMethodTab === 'cloudflare-git'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              途徑二：Cloudflare 官方 Git 整合
            </button>
            <button
              onClick={() => setDeployMethodTab('wrangler-cli')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                deployMethodTab === 'wrangler-cli'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              途徑三：Wrangler CLI 本機指令
            </button>
          </div>
        </div>

        {/* Method 1: GitHub Actions CI/CD */}
        {deployMethodTab === 'github-actions' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">1</span>
              <div className="space-y-1.5 flex-1">
                <span className="font-semibold text-white block">將檔案放入專案並建立 GitHub 倉庫</span>
                <p className="text-neutral-400 leading-relaxed">
                  建立專案目錄，並將下方產生的 <code className="text-cyan-300 font-mono">src/index.ts</code>、<code className="text-cyan-300 font-mono">wrangler.toml</code> 與 <code className="text-cyan-300 font-mono">.github/workflows/deploy.yml</code> 放入專案：
                </p>
                <div className="p-2.5 bg-neutral-900 rounded font-mono text-cyan-300 text-[11px] overflow-x-auto">
                  git init &amp;&amp; git add . &amp;&amp; git commit -m "feat: initial edge gateway" &amp;&amp; git branch -M main &amp;&amp; git remote add origin https://github.com/&lt;YOUR_USER&gt;/&lt;YOUR_REPO&gt;.git &amp;&amp; git push -u origin main
                </div>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">2</span>
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white block">在 GitHub 倉庫中設定 3 個 Actions Secrets</span>
                  <a
                    href="https://dash.cloudflare.com/profile/api-tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]"
                  >
                    <span>取得 Cloudflare API Token</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <p className="text-neutral-400">
                  進入 GitHub 倉庫 -&gt; <strong>Settings</strong> -&gt; <strong>Secrets and variables</strong> -&gt; <strong>Actions</strong> -&gt; 點擊 <strong>New repository secret</strong>：
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="p-2 bg-neutral-900 border border-neutral-800 rounded">
                    <span className="text-[10px] text-neutral-400 block font-mono">Secret 1</span>
                    <strong className="text-cyan-300 font-mono text-xs">CLOUDFLARE_API_TOKEN</strong>
                    <p className="text-[10px] text-neutral-400 mt-0.5">在 Cloudflare 使用「Edit Cloudflare Workers」範本建立</p>
                  </div>
                  <div className="p-2 bg-neutral-900 border border-neutral-800 rounded">
                    <span className="text-[10px] text-neutral-400 block font-mono">Secret 2</span>
                    <strong className="text-cyan-300 font-mono text-xs">CLOUDFLARE_ACCOUNT_ID</strong>
                    <p className="text-[10px] text-neutral-400 mt-0.5">Cloudflare Workers 儀表板右側欄位的 Account ID</p>
                  </div>
                  <div className="p-2 bg-neutral-900 border border-neutral-800 rounded">
                    <span className="text-[10px] text-neutral-400 block font-mono">Secret 3</span>
                    <strong className="text-cyan-300 font-mono text-xs">GATEWAY_ENCRYPTION_KEY</strong>
                    <p className="text-[10px] text-neutral-400 mt-0.5">您在控制台設定的主加密金鑰字串</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">3</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">全自動推送即發布 (Push to Deploy)</span>
                <p className="text-neutral-400">
                  日後只要 <code className="text-emerald-400 font-mono">git push</code> 推送更新，GitHub Actions 就會自動呼叫 <code className="text-cyan-300 font-mono">cloudflare/wrangler-action@v3</code> 將邊緣負載均衡網關瞬間發布至全球節點！
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Method 2: Cloudflare Dashboard Git Integration */}
        {deployMethodTab === 'cloudflare-git' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">1</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">開啟 Cloudflare Workers &amp; Pages 頁面</span>
                <p className="text-neutral-400">登入 Cloudflare 後點擊左側導航選單的 <strong>Workers &amp; Pages</strong>。</p>
                <a
                  href="https://dash.cloudflare.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-[11px] pt-1"
                >
                  <span>開啟 Cloudflare 控制台</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">2</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">建立應用並選擇「Connect to Git (連接至 Git)」</span>
                <p className="text-neutral-400">
                  點擊 <strong>Create application</strong> -&gt; 選擇 <strong>Workers</strong> 標籤頁 -&gt; 點擊 <strong>Connect to Git</strong> 按鈕，授權並選取您的 GitHub 專案倉庫。
                </p>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">3</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">填寫建置設定與環境變數</span>
                <ul className="list-disc list-inside text-neutral-400 space-y-0.5 pt-1">
                  <li><strong>Production branch</strong>: <code className="text-cyan-300 font-mono">main</code></li>
                  <li><strong>Deploy command</strong>: <code className="text-cyan-300 font-mono">npx wrangler deploy</code></li>
                  <li><strong>Variables and Secrets</strong>: 新增 <code className="text-cyan-300 font-mono">GATEWAY_ENCRYPTION_KEY</code> 填入主加密金鑰</li>
                </ul>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">4</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">點擊「Save and Deploy」完成</span>
                <p className="text-neutral-400">Cloudflare Workers Builds 邊緣系統將自動完成編譯、上傳與全球 DNS 綁定。</p>
              </div>
            </div>
          </div>
        )}

        {/* Method 3: Wrangler CLI */}
        {deployMethodTab === 'wrangler-cli' && (
          <div className="space-y-3 text-xs">
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">1</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">安裝 Wrangler CLI</span>
                <pre className="p-2 bg-neutral-900 rounded font-mono text-cyan-300 text-[11px]">npm install -g wrangler &amp;&amp; npx wrangler login</pre>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">2</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">本地預覽與邊緣模擬</span>
                <pre className="p-2 bg-neutral-900 rounded font-mono text-cyan-300 text-[11px]">npx wrangler dev</pre>
              </div>
            </div>

            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs shrink-0 font-mono">3</span>
              <div className="space-y-1 flex-1">
                <span className="font-semibold text-white block">一鍵發布至線上</span>
                <pre className="p-2 bg-neutral-900 rounded font-mono text-emerald-400 text-[11px]">npx wrangler deploy</pre>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Code Viewer Panel */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden">
        
        {/* Sub tabs */}
        <div className="px-3 py-2 bg-neutral-950/80 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveSubTab('workerTs')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'workerTs'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>src/index.ts (核心代碼)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('wranglerToml')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'wranglerToml'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>wrangler.toml (配置檔)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('githubWorkflow')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'githubWorkflow'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Github className="w-3.5 h-3.5 text-purple-400" />
              <span>.github/workflows/deploy.yml (CI/CD)</span>
            </button>

            <button
              onClick={() => setActiveSubTab('packageJson')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'packageJson'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>package.json</span>
            </button>

            <button
              onClick={() => setActiveSubTab('devVars')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'devVars'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>.dev.vars</span>
            </button>

            <button
              onClick={() => setActiveSubTab('readmeMd')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                activeSubTab === 'readmeMd'
                  ? 'bg-neutral-800 text-cyan-300 border border-neutral-700 shadow-sm'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <span>README.md (部署手冊)</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const code = workerCode ? (workerCode[activeSubTab] || '') : '';
                handleCopy(code, activeSubTab);
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded transition-colors"
            >
              {copied === activeSubTab ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied === activeSubTab ? '已複製！' : '複製內容'}</span>
            </button>
          </div>
        </div>

        {/* Code Content */}
        <pre className="p-4 text-[11px] font-mono text-cyan-300 bg-neutral-950 overflow-x-auto max-h-[480px] leading-relaxed">
          {workerCode ? (workerCode[activeSubTab] || '// 檔案內容準備中...') : '// 正在生成 Worker 代碼與設定檔...'}
        </pre>
      </div>

    </div>
  );
};
