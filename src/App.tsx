import React, { useState, useEffect, useCallback } from 'react';
import { Header, TabType } from './components/Header';
import { DashboardTab } from './components/DashboardTab';
import { ProvidersTab } from './components/ProvidersTab';
import { LoadBalancerTab } from './components/LoadBalancerTab';
import { ChatPlaygroundTab } from './components/ChatPlaygroundTab';
import { VirtualKeysTab } from './components/VirtualKeysTab';
import { DatabaseSecurityTab } from './components/DatabaseSecurityTab';
import { CloudflareWorkerTab } from './components/CloudflareWorkerTab';
import { LoginModal } from './components/LoginModal';
import { 
  AIProvider, 
  DatabaseConfig, 
  GatewaySettings, 
  ProviderHealth, 
  TelemetryStats, 
  VirtualApiKey 
} from './types';
import { CheckCircle2, AlertCircle, X, Database, ArrowRight } from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [authToken, setAuthToken] = useState<string>(() => {
    return localStorage.getItem('nexus_auth_token') || 'dev-bypass-session';
  });
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Core Gateway state
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [virtualKeys, setVirtualKeys] = useState<VirtualApiKey[]>([]);
  const [settings, setSettings] = useState<GatewaySettings>({
    masterKeySet: false,
    loadBalancingStrategy: 'fallback-cascade',
    circuitBreakerThreshold: 3,
    circuitBreakerCooldownSec: 30,
    maxRetriesPerRequest: 2,
    requestTimeoutMs: 25000,
    requireAuthForV1: false,
    defaultModel: 'gemini-2.5-flash'
  });
  const [dbConfig, setDbConfig] = useState<DatabaseConfig>({
    type: 'supabase-direct',
    connected: false
  });
  const [masterKeyMasked, setMasterKeyMasked] = useState<string>('');
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState<boolean>(false);

  // Notification Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const getAuthHeaders = useCallback((): Record<string, string> => {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`
    };
  }, [authToken]);

  // Load Auth Status & System Details
  const fetchAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(data.authenticated || authToken === 'dev-bypass-session');
        setMasterKeyMasked(data.masterKeyMasked || '');
        setSettings((prev) => ({ ...prev, masterKeySet: data.masterKeySet }));
        setDbConfig((prev) => ({ ...prev, connected: data.dbConnected, error: data.dbError }));
      }
    } catch (err) {
      console.error('Failed to fetch auth status:', err);
    }
  }, [getAuthHeaders, authToken]);

  // Load Providers
  const fetchProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/providers');
      if (res.ok) {
        const data = await res.json();
        setProviders(data.providers || []);
        if (data.dbConnected !== undefined) {
          setDbConfig((prev) => ({ ...prev, connected: data.dbConnected }));
        }
      }
    } catch (err) {
      console.error('Failed to load providers:', err);
    }
  }, []);

  // Load Routing Settings & Health
  const fetchRouting = useCallback(async () => {
    try {
      const res = await fetch('/api/routing');
      if (res.ok) {
        const data = await res.json();
        if (data.settings) setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load routing:', err);
    }
  }, []);

  // Load Virtual Keys
  const fetchVirtualKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/keys');
      if (res.ok) {
        const data = await res.json();
        setVirtualKeys(data.keys || []);
      }
    } catch (err) {
      console.error('Failed to load virtual keys:', err);
    }
  }, []);

  // Load DB Config
  const fetchDbConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/database/config');
      if (res.ok) {
        const data = await res.json();
        setDbConfig(data);
      }
    } catch (err) {
      console.error('Failed to load DB config:', err);
    }
  }, []);

  // Load Telemetry Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        if (data.dbConnected !== undefined) {
          setDbConfig((prev) => ({ ...prev, connected: data.dbConnected }));
        }
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAuthStatus();
    fetchProviders();
    fetchRouting();
    fetchVirtualKeys();
    fetchDbConfig();
    fetchStats();
  }, [fetchAuthStatus, fetchProviders, fetchRouting, fetchVirtualKeys, fetchDbConfig, fetchStats]);

  // Periodic stats poll on dashboard tab
  useEffect(() => {
    if (activeTab === 'dashboard') {
      const interval = setInterval(() => {
        fetchStats();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, fetchStats]);

  // Handlers for Auth
  const handleLogin = async (user: string, pass: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, password: pass })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        setAuthToken(data.token);
        localStorage.setItem('nexus_auth_token', data.token);
        setIsAuthenticated(true);
        addToast('登入成功！已切換為管理員模式');
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: getAuthHeaders()
      });
    } catch {}
    setAuthToken('');
    localStorage.removeItem('nexus_auth_token');
    setIsAuthenticated(false);
    addToast('已登出管理員');
  };

  const handleChangePassword = async (oldPass: string, newPass: string) => {
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
      });
      const data = await res.json();
      if (res.ok) {
        addToast('管理員密碼更新成功');
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  // Provider CRUD Handlers
  const handleSaveProvider = async (providerData: any): Promise<boolean> => {
    try {
      const url = providerData.id ? `/api/providers/${providerData.id}` : '/api/providers';
      const method = providerData.id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(providerData)
      });
      const data = await res.json();
      if (res.ok) {
        addToast(`提供商「${providerData.name}」已使用 AES-256-GCM 安全加密寫入 Supabase`);
        await fetchProviders();
        await fetchStats();
        return true;
      }
      addToast(data.error || '儲存提供商失敗', 'error');
      return false;
    } catch (err: any) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const handleDeleteProvider = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        addToast('提供商已從資料庫移除');
        await fetchProviders();
        await fetchStats();
        return true;
      }
      return false;
    } catch (err: any) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const handleTestProvider = async (id: string) => {
    try {
      const res = await fetch(`/api/providers/test/${id}`, { method: 'POST' });
      return await res.json();
    } catch (err: any) {
      return { success: false, latencyMs: 0, errorMessage: err.message };
    }
  };

  // Settings Handlers
  const handleUpdateSettings = async (newSettings: Partial<GatewaySettings>): Promise<boolean> => {
    try {
      const res = await fetch('/api/routing/settings', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newSettings)
      });
      const data = await res.json();
      if (res.ok) {
        setSettings(data.settings);
        addToast('負載平衡策略與熔斷參數已更新至 Supabase');
        return true;
      }
      addToast(data.error || '更新失敗', 'error');
      return false;
    } catch (err: any) {
      addToast(err.message, 'error');
      return false;
    }
  };

  // Master Key Handlers
  const handleUpdateMasterKey = async (newKey: string) => {
    try {
      const res = await fetch('/api/vault/set-master-key', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ newMasterKey: newKey })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchAuthStatus();
        await fetchProviders();
        addToast('主加密金鑰更新成功！所有金鑰已於 Supabase 重新加密');
        return { success: true, message: data.message };
      }
      return { success: false, message: data.error || '更新主金鑰失敗' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  // Direct Supabase Database Handlers
  const handleConnectDatabase = async (config: any) => {
    try {
      const res = await fetch('/api/database/connect', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDbConfig(data.config || { type: 'supabase-direct', connected: true });
        addToast('已成功直連 Supabase 資料庫！資料表已初始化');
        await fetchProviders();
        await fetchStats();
        return { success: true, message: data.message, latencyMs: data.latencyMs };
      }
      return { success: false, message: data.message || '連線失敗' };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  const handleTestDatabase = async (config: any) => {
    try {
      const res = await fetch('/api/database/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  };

  // Virtual Keys Handlers
  const handleCreateVirtualKey = async (keyData: { name: string; rateLimitRpm: number; allowedModels: string[] }) => {
    try {
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(keyData)
      });
      const data = await res.json();
      if (res.ok && data.rawSecretKey) {
        await fetchVirtualKeys();
        addToast('虛擬 API 金鑰建立成功');
        return data.rawSecretKey;
      }
      addToast(data.error || '建立失敗', 'error');
      return null;
    } catch (err: any) {
      addToast(err.message, 'error');
      return null;
    }
  };

  const handleDeleteVirtualKey = async (id: string): Promise<boolean> => {
    try {
      const res = await fetch(`/api/keys/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        await fetchVirtualKeys();
        addToast('虛擬金鑰已廢止');
        return true;
      }
      return false;
    } catch (err: any) {
      addToast(err.message, 'error');
      return false;
    }
  };

  const handleClearLogs = async () => {
    try {
      await fetch('/api/stats/logs', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      addToast('請求日誌已清空');
      fetchStats();
    } catch (err: any) {
      addToast(err.message, 'error');
    }
  };

  const activeProvidersCount = providers.filter((p) => p.enabled && p.hasApiKey).length;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col selection:bg-cyan-500/20 selection:text-cyan-300 font-sans">
      
      {/* Top Bar Navigation */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isAuthenticated={isAuthenticated}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onLogout={handleLogout}
        masterKeySet={settings.masterKeySet}
        dbConnected={dbConfig.connected}
        activeProvidersCount={activeProvidersCount}
      />

      {/* Global No-Database Alert Notification Banner */}
      {!dbConfig.connected && activeTab !== 'database-security' && (
        <div className="bg-amber-950/60 border-b border-amber-800/80 px-4 py-2.5 text-xs text-amber-200">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>提醒：</strong>目前尚未連線至 Supabase / PostgreSQL 資料庫。所有功能與網關請求均需真實資料庫連線支援。
              </span>
            </div>
            <button
              onClick={() => setActiveTab('database-security')}
              className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold rounded flex items-center gap-1 shrink-0 transition-colors"
            >
              <span>立即連線 Supabase</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {activeTab === 'dashboard' && (
          <DashboardTab
            stats={stats}
            providers={providers}
            onRefresh={fetchStats}
            onNavigateToTab={setActiveTab}
            onClearLogs={handleClearLogs}
            loading={statsLoading}
          />
        )}

        {activeTab === 'providers' && (
          <ProvidersTab
            providers={providers}
            onSaveProvider={handleSaveProvider}
            onDeleteProvider={handleDeleteProvider}
            onTestProvider={handleTestProvider}
            masterKeySet={settings.masterKeySet}
            dbConnected={dbConfig.connected}
          />
        )}

        {activeTab === 'load-balancer' && (
          <LoadBalancerTab
            settings={settings}
            providers={providers}
            healthMap={stats?.healthMap || {}}
            onUpdateSettings={handleUpdateSettings}
          />
        )}

        {activeTab === 'chat-playground' && (
          <ChatPlaygroundTab
            providers={providers}
            masterKeySet={settings.masterKeySet}
          />
        )}

        {activeTab === 'virtual-keys' && (
          <VirtualKeysTab
            keys={virtualKeys}
            onCreateKey={handleCreateVirtualKey}
            onDeleteKey={handleDeleteVirtualKey}
          />
        )}

        {activeTab === 'database-security' && (
          <DatabaseSecurityTab
            dbConfig={dbConfig}
            masterKeySet={settings.masterKeySet}
            masterKeyMasked={masterKeyMasked}
            onUpdateMasterKey={handleUpdateMasterKey}
            onConnectDatabase={handleConnectDatabase}
            onTestDatabase={handleTestDatabase}
          />
        )}

        {activeTab === 'cloudflare-export' && (
          <CloudflareWorkerTab />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950/60 py-4 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <span>EdgeAI Nexus Gateway</span>
            <span aria-hidden="true">·</span>
            <span>Cloudflare Worker & Supabase Real PostgreSQL Engine</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[11px]">OpenAI Compatible /v1</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-500">AES-256-GCM Encrypted in Supabase</span>
          </div>
        </div>
      </footer>

      {/* Login & Security Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLogin={handleLogin}
        onChangePassword={handleChangePassword}
        isAuthenticated={isAuthenticated}
      />

      {/* Toast Notification Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl flex items-start gap-2.5 text-xs font-medium transition-all ${
              toast.type === 'success'
                ? 'bg-neutral-900 border-emerald-800/80 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-neutral-900 border-red-800/80 text-red-200'
                : 'bg-neutral-900 border-neutral-700 text-neutral-200'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            ) : null}
            <span className="flex-1 leading-snug">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-neutral-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
}
