
import React from 'react';
import { Subscription, CATEGORIES, CYCLES } from '../types';
import { calculateNextBillingDate, getDaysUntil, formatCurrency } from '../utils';
import { CalendarClock, Trash2, Edit2 } from 'lucide-react';

interface Props {
  subscriptions: Subscription[];
  onDelete: (id: string) => void;
  onEdit: (sub: Subscription) => void;
  isLoading?: boolean;
}

const SubscriptionList: React.FC<Props> = ({ subscriptions, onDelete, onEdit, isLoading = false }) => {
  // Sort by days remaining (urgent first)
  const sortedSubs = [...subscriptions].sort((a, b) => {
    const daysA = getDaysUntil(calculateNextBillingDate(a.startDate, a.cycle));
    const daysB = getDaysUntil(calculateNextBillingDate(b.startDate, b.cycle));
    return daysA - daysB;
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-surface border border-border rounded-xl p-5 shadow-lg h-[142px] animate-pulse">
            <div className="flex justify-between items-start mb-4 pl-3">
              <div className="flex items-center gap-3 w-full">
                <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700/50 shrink-0"></div>
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700/50 rounded w-24"></div>
                  <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-12"></div>
                </div>
              </div>
              <div className="w-16 h-8 bg-slate-200 dark:bg-slate-700/50 rounded shrink-0"></div>
            </div>
            <div className="flex justify-between items-center mt-6 pl-3 border-t border-border pt-4">
                <div className="h-3 bg-slate-200 dark:bg-slate-700/50 rounded w-32"></div>
                <div className="flex gap-2">
                    <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700/50 rounded"></div>
                    <div className="w-7 h-7 bg-slate-200 dark:bg-slate-700/50 rounded"></div>
                </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-20 bg-surface rounded-2xl border border-border border-dashed animate-in fade-in zoom-in duration-300">
        <div className="mx-auto w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <CalendarClock className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-lg font-medium text-main">没有订阅</h3>
        <p className="text-muted mt-1">点击右上角的按钮添加您的第一个订阅</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 md:pb-0">
      {sortedSubs.map((sub) => {
        const nextDate = calculateNextBillingDate(sub.startDate, sub.cycle);
        const daysLeft = getDaysUntil(nextDate);
        const categoryConfig = CATEGORIES[sub.category];

        return (
          <div key={sub.id} className="bg-surface border border-border hover:border-slate-400 dark:hover:border-slate-500 rounded-xl p-5 shadow-lg transition-all group relative overflow-hidden active:scale-[0.99] touch-manipulation">
            {/* Urgency Indicator Strip */}
            <div className={`absolute top-0 left-0 w-1 h-full ${daysLeft <= 3 ? 'bg-red-500' : daysLeft <= 7 ? 'bg-yellow-500' : 'bg-slate-300 dark:bg-slate-700'}`}></div>

            <div className="flex justify-between items-start mb-4 pl-3">
              <div className="flex items-center gap-3">
                 {sub.logoUrl ? (
                   <img src={sub.logoUrl} alt={sub.name} className="w-10 h-10 rounded-lg object-cover shadow-inner bg-slate-100 dark:bg-slate-800" />
                 ) : (
                   <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold text-white shadow-inner" style={{ backgroundColor: categoryConfig.color }}>
                      {sub.name.charAt(0).toUpperCase()}
                   </div>
                 )}
                 <div>
                    <h3 className="font-semibold text-main truncate max-w-[120px]" title={sub.name}>{sub.name}</h3>
                    <span className="text-xs text-muted px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-border">
                        {categoryConfig.label}
                    </span>
                 </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-main">{formatCurrency(sub.price)}</div>
                <div className="text-xs text-muted">/ {CYCLES[sub.cycle].label}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mt-4 pl-3 pt-4 border-t border-border">
                <div className="flex flex-col">
                    <span className="text-xs text-muted">下次扣款</span>
                    <div className={`text-sm font-medium flex items-center gap-1.5 ${daysLeft <= 3 ? 'text-red-500 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
                        <CalendarClock className="w-3.5 h-3.5" />
                        {nextDate.toLocaleDateString('zh-CN')}
                        <span className="text-xs opacity-75">
                           ({daysLeft === 0 ? '今天' : `${daysLeft}天后`})
                        </span>
                    </div>
                </div>

                <div className="flex gap-2 relative z-20 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onEdit(sub); }}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-muted hover:text-blue-500 dark:hover:text-blue-400 transition-all active:scale-90 active:bg-slate-200 dark:active:bg-slate-600"
                        title="编辑"
                    >
                        <Edit2 className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(sub.id); }}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-muted hover:text-red-500 dark:hover:text-red-400 transition-all active:scale-90 active:bg-slate-200 dark:active:bg-slate-600"
                        title="删除"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default SubscriptionList;
