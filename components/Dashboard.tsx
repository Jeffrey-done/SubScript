import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Subscription, CATEGORIES, Budget } from '../types';
import { calculateStats, formatCurrency } from '../utils';
import { CreditCard, Calendar, TrendingUp, Settings2, Check, X, ChevronLeft, ChevronRight, CalendarDays, Wallet, Calculator } from 'lucide-react';

interface DashboardProps {
  subscriptions: Subscription[];
  budget: Budget;
  onUpdateBudget: (newBudget: Budget) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ subscriptions, budget, onUpdateBudget }) => {
  const [editingTarget, setEditingTarget] = useState<'monthly' | 'yearly' | null>(null);
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
  const averageCost = subscriptions.length > 0 ? stats.monthlyTotal / subscriptions.length : 0;

  // Calendar Logic
  const calendarData = useMemo(() => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const data: Record<number, Subscription[]> = {};

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
                 if (!data[day]) data[day] = [];
                 data[day].push(sub);
             }
        } else if (sub.cycle === 'yearly') {
             if (start.getMonth() === month) {
                 const day = start.getDate();
                 const dateToCheck = new Date(year, month, day);
                 if (dateToCheck >= start) {
                     if (!data[day]) data[day] = [];
                     data[day].push(sub);
                 }
             }
        } else if (sub.cycle === 'weekly') {
             for (let d = 1; d <= daysInCurrentMonth; d++) {
                 const dateToCheck = new Date(year, month, d);
                 if (dateToCheck < start) continue;
                 
                 const diffTime = dateToCheck.getTime() - start.getTime();
                 const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
                 if (diffDays % 7 === 0) {
                     if (!data[d]) data[d] = [];
                     data[d].push(sub);
                 }
             }
        }
    });
    return data;
  }, [subscriptions, viewDate]);

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const startEditing = (type: 'monthly' | 'yearly', currentValue: number) => {
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
      {/* Summary Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-800 dark:from-indigo-900 dark:to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
         {/* Decorative background */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl -ml-12 -mb-12 pointer-events-none"></div>

         <div className="relative z-10">
            <h3 className="text-lg font-semibold mb-6 flex items-center gap-2 text-indigo-100">
               <Wallet className="w-5 h-5" /> 支出总览
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-indigo-400/30">
               <div className="pt-4 md:pt-0">
                  <p className="text-sm text-indigo-200 mb-1">每月总固定支出</p>
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(stats.monthlyTotal)}</p>
               </div>
               <div className="pt-4 md:pt-0 md:pl-8">
                  <p className="text-sm text-indigo-200 mb-1">年度总支出预测</p>
                  <p className="text-3xl font-bold tracking-tight">{formatCurrency(stats.yearlyTotal)}</p>
               </div>
               <div className="pt-4 md:pt-0 md:pl-8">
                  <p className="text-sm text-indigo-200 mb-1">平均单项成本</p>
                  <div className="flex items-baseline gap-1">
                    <p className="text-3xl font-bold tracking-tight">{formatCurrency(averageCost)}</p>
                    <span className="text-sm text-indigo-300">/ 月</span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Budget & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {renderBudgetCard(
            '月度预算监控', 
            stats.monthlyTotal, 
            budget.monthly, 
            'monthly', 
            <Calculator className="w-5 h-5" />, 
            'bg-indigo-500 text-indigo-500'
        )}

        {renderBudgetCard(
            '年度预算监控', 
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
        <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-main flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                订阅日历
            </h3>
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
                const daySubs = calendarData[day] || [];
                const isToday = new Date().toDateString() === new Date(viewDate.getFullYear(), viewDate.getMonth(), day).toDateString();

                return (
                    <div key={`day-${day}`} className={`bg-surface p-2 min-h-[100px] relative group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isToday ? 'bg-primary/5' : ''}`}>
                        <div className={`text-sm mb-2 w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-primary text-white font-bold' : 'text-muted'}`}>
                            {day}
                        </div>
                        <div className="space-y-1">
                            {daySubs.map(sub => (
                                <div key={sub.id} className="flex items-center gap-1.5 px-1.5 py-1 rounded bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 text-xs text-slate-600 dark:text-slate-300 hover:border-primary/50 hover:text-primary dark:hover:text-white transition-all cursor-default" title={`${sub.name} - ${formatCurrency(sub.price)}`}>
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

export default Dashboard;