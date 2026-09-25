import React from 'react';
import { 
  Activity, 
  Cpu, 
  Scale, 
  MessageSquare, 
  Key, 
  Database, 
  Cloud, 
  Lock, 
  Unlock, 
  LogOut, 
  ShieldCheck,
  Zap
} from 'lucide-react';

export type TabType = 
  | 'dashboard' 
  | 'providers' 
  | 'load-balancer' 
  | 'chat-playground' 
  | 'virtual-keys' 
  | 'database-security' 
  | 'cloudflare-export';

interface HeaderProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  isAuthenticated: boolean;
  onOpenLogin: () => void;
  onLogout: () => void;
  masterKeySet: boolean;
  dbConnected: boolean;
  activeProvidersCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  isAuthenticated,
  onOpenLogin,
  onLogout,
  masterKeySet,
  dbConnected,
  activeProvidersCount,
}) => {
  const navItems: Array<{ id: TabType; label: string; icon: React.ReactNode }> = [
    { id: 'dashboard', label: '即時監控', icon: <Activity className="w-4 h-4" /> },
    { id: 'providers', label: 'AI 提供商與金鑰庫', icon: <Cpu className="w-4 h-4" /> },
    { id: 'load-balancer', label: '負載平衡與故障轉移', icon: <Scale className="w-4 h-4" /> },
    { id: 'chat-playground', label: '測試聊天實驗室', icon: <MessageSquare className="w-4 h-4" /> },
    { id: 'virtual-keys', label: '網關 API 金鑰', icon: <Key className="w-4 h-4" /> },
    { id: 'database-security', label: '資料庫與 AES 加密', icon: <Database className="w-4 h-4" /> },
    { id: 'cloudflare-export', label: 'Cloudflare Worker 部署', icon: <Cloud className="w-4 h-4" /> },
  ];

  return (
    <header className="border-b border-neutral-800 bg-neutral-900/90 backdrop-blur sticky top-0 z-30">
      {/* Top 3-Zone Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        
        {/* Zone 1: Brand Title */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
              EdgeAI Nexus Gateway
            </span>
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
              <span className={activeProvidersCount > 0 ? 'text-emerald-400 font-semibold' : 'text-neutral-500'}>
                {activeProvidersCount} 線上提供商
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className={masterKeySet ? 'text-cyan-400 font-medium' : 'text-amber-400'}>
                {masterKeySet ? 'AES-256-GCM 已鎖定' : '預設主金鑰'}
              </span>
              <span aria-hidden="true" className="text-neutral-600">·</span>
              <span className={dbConnected ? 'text-emerald-400 font-semibold flex items-center gap-1' : 'text-red-400 font-semibold'}>
                <span className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                {dbConnected ? 'Supabase 直連已就緒' : '資料庫未連線'}
              </span>
            </div>
          </div>
        </div>

        {/* Zone 2: Navigation Links / Segmented Tabs */}
        <nav className="hidden lg:flex items-center gap-1 bg-neutral-950/60 p-1 rounded-xl border border-neutral-800/80">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-neutral-800 text-cyan-300 shadow-sm border border-neutral-700/60'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions & Auth */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => onSelectTab('chat-playground')}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-sm shadow-cyan-500/20"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>立即測試</span>
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/50 rounded-lg font-mono">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>管理員模式</span>
              </div>
              <button
                onClick={onLogout}
                title="登出管理員"
                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-colors"
            >
              <Lock className="w-3.5 h-3.5 text-amber-400" />
              <span>管理員登入</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Nav Bar */}
      <div className="lg:hidden border-t border-neutral-800 bg-neutral-950/80 px-2 py-1.5 overflow-x-auto flex items-center gap-1 no-scrollbar">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTab(item.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md whitespace-nowrap shrink-0 transition-colors ${
              activeTab === item.id
                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </header>
  );
};
