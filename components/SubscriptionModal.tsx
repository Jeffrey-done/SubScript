import React, { useState, useEffect } from 'react';
import { Subscription, CycleType, CategoryType, CATEGORIES, CYCLES } from '../types';
import { X, Check, Upload, Image as ImageIcon } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Omit<Subscription, 'id'>) => void;
  initialData?: Subscription;
}

const SubscriptionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<CycleType>('monthly');
  const [category, setCategory] = useState<CategoryType>('software');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setPrice(initialData.price.toString());
        setCycle(initialData.cycle);
        setCategory(initialData.category);
        setStartDate(initialData.startDate.split('T')[0]);
        setLogoUrl(initialData.logoUrl || '');
      } else {
        // Reset defaults for new entry
        setName('');
        setPrice('');
        setCycle('monthly');
        setCategory('software');
        setStartDate(new Date().toISOString().split('T')[0]);
        setLogoUrl('');
      }
    }
  }, [isOpen, initialData]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      price: parseFloat(price) || 0,
      currency: 'CNY',
      cycle,
      startDate: new Date(startDate).toISOString(),
      category,
      logoUrl: logoUrl || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50">
          <h3 className="text-lg font-semibold text-main">
            {initialData ? '编辑订阅' : '添加新订阅'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          <div className="flex gap-4 items-start">
            <div className="shrink-0">
                <label className="block w-16 h-16 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center overflow-hidden relative group bg-background">
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    {logoUrl ? (
                        <>
                            <img src={logoUrl} alt="Preview" className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="w-5 h-5 text-white" />
                            </div>
                        </>
                    ) : (
                        <div className="text-muted flex flex-col items-center gap-1 group-hover:text-primary transition-colors">
                            <ImageIcon className="w-6 h-6" />
                            <span className="text-[10px]">Logo</span>
                        </div>
                    )}
                </label>
                {logoUrl && (
                    <button 
                        type="button" 
                        onClick={() => setLogoUrl('')} 
                        className="text-xs text-red-400 mt-1 hover:text-red-300 w-full text-center"
                    >
                        移除
                    </button>
                )}
            </div>

            <div className="flex-1">
                <label className="block text-sm font-medium text-muted mb-1">服务名称</label>
                <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: Netflix, Spotify"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-main focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-slate-400"
                />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">价格 (¥)</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-main focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">周期</label>
              <select
                value={cycle}
                onChange={(e) => setCycle(e.target.value as CycleType)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-main focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
              >
                {Object.entries(CYCLES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-muted mb-1">类别</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(CATEGORIES).map(([key, { label, color }]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key as CategoryType)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                    category === key
                      ? `bg-${color}/20 border-${color} text-white`
                      : 'bg-background border-border text-muted hover:border-slate-400'
                  }`}
                  style={{
                    backgroundColor: category === key ? color : undefined,
                    borderColor: category === key ? color : undefined,
                    color: category === key ? '#fff' : undefined
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
             <label className="block text-sm font-medium text-muted mb-1">开始日期 / 上次扣款</label>
             <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-4 py-2.5 text-main focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
             />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              className="w-full bg-primary hover:bg-indigo-600 text-white font-semibold py-3 rounded-lg shadow-lg shadow-primary/25 transition-all flex justify-center items-center gap-2"
            >
              <Check className="w-5 h-5" />
              {initialData ? '保存修改' : '添加订阅'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubscriptionModal;