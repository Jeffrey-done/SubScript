import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Plus, LayoutDashboard, List, Moon, Sun, Settings, ReceiptText } from 'lucide-react';
import { Subscription, Budget, AIConfig, AIModelConfig, Transaction } from './types';
import { AppData } from './services/cloudService';
import { normalizeImportedData } from './services/dataValidation';
import { advanceBillingDate, formatDateOnly } from './utils';
import ConfirmDialog from './components/ConfirmDialog';

const Dashboard = lazy(() => import('./components/Dashboard'));
const SubscriptionList = lazy(() => import('./components/SubscriptionList'));
const SubscriptionModal = lazy(() => import('./components/SubscriptionModal'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const AIAnalysisModal = lazy(() => import('./components/AIAnalysisModal'));
const BookkeepingList = lazy(() => import('./components/BookkeepingList'));
const TransactionModal = lazy(() => import('./components/TransactionModal'));
const RenewModal = lazy(() => import('./components/RenewModal'));

const LoadingPanel = ({ label = '加载中...' }: { label?: string }) => (
  <div className="min-h-[40vh] rounded-2xl border border-border bg-surface/70 flex items-center justify-center">
    <div className="flex items-center gap-3 text-muted">
      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  </div>
);

const LoadingModal = ({ label = '加载中...' }: { label?: string }) => (
  <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
    <div className="rounded-2xl border border-border bg-surface px-5 py-4 shadow-2xl flex items-center gap-3 text-muted">
      <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  </div>
);

// Built-in Worker URL from environment variables (set in Cloudflare Pages/Vercel).
const BUILT_IN_PROXY_URL = import.meta.env.VITE_WORKER_URL || '';

const DEFAULT_BUDGET: Budget = {
  monthly: 0,
  yearly: 0,
  baseSalary: 0,
  commission: 0,
  payday: 0,
  salaryDelay: 0,
  workMode: 'single',
};

const createEmptyModelConfig = (domain: string): AIModelConfig => ({
    appId: '',
    apiSecret: '',
    apiKey: '',
    domain
});

const DEFAULT_AI_CONFIG: AIConfig = {
    chat: createEmptyModelConfig('xdeepseekv32'),
    image: createEmptyModelConfig('xopzimageturbo'),
    ocr: createEmptyModelConfig('xophunyuanocr'),
    proxyUrl: BUILT_IN_PROXY_URL
};

const hasOwn = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (source: Record<string, unknown>, key: string, fallback = '') =>
  typeof source[key] === 'string' ? source[key] as string : fallback;

const getNumber = (source: Record<string, unknown>, key: string, fallback: number) =>
  typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] as number : fallback;

const normalizeList = <T,>(value: unknown): T[] => Array.isArray(value) ? value as T[] : [];

const normalizeSubscriptionRecord = (value: Subscription): Subscription => ({
  ...value,
  startDate: formatDateOnly(value.startDate || new Date()),
});

const normalizeTransactionRecord = (value: Transaction): Transaction => ({
  ...value,
  date: formatDateOnly(value.date || new Date().toISOString().slice(0, 10)),
});

const normalizeBudget = (value: unknown): Budget => {
  const source = isRecord(value) ? value : {};
  return {
    monthly: getNumber(source, 'monthly', DEFAULT_BUDGET.monthly),
    yearly: getNumber(source, 'yearly', DEFAULT_BUDGET.yearly),
    baseSalary: getNumber(source, 'baseSalary', DEFAULT_BUDGET.baseSalary),
    commission: getNumber(source, 'commission', DEFAULT_BUDGET.commission),
    payday: getNumber(source, 'payday', DEFAULT_BUDGET.payday),
    salaryDelay: getNumber(source, 'salaryDelay', DEFAULT_BUDGET.salaryDelay),
    workMode: source.workMode === 'double' ? 'double' : 'single',
  };
};

const normalizeModelConfig = (value: unknown, fallback: AIModelConfig): AIModelConfig => {
  const source = isRecord(value) ? value : {};
  return {
    appId: getString(source, 'appId', fallback.appId),
    apiSecret: getString(source, 'apiSecret', fallback.apiSecret),
    apiKey: getString(source, 'apiKey', fallback.apiKey),
    domain: getString(source, 'domain', fallback.domain),
  };
};

const normalizeAIConfig = (value: unknown): AIConfig => {
  const source = isRecord(value) ? value : {};

  // Migrate older single-model config shape: { appId, apiSecret, apiKey, domain }.
  if (typeof source.appId === 'string') {
    return {
      chat: normalizeModelConfig(source, DEFAULT_AI_CONFIG.chat),
      image: DEFAULT_AI_CONFIG.image,
      ocr: DEFAULT_AI_CONFIG.ocr,
      proxyUrl: BUILT_IN_PROXY_URL,
    };
  }

  const config: AIConfig = {
    chat: normalizeModelConfig(source.chat, DEFAULT_AI_CONFIG.chat),
    image: normalizeModelConfig(source.image, DEFAULT_AI_CONFIG.image),
    ocr: normalizeModelConfig(source.ocr, DEFAULT_AI_CONFIG.ocr),
    proxyUrl: getString(source, 'proxyUrl', BUILT_IN_PROXY_URL),
  };

  if (!config.proxyUrl && BUILT_IN_PROXY_URL) {
    config.proxyUrl = BUILT_IN_PROXY_URL;
  }

  const hasBundledDefaultShape =
    config.chat.appId &&
    config.chat.appId === config.image.appId &&
    config.chat.appId === config.ocr.appId &&
    config.chat.apiSecret === config.image.apiSecret &&
    config.chat.apiSecret === config.ocr.apiSecret &&
    config.chat.apiKey === config.image.apiKey &&
    config.chat.apiKey === config.ocr.apiKey &&
    config.chat.domain === DEFAULT_AI_CONFIG.chat.domain &&
    config.image.domain === DEFAULT_AI_CONFIG.image.domain &&
    config.ocr.domain === DEFAULT_AI_CONFIG.ocr.domain;

  if (hasBundledDefaultShape) {
    return { ...DEFAULT_AI_CONFIG, proxyUrl: config.proxyUrl };
  }

  return config;
};

const loadJson = <T,>(key: string, normalize: (value: unknown) => T): T => {
  const saved = localStorage.getItem(key);
  if (!saved) return normalize(undefined);

  try {
    return normalize(JSON.parse(saved));
  } catch (error) {
    console.warn(`Failed to parse localStorage item "${key}". Falling back to defaults.`, error);
    return normalize(undefined);
  }
};

function App() {
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => {
    return loadJson('subscriptions', (value) => normalizeList<Subscription>(value).map(normalizeSubscriptionRecord));
  });

  const [budget, setBudget] = useState<Budget>(() => {
    return loadJson('budget', normalizeBudget);
  });

  // Store rest days as an array of ISO date strings "YYYY-MM-DD"
  const [restDays, setRestDays] = useState<string[]>(() => {
    return loadJson('restDays', normalizeList<string>);
  });
  
  // AI Configuration
  const [aiConfig, setAiConfig] = useState<AIConfig>(() => {
    return loadJson('aiConfig', normalizeAIConfig);
  });

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return loadJson('transactions', (value) => normalizeList<Transaction>(value).map(normalizeTransactionRecord));
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);
  const [renewingSub, setRenewingSub] = useState<Subscription | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);
  const [deletePrompt, setDeletePrompt] = useState<{ kind: 'subscription' | 'transaction'; id: string; label: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'subscriptions' | 'bookkeeping'>('dashboard');
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
    }
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

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

  useEffect(() => {
    localStorage.setItem('transactions', JSON.stringify(transactions));
  }, [transactions]);

  const handleAddSubscription = (subData: Omit<Subscription, 'id'>) => {
    if (editingSub) {
      setSubscriptions(subs => subs.map(s => s.id === editingSub.id ? { ...subData, id: editingSub.id } : s));
    } else {
      const newSub: Subscription = { ...subData, id: crypto.randomUUID() };
      setSubscriptions([...subscriptions, newSub]);
    }
    setEditingSub(undefined);
  };

  const handleDeleteSubscription = (id: string) => {
    const target = subscriptions.find(sub => sub.id === id);
    setDeletePrompt({
      kind: 'subscription',
      id,
      label: target?.name || '这条订阅'
    });
  };
  const handleEditSubscription = (sub: Subscription) => {
    setEditingSub(sub);
    setIsSubModalOpen(true);
  };

  const handleOpenRenewModal = (sub: Subscription) => {
    setRenewingSub(sub);
    setIsRenewModalOpen(true);
  };

  const handleConfirmRenew = (price: number, date: string) => {
    if (!renewingSub) return;

    // 1. Create a Transaction record
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      amount: price,
      date: date,
      category: 'other', // Default fallback
      description: `${renewingSub.name} 缁垂`,
      type: 'expense',
      source: 'renewal'
    };

    // Attempt to map subscription category to transaction category loosely
    const mapCat: Record<string, string> = {
      'entertainment': 'entertainment',
      'utilities': 'housing',
      'software': 'shopping',
      'insurance': 'medical',
      'other': 'other'
    };
    if (mapCat[renewingSub.category]) {
      newTransaction.category = mapCat[renewingSub.category];
    }
    
    setTransactions(prev => [...prev, newTransaction]);

    // 2. Update Subscription Start Date to the *Next* Billing Date
    // This effectively pushes the subscription forward by one cycle
    const nextCycleDate = advanceBillingDate(renewingSub.startDate, renewingSub.cycle);
    
    const updatedSub = {
      ...renewingSub,
      startDate: formatDateOnly(nextCycleDate)
    };
    
    setSubscriptions(prev => prev.map(s => s.id === renewingSub.id ? updatedSub : s));
    setRenewingSub(null);
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

  const handleRestoreData = (data: Partial<AppData>) => {
      const normalized = normalizeImportedData(data, {
        budgetFallback: DEFAULT_BUDGET,
        aiConfigFallback: DEFAULT_AI_CONFIG,
        builtInProxyUrl: BUILT_IN_PROXY_URL,
      }).data;

      if (normalized.subscriptions) setSubscriptions(normalized.subscriptions.map(normalizeSubscriptionRecord));
      if (normalized.budget) setBudget(normalized.budget);
      if (normalized.restDays) setRestDays(normalized.restDays);
      if (normalized.aiConfig) setAiConfig(normalized.aiConfig);
      if (normalized.transactions) setTransactions(normalized.transactions.map(normalizeTransactionRecord));
  };

  // Transaction Handlers
  const handleSaveTransaction = (tData: Omit<Transaction, 'id'>) => {
      if (editingTransaction) {
          setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...editingTransaction, ...tData, id: editingTransaction.id } : t));
      } else {
          const newT: Transaction = { ...tData, id: crypto.randomUUID() };
          setTransactions(prev => [...prev, newT]);
      }
      setEditingTransaction(undefined);
  };

  const handleDeleteTransaction = (id: string) => {
      const target = transactions.find(t => t.id === id);
      setDeletePrompt({
        kind: 'transaction',
        id,
        label: target?.description || target?.category || '这条记录'
      });
  };

  const confirmDelete = () => {
      if (!deletePrompt) return;
      if (deletePrompt.kind === 'subscription') {
        setSubscriptions(prev => prev.filter(s => s.id !== deletePrompt.id));
      } else {
        setTransactions(prev => prev.filter(t => t.id !== deletePrompt.id));
      }
      setDeletePrompt(null);
  };
  const handleEditTransaction = (t: Transaction) => {
      setEditingTransaction(t);
      setIsTransactionModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background transition-colors selection:bg-primary/20 flex flex-col">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border shrink-0">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img 
                src="https://img.cdn1.vip/i/693be76cac073_1765533548.webp" 
                alt="Logo" 
                className="w-9 h-9 rounded-xl shadow-lg shadow-primary/20 object-cover" 
            />
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-indigo-600 bg-clip-text text-transparent truncate">
              SubScript
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
             <div className="hidden md:flex bg-surface p-1 rounded-lg border border-border mr-2">
                <button 
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main'}`}
                >
                    <LayoutDashboard className="w-4 h-4" /> 总览
                </button>
                <button 
                    onClick={() => setActiveTab('subscriptions')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'subscriptions' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main'}`}
                >
                    <List className="w-4 h-4" /> 订阅
                </button>
                <button 
                    onClick={() => setActiveTab('bookkeeping')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'bookkeeping' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-main'}`}
                >
                    <ReceiptText className="w-4 h-4" /> 记账
                </button>
             </div>

            <button 
              onClick={() => setDarkMode(!darkMode)}
              aria-label={darkMode ? '切换到浅色模式' : '切换到深色模式'}
              className="p-2.5 rounded-xl hover:bg-surface text-muted hover:text-main transition-all active:scale-95"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              aria-label="打开设置"
              className="p-2.5 rounded-xl hover:bg-surface text-muted hover:text-main transition-all active:scale-95"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content with correct padding to avoid overlap with bottom nav */}
      <Suspense fallback={<main className="max-w-5xl mx-auto p-4 md:p-6 flex-1 w-full pb-24 md:pb-6 overflow-x-hidden"><LoadingPanel label="正在加载主界面..." /></main>}>
        <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6 flex-1 w-full pb-24 md:pb-6 overflow-x-hidden">
          {activeTab === 'dashboard' && (
            <Dashboard 
              subscriptions={subscriptions} 
              budget={budget} 
              onUpdateBudget={setBudget}
              restDays={restDays}
              onToggleRestDay={handleToggleRestDay}
              onOpenAI={() => setIsAiModalOpen(true)}
              transactions={transactions}
            />
          )}
          
          {activeTab === 'subscriptions' && (
            <SubscriptionList 
              subscriptions={subscriptions}
              onDelete={handleDeleteSubscription}
              onEdit={handleEditSubscription}
              onRenew={handleOpenRenewModal}
            />
          )}

          {activeTab === 'bookkeeping' && (
              <BookkeepingList 
                  transactions={transactions}
                  onDelete={handleDeleteTransaction}
                  onEdit={handleEditTransaction}
              />
          )}
        </main>
      </Suspense>

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-border z-40 pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${activeTab === 'dashboard' ? 'text-primary' : 'text-muted'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">总览</span>
          </button>
          <button 
            onClick={() => setActiveTab('subscriptions')}
            className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${activeTab === 'subscriptions' ? 'text-primary' : 'text-muted'}`}
          >
            <List className="w-5 h-5" />
            <span className="text-[10px] font-medium">订阅</span>
          </button>
          <button 
            onClick={() => setActiveTab('bookkeeping')}
            className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${activeTab === 'bookkeeping' ? 'text-primary' : 'text-muted'}`}
          >
            <ReceiptText className="w-5 h-5" />
            <span className="text-[10px] font-medium">记账</span>
          </button>
        </div>
      </nav>

      {/* Floating Action Button */}
      <button
        onClick={() => {
            if (activeTab === 'bookkeeping') {
                setEditingTransaction(undefined);
                setIsTransactionModalOpen(true);
            } else {
                setEditingSub(undefined);
                setIsSubModalOpen(true);
            }
        }}
        aria-label={activeTab === 'bookkeeping' ? '新增记账' : '新增订阅'}
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary hover:bg-indigo-600 text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      <Suspense fallback={<LoadingModal />}>
        <SubscriptionModal
          isOpen={isSubModalOpen}
          onClose={() => setIsSubModalOpen(false)}
          onSave={handleAddSubscription}
          initialData={editingSub}
          aiConfig={aiConfig}
        />

        <RenewModal
          isOpen={isRenewModalOpen}
          onClose={() => setIsRenewModalOpen(false)}
          onConfirm={handleConfirmRenew}
          subscription={renewingSub}
        />

        <TransactionModal
          isOpen={isTransactionModalOpen}
          onClose={() => setIsTransactionModalOpen(false)}
          onSave={handleSaveTransaction}
          initialData={editingTransaction}
          aiConfig={aiConfig}
        />

        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          currentData={{ subscriptions, budget, restDays, aiConfig, transactions }}
          onRestore={handleRestoreData}
          aiConfig={aiConfig}
          onUpdateAIConfig={setAiConfig}
          defaultAiConfig={DEFAULT_AI_CONFIG}
        />

        <AIAnalysisModal
          isOpen={isAiModalOpen}
          onClose={() => setIsAiModalOpen(false)}
          subscriptions={subscriptions}
          budget={budget}
          aiConfig={aiConfig}
          transactions={transactions}
        />
      </Suspense>

      <ConfirmDialog
        isOpen={deletePrompt !== null}
        title={deletePrompt?.kind === 'subscription' ? '删除订阅' : '删除记录'}
        message={deletePrompt ? `确认删除“${deletePrompt.label}”吗？此操作无法撤销。` : ''}
        confirmLabel="删除"
        onConfirm={confirmDelete}
        onCancel={() => setDeletePrompt(null)}
      />
    </div>
  );
}

export default App;
