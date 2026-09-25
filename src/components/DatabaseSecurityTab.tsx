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
  Copy, 
  Check,
  Zap,
  Radio
} from 'lucide-react';
import { DatabaseConfig } from '../types';

interface DatabaseSecurityTabProps {
  dbConfig: DatabaseConfig;
  masterKeySet: boolean;
  masterKeyMasked: string;
  onUpdateMasterKey: (newKey: string) => Promise<{ success: boolean; message: string }>;
  onConnectDatabase: (config: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    connectionString?: string;
    ssl?: boolean;
  }) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
  onTestDatabase: (config: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    connectionString?: string;
    ssl?: boolean;
  }) => Promise<{ success: boolean; message: string; latencyMs?: number }>;
}

export const DatabaseSecurityTab: React.FC<DatabaseSecurityTabProps> = ({
  dbConfig,
  masterKeySet,
  masterKeyMasked,
  onUpdateMasterKey,
  onConnectDatabase,
  onTestDatabase,
}) => {
  // Master Key state
  const [newMasterKey, setNewMasterKey] = useState('');
  const [confirmMasterKey, setConfirmMasterKey] = useState('');
  const [masterKeyUpdating, setMasterKeyUpdating] = useState(false);
  const [masterKeyMsg, setMasterKeyMsg] = useState<{ text: string; success: boolean } | null>(null);

  // Connection mode: 'fields' (Host, Port, DB, User, Password) or 'uri' (postgresql://...)
  const [connectMode, setConnectMode] = useState<'fields' | 'uri'>('fields');
  
  // Direct Supabase / PostgreSQL fields
  const [host, setHost] = useState(dbConfig.host || '');
  const [port, setPort] = useState(dbConfig.port || 5432);
  const [database, setDatabase] = useState(dbConfig.database || 'postgres');
  const [user, setUser] = useState(dbConfig.user || 'postgres');
  const [password, setPassword] = useState(dbConfig.password || '');
  const [ssl, setSsl] = useState(dbConfig.ssl !== false);
  const [connectionString, setConnectionString] = useState(dbConfig.connectionString || '');

  const [testingDb, setTestingDb] = useState(false);
  const [connectingDb, setConnectingDb] = useState(false);
  const [dbStatusMsg, setDbStatusMsg] = useState<{ text: string; success: boolean; latencyMs?: number } | null>(null);
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

  const getTargetPayload = () => {
    if (connectMode === 'uri') {
      return { connectionString: connectionString.trim(), ssl };
    }
    return {
      host: host.trim(),
      port: Number(port) || 5432,
      database: database.trim() || 'postgres',
      user: user.trim() || 'postgres',
      password: password.trim(),
      ssl
    };
  };

  const handleTestConnection = async () => {
    setTestingDb(true);
    setDbStatusMsg(null);
    const payload = getTargetPayload();
    const res = await onTestDatabase(payload);
    setTestingDb(false);
    setDbStatusMsg({ text: res.message, success: res.success, latencyMs: res.latencyMs });
  };

  const handleConnectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectingDb(true);
    setDbStatusMsg(null);
    const payload = getTargetPayload();
    const res = await onConnectDatabase(payload);
    setConnectingDb(false);
    setDbStatusMsg({ text: res.message, success: res.success, latencyMs: res.latencyMs });
  };

  const postgresSqlSchema = `-- Supabase / PostgreSQL 自動建立的資料表綱要
-- 當您點擊「連線並初始化資料庫」時，系統會自動在您的 Supabase 中建立以下資料表：

-- 1. 網關全局設定與管理員雜湊
CREATE TABLE IF NOT EXISTS nexus_gateway_settings (
  id VARCHAR(32) PRIMARY KEY,
  settings JSONB NOT NULL,
  admin JSONB NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 2. AI 提供商清單 (所有敏感金鑰皆以 AES-256-GCM 加密存儲)
CREATE TABLE IF NOT EXISTS nexus_providers (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  base_url TEXT NOT NULL,
  encrypted_api_key TEXT NOT NULL,
  api_key_masked VARCHAR(64),
  model VARCHAR(128) NOT NULL,
  supported_models JSONB NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  weight INTEGER NOT NULL DEFAULT 50,
  priority INTEGER NOT NULL DEFAULT 1,
  max_tokens INTEGER,
  rate_limit_rpm INTEGER,
  custom_headers JSONB,
  auth_header_type VARCHAR(32),
  custom_auth_header_name VARCHAR(128),
  request_body_format VARCHAR(32),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

-- 3. 客戶端虛擬 API 金鑰 (Virtual Keys)
CREATE TABLE IF NOT EXISTS nexus_virtual_keys (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  key_prefix VARCHAR(64) NOT NULL,
  allowed_models JSONB NOT NULL,
  rate_limit_rpm INTEGER NOT NULL DEFAULT 60,
  total_usage_tokens BIGINT NOT NULL DEFAULT 0,
  total_requests BIGINT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at BIGINT NOT NULL,
  last_used_at BIGINT
);

-- 4. 即時請求日誌 (Request Telemetry Logs)
CREATE TABLE IF NOT EXISTS nexus_request_logs (
  id VARCHAR(64) PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  client_ip VARCHAR(64),
  virtual_key_prefix VARCHAR(64),
  requested_model VARCHAR(128) NOT NULL,
  resolved_provider_id VARCHAR(64) NOT NULL,
  resolved_provider_name VARCHAR(255) NOT NULL,
  resolved_model VARCHAR(128) NOT NULL,
  duration_ms INTEGER NOT NULL,
  ttft_ms INTEGER,
  status_code INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  fallback_count INTEGER NOT NULL DEFAULT 0,
  fallback_trace JSONB,
  prompt_tokens INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  streaming BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT
);`;

  return (
    <div className="space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-neutral-800">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Supabase 資料庫直連與金鑰加密安全</h1>
          <div className="flex items-center gap-2 text-xs text-neutral-400 mt-0.5">
            <span className="text-cyan-400 font-mono">PostgreSQL Direct Driver (pg.Pool)</span>
            <span aria-hidden="true">·</span>
            <span>AES-256-GCM 軍規加解密</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">真實資料庫持久化</span>
          </div>
        </div>
      </div>

      {/* Database Connection Status Banner */}
      {!dbConfig.connected ? (
        <div className="bg-red-950/40 border border-red-800/80 p-4 rounded-xl flex items-start gap-3 text-xs text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-sm text-red-300 block mb-1">
              資料庫尚未連線 (Database Connection Required)
            </span>
            <p className="leading-relaxed text-red-300/90">
              本系統已完全移除任何模擬請求，必須先連線至真實的 <strong>Supabase / PostgreSQL</strong> 資料庫以載入提供商配置、執行負載平衡與記錄流量日誌。請在下方輸入您的 Supabase 連線資訊並點擊「連線並初始化資料庫」。
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-950/40 border border-emerald-800/80 p-4 rounded-xl flex items-center justify-between gap-3 text-xs text-emerald-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-emerald-300">Supabase / PostgreSQL 直連已就緒</span>
              <p className="text-emerald-400/80 text-[11px]">
                主機: {dbConfig.host || 'Direct Connection URI'} · 資料庫: {dbConfig.database} · 使用者: {dbConfig.user}
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 bg-emerald-900/60 border border-emerald-700 rounded text-[11px] font-mono font-bold text-emerald-300">
            ONLINE
          </span>
        </div>
      )}

      {/* Section 1: Supabase Direct Connection Form */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">Supabase / PostgreSQL 直連設定</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              支援 Supabase 直連格式（URL / Host、端口 Port、資料庫名稱、使用者 User、密碼 Password）
            </p>
          </div>

          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs font-medium">
            <button
              type="button"
              onClick={() => setConnectMode('fields')}
              className={`px-3 py-1 rounded transition-colors ${
                connectMode === 'fields' ? 'bg-neutral-800 text-cyan-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              分項參數輸入 (URL/Port/User/Pass)
            </button>
            <button
              type="button"
              onClick={() => setConnectMode('uri')}
              className={`px-3 py-1 rounded transition-colors ${
                connectMode === 'uri' ? 'bg-neutral-800 text-cyan-300' : 'text-neutral-400 hover:text-white'
              }`}
            >
              URI 字串 (Connection String)
            </button>
          </div>
        </div>

        <form onSubmit={handleConnectSubmit} className="space-y-4 text-xs">
          {connectMode === 'fields' ? (
            <div className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-neutral-300 font-medium mb-1">
                    Supabase 主機 URL / Host
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="例如: aws-0-ap-northeast-1.pooler.supabase.com 或 db.xxxx.supabase.co"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">端口 (Port)</label>
                  <input
                    type="number"
                    required
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <span className="text-[10px] text-neutral-500 mt-0.5 block">Supabase Pooler 常用 6543 或 5432</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-neutral-300 font-medium mb-1">資料庫名稱 (Database)</label>
                  <input
                    type="text"
                    required
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    placeholder="postgres"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">使用者名稱 (User)</label>
                  <input
                    type="text"
                    required
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="例如: postgres 或 postgres.xxxx"
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-neutral-300 font-medium mb-1">密碼 (Password / 變數)</label>
                  <input
                    type="password"
                    required
                    placeholder="輸入 Supabase 資料庫密碼..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-neutral-300 font-medium mb-1">
                PostgreSQL / Supabase 連線字串 (Connection URI)
              </label>
              <input
                type="password"
                required
                placeholder="postgresql://postgres:[YOUR-PASSWORD]@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres"
                value={connectionString}
                onChange={(e) => setConnectionString(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ssl}
                onChange={(e) => setSsl(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-950 text-cyan-500 focus:ring-0"
              />
              <span className="text-neutral-300">啟用 SSL 加密連線 (Supabase 必須開啟)</span>
            </label>
          </div>

          {/* Status / Feedback message */}
          {dbStatusMsg && (
            <div className={`p-3 rounded-lg border text-xs font-mono flex items-center justify-between ${
              dbStatusMsg.success
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                : 'bg-red-950/40 border-red-800 text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {dbStatusMsg.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                <span>{dbStatusMsg.text}</span>
              </div>
              {dbStatusMsg.latencyMs !== undefined && (
                <span className="text-neutral-400 tabular-nums">{dbStatusMsg.latencyMs}ms</span>
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-neutral-800">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testingDb}
              className="px-3 py-2 bg-neutral-800 hover:bg-neutral-700 text-cyan-300 border border-neutral-700 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${testingDb ? 'animate-spin' : ''}`} />
              <span>{testingDb ? '測試中...' : '測試連線 (Test Ping)'}</span>
            </button>

            <button
              type="submit"
              disabled={connectingDb}
              className="px-4 py-2 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{connectingDb ? '連線中...' : '連線並初始化資料庫 (Connect & Init)'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Master Encryption Key Vault */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-semibold text-white">主加密金鑰串 (Master Passphrase)</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              所有 AI 提供商的 API 金鑰在寫入 Supabase 資料庫前，皆強制透過此金鑰進行 AES-256-GCM 端到端加密。
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span className={`flex items-center gap-1 text-xs font-mono px-2.5 py-1 rounded-lg border ${
              masterKeySet
                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                : 'bg-amber-950/60 text-amber-300 border-amber-800'
            }`}>
              <ShieldCheck className="w-3.5 h-3.5" />
              {masterKeySet ? '自訂金鑰已生效' : '預設金鑰'}
            </span>
          </div>
        </div>

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
              ⚠️ 更新金鑰時，系統會自動將 Supabase 資料庫中現存的所有 API 金鑰以新金鑰重新加密。
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

      {/* Section 3: Supabase SQL Table Schema Reference */}
      <div className="bg-neutral-900/90 border border-neutral-800 p-4 sm:p-5 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Supabase 資料表結構 (SQL Schema Reference)</h2>
            <p className="text-xs text-neutral-400">連線時系統已自動執行，您亦可在 Supabase SQL Editor 中手動檢視或備份：</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard.writeText(postgresSqlSchema);
              setCopiedSchema(true);
              setTimeout(() => setCopiedSchema(false), 2000);
            }}
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 font-mono"
          >
            {copiedSchema ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedSchema ? '已複製 SQL' : '複製 SQL 綱要'}</span>
          </button>
        </div>

        <pre className="p-3 bg-neutral-950 rounded-lg border border-neutral-800 text-[11px] font-mono text-cyan-300 overflow-x-auto max-h-60">
          {postgresSqlSchema}
        </pre>
      </div>

    </div>
  );
};
