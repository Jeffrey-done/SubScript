import React, { useState, useEffect } from 'react';
import { Transaction, TransactionType, TRANSACTION_CATEGORIES } from '../types';
import { X, Check } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  initialData?: Transaction;
}

const TransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(initialData.amount.toString());
        setDate(initialData.date);
        setCategory(initialData.category);
        setDescription(initialData.description || '');
        setType(initialData.type);
      } else {
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setCategory('food');
        setDescription('');
        setType('expense');
      }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      amount: parseFloat(amount) || 0,
      date,
      category,
      description,
      type
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50">
          <h3 className="text-lg font-semibold text-main">
            {initialData ? '编辑记录' : '记一笔'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Type Toggle */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
             <button
                type="button"
                onClick={() => setType('expense')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    type === 'expense' ? 'bg-white dark:bg-slate-700 text-red-500 shadow-sm' : 'text-muted'
                }`}
             >
                支出
             </button>
             {/* Currently mostly expense focused, but structure allows income */}
             <button
                type="button"
                onClick={() => setType('income')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
                    type === 'income' ? 'bg-white dark:bg-slate-700 text-emerald-500 shadow-sm' : 'text-muted'
                }`}
             >
                收入
             </button>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">金额</label>
            <input
              type="number"
              required
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full text-2xl font-bold bg-transparent border-b-2 border-border focus:border-primary outline-none py-2 text-main placeholder:text-slate-300 dark:placeholder:text-slate-700 transition-colors"
              placeholder="0.00"
              autoFocus
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-muted mb-2">分类</label>
             <div className="grid grid-cols-4 gap-2">
                 {Object.entries(TRANSACTION_CATEGORIES).map(([key, cfg]) => (
                     <button
                        key={key}
                        type="button"
                        onClick={() => setCategory(key)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${
                            category === key 
                            ? 'bg-primary/10 border-primary text-primary' 
                            : 'bg-background border-border text-muted hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                     >
                         <div className="w-3 h-3 rounded-full mb-1" style={{ backgroundColor: cfg.color }} />
                         <span className="text-xs">{cfg.label}</span>
                     </button>
                 ))}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-muted mb-1">日期</label>
                <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-main outline-none focus:ring-2 focus:ring-primary"
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-muted mb-1">备注 (可选)</label>
                <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-main outline-none focus:ring-2 focus:ring-primary"
                    placeholder="备注..."
                />
             </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary hover:bg-indigo-600 text-white font-semibold py-3 rounded-lg shadow-lg shadow-primary/25 transition-all flex justify-center items-center gap-2 mt-4"
          >
            <Check className="w-5 h-5" />
            保存
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionModal;