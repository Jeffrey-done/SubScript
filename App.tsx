

import React, { useState, useEffect } from 'react';
import { Plus, LayoutDashboard, List, Wallet, Moon, Sun, Settings, AlertTriangle } from 'lucide-react';
import { Subscription, Budget, AIConfig } from './types';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import SubscriptionModal from './components/SubscriptionModal';
import SettingsModal from './components/SettingsModal';
import AIAnalysisModal from './components/AIAnalysisModal';

const DEFAULT_BUDGET: Budget = {
  monthly: 2000,
  yearly: 24000,
  baseSalary: 4500, // Default base salary
  commission: 0,    // Default commission
};

const DEFAULT_AI_CONFIG: AIConfig = {
    chat: {
        appId: '1198a631',
        apiSecret: 'ODgwZWEwZWIxMmQ2M2VmNDhiZTBiMzlk',
        apiKey: '7fc4633e7541e7fdc26f295fd10f7b77',
        domain: 'xdeepseekv32'
    },
    image: {
        appId: '1198a631',
        apiSecret: 'ODgwZWEwZWIxMmQ2M2VmNDhiZTBiMzlk',
        apiKey: '7fc4633e7541e7fdc26f295fd10f7b77',
        domain: 'xopzimageturbo'
    },
    proxyUrl: '' // Default empty
};

