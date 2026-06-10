import React, { useState, useEffect } from 'react';
import { Subscription, CycleType } from '../types';
import { X, Check, CreditCard, Calendar, Info } from 'lucide-react';
import { formatCurrency, calculateNextBillingDate, advanceBillingDate, formatDateOnly } from '../utils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (price: number, date: string) => void;
  subscription: Subscription | null;
}

const RenewModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, subscription }) => {
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(formatDateOnly(new Date()));

  useEffect(() => {
    if (isOpen && subscription) {
      setPrice(subscription.price.toString());
      setDate(formatDateOnly(new Date()));
    }
  }, [isOpen, subscription]);
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

  if (!isOpen || !subscription) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(parseFloat(price) || 0, date);
    onClose();
  };

  const nextDate = calculateNextBillingDate(subscription.startDate, subscription.cycle);
  const nextRenewalDate = advanceBillingDate(subscription.startDate, subscription.cycle);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-label="续费弹窗">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-4 border-b border-border bg-background/50">
          <h3 className="text-lg font-semibold text-main flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-emerald-500" />
            确认续费
          </h3>
          <button type="button" onClick={onClose} aria-label="关闭续费弹窗" className="text-muted hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-border flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg">
                {subscription.name.charAt(0).toUpperCase()}
             </div>
             <div>
                 <p className="font-medium text-main">{subscription.name}</p>
                 <p className="text-xs text-muted">原定价格: {formatCurrency(subscription.price)}</p>
             </div>
          </div>

          <div className="text-xs text-blue-600 bg-blue-50 dark:bg-blue-900/20 p-2.5 rounded-lg border border-blue-100 dark:border-blue-800/30 flex gap-2">
             <Info className="w-4 h-4 shrink-0" />
              <p>当前扣款日: {nextDate.toLocaleDateString()}。确认后会新增一条支出，并把下次扣款日推进到 {nextRenewalDate.toLocaleDateString()}。</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">本次实付金额</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full text-xl font-bold bg-background border border-border rounded-lg px-4 py-2 text-main focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">扣款日期</label>
            <div className="relative">
                <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg pl-10 pr-4 py-2.5 text-main focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                />
                <Calendar className="w-4 h-4 text-muted absolute left-3 top-3" />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-semibold py-3 rounded-lg shadow-lg shadow-emerald-500/25 transition-all flex justify-center items-center gap-2 mt-2"
          >
            <Check className="w-5 h-5" />
            确认续费并继续下个周期
          </button>
        </form>
      </div>
    </div>
  );
};

export default RenewModal;
