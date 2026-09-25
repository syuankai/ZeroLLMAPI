import React, { useState } from 'react';
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  Shield, 
  Code, 
  Terminal, 
  Layers,
  AlertCircle
} from 'lucide-react';
import { VirtualApiKey } from '../types';

interface VirtualKeysTabProps {
  keys: VirtualApiKey[];
  onCreateKey: (keyData: { name: string; rateLimitRpm: number; allowedModels: string[] }) => Promise<string | null>;
  onDeleteKey: (id: string) => Promise<boolean>;
}

export const VirtualKeysTab: React.FC<VirtualKeysTabProps> = ({
  keys,
  onCreateKey,
  onDeleteKey,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [rateLimitRpm, setRateLimitRpm] = useState(60);
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const rawKey = await onCreateKey({
      name: name || 'Client Application Key',
      rateLimitRpm: Number(rateLimitRpm),
      allowedModels: ['*']
    });
    setSubmitting(false);
    if (rawKey) {
      setCreatedSecret(rawKey);
      setName('');
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const currentHost = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';

  const curlExample = `curl ${currentHost}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer gw-live-your-key-here" \\
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Hello via Gateway!"}],
    "stream": true
  }'`;

  const pythonExample = `from openai import OpenAI

client = OpenAI(
    base_url="${currentHost}/v1",
    api_key="gw-live-your-key-here"  # 或留空 (若未強制開啟驗證)
)

response = client.chat.completions.create(
    model="gemini-2.5-flash",  # 或 "auto" 進行負載平衡
    messages=[{"role": "user", "content": "Hello EdgeAI Gateway!"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content or "", end="")`;

  const nodeExample = `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${currentHost}/v1",
  apiKey: "gw-live-your-key-here",
});

const stream = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "user", content: "Hello Gateway!" }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}`;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">網關客戶端 API 金鑰 (Virtual Keys)</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span>OpenAI 相容代理接入點</span>
            <span aria-hidden="true">·</span>
            <span>獨立速率限制</span>
            <span aria-hidden="true">·</span>
            <span>支援 NextChat, Cursor, Claude Code</span>
          </div>
        </div>

        <button
          onClick={() => {
            setCreatedSecret(null);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>建立新金鑰 (Generate Key)</span>
        </button>
      </div>

      {/* Keys Table */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">已發行的虛擬 API 金鑰</h2>
            <p className="text-xs text-neutral-400">外部客戶端使用此金鑰即可直接連線至本負載平衡網關</p>
          </div>
          <span className="text-xs font-mono text-neutral-400">共 {keys.length} 組</span>
        </div>

        {keys.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-xs">
            目前尚未建立客戶端金鑰。點擊上方「建立新金鑰」即可生成。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-neutral-950/60 border-b border-neutral-800 text-neutral-400 font-medium">
                <tr>
                  <th className="py-2.5 px-4">名稱</th>
                  <th className="py-2.5 px-3">金鑰前綴</th>
                  <th className="py-2.5 px-3">速率限制 (RPM)</th>
                  <th className="py-2.5 px-3 text-right">總消耗 Tokens</th>
                  <th className="py-2.5 px-3 text-right">請求次數</th>
                  <th className="py-2.5 px-3">建立時間</th>
                  <th className="py-2.5 px-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {keys.map((k) => (
                  <tr key={k.id} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="py-3 px-4 font-semibold text-white">{k.name}</td>
                    <td className="py-3 px-3 font-mono text-cyan-300">{k.keyPrefix}</td>
                    <td className="py-3 px-3 font-mono text-neutral-300">{k.rateLimitRpm} RPM</td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-neutral-300">
                      {k.totalUsageTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono tabular-nums text-right text-neutral-300">
                      {k.totalRequests.toLocaleString()}
                    </td>
                    <td className="py-3 px-3 font-mono text-neutral-400">
                      {new Date(k.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => {
                          if (confirm(`確定要廢止金鑰「${k.name}」嗎？`)) {
                            onDeleteKey(k.id);
                          }
                        }}
                        className="p-1.5 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded transition-colors"
                        title="廢止金鑰"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Integration Code Snippets */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">客戶端快速接入指南 (OpenAI Compatible Integration)</h2>
          <p className="text-xs text-neutral-400">本網關完全相容標準 OpenAI 協定，可直接填入任何支援自訂 base_url 的軟體或 SDK</p>
        </div>

        <div className="space-y-4">
          
          {/* cURL */}
          <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/80 border-b border-neutral-800 text-xs text-neutral-300 font-mono">
              <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                <Terminal className="w-3.5 h-3.5" /> cURL 測試指令
              </span>
              <button
                onClick={() => copyToClipboard(curlExample, 'curl')}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
              >
                {copiedCode === 'curl' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'curl' ? '已複製' : '複製'}</span>
              </button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-neutral-300 overflow-x-auto">
              {curlExample}
            </pre>
          </div>

          {/* Python */}
          <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/80 border-b border-neutral-800 text-xs text-neutral-300 font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                <Code className="w-3.5 h-3.5" /> Python (openai SDK)
              </span>
              <button
                onClick={() => copyToClipboard(pythonExample, 'python')}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
              >
                {copiedCode === 'python' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'python' ? '已複製' : '複製'}</span>
              </button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-neutral-300 overflow-x-auto">
              {pythonExample}
            </pre>
          </div>

          {/* Node.js / TypeScript */}
          <div className="bg-neutral-950 rounded-lg border border-neutral-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-neutral-900/80 border-b border-neutral-800 text-xs text-neutral-300 font-mono">
              <span className="flex items-center gap-1.5 text-blue-400 font-semibold">
                <Code className="w-3.5 h-3.5" /> TypeScript / JavaScript
              </span>
              <button
                onClick={() => copyToClipboard(nodeExample, 'node')}
                className="flex items-center gap-1 text-[11px] text-neutral-400 hover:text-white"
              >
                {copiedCode === 'node' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCode === 'node' ? '已複製' : '複製'}</span>
              </button>
            </div>
            <pre className="p-3 text-[11px] font-mono text-neutral-300 overflow-x-auto">
              {nodeExample}
            </pre>
          </div>

        </div>
      </div>

      {/* Create Key Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-cyan-400" />
                建立網關虛擬 API 金鑰
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {createdSecret ? (
              <div className="space-y-4">
                <div className="p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <Check className="w-4 h-4" /> 金鑰建立成功！
                  </div>
                  <p className="text-neutral-300">
                    請立即複製並保存此金鑰。出於安全考量，此金鑰明文<strong>僅會顯示這一次</strong>。
                  </p>
                  <div className="flex items-center gap-2 bg-neutral-950 p-2 rounded border border-neutral-800">
                    <code className="text-cyan-300 font-mono text-[11px] break-all flex-1">
                      {createdSecret}
                    </code>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(createdSecret);
                        setCopiedKey(true);
                        setTimeout(() => setCopiedKey(false), 2000);
                      }}
                      className="px-2.5 py-1 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-bold rounded text-xs shrink-0"
                    >
                      {copiedKey ? '已複製！' : '複製金鑰'}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-white rounded text-xs"
                  >
                    完成
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">應用程式或使用者名稱</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: NextChat Web App / Production Backend"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">速率限制 (RPM)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={rateLimitRpm}
                    onChange={(e) => setRateLimitRpm(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
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
                    {submitting ? '建立中...' : '生成金鑰'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
