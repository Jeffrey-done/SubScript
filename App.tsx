import React, { useState, useEffect } from 'react';
import { Plus, LayoutDashboard, List, Wallet, Moon, Sun, Settings, ReceiptText } from 'lucide-react';
import { Subscription, Budget, AIConfig, Transaction } from './types';
import Dashboard from './components/Dashboard';
import SubscriptionList from './components/SubscriptionList';
import SubscriptionModal from './components/SubscriptionModal';
import SettingsModal from './components/SettingsModal';
import AIAnalysisModal from './components/AIAnalysisModal';
import BookkeepingList from './components/BookkeepingList';
import TransactionModal from './components/TransactionModal';

const DEFAULT_BUDGET: Budget = {
  monthly: 2000,
  yearly: 24000,
  baseSalary: 4500, // Default base salary
  commission: 0,    // Default commission
  payday: 15,       // Default payday
  salaryDelay: 0,   // Default: current month payment
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
    if (parsed.payday === undefined) parsed.payday = 15;
    if (parsed.salaryDelay === undefined) parsed.salaryDelay = 0;
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

  // Transactions State
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  
  const [editingSub, setEditingSub] = useState<Subscription | undefined>(undefined);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);

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
    if (confirm('确定要删除这个订阅吗？')) {
      setSubscriptions(subs => subs.filter(s => s.id !== id));
    }
  };

  const handleEditSubscription = (sub: Subscription) => {
    setEditingSub(sub);
    setIsSubModalOpen(true);
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

  const handleRestoreData = (data: { subscriptions: Subscription[]; budget: Budget; restDays?: string[]; aiConfig?: AIConfig; transactions?: Transaction[] }) => {
      if (data.subscriptions) setSubscriptions(data.subscriptions);
      if (data.budget) setBudget(data.budget);
      if (data.restDays) setRestDays(data.restDays);
      if (data.aiConfig) setAiConfig(data.aiConfig);
      if (data.transactions) setTransactions(data.transactions);
  };

  // Transaction Handlers
  const handleSaveTransaction = (tData: Omit<Transaction, 'id'>) => {
      if (editingTransaction) {
          setTransactions(prev => prev.map(t => t.id === editingTransaction.id ? { ...tData, id: editingTransaction.id } : t));
      } else {
          const newT: Transaction = { ...tData, id: crypto.randomUUID() };
          setTransactions(prev => [...prev, newT]);
      }
      setEditingTransaction(undefined);
  };

  const handleDeleteTransaction = (id: string) => {
      if (confirm('确定要删除这条记录吗？')) {
          setTransactions(prev => prev.filter(t => t.id !== id));
      }
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
            <div className="bg-primary p-2 rounded-xl shadow-lg shadow-primary/20">
                <Wallet className="w-5 h-5 text-white" />
            </div>
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
                    <LayoutDashboard className="w-4 h-4" /> 概览
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
              className="p-2.5 rounded-xl hover:bg-surface text-muted hover:text-main transition-all active:scale-95"
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className="p-2.5 rounded-xl hover:bg-surface text-muted hover:text-main transition-all active:scale-95"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content with correct padding to avoid overlap with bottom nav */}
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

      {/* Mobile Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-lg border-t border-border z-40 pb-safe shadow-[0_-5px_10px_rgba(0,0,0,0.05)]">
        <div className="flex justify-around items-center h-16">
          <button 
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center gap-1 w-full h-full justify-center transition-colors ${activeTab === 'dashboard' ? 'text-primary' : 'text-muted'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-[10px] font-medium">概览</span>
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
        className="fixed bottom-20 md:bottom-8 right-4 md:right-8 w-14 h-14 bg-primary hover:bg-indigo-600 text-white rounded-full shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 z-40"
      >
        <Plus className="w-7 h-7" />
      </button>

      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        onSave={handleAddSubscription}
        initialData={editingSub}
        aiConfig={aiConfig}
      />

      <TransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => setIsTransactionModalOpen(false)}
        onSave={handleSaveTransaction}
        initialData={editingTransaction}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentData={{ subscriptions, budget, restDays, aiConfig, transactions }}
        onRestore={handleRestoreData}
        aiConfig={aiConfig}
        onUpdateAIConfig={setAiConfig}
      />

      <AIAnalysisModal
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        subscriptions={subscriptions}
        budget={budget}
        aiConfig={aiConfig}
        transactions={transactions}
      />
    </div>
  );
}

export default App;