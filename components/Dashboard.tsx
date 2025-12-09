
import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Subscription, CATEGORIES, Budget } from '../types';
import { calculateStats, formatCurrency, getDaysInMonth, countSundaysInMonth } from '../utils';
import { CreditCard, Calendar, TrendingUp, Settings2, Check, X, ChevronLeft, ChevronRight, CalendarDays, Wallet, Calculator, Coffee, Coins, Banknote, MousePointerClick } from 'lucide-react';

interface DashboardProps {
  subscriptions: Subscription[];
  budget: Budget;
  onUpdateBudget: (newBudget: Budget) => void;
  restDays: string[];
  onToggleRestDay: (dateStr: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ subscriptions, budget, onUpdateBudget, restDays, onToggleRestDay }) => {
  const [editingTarget, setEditingTarget] = useState<'monthly' | 'yearly' | 'baseSalary' | 'commission' | null>(null);
  const [tempBudgetValue, setTempBudgetValue] = useState('');
  
  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());

  const stats = useMemo(() => {
    const data = calculateStats(subscriptions);
    // Inject colors for chart
    data.categoryBreakdown = data.categoryBreakdown.map(item => ({
        ...item,
        color: CATEGORIES[item.name as keyof typeof CATEGORIES]?.color || '#cbd5e1'
    }));
    return data;
  }, [subscriptions]);

  const sortedBreakdown = [...stats.categoryBreakdown].sort((a, b) => b.value - a.value);
  
  // --- Salary Calculation Logic ---
  const salaryStats = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const sundaysInMonth = countSundaysInMonth(year, month);
    
    // Fix: Use string matching for accurate count instead of Date objects to avoid timezone issues
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const markedRestDaysInMonth = restDays.filter(dateStr => dateStr.startsWith(currentMonthPrefix)).length;

    // Formula: 4500 - {4500 / (DaysInMonth - Sundays)} * (RestDays - Sundays)
    const base = budget.baseSalary || 4500;
    const commission = budget.commission || 0;
    
    const workableDays = daysInMonth - sundaysInMonth;
    const dailyRate = workableDays > 0 ? base / workableDays : 0;
    
    // How many days "extra" rest did they take beyond Sundays?
    const deductionDays = markedRestDaysInMonth - sundaysInMonth;
    
    // Logic: If deductionDays < 0 (worked extra), we cap at 4500 (deduction = 0).
    // If deductionDays > 0 (rested extra), we deduct.
    const effectiveDeductionDays = Math.max(0, deductionDays);
    const deductionAmount = dailyRate * effectiveDeductionDays;
    
    const estimatedSalaryBeforeCommission = base - deductionAmount;
    
    // Total including commission
    const totalIncome = estimatedSalaryBeforeCommission + commission;
    
    const disposableIncome = totalIncome - stats.monthlyTotal;

    return {
      daysInMonth,
      sundaysInMonth,
      markedRestDaysInMonth,
      effectiveDeductionDays,
      deductionAmount,
      base,
      commission,
      totalIncome,
      disposableIncome
    };
  }, [viewDate, restDays, budget.baseSalary, budget.commission, stats.monthlyTotal]);


  // Calendar Logic
  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const data: Record<number, { subs: Subscription[], isRest: boolean, dateStr: string }> = {};

    // Check rest days
    const daysInMonth = getDaysInMonth(year, month);
    for (let d = 1; d <= daysInMonth; d++) {
       const dateStr = new Date(year, month, d, 12).toISOString().split('T')[0]; // Use noon to avoid timezone flip issues
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
             // Cap at month end (e.g. 31st on a 30-day month)
             if (day > daysInCurrentMonth) day = daysInCurrentMonth;
             
             const dateToCheck = new Date(year, month, day);
             // Ensure subscription has started
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

  const startEditing = (type: 'monthly' | 'yearly' | 'baseSalary' | 'commission', currentValue: number) => {
    setEditingTarget(type);
    setTempBudgetValue(currentValue.toString());
  };

  const saveBudget = () => {
    if (editingTarget && tempBudgetValue) {
      const val = parseFloat(tempBudgetValue);
      if (!isNaN(val) && val >= 0) {
        onUpdateBudget({
          ...budget,
          [editingTarget]: val
        });
      }
    }
    setEditingTarget(null);
  };

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
      <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg relative group transition-colors">
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
    );
  };

  // Calendar Helpers
  const firstDayOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay(); // 0 is Sunday
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  return (
    <div className="space-y-6">
      
      {/* Salary & Disposable Income Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900 dark:to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
             {/* Decorative background */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
             
             <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 text-indigo-100">
                        <Wallet className="w-5 h-5" /> 支出总览
                    </h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-indigo-200 mb-1">每月总固定支出</p>
                      <p className="text-3xl font-bold tracking-tight">{formatCurrency(stats.monthlyTotal)}</p>
                    </div>
                    <div className="border-l border-indigo-500/30 pl-4">
                       <p className="text-sm text-indigo-200 mb-1">当月休息天数</p>
                       <p className="text-3xl font-bold tracking-tight text-amber-300">
                          {salaryStats.markedRestDaysInMonth} <span className="text-base font-medium text-indigo-200">天</span>
                       </p>
                    </div>
                </div>
             </div>
          </div>

          <div className="bg-surface rounded-2xl p-6 border border-border shadow-xl relative overflow-hidden group">
             <div className="flex justify-between items-start mb-4">
                 <h3 className="text-lg font-semibold flex items-center gap-2 text-main">
                    <Coins className="w-5 h-5 text-emerald-500" /> 
                    {viewDate.getMonth() + 1}月收入计算
                 </h3>
                 <div className="flex gap-1">
                    {/* Settings for Base Salary */}
                    {editingTarget !== 'baseSalary' && editingTarget !== 'commission' && (
                        <button 
                            onClick={() => startEditing('baseSalary', salaryStats.base)}
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
                        <div className="flex justify-between">
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
                                <span className="font-medium text-main">{formatCurrency(salaryStats.base)}</span>
                             )}
                        </div>
                        <div className="flex justify-between">
                             <span className="text-muted">缺勤扣款:</span>
                             <span className={`font-medium ${salaryStats.deductionAmount > 0 ? 'text-red-500' : 'text-main'}`}>
                                 -{formatCurrency(salaryStats.deductionAmount)}
                             </span>
                        </div>
                        <div className="flex justify-between items-center group/comm">
                             <span className="text-muted flex items-center gap-1 cursor-pointer" onClick={() => startEditing('commission', salaryStats.commission)}>
                                提成收入 <Edit2IconMini />
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
                                <span className="font-medium text-emerald-500 cursor-pointer hover:underline" onClick={() => startEditing('commission', salaryStats.commission)}>
                                    +{formatCurrency(salaryStats.commission)}
                                </span>
                             )}
                        </div>
                        <div className="pt-2 border-t border-border flex justify-between font-bold text-main">
                             <span>实发工资:</span>
                             <span>{formatCurrency(salaryStats.totalIncome)}</span>
                        </div>
                    </div>

                    {/* Right: Disposable Result */}
                    <div className="flex flex-col justify-end text-right border-l border-border pl-4">
                        <p className="text-sm text-muted mb-1">扣除订阅后可支配</p>
                        <p className={`text-2xl font-bold ${salaryStats.disposableIncome >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                            {formatCurrency(salaryStats.disposableIncome)}
                        </p>
                    </div>
                 </div>

                 <div className="text-[10px] text-muted bg-slate-50 dark:bg-slate-900/50 p-2.5 rounded-lg border border-border">
                     <div className="flex flex-wrap gap-x-4 gap-y-1 mb-1.5">
                        <span>月天数: {salaryStats.daysInMonth}</span>
                        <span>周日: {salaryStats.sundaysInMonth}</span>
                        <span className="text-orange-500 font-medium">本月标注休息: {salaryStats.markedRestDaysInMonth}天</span>
                        <span>扣款计算天数: {salaryStats.effectiveDeductionDays}</span>
                     </div>
                     <div className="opacity-75">
                         公式: ({salaryStats.base} - 扣款 + 提成) - 订阅支出
                     </div>
                 </div>
             </div>
          </div>
      </div>

      {/* Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderBudgetCard(
            '月度订阅预算', 
            stats.monthlyTotal, 
            budget.monthly, 
            'monthly', 
            <Calculator className="w-5 h-5" />, 
            'bg-indigo-500 text-indigo-500'
        )}

        {renderBudgetCard(
            '年度订阅预算', 
            stats.yearlyTotal, 
            budget.yearly, 
            'yearly', 
            <TrendingUp className="w-5 h-5" />, 
            'bg-emerald-500 text-emerald-500'
        )}

        <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg flex flex-col justify-between transition-colors">
          <div className="flex items-center gap-3 mb-2 text-muted">
            <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500">
                <Calendar className="w-5 h-5" />
            </div>
            <span className="text-sm font-medium">活跃订阅数</span>
          </div>
          <div>
            <p className="text-3xl font-bold text-main tracking-tight">
                {subscriptions.length}
            </p>
            <p className="text-xs text-muted mt-4">
               正在管理的订阅服务数量
            </p>
          </div>
        </div>
      </div>

      {/* Chart & Detailed Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg lg:col-span-2 transition-colors">
            <h3 className="text-lg font-semibold text-main mb-6">支出构成</h3>
            <div className="h-[300px] w-full">
                {subscriptions.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                        data={stats.categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        >
                        {stats.categoryBreakdown.map((entry, index) => (
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
                    <div className="flex h-full items-center justify-center text-muted">
                        暂无数据
                    </div>
                )}
            </div>
        </div>

        {/* Top Categories List */}
        <div className="bg-surface p-6 rounded-2xl border border-border shadow-lg flex flex-col transition-colors">
          <h3 className="text-lg font-semibold text-main mb-4">分类排行</h3>
          <div className="space-y-4 overflow-y-auto flex-1 pr-2">
            {sortedBreakdown.length > 0 ? sortedBreakdown.map((cat) => (
              <div key={cat.name} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color, boxShadow: `0 0 8px ${cat.color}` }}></div>
                  <span className="text-slate-500 dark:text-slate-300 font-medium">{CATEGORIES[cat.name as keyof typeof CATEGORIES]?.label}</span>
                </div>
                <div className="text-right">
                    <div className="text-main font-semibold">{formatCurrency(cat.value)}</div>
                    <div className="text-xs text-muted">/ 月</div>
                </div>
              </div>
            )) : (
                <p className="text-muted text-center mt-10">暂无数据</p>
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
                {/* Legend / Instructions */}
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
            
            <div className="flex items-center gap-4 text-sm font-medium bg-background px-1 py-1 rounded-lg border border-border self-start md:self-auto">
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

        <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden border border-border">
            {/* Weekday Headers */}
            {weekDays.map(day => (
                <div key={day} className="bg-slate-100 dark:bg-slate-900/80 p-3 text-center text-xs font-semibold text-muted">
                    {day}
                </div>
            ))}

            {/* Empty Days Start */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-surface min-h-[100px]" />
            ))}

            {/* Days */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayData = calendarData[day];
                const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString();
                const isSunday = new Date(viewDate.getFullYear(), viewDate.getMonth(), day).getDay() === 0;

                return (
                    <div 
                        key={`day-${day}`} 
                        onClick={() => onToggleRestDay(dayData.dateStr)}
                        className={`bg-surface p-2 min-h-[100px] relative group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer select-none
                            ${dayData.isRest ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                        `}
                    >
                        {/* Status Indicators */}
                        <div className="flex justify-between items-start mb-2">
                            <div className={`text-sm w-6 h-6 flex items-center justify-center rounded-full transition-colors
                                ${isToday ? 'bg-primary text-white font-bold' : 
                                  isSunday ? 'text-red-400' : 'text-muted'}
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
            
             {/* Empty Days End */}
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
