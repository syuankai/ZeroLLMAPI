import React, { useState } from 'react';
import { 
  Database, 
  Lock, 
  ShieldCheck, 
  RotateCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Server, 
  Key, 
  Code, 
  Copy, 
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { DatabaseConfig } from '../types';

interface DatabaseSecurityTabProps {
  dbConfig: DatabaseConfig;
  masterKeySet: boolean;
  masterKeyMasked: string;
  onUpdateMasterKey: (newKey: string) => Promise<{ success: boolean; message: string }>;
  onSaveDbConfig: (config: Partial<DatabaseConfig> & { restApiKey?: string }) => Promise<{ success: boolean; message: string }>;
  onTestDbConnection: (endpoint: string, apiKey?: string, type?: string) => Promise<{ success: boolean; message: string; latencyMs: number }>;
  onSyncDb: () => Promise<{ success: boolean; message: string }>;
}

export const DatabaseSecurityTab: React.FC<DatabaseSecurityTabProps> = ({
  dbConfig,
  masterKeySet,
  masterKeyMasked,
  onUpdateMasterKey,
  onSaveDbConfig,
  onTestDbConnection,
  onSyncDb,
}) => {
  // Master Key state
  const [newMasterKey, setNewMasterKey] = useState('');
  const [confirmMasterKey, setConfirmMasterKey] = useState('');
  const [masterKeyUpdating, setMasterKeyUpdating] = useState(false);
  const [masterKeyMsg, setMasterKeyMsg] = useState<{ text: string; success: boolean } | null>(null);

  // DB Config state
  const [dbType, setDbType] = useState<DatabaseConfig['type']>(dbConfig.type || 'sqlite-local');
  const [restEndpoint, setRestEndpoint] = useState(dbConfig.restEndpoint || '');
  const [restApiKey, setRestApiKey] = useState('');
  const [testingDb, setTestingDb] = useState(false);
  const [syncingDb, setSyncingDb] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string; latencyMs?: number } | null>(null);
  const [dbSaveMsg, setDbSaveMsg] = useState<{ text: string; success: boolean } | null>(null);

  const [copiedSchema, setCopiedSchema] = useState(false);

  const handleMasterKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newMasterKey.length < 8) {
      setMasterKeyMsg({ text: '金鑰長度至少需為 8 個字元', success: false });
      return;
    }
    if (newMasterKey !== confirmMasterKey) {
      setMasterKeyMsg({ text: '兩次輸入的金鑰不一致', success: false });
      return;
    }

    setMasterKeyUpdating(true);
    setMasterKeyMsg(null);
    const res = await onUpdateMasterKey(newMasterKey);
    setMasterKeyUpdating(false);
    setMasterKeyMsg({ text: res.message, success: res.success });
    if (res.success) {
      setNewMasterKey('');
      setConfirmMasterKey('');
    }
  };

  const handleTestConnection = async () => {
    if (dbType === 'sqlite-local') {
      setDbTestResult({ success: true, message: '本機加密存儲運作正常 (Local encrypted storage ready)', latencyMs: 0 });
      return;
    }
    if (!restEndpoint.trim()) {
      setDbTestResult({ success: false, message: '請先輸入 REST API 連線 Endpoint URL' });
      return;
    }

    setTestingDb(true);
    setDbTestResult(null);
    const res = await onTestDbConnection(restEndpoint, restApiKey || undefined, dbType);
    setTestingDb(false);
    setDbTestResult(res);
  };

  const handleSaveDb = async (e: React.FormEvent) => {
    e.preventDefault();
    setDbSaveMsg(null);
    const res = await onSaveDbConfig({
      type: dbType,
      restEndpoint: restEndpoint.trim(),
      ...(restApiKey && !restApiKey.includes('••••') ? { restApiKey } : {})
    });
    setDbSaveMsg({ text: res.message, success: res.success });
  };

  const handleSyncNow = async () => {
    setSyncingDb(true);
    const res = await onSyncDb();
    setSyncingDb(false);
    setDbSaveMsg({ text: res.message, success: res.success });
  };

  const postgresSqlSchema = `-- PostgreSQL / Supabase 資料表綱要 (Table Schema)
CREATE TABLE IF NOT EXISTS nexus_gateway (
  app_id VARCHAR(64) PRIMARY KEY,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  settings JSONB NOT NULL,
  providers_encrypted JSONB NOT NULL, -- 所有 API 金鑰皆為 AES-256-GCM 加密密文
  virtual_keys JSONB NOT NULL
);

-- 啟用 REST API 讀寫權限 (PostgREST)
ALTER TABLE nexus_gateway ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow Service Role" ON nexus_gateway FOR ALL USING (true);`;

  const mysqlSqlSchema = `-- MySQL / PlanetScale 資料表綱要 (Table Schema)
CREATE TABLE IF NOT EXISTS nexus_gateway (
  app_id VARCHAR(64) PRIMARY KEY,
  synced_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  settings JSON NOT NULL,
  providers_encrypted JSON NOT NULL, -- 所有 API 金鑰皆為 AES-256-GCM 加密密文
  virtual_keys JSON NOT NULL
);`;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">資料庫設定與金鑰加密安全 (Security Vault)</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span className="text-cyan-400 font-mono">AES-256-GCM (PBKDF2 100k)</span>
            <span aria-hidden="true">·</span>
            <span>支援 PostgreSQL (PostgREST / Supabase) 與 MySQL REST API</span>
          </div>
        </div>
      </div>

      {/* Section 1: Master Encryption Key Vault */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">主加密金鑰串 (Master Passphrase)</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              所有 AI 提供商的 API 金鑰在寫入資料庫前，皆強制透過此主金鑰進行 AES-256-GCM 端到端加密。
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className={`flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border ${
              masterKeySet
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : 'bg-amber-950/60 text-amber-300 border-amber-800'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {masterKeySet ? '自訂金鑰運作中' : '使用環境預設金鑰'}
            </span>
          </div>
        </div>

        {/* Security Specs Badge */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-neutral-950/60 rounded-lg border border-neutral-800 text-[11px] font-mono">
          <div>
            <span className="text-neutral-500 block">加密算法:</span>
            <span className="text-white font-bold">AES-256-GCM</span>
          </div>
          <div>
            <span className="text-neutral-500 block">密鑰衍生:</span>
            <span className="text-cyan-300">PBKDF2 (100,000 輪)</span>
          </div>
          <div>
            <span className="text-neutral-500 block">初始向量 (IV):</span>
            <span className="text-neutral-300">12 位元組隨機隨機數</span>
          </div>
          <div>
            <span className="text-neutral-500 block">認證標籤 (Auth Tag):</span>
            <span className="text-emerald-400">16 位元組防篡改校驗</span>
          </div>
        </div>

        {/* Form to Update / Rotate Master Key */}
        <form onSubmit={handleMasterKeySubmit} className="space-y-3 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-300 mb-1">
                設定新主金鑰字串 (至少 8 個字元)
              </label>
              <input
                type="password"
                required
                placeholder="輸入安全金鑰密碼..."
                value={newMasterKey}
                onChange={(e) => setNewMasterKey(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-300 mb-1">
                再次確認新金鑰
              </label>
              <input
                type="password"
                required
                placeholder="再次確認金鑰..."
                value={confirmMasterKey}
                onChange={(e) => setConfirmMasterKey(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {masterKeyMsg && (
            <div className={`p-2.5 rounded text-xs flex items-center gap-1.5 ${
              masterKeyMsg.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
            }`}>
              {masterKeyMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{masterKeyMsg.text}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-neutral-400">
              ⚠️ 更新金鑰時，系統會自動將資料庫中現有的所有 API 金鑰以新金鑰重新加密。
            </span>
            <button
              type="submit"
              disabled={masterKeyUpdating || !newMasterKey}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{masterKeyUpdating ? '重新加密中...' : '更新主加密金鑰'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: PostgreSQL / MySQL Database REST API Connection */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">外部資料庫 REST API 存儲配置</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              支援以標準 HTTP / REST API 連線至 PostgreSQL (Supabase / PostgREST) 或 MySQL 代理。
            </p>
          </div>

          <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border flex items-center gap-1 ${
            dbConfig.connected
              ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700'
          }`}>
            <Server className="w-3.5 h-3.5" />
            {dbConfig.connected ? '資料庫連線良好' : '未連線'}
          </span>
        </div>

        <form onSubmit={handleSaveDb} className="space-y-4 text-xs">
          
          {/* Database Type Radio / Grid */}
          <div>
            <label className="block text-neutral-300 font-medium mb-2">資料庫連線類型</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              
              <div
                onClick={() => setDbType('postgres-rest')}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  dbType === 'postgres-rest'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">PostgreSQL (REST / PostgREST)</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">Supabase, Neon HTTP, PostgREST</div>
              </div>

              <div
                onClick={() => setDbType('mysql-rest')}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  dbType === 'mysql-rest'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">MySQL (REST Proxy)</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">PlanetScale HTTP, 自訂 REST API</div>
              </div>

              <div
                onClick={() => setDbType('sqlite-local')}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  dbType === 'sqlite-local'
                    ? 'border-cyan-500 bg-cyan-950/30 text-white'
                    : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:border-neutral-700'
                }`}
              >
                <div className="font-semibold text-xs text-white">本機加密持久化 (Built-in)</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">免配置外部資料庫，即開即用</div>
              </div>

            </div>
          </div>

          {dbType !== 'sqlite-local' && (
            <>
              <div>
                <label className="block text-neutral-300 font-medium mb-1">
                  REST API Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder={
                    dbType === 'postgres-rest'
                      ? 'https://your-project.supabase.co/rest/v1/nexus_gateway'
                      : 'https://your-mysql-proxy.com/api/nexus_gateway'
                  }
                  value={restEndpoint}
                  onChange={(e) => setRestEndpoint(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-neutral-300 font-medium mb-1 flex items-center justify-between">
                  <span>REST API Key / Bearer Token (選填)</span>
                  {dbConfig.restApiKeyMasked && (
                    <span className="text-[10px] text-neutral-500">
                      已保存: {dbConfig.restApiKeyMasked}
                    </span>
                  )}
                </label>
                <input
                  type="password"
                  placeholder={dbConfig.restApiKeyMasked ? '•••••••••••••••• (留空代表不修改)' : '輸入 API Key 或 Token'}
                  value={restApiKey}
                  onChange={(e) => setRestApiKey(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>
            </>
          )}

          {/* Test connection result display */}
          {dbTestResult && (
            <div className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
              dbTestResult.success
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-red-950/40 border-red-800 text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {dbTestResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{dbTestResult.message}</span>
              </div>
              {dbTestResult.latencyMs !== undefined && (
                <span className="text-neutral-400 tabular-nums">{dbTestResult.latencyMs}ms</span>
              )}
            </div>
          )}

          {dbSaveMsg && (
            <div className={`p-2.5 rounded text-xs flex items-center gap-1.5 ${
              dbSaveMsg.success ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
            }`}>
              {dbSaveMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{dbSaveMsg.text}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingDb}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-neutral-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
                <span>{testingDb ? '連線中...' : '測試 REST 連線'}</span>
              </button>

              {dbType !== 'sqlite-local' && (
                <button
                  type="button"
                  onClick={handleSyncNow}
                  disabled={syncingDb}
                  className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingDb ? 'animate-spin' : ''}`} />
                  <span>{syncingDb ? '同步中...' : '立即同步資料'}</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg shadow-sm transition-colors"
            >
              儲存資料庫設定
            </button>
          </div>

        </form>
      </div>

      {/* SQL Table Schema Generator */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">快速建立資料表綱要 (SQL Schema Helper)</h2>
            <p className="text-xs text-neutral-400">若使用自有 PostgreSQL 或 MySQL，請在資料庫中執行以下 SQL 語句：</p>
          </div>
          <button
            onClick={() => {
              const code = dbType === 'mysql-rest' ? mysqlSqlSchema : postgresSqlSchema;
              navigator.clipboard.writeText(code);
              setCopiedSchema(true);
              setTimeout(() => setCopiedSchema(false), 2000);
            }}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
          >
            {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSchema ? '已複製 SQL' : '複製 SQL 綱要'}</span>
          </button>
        </div>

        <pre className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px] font-mono text-cyan-300 overflow-x-auto">
          {dbType === 'mysql-rest' ? mysqlSqlSchema : postgresSqlSchema}
        </pre>
      </div>

    </div>
  );
};
