import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Subscription, CATEGORIES, Budget, Transaction, TRANSACTION_CATEGORIES } from '../types';
import { calculateStats, formatCurrency, getDaysInMonth, countStandardRestDays, getPaydayCountdown } from '../utils';
import { CreditCard, Calendar, TrendingUp, Settings2, Check, X, ChevronLeft, ChevronRight, CalendarDays, Wallet, Calculator, Coffee, Coins, Bot, MousePointerClick, Timer, Repeat, ArrowRight, RotateCcw, Info, ReceiptText, Activity, Briefcase } from 'lucide-react';

interface DashboardProps {
  subscriptions: Subscription[];
  budget: Budget;
  onUpdateBudget: (newBudget: Budget) => void;
  restDays: string[];
  onToggleRestDay: (dateStr: string) => void;
  onOpenAI: () => void;
  transactions: Transaction[];
}

const Dashboard: React.FC<DashboardProps> = ({ subscriptions, budget, onUpdateBudget, restDays, onToggleRestDay, onOpenAI, transactions }) => {
  const [editingTarget, setEditingTarget] = useState<'monthly' | 'yearly' | 'baseSalary' | 'commission' | 'payday' | null>(null);
  const [tempBudgetValue, setTempBudgetValue] = useState('');
  
  // Calendar State
  // Initialize viewDate based on salaryDelay to show the relevant salary calculation immediately
  const [viewDate, setViewDate] = useState(() => {
    const now = new Date();
    // If salary is delayed (paid next month), default the view to the Previous Month
    // This ensures the "Income & Budget" card immediately shows the salary calculation 
    // that is funding the current month's "Disposable Income".
    if (budget.salaryDelay === 1) {
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    }
    return now;
  });

  // --- Data Merging Logic for Charts ---
  const mergedChartData = useMemo(() => {
    // 1. Subscription Stats (Monthly Normalized)
    const subStats = calculateStats(subscriptions);
    
    // 2. Transaction Stats (Filtered by VIEW Month)
    const viewMonthPrefix = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
    const monthlyExpenses = transactions.filter(t => 
        t.type === 'expense' && t.date.startsWith(viewMonthPrefix)
    );

    const expenseMap: Record<string, number> = {};
    
    // Add Subscriptions
    subStats.categoryBreakdown.forEach(item => {
        expenseMap[item.name] = (expenseMap[item.name] || 0) + item.value;
    });

    // Add Transactions
    monthlyExpenses.forEach(t => {
        expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    });

    // Transform to Chart Data
    const data = Object.entries(expenseMap).map(([key, value]) => {
        // @ts-ignore
        let config = CATEGORIES[key];
        if (!config) {
            config = TRANSACTION_CATEGORIES[key];
        }
        
        return {
            name: key,
            value: parseFloat(value.toFixed(2)),
            label: config?.label || key,
            color: config?.color || '#94a3b8'
        };
    }).filter(item => item.value > 0);

    return data.sort((a, b) => b.value - a.value);
  }, [subscriptions, transactions, viewDate]);

  // Payday Countdown
  const paydayCountdown = useMemo(() => {
    return getPaydayCountdown(budget.payday || 15);
  }, [budget.payday]);

  // --- Salary Calculation Logic ---
  
  const calculateSalaryForMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    // Use Standard Rest Days logic (Single vs Double break)
    // 'single' = Sundays only (user's formula)
    // 'double' = Sat + Sun
    const standardRestDaysInMonth = countStandardRestDays(year, month, budget.workMode || 'single');
    
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const markedRestDaysInMonth = restDays.filter(dateStr => dateStr.startsWith(currentMonthPrefix)).length;

    // Formula: Daily Rate = Base / WorkableDays
    // WorkableDays = TotalDays - StandardRestDays
    const base = budget.baseSalary || 4500;
    const commission = budget.commission || 0;
    
    const workableDays = daysInMonth - standardRestDaysInMonth;
    const dailyRate = workableDays > 0 ? base / workableDays : 0;
    
    // Logic: If user marks MORE rest days than standard, we deduct.
    // If user marks LESS (worked overtime on weekend), we effectively treat deduction as 0 (cap salary at base).
    const deductionDays = markedRestDaysInMonth - standardRestDaysInMonth;
    const effectiveDeductionDays = Math.max(0, deductionDays);
    const deductionAmount = dailyRate * effectiveDeductionDays;
    
    const estimatedSalaryBeforeCommission = base - deductionAmount;
    const totalIncome = estimatedSalaryBeforeCommission + commission;
    
    return {
      year,
      month: month + 1,
      daysInMonth,
      standardRestDaysInMonth,
      markedRestDaysInMonth,
      effectiveDeductionDays,
      deductionAmount,
      base,
      commission,
      totalIncome
    };
  };

  // Stats for the CURRENT CALENDAR VIEW (What user is editing)
  const viewMonthStats = useMemo(() => calculateSalaryForMonth(viewDate), [viewDate, restDays, budget.baseSalary, budget.commission, budget.workMode]);
  
  // Stats for the ACTUAL INCOME SOURCE (Previous month if delayed, else current real month)
  const realToday = new Date();
  const sourceDate = budget.salaryDelay === 1 
      ? new Date(realToday.getFullYear(), realToday.getMonth() - 1, 1) // Previous month
      : new Date(realToday.getFullYear(), realToday.getMonth(), 1);    // Current month

  const sourceMonthStats = useMemo(() => calculateSalaryForMonth(sourceDate), [sourceDate, restDays, budget.baseSalary, budget.commission, budget.workMode]);

  // --- Bookkeeping (Expenses) ---
  const currentRealMonthPrefix = `${realToday.getFullYear()}-${String(realToday.getMonth() + 1).padStart(2, '0')}`;
  
  const variableExpenses = useMemo(() => {
    return transactions
        .filter(t => t.type === 'expense' && t.date.startsWith(currentRealMonthPrefix))
        .reduce((sum, t) => sum + t.amount, 0);
  }, [transactions, currentRealMonthPrefix]);

  const subStats = calculateStats(subscriptions);
  const disposableIncome = sourceMonthStats.totalIncome - subStats.monthlyTotal - variableExpenses;

  // Calendar Logic
  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const data: Record<number, { subs: Subscription[], isRest: boolean, dateStr: string }> = {};

    const daysInMonth = getDaysInMonth(year, month);
    for (let d = 1; d <= daysInMonth; d++) {
       const dateStr = new Date(year, month, d, 12).toISOString().split('T')[0];
       data[d] = { 
           subs: [], 
           isRest: restDays.includes(dateStr),
           dateStr
       };
    }

    subscriptions.forEach(sub => {
        const start = new Date(sub.startDate);
        start.setHours(0, 0, 0, 0);
        
        if (sub.cycle === 'monthly') {
             let day = start.getDate();
             if (day > daysInCurrentMonth) day = daysInCurrentMonth;
             const dateToCheck = new Date(year, month, day);
             if (dateToCheck >= start) {
                 if (data[day]) data[day].subs.push(sub);
             }
        } else if (sub.cycle === 'yearly') {
             if (start.getMonth() === month) {
                 const day = start.getDate();
                 const dateToCheck = new Date(year, month, day);
                 if (dateToCheck >= start) {
                     if (data[day]) data[day].subs.push(sub);
                 }
             }
        } else if (sub.cycle === 'weekly') {
             for (let d = 1; d <= daysInCurrentMonth; d++) {
                 const dateToCheck = new Date(year, month, d);
                 if (dateToCheck < start) continue;
                 const diffTime = dateToCheck.getTime() - start.getTime();
                 const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
                 if (diffDays % 7 === 0) {
                     if (data[d]) data[d].subs.push(sub);
                 }
             }
        }
    });
    return data;
  }, [subscriptions, viewDate, restDays]);

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  
  const goToToday = () => {
    setViewDate(new Date());
  };

  const goToSourceMonth = () => {
      setViewDate(sourceDate);
  };

  const startEditing = (type: 'monthly' | 'yearly' | 'baseSalary' | 'commission' | 'payday', currentValue: number) => {
    setEditingTarget(type);
    setTempBudgetValue(currentValue.toString());
  };

  const saveBudget = () => {
    if (editingTarget && tempBudgetValue) {
      const val = parseFloat(tempBudgetValue);
      if (!isNaN(val) && val >= 0) {
        if (editingTarget === 'payday' && (val < 1 || val > 31)) {
            return;
        }
        onUpdateBudget({
          ...budget,
          [editingTarget]: val
        });
      }
    }
    setEditingTarget(null);
  };
  
  const toggleSalaryDelay = () => {
      const newDelay = budget.salaryDelay === 1 ? 0 : 1;
      const now = new Date();
      let targetViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
      if (newDelay === 1) {
          targetViewDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      }
      setViewDate(targetViewDate);
      onUpdateBudget({
          ...budget,
          salaryDelay: newDelay
      });
  };

  const toggleWorkMode = () => {
      const newMode = budget.workMode === 'double' ? 'single' : 'double';
      onUpdateBudget({
          ...budget,
          workMode: newMode
      });
  };

  // Calculate Expected Payment Date
  const expectedPayDate = new Date(viewMonthStats.year, viewMonthStats.month - 1, budget.payday || 15);
  if (budget.salaryDelay === 1) {
      expectedPayDate.setMonth(expectedPayDate.getMonth() + 1);
  }
  const expectedPayDateStr = `${expectedPayDate.getMonth() + 1}月${expectedPayDate.getDate()}日`;


  const renderBudgetCard = (
    title: string, 
    current: number, 
    target: number, 
    type: 'monthly' | 'yearly', 
    icon: React.ReactNode, 
    iconColorClass: string
  ) => {
    const percentage = Math.min((current / target) * 100, 100);
    const isOverBudget = current > target;
    const isEditing = editingTarget === type;

    return (
      <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg relative group transition-colors flex flex-col justify-between">
        <div>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3 text-muted">
                    <div className={`p-2 ${iconColorClass} bg-opacity-10 rounded-lg`}>
                        {icon}
                    </div>
                    <span className="text-sm font-medium">{title}</span>
                </div>
                {!isEditing && (
                     <button 
                        onClick={() => startEditing(type, target)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-background rounded-md text-muted hover:text-main"
                        title="设置预算目标"
                     >
                        <Settings2 className="w-4 h-4" />
                     </button>
                )}
            </div>
            
            <div className="mb-4">
                <p className="text-3xl font-bold text-main tracking-tight">
                    {formatCurrency(current)}
                </p>
            </div>

            {isEditing ? (
                <div className="flex items-center gap-2 mt-2 animate-in fade-in slide-in-from-top-2">
                    <input 
                        type="number" 
                        value={tempBudgetValue}
                        onChange={(e) => setTempBudgetValue(e.target.value)}
                        className="w-full bg-background border border-slate-600 rounded px-2 py-1 text-sm text-main focus:ring-1 focus:ring-primary outline-none"
                        autoFocus
                    />
                    <button onClick={saveBudget} className="p-1 text-emerald-500 hover:bg-background rounded"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingTarget(null)} className="p-1 text-muted hover:bg-background rounded"><X className="w-4 h-4" /></button>
                </div>
            ) : (
                <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-medium">
                        <span className={isOverBudget ? 'text-red-400' : 'text-emerald-400'}>
                            {Math.round((current / target) * 100)}%
                        </span>
                        <span className="text-muted">
                            预算: {formatCurrency(target)}
                        </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${isOverBudget ? 'bg-red-500' : 'bg-emerald-500'}`}
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                    <p className="text-xs text-muted mt-1">
                        {isOverBudget 
                            ? `超出预算 ${formatCurrency(current - target)}` 
                            : `剩余预算 ${formatCurrency(target - current)}`
                        }
                    </p>
                </div>
            )}
        </div>
        
        {type === 'monthly' && (
            <div className="mt-4 pt-3 border-t border-border flex items-center gap-2 text-xs text-muted">
                <Activity className="w-3.5 h-3.5" />
                <span>活跃订阅: <span className="text-main font-semibold">{subscriptions.length}</span></span>
            </div>
        )}
      </div>
    );
  };

  // Calendar Helpers
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 is Sunday
  // @ts-ignore
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  const isViewingSourceMonth = viewDate.getMonth() === sourceDate.getMonth() && viewDate.getFullYear() === sourceDate.getFullYear();

  return (
    <div className="space-y-6">
      
      {/* Salary & Disposable Income Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* LEFT CARD */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900 dark:to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between">
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
             
             <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-100">
                        <Wallet className="w-5 h-5" /> 支出总览
                    </h3>
                    <button 
                        onClick={onOpenAI}
                        className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-semibold backdrop-blur-sm transition-all border border-white/10"
                    >
                        <Bot className="w-4 h-4" />
                        AI 分析
                    </button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-indigo-200 mb-1">固定支出 (订阅)</p>
                      <p className="text-2xl font-bold tracking-tight">{formatCurrency(subStats.monthlyTotal)}</p>
                    </div>
                     <div>
                      <p className="text-sm text-indigo-200 mb-1">日常支出 (本月)</p>
                      <p className="text-2xl font-bold tracking-tight text-indigo-100">{formatCurrency(variableExpenses)}</p>
                    </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-indigo-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm text-indigo-200">
                        <Timer className="w-3.5 h-3.5" /> 距离发工资
                    </div>
                     <p className="text-xl font-bold tracking-tight text-emerald-300">
                        {paydayCountdown === 0 ? '今天!' : `${paydayCountdown} 天`}
                    </p>
                </div>
             </div>
             
             <div className="relative z-10 mt-4">
                <div className="flex justify-between items-center text-xs text-indigo-200">
                     <div className="flex items-center gap-1">
                        资金来源: <span className="font-bold text-white bg-white/20 px-1.5 rounded">{sourceMonthStats.month}月工资</span>
                     </div>
                     <div>总固定年支: <span className="font-bold text-white">{formatCurrency(subStats.yearlyTotal)}</span></div>
                </div>
             </div>
          </div>

          {/* RIGHT CARD */}
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-xl relative overflow-hidden group">
             <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-2">
                     <h3 className="text-lg font-semibold flex items-center gap-2 text-main">
                        <Coins className="w-5 h-5 text-emerald-500" /> 
                        收入与预算
                     </h3>
                     {/* Work Mode Toggle */}
                     <button 
                        onClick={toggleWorkMode}
                        className="text-[10px] px-2 py-0.5 rounded border flex items-center gap-1 transition-colors bg-slate-50 border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:hover:bg-slate-700 text-muted"
                        title="切换单休/双休制度"
                     >
                        <Briefcase className="w-3 h-3" />
                        {budget.workMode === 'double' ? '双休' : '单休'}
                     </button>
                 </div>

                 <div className="flex gap-1">
                    {editingTarget === null && (
                        <button 
                            onClick={() => startEditing('baseSalary', viewMonthStats.base)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-muted hover:text-main"
                            title="设置基础工资"
                        >
                            <Settings2 className="w-4 h-4" />
                        </button>
                    )}
                 </div>
             </div>

             <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    {/* Left: Calculation Breakdown */}
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center mb-1">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                isViewingSourceMonth 
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800' 
                                : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}>
                                {viewMonthStats.month}月考勤计算 {isViewingSourceMonth ? '(当前生效)' : '(预览)'}
                            </span>
                        </div>

                        <div className="flex justify-between group/row">
                             <span className="text-muted">基础工资:</span>
                             {editingTarget === 'baseSalary' ? (
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        value={tempBudgetValue}
                                        onChange={(e) => setTempBudgetValue(e.target.value)}
                                        className="w-16 bg-background border border-slate-600 rounded px-1 py-0.5 text-xs text-main outline-none"
                                        autoFocus
                                    />
                                    <button onClick={saveBudget} className="text-emerald-500"><Check className="w-3 h-3" /></button>
                                </div>
                             ) : (
                                <span className="font-medium text-main cursor-pointer hover:text-primary transition-colors" onClick={() => startEditing('baseSalary', viewMonthStats.base)}>{formatCurrency(viewMonthStats.base)}</span>
                             )}
                        </div>
                        <div className="flex justify-between group/row">
                             <span className="text-muted">发薪日:</span>
                             {editingTarget === 'payday' ? (
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        min="1" max="31"
                                        value={tempBudgetValue}
                                        onChange={(e) => setTempBudgetValue(e.target.value)}
                                        className="w-16 bg-background border border-slate-600 rounded px-1 py-0.5 text-xs text-main outline-none"
                                        autoFocus
                                    />
                                    <button onClick={saveBudget} className="text-emerald-500"><Check className="w-3 h-3" /></button>
                                </div>
                             ) : (
                                <span className="font-medium text-main cursor-pointer hover:text-primary transition-colors flex items-center gap-1" onClick={() => startEditing('payday', budget.payday || 15)}>
                                    每月 {budget.payday || 15} 号 <Edit2IconMini />
                                </span>
                             )}
                        </div>
                        <div className="flex justify-between">
                             <span className="text-muted">缺勤扣款:</span>
                             <span className={`font-medium ${viewMonthStats.deductionAmount > 0 ? 'text-red-500' : 'text-main'}`}>
                                 -{formatCurrency(viewMonthStats.deductionAmount)}
                             </span>
                        </div>
                        <div className="flex justify-between items-center group/comm">
                             <span className="text-muted flex items-center gap-1 cursor-pointer" onClick={() => startEditing('commission', viewMonthStats.commission)}>
                                提成收入
                             </span>
                             {editingTarget === 'commission' ? (
                                <div className="flex items-center gap-1">
                                    <input 
                                        type="number" 
                                        value={tempBudgetValue}
                                        onChange={(e) => setTempBudgetValue(e.target.value)}
                                        className="w-16 bg-background border border-slate-600 rounded px-1 py-0.5 text-xs text-main outline-none"
                                        autoFocus
                                    />
                                    <button onClick={saveBudget} className="text-emerald-500"><Check className="w-3 h-3" /></button>
                                </div>
                             ) : (
                                <span className="font-medium text-emerald-500 cursor-pointer hover:underline" onClick={() => startEditing('commission', viewMonthStats.commission)}>
                                    +{formatCurrency(viewMonthStats.commission)}
                                </span>
                             )}
                        </div>
                        <div className="pt-2 border-t border-border flex flex-col gap-1">
                             <div className="flex justify-between font-bold text-main">
                                 <span>{viewMonthStats.month}月实发:</span>
                                 <span>{formatCurrency(viewMonthStats.totalIncome)}</span>
                             </div>
                             <div className="flex justify-between text-[10px] text-muted">
                                 <span>预计发放:</span>
                                 <span>{expectedPayDateStr}</span>
                             </div>
                        </div>
                    </div>

                    {/* Right: Disposable Result */}
                    <div className="flex flex-col text-right border-l border-border pl-4">
                         <div className="mb-auto flex justify-end">
                            <button 
                                onClick={toggleSalaryDelay}
                                className={`text-[10px] px-2 py-1 rounded flex items-center gap-1 transition-colors ${
                                    budget.salaryDelay === 1 
                                    ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300' 
                                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                                }`}
                                title="切换工资发放周期"
                            >
                                <Repeat className="w-3 h-3" />
                                {budget.salaryDelay === 1 ? '次月发放' : '当月发放'}
                            </button>
                         </div>

                        <div className="mt-2">
                            <p className="text-xs text-muted mb-1">本月可支配余额</p>
                            <p className={`text-2xl font-bold ${disposableIncome >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                {formatCurrency(disposableIncome)}
                            </p>
                            
                            {!isViewingSourceMonth && budget.salaryDelay === 1 && (
                                <div className="mt-2 animate-in fade-in slide-in-from-right-4">
                                    <div className="text-[10px] text-orange-500 bg-orange-50 dark:bg-orange-900/20 p-1.5 rounded border border-orange-100 dark:border-orange-900/30 flex items-start gap-1">
                                        <Info className="w-3 h-3 mt-0.5 shrink-0" />
                                        <div className="text-left">
                                            当前预算基于<b>{sourceMonthStats.month}月</b>工资。<br/>
                                            <button 
                                                onClick={goToSourceMonth}
                                                className="underline font-bold hover:text-orange-600 mt-0.5"
                                            >
                                                点击去{sourceMonthStats.month}月核对考勤
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                             {isViewingSourceMonth && budget.salaryDelay === 1 && (
                                 <p className="text-[10px] text-emerald-500 mt-1 flex items-center justify-end gap-1">
                                     <Check className="w-3 h-3" /> 正在编辑当前生效的考勤
                                 </p>
                             )}
                        </div>
                    </div>
                 </div>

                 <div className="text-[10px] text-muted bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-border">
                     <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1.5">
                        <span>{viewMonthStats.month}月天数: {viewMonthStats.daysInMonth}</span>
                        <span>标准休息: {viewMonthStats.standardRestDaysInMonth}天 ({budget.workMode === 'double' ? '双休' : '单休'})</span>
                        <span className="text-orange-500 font-medium">标注休息: {viewMonthStats.markedRestDaysInMonth}天</span>
                        <span>扣款天数: {viewMonthStats.effectiveDeductionDays}</span>
                     </div>
                     <div className="opacity-75">
                         公式: (工资 - 扣款 + 提成) - 固定订阅 - 本月日常支出
                     </div>
                 </div>
             </div>
          </div>
      </div>
      
      {/* Rest of the dashboard (Budget Cards, Charts, Calendar) remains same, just pass through */}
      
      {/* Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderBudgetCard(
            '月度订阅预算', 
            subStats.monthlyTotal, 
            budget.monthly, 
            'monthly', 
            <Calculator className="w-5 h-5" />, 
            'bg-indigo-500 text-indigo-500'
        )}

        <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg flex flex-col justify-between transition-colors relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2 text-muted relative z-10">
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                <ReceiptText className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">本月日常支出</span>
          </div>
          <div className="relative z-10">
            <p className="text-3xl font-bold text-main tracking-tight">
                {formatCurrency(variableExpenses)}
            </p>
            <p className="text-xs text-muted mt-4">
               {realToday.getMonth()+1}月累计非订阅支出
            </p>
          </div>
          <div className="absolute right-0 bottom-0 opacity-5 pointer-events-none">
              <ReceiptText className="w-32 h-32" />
          </div>
        </div>
      </div>

      {/* Chart & Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg lg:col-span-2 transition-colors">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-semibold text-main">支出构成 (订阅 + 日常)</h3>
                <span className="text-xs text-muted bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
                    {viewDate.getMonth() + 1}月视图
                </span>
            </div>
            
            <div className="h-[300px] w-full">
                {mergedChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={mergedChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        >
                        {mergedChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        </Pie>
                        <Tooltip 
                            contentStyle={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-main)', borderRadius: '8px' }}
                            itemStyle={{ color: 'var(--text-main)' }}
                            formatter={(value: number) => formatCurrency(value)}
                        />
                        <Legend iconType="circle" verticalAlign="bottom" height={36}/>
                    </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-full items-center justify-center text-muted flex-col gap-2">
                        <Activity className="w-8 h-8 opacity-20" />
                        <span>暂无支出数据</span>
                    </div>
                )}
            </div>
        </div>

        {/* Top Categories List */}
        <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg flex flex-col transition-colors">
          <h3 className="text-lg font-semibold text-main mb-4">分类排行</h3>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {mergedChartData.length > 0 ? mergedChartData.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}` }}></div>
                  <span className="text-slate-500 dark:text-slate-300 font-medium">{cat.label}</span>
                </div>
                <div className="text-right">
                    <div className="text-main font-semibold">{formatCurrency(cat.value)}</div>
                </div>
              </div>
            )) : (
                <div className="text-muted text-center mt-10 text-sm">
                    <p>暂无数据</p>
                    <p className="text-xs opacity-60 mt-1">添加订阅或记账后显示</p>
                </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg transition-colors">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4">
            <div>
                <h3 className="text-lg font-semibold text-main flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    考勤与订阅日历
                </h3>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-primary flex items-center justify-center text-[8px] text-white"></div>
                        <span>今天</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded flex items-center justify-center bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700/50">
                            <Coffee className="w-2 h-2 text-amber-600 dark:text-amber-400" />
                        </div>
                        <span className="flex items-center gap-1">休息日 <MousePointerClick className="w-3 h-3" /> 点击日期切换</span>
                    </div>
                </div>
            </div>
            
            <div className="flex items-center gap-2 self-start md:self-auto">
                <button 
                    onClick={goToToday}
                    className="p-1.5 text-xs font-medium bg-surface hover:bg-slate-100 dark:hover:bg-slate-800 border border-border rounded-lg text-muted hover:text-primary transition-colors flex items-center gap-1"
                    title="回到今天"
                >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">今天</span>
                </button>
                <div className="flex items-center gap-4 text-sm font-medium bg-background px-1 py-1 rounded-lg border border-border">
                    <button onClick={prevMonth} className="p-1 hover:bg-surface text-muted hover:text-main rounded transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="min-w-[100px] text-center text-main">
                        {viewDate.getFullYear()}年 {viewDate.getMonth() + 1}月
                    </span>
                    <button onClick={nextMonth} className="p-1 hover:bg-surface text-muted hover:text-main rounded transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {weekDays.map(day => (
                <div key={day} className="bg-slate-100 dark:bg-slate-900/80 p-3 text-center text-xs font-semibold text-muted">
                    {day}
                </div>
            ))}

            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-surface min-h-[100px]" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayData = calendarData[day];
                const dateObj = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
                const isToday = new Date().toDateString() === dateObj.toDateString();
                const dayOfWeek = dateObj.getDay();
                // Determine if it's a standard rest day for styling
                const isStandardRest = budget.workMode === 'double' ? (dayOfWeek === 0 || dayOfWeek === 6) : (dayOfWeek === 0);

                return (
                    <div 
                        key={`day-${day}`} 
                        onClick={() => onToggleRestDay(dayData.dateStr)}
                        className={`bg-surface p-2 min-h-[100px] relative group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none
                            ${dayData.isRest ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                        `}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <div className={`text-sm w-6 h-6 flex items-center justify-center rounded-full transition-colors
                                ${isToday ? 'bg-primary text-white font-bold' : 
                                  isStandardRest ? 'text-red-400' : 'text-muted'}
                            `}>
                                {day}
                            </div>
                            {dayData.isRest && (
                                <div className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded flex items-center gap-1 border border-amber-200 dark:border-amber-800/50">
                                    <Coffee className="w-3 h-3" /> <span className="hidden sm:inline">休息</span>
                                </div>
                            )}
                        </div>

                        <div className="space-y-1">
                            {dayData.subs.map(sub => (
                                <div key={sub.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800/50 text-xs text-indigo-600 dark:text-indigo-300 transition-all truncate" title={`${sub.name} - ${formatCurrency(sub.price)}`}>
                                    <div 
                                        className="w-1.5 h-1.5 rounded-full shrink-0" 
                                        style={{ backgroundColor: CATEGORIES[sub.category]?.color || '#cbd5e1' }}
                                    />
                                    <span className="truncate">{sub.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
            
             {Array.from({ length: (42 - (firstDayOfMonth + daysInMonth)) % 7 }).map((_, i) => (
                <div key={`empty-end-${i}`} className="bg-surface min-h-[100px]" />
            ))}
        </div>
      </div>
    </div>
  );
};

// Helper for smaller edit icon
const Edit2IconMini = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50 hover:opacity-100"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
);

export default Dashboard;