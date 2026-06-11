import React, { useRef, useState, useEffect } from 'react';
import { X, Settings, Download, Upload, FileJson, Check, AlertCircle, Cloud, Bot, Eye, EyeOff, MessageSquareText, Image as ImageIcon, Globe, LogIn, UserPlus, RefreshCw, LogOut, AlertTriangle, ScanLine } from 'lucide-react';
import { Subscription, Budget, AIConfig, Transaction, UserAuth } from '../types';
import { cloudService, AppData } from '../services/cloudService';
import { jianguoyunService } from '../services/jianguoyunService';
import { normalizeImportedData } from '../services/dataValidation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentData: {
    subscriptions: Subscription[];
    budget: Budget;
    restDays: string[];
    aiConfig: AIConfig;
    transactions: Transaction[];
  };
  onRestore: (data: Partial<AppData>) => void;
  aiConfig: AIConfig;
  onUpdateAIConfig: (config: AIConfig) => void;
  defaultAiConfig: AIConfig;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, currentData, onRestore, aiConfig, onUpdateAIConfig, defaultAiConfig }) => {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  
  // Cloudflare Auth State
  const [userAuth, setUserAuth] = useState<UserAuth>({ username: '', token: '', isLoggedIn: false });
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Jianguoyun WebDAV State
  const [jianguoyunAccount, setJianguoyunAccount] = useState('');
  const [jianguoyunAppPassword, setJianguoyunAppPassword] = useState('');
  const [jianguoyunFileName, setJianguoyunFileName] = useState('subscript_backup.json');
  const [showBackupSecret, setShowBackupSecret] = useState(false);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  // AI Config State
  const [localAiConfig, setLocalAiConfig] = useState<AIConfig>(aiConfig);
  const [showChatSecrets, setShowChatSecrets] = useState(false);
  const [showImageSecrets, setShowImageSecrets] = useState(false);
  const [activeAiTab, setActiveAiTab] = useState<'chat' | 'image' | 'ocr'>('chat');

  // File Input
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load local User Auth
    const savedToken = localStorage.getItem('cf_token');
    const savedUser = localStorage.getItem('cf_username');
    if (savedToken && savedUser) {
        setUserAuth({ username: savedUser, token: savedToken, isLoggedIn: true });
    }
    
    // Load Jianguoyun backup config
    const savedAccount = localStorage.getItem('jianguoyun_account');
    const savedAppPassword = localStorage.getItem('jianguoyun_app_password');
    const savedFileName = localStorage.getItem('jianguoyun_file_name');
    if (savedAccount) setJianguoyunAccount(savedAccount);
    if (savedAppPassword) setJianguoyunAppPassword(savedAppPassword);
    if (savedFileName) setJianguoyunFileName(savedFileName);

    if (isOpen) {
        setLocalAiConfig(aiConfig);
    }
  }, [isOpen, aiConfig]);

  useEffect(() => {
    const account = jianguoyunAccount.trim();
    if (account) {
      localStorage.setItem('jianguoyun_account', account);
    } else {
      localStorage.removeItem('jianguoyun_account');
    }
  }, [jianguoyunAccount]);

  useEffect(() => {
    const password = jianguoyunAppPassword.trim();
    if (password) {
      localStorage.setItem('jianguoyun_app_password', password);
    } else {
      localStorage.removeItem('jianguoyun_app_password');
    }
  }, [jianguoyunAppPassword]);

  useEffect(() => {
    const fileName = jianguoyunFileName.trim() || 'subscript_backup.json';
    localStorage.setItem('jianguoyun_file_name', fileName);
  }, [jianguoyunFileName]);
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);


  // --- Cloudflare KV Auth Handlers ---
  const handleAuth = async () => {
      if (!usernameInput || !passwordInput) {
          setStatus({ type: 'error', msg: 'Please enter both username and password.' });
          return;
      }
      
      const proxyUrl = localAiConfig.proxyUrl || '';
      if (!proxyUrl) {
        setStatus({ type: 'error', msg: 'Please enter the Worker proxy URL in the AI & Network section first.' });
          return;
      }

      setIsAuthLoading(true);
      setStatus(null);

      try {
          if (authMode === 'register') {
              const res = await cloudService.register(proxyUrl, usernameInput, passwordInput);
              if (res.success) {
                  setStatus({ type: 'success', msg: '注册成功，可以直接登录了。' });
                  setAuthMode('login');
              } else {
                  throw new Error(res.error);
              }
          } else {
              const res = await cloudService.login(proxyUrl, usernameInput, passwordInput);
              if (res.success && res.data) {
                  const token = res.data.token;
                  localStorage.setItem('cf_token', token);
                  localStorage.setItem('cf_username', usernameInput);
                  setUserAuth({ username: usernameInput, token, isLoggedIn: true });
                  setStatus({ type: 'success', msg: 'Login successful.' });
                  setUsernameInput('');
                  setPasswordInput('');
              } else {
                  throw new Error(res.error);
              }
          }
      } catch (e: any) {
        setStatus({ type: 'error', msg: e.message || 'Operation failed. Check the Proxy URL.' });
      } finally {
          setIsAuthLoading(false);
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_username');
      setUserAuth({ username: '', token: '', isLoggedIn: false });
      setStatus({ type: 'success', msg: 'Logged out successfully.' });
  };

  const handleSyncPush = async () => {
      setIsAuthLoading(true);
      try {
          const appData: AppData = {
              ...currentData,
              lastUpdated: Date.now()
          };
          const res = await cloudService.pushData(localAiConfig.proxyUrl!, userAuth.token, appData);
          if (res.success) {
            setStatus({ type: 'success', msg: 'Data synced to Cloudflare KV.' });
          } else {
              throw new Error(res.error);
          }
      } catch (e: any) {
          setStatus({ type: 'error', msg: 'Sync failed: ' + e.message });
      } finally {
          setIsAuthLoading(false);
      }
  };

  const handleSyncPull = async () => {
      setIsAuthLoading(true);
      try {
          const res = await cloudService.pullData(localAiConfig.proxyUrl!, userAuth.token);
          if (res.success && res.data) {
              onRestore(res.data);
              setStatus({ type: 'success', msg: 'Restored data from Cloudflare KV.' });
              setTimeout(() => onClose(), 1500);
          } else {
              throw new Error(res.error || '云端暂无数据');
          }
      } catch (e: any) {
          setStatus({ type: 'error', msg: 'Pull failed: ' + e.message });
      } finally {
          setIsAuthLoading(false);
      }
  };

  // --- Jianguoyun Backup Handlers ---
  const handleJianguoyunUpload = async () => {
    if (!jianguoyunAccount.trim() || !jianguoyunAppPassword.trim()) {
        setStatus({ type: 'error', msg: '请先填写坚果云账号和应用密码。' });
        return;
    }
    if (!localAiConfig.proxyUrl) {
        setStatus({ type: 'error', msg: '请先在 AI & 网络配置中填写 Cloudflare Worker 地址。' });
        return;
    }
    setIsBackupLoading(true);
    try {
        await jianguoyunService.uploadBackup(localAiConfig.proxyUrl, {
          account: jianguoyunAccount.trim(),
          appPassword: jianguoyunAppPassword.trim(),
          fileName: jianguoyunFileName.trim() || 'subscript_backup.json',
          data: currentData,
        });
        setStatus({ type: 'success', msg: '备份已上传到坚果云。' });
    } catch (e: any) {
        setStatus({ type: 'error', msg: e.message || '坚果云上传失败。' });
    } finally {
        setIsBackupLoading(false);
    }
  };

  const handleJianguoyunDownload = async () => {
    if (!jianguoyunAccount.trim() || !jianguoyunAppPassword.trim()) {
        setStatus({ type: 'error', msg: '请先填写坚果云账号和应用密码。' });
        return;
    }
    if (!localAiConfig.proxyUrl) {
        setStatus({ type: 'error', msg: '请先在 AI & 网络配置中填写 Cloudflare Worker 地址。' });
        return;
    }
    setIsBackupLoading(true);
    try {
        const data = await jianguoyunService.downloadBackup(localAiConfig.proxyUrl, {
          account: jianguoyunAccount.trim(),
          appPassword: jianguoyunAppPassword.trim(),
          fileName: jianguoyunFileName.trim() || 'subscript_backup.json',
        });
        // @ts-ignore
        onRestore(data);
        setStatus({ type: 'success', msg: '已从坚果云恢复备份。' });
        setTimeout(() => onClose(), 1500);
    } catch (e: any) {
        setStatus({ type: 'error', msg: e.message || '坚果云下载失败。' });
    } finally {
        setIsBackupLoading(false);
    }
  };

  // Local & File Handlers
  const handleLocalExport = () => {
    try {
      const dataStr = JSON.stringify(currentData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `SubScript_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatus({ type: 'success', msg: 'Backup file exported.' });
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: 'Export failed.' });
    }
  };

  const handleLocalImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const normalized = normalizeImportedData(json, {
          budgetFallback: currentData.budget,
          aiConfigFallback: aiConfig,
          builtInProxyUrl: aiConfig.proxyUrl || '',
        });

        if (!normalized.hasUsableData) {
          throw new Error('Invalid backup file.');
        }

        setStatus({
          type: 'success',
          msg: normalized.droppedFields.length > 0
            ? `File parsed successfully. Filtered: ${normalized.droppedFields.join(' / ')}`
            : 'File parsed successfully. Restoring now...'
        });
        setTimeout(() => {
          setStatus(null);
          onClose();
          setTimeout(() => onRestore(normalized.data), 300);
        }, 1000);
      } catch (err) {
        setStatus({ type: 'error', msg: err instanceof Error ? err.message : 'File parse failed.' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };
  const handleSaveAIConfig = () => {
      onUpdateAIConfig(localAiConfig);
      setStatus({ type: 'success', msg: 'Configuration saved.' });
      setTimeout(() => setStatus(null), 2000);
  };

  const handleRestoreDefaults = () => {
      setLocalAiConfig(defaultAiConfig);
      setStatus({ type: 'success', msg: 'Model config reset and secrets cleared. Please re-enter them before saving.' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="设置弹窗">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50 sticky top-0 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2 text-main">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">应用设置</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭设置弹窗" className="text-muted hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          
          {/* 1. Cloudflare KV Account */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-blue-500" />
                    <div>
                        <h4 className="text-sm font-bold text-main">专属云账户 (Cloudflare KV)</h4>
                        <p className="text-[10px] text-muted">支持多端同步（推荐）</p>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-border">
                {!userAuth.isLoggedIn ? (
                    <div className="space-y-3">
                        <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-border">
                            <button onClick={() => setAuthMode('login')} className={`flex-1 py-1.5 text-xs font-medium rounded ${authMode === 'login' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-muted'}`}>登录</button>
                            <button onClick={() => setAuthMode('register')} className={`flex-1 py-1.5 text-xs font-medium rounded ${authMode === 'register' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' : 'text-muted'}`}>注册</button>
                        </div>
                        <input 
                            type="text" 
                            placeholder="用户名（至少 3 位）"
                            value={usernameInput}
                            onChange={e => setUsernameInput(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <input 
                            type="password" 
                            placeholder="密码"
                            value={passwordInput}
                            onChange={e => setPasswordInput(e.target.value)}
                            className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button 
                            onClick={handleAuth}
                            disabled={isAuthLoading}
                            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                            {isAuthLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : (authMode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />)}
                            {authMode === 'login' ? '登录' : '注册'}
                        </button>
                        
                        <div className="text-[10px] text-orange-500 flex items-start gap-1 bg-orange-50 dark:bg-orange-900/10 p-2 rounded">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>提示：如果 workers.dev 被屏蔽，请在 Cloudflare 绑定自定义域名后重新部署。</span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-main font-medium">欢迎, {userAuth.username}</span>
                            <button type="button" onClick={handleLogout} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded" title="Log out">
                                <LogOut className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={handleSyncPush} 
                                disabled={isAuthLoading}
                                className="bg-blue-500 text-white py-2 rounded-lg text-xs font-medium hover:bg-blue-600 flex items-center justify-center gap-1 shadow-sm"
                            >
                                <Upload className="w-3 h-3" /> 上传 (KV)
                            </button>
                            <button 
                                onClick={handleSyncPull} 
                                disabled={isAuthLoading}
                                className="bg-surface border border-border text-main py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1"
                            >
                                <Download className="w-3 h-3" /> 下载 (KV)
                            </button>
                        </div>
                        {isAuthLoading && <p className="text-[10px] text-center text-muted animate-pulse">正在同步数据...</p>}
                    </div>
                )}
            </div>
          </div>

          {/* 2. Jianguoyun WebDAV Backup */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Cloud className="w-5 h-5 text-indigo-500" />
                    <div>
                        <h4 className="text-sm font-bold text-main">坚果云 WebDAV 备份</h4>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted">使用坚果云账号 + 应用密码备份</p>
                            <a href="https://help.jianguoyun.com/?p=2064" target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">获取应用密码</a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-border space-y-3">
                <div>
                    <label className="text-xs text-muted mb-1 block">坚果云账号</label>
                    <input 
                        type="text" 
                        value={jianguoyunAccount}
                        onChange={(e) => setJianguoyunAccount(e.target.value)}
                        placeholder="邮箱或手机号"
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                </div>
                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-muted block">应用密码</label>
                        <button
                            type="button"
                            onClick={() => setShowBackupSecret(!showBackupSecret)}
                            className="text-muted hover:text-main"
                        >
                            {showBackupSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                    <input 
                        type={showBackupSecret ? 'text' : 'password'}
                        value={jianguoyunAppPassword}
                        onChange={(e) => setJianguoyunAppPassword(e.target.value)}
                        placeholder="坚果云应用密码"
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                </div>
                <div>
                    <label className="text-xs text-muted mb-1 block">备份文件名</label>
                    <input 
                        type="text" 
                        value={jianguoyunFileName}
                        onChange={(e) => setJianguoyunFileName(e.target.value)}
                        placeholder="subscript_backup.json"
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={handleJianguoyunUpload} 
                        disabled={isBackupLoading}
                        className="bg-indigo-500 text-white py-2 rounded-lg text-xs font-medium hover:bg-indigo-600 flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                    >
                        {isBackupLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} 
                        上传备份
                    </button>
                    <button 
                        onClick={handleJianguoyunDownload} 
                        disabled={isBackupLoading}
                        className="bg-surface border border-border text-main py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        {isBackupLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                        从云端恢复
                    </button>
                </div>
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* 3. AI & 网络配置 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-purple-500" />
                <div>
                    <h4 className="text-sm font-bold text-main">AI & 网络配置</h4>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-4 border border-border">
                {/* Proxy URL */}
                <div className="pb-2">
                     <label className="text-xs font-semibold text-main mb-1 flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5" /> 
                        Cloudflare Worker 地址（必填）
                     </label>
                     <p className="text-[10px] text-muted mb-2 leading-relaxed">
                        这是你的私有服务端点，用于 KV 登录、数据同步和 AI 图像代理。
                     </p>
                     <input 
                        type="text" 
                        value={localAiConfig.proxyUrl || ''}
                        onChange={(e) => setLocalAiConfig({...localAiConfig, proxyUrl: e.target.value})}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                        placeholder="https://your-worker.name.workers.dev"
                     />
                     <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                        提示：如果 workers.dev 被屏蔽，请在 Cloudflare 控制台绑定自定义域名。
                     </p>
                </div>

                <div className="h-px bg-border w-full border-dashed"></div>

                {/* Tabs */}
                <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-border">
                    <button 
                        onClick={() => setActiveAiTab('chat')}
                        className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeAiTab === 'chat' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'text-muted hover:text-main'}`}
                    >
                        <MessageSquareText className="w-3.5 h-3.5" />
                        对话
                    </button>
                    <button 
                         onClick={() => setActiveAiTab('image')}
                         className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeAiTab === 'image' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'text-muted hover:text-main'}`}
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                        绘图
                    </button>
                    <button 
                         onClick={() => setActiveAiTab('ocr')}
                         className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all ${activeAiTab === 'ocr' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300' : 'text-muted hover:text-main'}`}
                    >
                        <ScanLine className="w-3.5 h-3.5" />
                        识图
                    </button>
                </div>

                {activeAiTab === 'chat' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-200">
                         <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">对话配置 (Spark / DeepSeek)</span>
                            <button 
                                onClick={() => setShowChatSecrets(!showChatSecrets)}
                                className="text-muted hover:text-main"
                            >
                                {showChatSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                         </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted mb-1 block">应用 ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.chat.appId}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, appId: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1 block">域名</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.chat.domain}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, domain: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API 密钥</label>
                            <input 
                                type={showChatSecrets ? "text" : "password"}
                                value={localAiConfig.chat.apiSecret}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, apiSecret: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API 密钥</label>
                            <input 
                                type={showChatSecrets ? "text" : "password"}
                                value={localAiConfig.chat.apiKey}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, apiKey: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                    </div>
                )}

                {activeAiTab === 'image' && (
                    <div className="space-y-3 animate-in fade-in duration-200">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">图像生成配置</span>
                            <button 
                                onClick={() => setShowImageSecrets(!showImageSecrets)}
                                className="text-muted hover:text-main"
                            >
                                {showImageSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted mb-1 block">应用 ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.image.appId}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, appId: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1 block">域名</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.image.domain}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, domain: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API 密钥</label>
                            <input 
                                type={showImageSecrets ? "text" : "password"}
                                value={localAiConfig.image.apiSecret}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, apiSecret: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API 密钥</label>
                            <input 
                                type={showImageSecrets ? "text" : "password"}
                                value={localAiConfig.image.apiKey}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, apiKey: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                    </div>
                )}

                {activeAiTab === 'ocr' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-right-2 duration-200">
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-purple-600 dark:text-purple-400">OCR / 识图配置 (Hunyuan)</span>
                                <button 
                                    onClick={() => setLocalAiConfig(prev => ({ ...prev, ocr: defaultAiConfig.ocr }))}
                                    className="text-[10px] bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded border border-purple-100 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                                >
                                    重置模型
                                </button>
                            </div>
                            <button 
                                onClick={() => setShowImageSecrets(!showImageSecrets)}
                                className="text-muted hover:text-main"
                            >
                                {showImageSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted mb-1 block">应用 ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.ocr?.appId || ''}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, ocr: {...(localAiConfig.ocr || {appId:'', apiSecret:'', apiKey:'', domain:''}), appId: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1 block">模型 ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.ocr?.domain || 'xophunyuanocr'}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, ocr: {...(localAiConfig.ocr || {appId:'', apiSecret:'', apiKey:'', domain:''}), domain: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                    placeholder="xophunyuanocr"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API 密钥</label>
                            <input 
                                type={showImageSecrets ? "text" : "password"}
                                value={localAiConfig.ocr?.apiSecret || ''}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, ocr: {...(localAiConfig.ocr || {appId:'', apiSecret:'', apiKey:'', domain:''}), apiSecret: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API 密钥</label>
                            <input 
                                type={showImageSecrets ? "text" : "password"}
                                value={localAiConfig.ocr?.apiKey || ''}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, ocr: {...(localAiConfig.ocr || {appId:'', apiSecret:'', apiKey:'', domain:''}), apiKey: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                    </div>
                )}

                <div className="flex gap-2 mt-2">
                    <button 
                        onClick={handleRestoreDefaults}
                        className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-main py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        恢复默认
                    </button>
                    <button 
                        onClick={handleSaveAIConfig}
                        className="flex-[2] flex items-center justify-center gap-2 bg-purple-500 hover:bg-purple-600 text-white py-2 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-purple-500/20"
                    >
                        <Check className="w-4 h-4" />
                        保存配置
                    </button>
                </div>
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* 4. 本地文件备份 */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <FileJson className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-main">本地文件备份</h4>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={handleLocalExport}
                    className="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-4 rounded-xl transition-all border border-transparent hover:border-border"
                 >
                    <Download className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-medium text-main">导出 JSON</span>
                 </button>

                 <button 
                    onClick={handleLocalImportClick}
                    className="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-4 rounded-xl transition-all border border-transparent hover:border-border"
                 >
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-medium text-main">导入 JSON</span>
                 </button>
                 <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                 />
             </div>
          </div>

          {/* Status Bar */}
          {status && (
              <div className={`text-xs p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 sticky bottom-0 shadow-lg ${
                  status.type === 'error' ? 'bg-red-50 dark:bg-red-900/90 text-red-600 dark:text-red-200 border border-red-200 dark:border-red-800' : 
                  'bg-emerald-50 dark:bg-emerald-900/90 text-emerald-600 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              }`}>
                  {status.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                  <span className="flex-1 font-medium">{status.msg}</span>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
