import React, { useRef, useState, useEffect } from 'react';
import { X, Settings, Download, Upload, FileJson, Check, AlertCircle, Cloud, Bot, Eye, EyeOff, MessageSquareText, Image as ImageIcon, Globe, LogIn, UserPlus, RefreshCw, LogOut, Database, AlertTriangle, ScanLine } from 'lucide-react';
import { Subscription, Budget, AIConfig, Transaction, UserAuth } from '../types';
import { cloudService, AppData } from '../services/cloudService';
import { pantryService } from '../services/pantryService';

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

  // Pantry State
  const [pantryId, setPantryId] = useState('');
  const [isPantryLoading, setIsPantryLoading] = useState(false);

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
    
    // Load Pantry ID
    const savedPantryId = localStorage.getItem('pantry_id');
    if (savedPantryId) setPantryId(savedPantryId);

    if (isOpen) {
        setLocalAiConfig(aiConfig);
    }
  }, [isOpen, aiConfig]);

  // --- Cloudflare KV Auth Handlers ---
  const handleAuth = async () => {
      if (!usernameInput || !passwordInput) {
          setStatus({ type: 'error', msg: '请输入用户名和密码' });
          return;
      }
      
      const proxyUrl = localAiConfig.proxyUrl || '';
      if (!proxyUrl) {
          setStatus({ type: 'error', msg: '请先在下方的“AI & 网络配置”中填写 Proxy URL (即 Worker 地址)' });
          return;
      }

      setIsAuthLoading(true);
      setStatus(null);

      try {
          if (authMode === 'register') {
              const res = await cloudService.register(proxyUrl, usernameInput, passwordInput);
              if (res.success) {
                  setStatus({ type: 'success', msg: '注册成功！请直接登录。' });
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
                  setStatus({ type: 'success', msg: '登录成功！' });
                  setUsernameInput('');
                  setPasswordInput('');
              } else {
                  throw new Error(res.error);
              }
          }
      } catch (e: any) {
          setStatus({ type: 'error', msg: e.message || '操作失败，请检查 Proxy URL' });
      } finally {
          setIsAuthLoading(false);
      }
  };

  const handleLogout = () => {
      localStorage.removeItem('cf_token');
      localStorage.removeItem('cf_username');
      setUserAuth({ username: '', token: '', isLoggedIn: false });
      setStatus({ type: 'success', msg: '已退出登录' });
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
              setStatus({ type: 'success', msg: '数据已同步到 Cloudflare KV！' });
          } else {
              throw new Error(res.error);
          }
      } catch (e: any) {
          setStatus({ type: 'error', msg: '同步失败: ' + e.message });
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
              setStatus({ type: 'success', msg: '已从 Cloudflare KV 恢复数据！' });
              setTimeout(() => onClose(), 1500);
          } else {
              throw new Error(res.error || '云端暂无数据');
          }
      } catch (e: any) {
          setStatus({ type: 'error', msg: '拉取失败: ' + e.message });
      } finally {
          setIsAuthLoading(false);
      }
  };

  // --- Pantry Cloud Handlers ---
  const handlePantryUpload = async () => {
    if (!pantryId) {
        setStatus({ type: 'error', msg: '请输入 Pantry ID' });
        return;
    }
    localStorage.setItem('pantry_id', pantryId);
    setIsPantryLoading(true);
    try {
        await pantryService.uploadBackup(pantryId, currentData);
        setStatus({ type: 'success', msg: '备份已上传到 Pantry Cloud' });
    } catch (e: any) {
        setStatus({ type: 'error', msg: e.message || 'Pantry 上传失败' });
    } finally {
        setIsPantryLoading(false);
    }
  };

  const handlePantryDownload = async () => {
    if (!pantryId) {
        setStatus({ type: 'error', msg: '请输入 Pantry ID' });
        return;
    }
    localStorage.setItem('pantry_id', pantryId);
    setIsPantryLoading(true);
    try {
        const data = await pantryService.downloadBackup(pantryId);
        // @ts-ignore
        onRestore(data);
        setStatus({ type: 'success', msg: '已从 Pantry Cloud 恢复备份' });
        setTimeout(() => onClose(), 1500);
    } catch (e: any) {
        setStatus({ type: 'error', msg: e.message || 'Pantry 下载失败' });
    } finally {
        setIsPantryLoading(false);
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
      
      setStatus({ type: 'success', msg: '备份文件已导出' });
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: '导出失败' });
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
        if (json && (Array.isArray(json.subscriptions) || json.budget)) {
          setStatus({ type: 'success', msg: `文件解析成功！正在恢复...` });
          setTimeout(() => {
            setStatus(null);
            onClose();
            setTimeout(() => onRestore(json), 300);
          }, 1000);
        } else {
          throw new Error('无效的备份文件');
        }
      } catch (err) {
        setStatus({ type: 'error', msg: '文件解析失败' });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSaveAIConfig = () => {
      onUpdateAIConfig(localAiConfig);
      setStatus({ type: 'success', msg: '配置已保存' });
      setTimeout(() => setStatus(null), 2000);
  };

  const handleRestoreDefaults = () => {
      setLocalAiConfig(defaultAiConfig);
      setStatus({ type: 'success', msg: '已加载默认 AI 配置，请点击“保存配置”以生效' });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50 sticky top-0 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2 text-main">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">应用设置</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
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
                        <h4 className="text-sm font-bold text-main">专属云账号 (Cloudflare KV)</h4>
                        <p className="text-[10px] text-muted">支持多端同步 (推荐)</p>
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
                            placeholder="用户名 (至少3位)"
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
                            {authMode === 'login' ? '登录账号' : '注册新账号'}
                        </button>
                        
                        {/* Domestic Warning */}
                        <div className="text-[10px] text-orange-500 flex items-start gap-1 bg-orange-50 dark:bg-orange-900/10 p-2 rounded">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>
                                注意：若点击无反应或报错，可能是 <b>workers.dev</b> 域名被墙。请确保在 Cloudflare 后台绑定的<b>自定义域名</b>已生效，并已重新部署 Pages。
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-main font-medium">欢迎, {userAuth.username}</span>
                            <button onClick={handleLogout} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 p-1.5 rounded" title="退出"><LogOut className="w-4 h-4" /></button>
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

          {/* 2. Pantry Cloud Backup (Restored) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-500" />
                    <div>
                        <h4 className="text-sm font-bold text-main">Pantry Cloud (免费备份)</h4>
                        <div className="flex items-center gap-2">
                            <p className="text-[10px] text-muted">无需注册，使用 ID 备份</p>
                            <a href="https://pantry.cloud/" target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-500 hover:underline">获取 ID</a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-border space-y-3">
                <div>
                    <label className="text-xs text-muted mb-1 block">Your Pantry ID</label>
                    <input 
                        type="text" 
                        value={pantryId}
                        onChange={(e) => setPantryId(e.target.value)}
                        placeholder="例如: 9471f008-..."
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={handlePantryUpload} 
                        disabled={isPantryLoading}
                        className="bg-indigo-500 text-white py-2 rounded-lg text-xs font-medium hover:bg-indigo-600 flex items-center justify-center gap-1 shadow-sm disabled:opacity-50"
                    >
                        {isPantryLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />} 
                        上传备份
                    </button>
                    <button 
                        onClick={handlePantryDownload} 
                        disabled={isPantryLoading}
                        className="bg-surface border border-border text-main py-2 rounded-lg text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1 disabled:opacity-50"
                    >
                        {isPantryLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
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
                        Cloudflare Worker 地址 (必填)
                     </label>
                     <p className="text-[10px] text-muted mb-2 leading-relaxed">
                        这是您的私有服务器地址，用于 <b>KV 账号登录、数据同步</b> 以及 AI 绘图代理。
                     </p>
                     <input 
                        type="text" 
                        value={localAiConfig.proxyUrl || ''}
                        onChange={(e) => setLocalAiConfig({...localAiConfig, proxyUrl: e.target.value})}
                        className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                        placeholder="https://your-worker.name.workers.dev"
                     />
                     <p className="text-[10px] text-muted mt-1 flex items-center gap-1">
                        提示: 如果该地址以 workers.dev 结尾且在国内无法访问，请在 CF 后台绑定自定义域名。
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
                                <label className="text-xs text-muted mb-1 block">App ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.chat.appId}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, appId: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1 block">Domain</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.chat.domain}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, domain: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API Secret</label>
                            <input 
                                type={showChatSecrets ? "text" : "password"}
                                value={localAiConfig.chat.apiSecret}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, chat: {...localAiConfig.chat, apiSecret: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API Key</label>
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
                            <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Image Generation 配置</span>
                            <button 
                                onClick={() => setShowImageSecrets(!showImageSecrets)}
                                className="text-muted hover:text-main"
                            >
                                {showImageSecrets ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                        </div>
                         <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs text-muted mb-1 block">App ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.image.appId}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, appId: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1 block">Domain</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.image.domain}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, domain: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API Secret</label>
                            <input 
                                type={showImageSecrets ? "text" : "password"}
                                value={localAiConfig.image.apiSecret}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, image: {...localAiConfig.image, apiSecret: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API Key</label>
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
                                    恢复默认
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
                                <label className="text-xs text-muted mb-1 block">App ID</label>
                                <input 
                                    type="text" 
                                    value={localAiConfig.ocr?.appId || ''}
                                    onChange={(e) => setLocalAiConfig({...localAiConfig, ocr: {...(localAiConfig.ocr || {appId:'', apiSecret:'', apiKey:'', domain:''}), appId: e.target.value}})}
                                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-muted mb-1 block">Model ID</label>
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
                            <label className="text-xs text-muted mb-1 block">API Secret</label>
                            <input 
                                type={showImageSecrets ? "text" : "password"}
                                value={localAiConfig.ocr?.apiSecret || ''}
                                onChange={(e) => setLocalAiConfig({...localAiConfig, ocr: {...(localAiConfig.ocr || {appId:'', apiSecret:'', apiKey:'', domain:''}), apiSecret: e.target.value}})}
                                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-purple-500 outline-none font-mono"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-muted mb-1 block">API Key</label>
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