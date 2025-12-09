import React, { useState, useEffect } from 'react';
import { Subscription, CycleType, CategoryType, CATEGORIES, CYCLES, AIConfig } from '../types';
import { X, Check, Upload, Image as ImageIcon, Sparkles, Loader2, Wand2, AlertCircle } from 'lucide-react';
import { generateImage } from '../services/aiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sub: Omit<Subscription, 'id'>) => void;
  initialData?: Subscription;
  aiConfig: AIConfig;
}

const SubscriptionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, aiConfig }) => {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cycle, setCycle] = useState<CycleType>('monthly');
  const [category, setCategory] = useState<CategoryType>('software');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [logoUrl, setLogoUrl] = useState('');
  
  // AI Image Gen State
  const [showAiGen, setShowAiGen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name);
        setPrice(initialData.price.toString());
        setCycle(initialData.cycle);
        setCategory(initialData.category);
        setStartDate(initialData.startDate.split('T')[0]);
        setLogoUrl(initialData.logoUrl || '');
        setPrompt(initialData.name + " logo, minimalist style, icon");
      } else {
        // Reset defaults for new entry
        setName('');
        setPrice('');
        setCycle('monthly');
        setCategory('software');
        setStartDate(new Date().toISOString().split('T')[0]);
        setLogoUrl('');
        setPrompt('');
      }
      setShowAiGen(false);
      setGenError('');
    }
  }, [isOpen, initialData]);

  // Utility to resize base64 image
  const resizeImage = (base64Str: string, maxWidth = 128, maxHeight = 128): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png')); // Default quality is usually 0.92
      };
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
         const result = reader.result as string;
         // Resize uploaded image too to save space
         const resized = await resizeImage(result);
         setLogoUrl(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
      if (!prompt.trim()) return;
      setIsGenerating(true);
      setGenError('');
      
      try {
          const rawBase64 = await generateImage(prompt, aiConfig);
          // The API returns a large image (512x512 or 1024x1024), we MUST resize it to avoid filling LocalStorage
          const resized = await resizeImage(rawBase64, 128, 128);
          setLogoUrl(resized);
          setShowAiGen(false); // Close the gen UI
      } catch (e: any) {
          console.error(e);
          setGenError(e.message || '生成失败，请检查设置中的 API Key');
      } finally {
          setIsGenerating(false);
      }
  };

  const openAiPanel = () => {
    setShowAiGen(true);
    // Auto-fill prompt if empty
    if (!prompt && name) {
        setPrompt(`${name} logo, minimalist icon, high quality`);
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
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50 sticky top-0 backdrop-blur-md z-10">
          <h3 className="text-lg font-semibold text-main">
            {initialData ? '编辑订阅' : '添加新订阅'}
          </h3>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          
          {/* Name Input First */}
          <div>
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

          {/* Logo & AI Generation Section */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-border">
            <div className="flex gap-4 items-center">
                {/* Logo Preview */}
                <div className="shrink-0">
                    <label className="block w-20 h-20 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 hover:border-primary hover:bg-white dark:hover:bg-slate-700 transition-all cursor-pointer flex items-center justify-center overflow-hidden relative group bg-background shadow-sm">
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
                                <span className="text-[10px]">上传</span>
                            </div>
                        )}
                    </label>
                    {logoUrl && (
                        <button 
                            type="button" 
                            onClick={() => setLogoUrl('')} 
                            className="text-[10px] text-red-500 hover:text-red-600 w-full text-center mt-1.5 font-medium"
                        >
                            移除
                        </button>
                    )}
                </div>

                {/* Controls */}
                <div className="flex-1 flex flex-col justify-center">
                    {!showAiGen ? (
                        <div className="space-y-2 animate-in fade-in">
                            <p className="text-xs text-muted mb-1">设置订阅图标</p>
                            <div className="flex gap-2">
                                <button 
                                    type="button"
                                    onClick={() => document.querySelector<HTMLInputElement>('input[type="file"]')?.click()}
                                    className="flex-1 py-2 px-3 bg-white dark:bg-slate-700 border border-border rounded-lg text-xs font-medium text-main hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Upload className="w-3.5 h-3.5" />
                                    本地上传
                                </button>
                                <button 
                                    type="button"
                                    onClick={openAiPanel}
                                    className="flex-1 py-2 px-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg text-xs font-medium shadow-lg shadow-purple-500/20 hover:from-purple-600 hover:to-indigo-700 transition-all flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-3.5 h-3.5" />
                                    AI 生成
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-in fade-in slide-in-from-right-2 space-y-2 w-full">
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                    <Wand2 className="w-3 h-3" /> AI 图标生成器
                                </label>
                                <button onClick={() => setShowAiGen(false)} className="text-xs text-muted hover:text-main">
                                    取消
                                </button>
                            </div>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="描述图标 (例如: 红色 Netflix N)"
                                    className="flex-1 bg-white dark:bg-slate-900 border border-border rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-purple-500"
                                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleGenerateImage())}
                                />
                                <button
                                    type="button"
                                    onClick={handleGenerateImage}
                                    disabled={isGenerating || !prompt}
                                    className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white rounded-lg px-4 text-xs font-medium transition-colors flex items-center justify-center min-w-[60px] shadow-md"
                                >
                                    {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '生成'}
                                </button>
                            </div>
                            {genError && (
                                <p className="text-[10px] text-red-500 flex items-center gap-1 bg-red-50 dark:bg-red-900/20 p-1.5 rounded border border-red-100 dark:border-red-900 break-all leading-tight">
                                    <AlertCircle className="w-3 h-3 shrink-0" /> {genError}
                                </p>
                            )}
                        </div>
                    )}
                </div>
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
                      ? 'text-white'
                      : 'bg-background border-border text-muted hover:border-slate-400'
                  }`}
                  style={{
                    backgroundColor: category === key ? `${color}33` : undefined,
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

          <div className="pt-4 sticky bottom-0 bg-surface/50 backdrop-blur-sm -mx-6 -mb-6 p-6 border-t border-border mt-auto">
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