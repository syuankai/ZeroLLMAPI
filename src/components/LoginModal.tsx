import React, { useState } from 'react';
import { Lock, ShieldCheck, KeyRound, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  onChangePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; error?: string }>;
  isAuthenticated: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onChangePassword,
  isAuthenticated
}) => {
  const [activeMode, setActiveMode] = useState<'login' | 'change-password'>(isAuthenticated ? 'change-password' : 'login');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123456');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await onLogin(username, password);
    setSubmitting(false);

    if (res.success) {
      setSuccessMessage('登入成功！');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 800);
    } else {
      setErrorMessage(res.error || '帳號或密碼錯誤');
    }
  };

  const handleChangePassSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setErrorMessage('新密碼兩次輸入不一致');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('新密碼長度至少需為 6 個字元');
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const res = await onChangePassword(oldPassword, newPassword);
    setSubmitting(false);

    if (res.success) {
      setSuccessMessage('密碼已成功更新！');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setSuccessMessage(null);
      }, 1200);
    } else {
      setErrorMessage(res.error || '密碼修改失敗');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-neutral-700 rounded-xl max-w-md w-full p-5 shadow-2xl space-y-4">
        
        <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
            {isAuthenticated ? '管理員安全性設定' : '管理員身份驗證 (Admin Auth)'}
          </h3>
          <button 
            onClick={onClose}
            className="text-neutral-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        {isAuthenticated && (
          <div className="flex bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveMode('change-password')}
              className="flex-1 py-1.5 font-medium rounded-md bg-neutral-800 text-white"
            >
              變更管理員密碼
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-2.5 rounded bg-red-950/60 border border-red-800 text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-2.5 rounded bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {!isAuthenticated ? (
          <form onSubmit={handleLoginSubmit} className="space-y-3.5 text-xs">
            <div className="p-3 bg-neutral-950/60 border border-neutral-800 rounded-lg text-neutral-400 text-[11px] leading-relaxed">
              <span>預設管理員帳號: </span>
              <code className="text-cyan-300 font-mono">admin</code>
              <span> / 預設密碼: </span>
              <code className="text-cyan-300 font-mono">admin123456</code>
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">管理員帳號</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">密碼</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {submitting ? '驗證中...' : '登入管理後台'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleChangePassSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="block text-neutral-300 font-medium mb-1">原密碼</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="輸入目前管理員密碼..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">新密碼 (至少 6 個字元)</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="設定新密碼..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-neutral-300 font-medium mb-1">再次輸入新密碼</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次確認新密碼..."
                className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-1.5 bg-cyan-400 hover:bg-cyan-300 text-neutral-950 font-semibold rounded-lg shadow-sm disabled:opacity-50"
              >
                {submitting ? '更新中...' : '確認變更密碼'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
