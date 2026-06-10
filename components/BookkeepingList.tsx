import React, { useMemo } from 'react';
import { Transaction, TRANSACTION_CATEGORIES } from '../types';
import { formatCurrency, formatDateOnly, parseDateOnly } from '../utils';
import { Trash2, Edit2, ReceiptText } from 'lucide-react';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit: (t: Transaction) => void;
}

const BookkeepingList: React.FC<Props> = ({ transactions, onDelete, onEdit }) => {
  const grouped = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};

    transactions.forEach((t) => {
      const dateKey = formatDateOnly(t.date);
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push({ ...t, date: dateKey });
    });

    return Object.entries(groups).sort((a, b) => parseDateOnly(b[0]).getTime() - parseDateOnly(a[0]).getTime());
  }, [transactions]);

  const totalExpense = transactions.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  const totalIncome = transactions.filter((t) => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
          <ReceiptText className="w-8 h-8 text-slate-400" />
        </div>
        <p>暂无记账记录</p>
        <p className="text-sm opacity-60">点击右下角 + 按钮添加一条记录。</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-muted">本月支出</span>
          <p className="text-xl font-bold text-main mt-1">{formatCurrency(totalExpense)}</p>
        </div>
        <div className="bg-surface p-4 rounded-xl border border-border">
          <span className="text-xs text-muted">本月收入</span>
          <p className="text-xl font-bold text-emerald-500 mt-1">+{formatCurrency(totalIncome)}</p>
        </div>
      </div>

      <div className="space-y-6">
        {grouped.map(([date, items]) => {
          const dayTotal = items.reduce((acc, curr) => (curr.type === 'expense' ? acc - curr.amount : acc + curr.amount), 0);
          const dateObj = parseDateOnly(date);
          const displayDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
          const weekDay = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dateObj.getDay()];

          return (
            <div key={date} className="animate-in fade-in slide-in-from-bottom-2">
              <div className="flex justify-between items-center px-2 mb-2 text-xs text-muted font-medium">
                <div className="flex items-center gap-2">
                  <span>{displayDate}</span>
                  <span className="opacity-60">{weekDay}</span>
                </div>
                <span>{dayTotal > 0 ? '+' : ''}{formatCurrency(dayTotal)}</span>
              </div>

              <div className="bg-surface border border-border rounded-xl overflow-hidden divide-y divide-border">
                {items.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-xs shadow-sm"
                        style={{ backgroundColor: TRANSACTION_CATEGORIES[t.category]?.color || '#94a3b8' }}
                      >
                        {TRANSACTION_CATEGORIES[t.category]?.label?.[0] || 'O'}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-main flex items-center gap-2">
                          {TRANSACTION_CATEGORIES[t.category]?.label || t.category}
                          {t.description && <span className="text-xs font-normal text-muted truncate max-w-[100px]">- {t.description}</span>}
                        </div>
                        <div className="text-[10px] text-muted">{t.type === 'expense' ? '支出' : '收入'}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`font-bold ${t.type === 'expense' ? 'text-main' : 'text-emerald-500'}`}>
                        {t.type === 'expense' ? '-' : '+'}{formatCurrency(t.amount)}
                      </span>

                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => onEdit(t)}
                          aria-label={`Edit ${t.description || t.category}`}
                          className="p-1.5 text-muted hover:text-blue-500 rounded bg-slate-100 dark:bg-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(t.id)}
                          aria-label={`Delete ${t.description || t.category}`}
                          className="p-1.5 text-muted hover:text-red-500 rounded bg-slate-100 dark:bg-slate-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BookkeepingList;