function App() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    const saved = localStorage.getItem('subscriptions');
    return saved ? JSON.parse(saved) : [];
  });

  const [budget, setBudget] = useState<Budget>(() => {
    const saved = localStorage.getItem('budget');
    // Migration for old data
    const parsed = saved ? JSON.parse(saved) : DEFAULT_BUDGET;
    if (parsed.baseSalary === undefined) parsed.baseSalary = 4500;
    if (parsed.commission === undefined) parsed.commission = 0;
    return parsed;
  });

  // Store rest days as an array of ISO date strings "YYYY-MM-DD"
  const [restDays, setRestDays] = useState<string[]>(() => {
    const saved = localStorage.getItem('restDays');
    return saved ? JSON.parse(saved) : [];
  });
  
  // AI Configuration
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('aiConfig');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: check if it's the old flat structure (has appId at root)
        // @ts-ignore
        if (parsed.appId) {
            return {
                chat: {
                    // @ts-ignore
                    appId: parsed.appId,
                    // @ts-ignore
                    apiSecret: parsed.apiSecret,
                    // @ts-ignore
                    apiKey: parsed.apiKey,
                    // @ts-ignore
                    domain: parsed.domain || 'xdeepseekv32'
                },
                image: DEFAULT_AI_CONFIG.image,
                proxyUrl: ''
            };
        }
        return { ...DEFAULT_AI_CONFIG, ...parsed };
    }
    return DEFAULT_AI_CONFIG;
  });

  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'dark' | 'light') || 'dark';
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'list'>('dashboard');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  
  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Apply theme class to HTML element
  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      // Update meta theme color
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f172a');
    } else {
      root.classList.remove('dark');
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#f1f5f9');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    // Simulate loading data
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    localStorage.setItem('budget', JSON.stringify(budget));
  }, [budget]);

  useEffect(() => {
    localStorage.setItem('restDays', JSON.stringify(restDays));
  }, [restDays]);
  
  useEffect(() => {
    localStorage.setItem('aiConfig', JSON.stringify(aiConfig));
  }, [aiConfig]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const handleSaveSubscription = (subData: Omit<Subscription, 'id'>) => {
    if (editingSub) {
      setSubscriptions(prev => prev.map(sub => 
        sub.id === editingSub.id ? { ...subData, id: sub.id } : sub
      ));
    } else {
      const newSub: Subscription = {
        ...subData,
        id: crypto.randomUUID(),
      };
      setSubscriptions(prev => [...prev, newSub]);
    }
    setEditingSub(undefined);
  };

  const handleEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setIsModalOpen(true);
  };

  const openAddModal = () => {
    setEditingSub(undefined);
    setIsModalOpen(true);
  };

  const handleUpdateBudget = (newBudget: Budget) => {
    setBudget(newBudget);
  };

  const handleToggleRestDay = (dateStr: string) => {
    setRestDays(prev => {
      if (prev.includes(dateStr)) {
        return prev.filter(d => d !== dateStr);
      } else {
        return [...prev, dateStr];
      }
    });
  };

  const handleDataRestore = (data: { subscriptions: Subscription[]; budget: Budget; restDays?: string[] }) => {
    // Basic validation
    if (Array.isArray(data.subscriptions)) {
      setIsLoading(true);
      setTimeout(() => {
        setSubscriptions(data.subscriptions);
        if (data.budget) setBudget(data.budget);
        if (Array.isArray(data.restDays)) setRestDays(data.restDays);
        setIsLoading(false);
      }, 1000); // 1 second delay for visual feedback
    } else {
      console.error('Invalid data format received during restore');
    }
  };

  // --- Delete Logic with Custom Modal ---
  const requestDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const executeDelete = () => {
    if (deleteConfirmId) {
      setSubscriptions(prev => prev.filter(sub => sub.id !== deleteConfirmId));
      setDeleteConfirmId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background text-main transition-colors duration-300 font-sans flex flex-col md:flex-row h-screen overflow-hidden">
      
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-surface border-r border-border p-6 shrink-0 h-full relative z-20">
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-indigo-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">SubScript</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'dashboard' 
                ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                : 'text-muted hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-main'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400 group-hover:text-main'}`} />
            <span className="font-medium">概览仪表盘</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('list')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              activeTab === 'list' 
                ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                : 'text-muted hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-main'
            }`}
          >
            <div className="relative">
                <List className={`w-5 h-5 ${activeTab === 'list' ? 'text-white' : 'text-slate-400 group-hover:text-main'}`} />
                {subscriptions.length > 0 && activeTab !== 'list' && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-surface"></span>
                )}
            </div>
            <span className="font-medium">订阅列表</span>
            <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-md ${
                activeTab === 'list' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-muted'
            }`}>
                {subscriptions.length}
            </span>
          </button>
        </nav>

        <div className="pt-6 border-t border-border space-y-3">
          <button 
             onClick={() => setIsSettingsOpen(true)}
             className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-muted hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-main transition-all"
          >
             <Settings className="w-5 h-5" />
             <span className="font-medium text-sm">设置与备份</span>
          </button>
          <button 
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-muted hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-main transition-all"
          >
            {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            <span className="font-medium text-sm">{theme === 'dark' ? '深色模式' : '浅色模式'}</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden bg-surface/80 backdrop-blur-md border-b border-border p-4 flex justify-between items-center shrink-0 sticky top-0 z-30">
           <div className="flex items-center gap-2">
             <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-700 rounded-lg flex items-center justify-center">
                <Wallet className="w-5 h-5 text-white" />
             </div>
             <span className="font-bold text-lg">SubScript</span>
           </div>
           <div className="flex items-center gap-3">
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="p-2 text-muted hover:text-main bg-background rounded-full border border-border"
              >
                <Settings className="w-5 h-5" />
              </button>
              <button 
                onClick={toggleTheme}
                className="p-2 text-muted hover:text-main bg-background rounded-full border border-border"
              >
                {theme === 'dark' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
           </div>
        </header>

        {/* Scrollable Area */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8 scroll-smooth" id="scroll-container">
          <div className="max-w-5xl mx-auto w-full">
            {activeTab === 'dashboard' ? (
              <Dashboard 
                subscriptions={subscriptions} 
                budget={budget}
                onUpdateBudget={handleUpdateBudget}
                restDays={restDays}
                onToggleRestDay={handleToggleRestDay}
                onOpenAI={() => setIsAIModalOpen(true)}
              />
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold text-main">订阅列表</h2>
                  <button 
                    onClick={openAddModal}
                    className="md:hidden flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-sm font-medium shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-4 h-4" /> 新增
                  </button>
                  <button 
                    onClick={openAddModal}
                    className="hidden md:flex items-center gap-2 px-4 py-2 bg-primary hover:bg-indigo-600 text-white rounded-xl font-medium transition-all shadow-lg shadow-primary/20"
                  >
                    <Plus className="w-5 h-5" /> 添加订阅
                  </button>
                </div>
                <SubscriptionList 
                  subscriptions={subscriptions} 
                  onDelete={requestDelete} 
                  onEdit={handleEdit}
                  isLoading={isLoading}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-border px-6 pb-safe pt-2 z-40 h-[calc(60px+env(safe-area-inset-bottom))]">
        <div className="flex justify-between items-end h-full pb-3">
           <button 
             onClick={() => setActiveTab('dashboard')}
             className={`flex flex-col items-center gap-1 w-16 transition-colors ${activeTab === 'dashboard' ? 'text-primary' : 'text-muted'}`}
           >
             <LayoutDashboard className="w-6 h-6" />
             <span className="text-[10px] font-medium">概览</span>
           </button>

           <div className="relative -top-5">
             <button 
               onClick={openAddModal}
               className="w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-xl shadow-primary/30 border-4 border-background active:scale-95 transition-transform"
             >
               <Plus className="w-7 h-7" />
             </button>
           </div>

           <button 
             onClick={() => setActiveTab('list')}
             className={`flex flex-col items-center gap-1 w-16 transition-colors ${activeTab === 'list' ? 'text-primary' : 'text-muted'}`}
           >
             <div className="relative">
               <List className="w-6 h-6" />
               {subscriptions.length > 0 && activeTab !== 'list' && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 border-2 border-surface rounded-full"></span>
               )}
             </div>
             <span className="text-[10px] font-medium">列表</span>
           </button>
        </div>
      </nav>

      {/* Modals */}
      <SubscriptionModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSubscription}
        initialData={editingSub}
        aiConfig={aiConfig}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentData={{ subscriptions, budget, restDays }}
        onRestore={handleDataRestore}
        aiConfig={aiConfig}
        onUpdateAIConfig={setAiConfig}
      />
      
      <AIAnalysisModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        subscriptions={subscriptions}
        budget={budget}
        aiConfig={aiConfig}
      />

      {/* Delete Confirmation Modal - Custom Implementation to bypass browser blocking */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl p-6 transform scale-100 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-main">确认删除?</h3>
                <p className="text-sm text-muted mt-2">
                  此操作无法撤销。该订阅将从您的列表中永久移除。
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full mt-2">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="w-full py-2.5 rounded-xl border border-border text-main hover:bg-slate-100 dark:hover:bg-slate-800 font-medium transition-colors active:bg-slate-200"
                >
                  取消
                </button>
                <button 
                  onClick={executeDelete}
                  className="w-full py-2.5 rounded-xl bg-red-500 hover:bg-red-600 active:bg-red-700 text-white font-medium shadow-lg shadow-red-500/20 transition-colors"
                >
                  删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;