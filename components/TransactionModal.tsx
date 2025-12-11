import React, { useState, useEffect, useRef } from 'react';
import { Transaction, TransactionType, TRANSACTION_CATEGORIES, AIConfig } from '../types';
import { X, Check, ScanLine, Loader2, Bot, MessageSquare, Edit2, Send, ImagePlus, Sparkles } from 'lucide-react';
import { recognizeReceipt, parseTransactionFromText } from '../services/aiService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (transaction: Omit<Transaction, 'id'>) => void;
  initialData?: Transaction;
  aiConfig?: AIConfig; // Pass config for OCR/Chat
}

const TransactionModal: React.FC<Props> = ({ isOpen, onClose, onSave, initialData, aiConfig }) => {
  // Modes: 'manual' form or 'ai' chat input
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');
  
  // Manual Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('food');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<TransactionType>('expense');
  
  // AI/Chat State
  const [chatInput, setChatInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiError, setAiError] = useState('');
  // Context for Chat Correction (stores raw OCR text)
  const [ocrContext, setOcrContext] = useState('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setAmount(initialData.amount.toString());
        setDate(initialData.date);
        setCategory(initialData.category);
        setDescription(initialData.description || '');
        setType(initialData.type);
        setActiveTab('manual');
      } else {
        // Defaults
        setAmount('');
        setDate(new Date().toISOString().split('T')[0]);
        setCategory('food');
        setDescription('');
        setType('expense');
        setActiveTab('manual');
      }
      setChatInput('');
      setAiError('');
      setOcrContext(''); // Reset context
      setIsProcessing(false);
    }
  }, [isOpen, initialData]);

  // --- Handlers ---

  const fillForm = (result: Partial<Transaction>) => {
      if (result.amount !== undefined && result.amount > 0) setAmount(result.amount.toString());
      if (result.date) setDate(result.date);
      if (result.category && TRANSACTION_CATEGORIES[result.category]) setCategory(result.category);
      if (result.description) setDescription(result.description);
      if (result.type) setType(result.type);
  };

  const compressImage = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                  const canvas = document.createElement('canvas');
                  const MAX_WIDTH = 800; 
                  let width = img.width;
                  let height = img.height;

                  if (width > MAX_WIDTH) {
                      height *= MAX_WIDTH / width;
                      width = MAX_WIDTH;
                  }

                  canvas.width = width;
                  canvas.height = height;
                  const ctx = canvas.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);
                  // Quality increased to 0.8 for better OCR of small text (dates/codes)
                  resolve(canvas.toDataURL('image/jpeg', 0.8));
              };
              img.onerror = () => reject(new Error("图片加载失败"));
          };
          reader.onerror = (err) => reject(err);
      });
  };

  // 1. Image Upload (OCR)
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!aiConfig) {
          setAiError("请先在设置中配置 AI 密钥");
          setActiveTab('ai'); // Show error in AI tab
          return;
      }

      setIsProcessing(true);
      setAiError('');

      try {
          // Compress
          const base64 = await compressImage(file);
          const rawBase64 = base64.split(',')[1];
          
          // OCR + Analysis
          // @ts-ignore
          const result = await recognizeReceipt(rawBase64, aiConfig);

          // Fill whatever we found (merchant, date, etc.)
          fillForm(result);

          if (result.amount > 0) {
              // SUCCESS: Prioritize using this info.
              // Switch to manual mode so user can review and save.
              setActiveTab('manual');
              setOcrContext('');
          } else {
              // NOT IDEAL: Missing amount or critical info.
              // Let user correct via chat input.
              setActiveTab('ai');
              setOcrContext(result.rawText); // Store raw OCR text as context
              setAiError('识别结果不完整（未找到金额），请在下方对话框补充信息。');
          }
          
      } catch (err: any) {
          console.error(err);
          setAiError(err.message || "识别失败");
          setActiveTab('ai');
      } finally {
          setIsProcessing(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
      }
  };

  // 2. Text Submit (Chat)
  const handleTextSubmit = async () => {
      if (!chatInput.trim()) return;
      if (!aiConfig) {
          setAiError("请先在设置中配置 AI 密钥");
          return;
      }

      setIsProcessing(true);
      setAiError('');

      try {
          // Construct input for AI:
          // If we have previous OCR context, prepend it so AI knows what "it" refers to.
          let inputText = chatInput;
          if (ocrContext) {
              inputText = `[OCR原文参考]:\n${ocrContext}\n\n[用户补充说明]:\n${chatInput}`;
          }

          const result = await parseTransactionFromText(inputText, aiConfig);
          fillForm(result);
          
          if (result.amount > 0) {
              // Now we have full info, go to Manual to save
              setActiveTab('manual');
              setOcrContext(''); // Clear context
              setChatInput('');
          } else {
              setAiError("仍无法确定金额，请明确说明 (例如 '金额是50元')");
          }

      } catch (err: any) {
           console.error(err);
           setAiError(err.message || "解析失败");
      } finally {
          setIsProcessing(false);
      }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        
        {/* Header with Tabs */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-background/50">
           <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
               <button 
                  onClick={() => setActiveTab('manual')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab === 'manual' ? 'bg-white dark:bg-slate-700 text-main shadow-sm' : 'text-muted hover:text-main'}`}
               >
                   <Edit2 className="w-3.5 h-3.5" /> 记一笔
               </button>
               <button 
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab === 'ai' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-muted hover:text-main'}`}
               >
                   <Sparkles className="w-3.5 h-3.5" /> AI 助手
               </button>
           </div>
           <button onClick={onClose} className="text-muted hover:text-main transition-colors p-1">
              <X className="w-5 h-5" />
           </button>
        </div>

        {/* Content */}
        {activeTab === 'ai' ? (
            <div className="p-6 space-y-4 flex flex-col h-full">
                <div className="flex-1 space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 shrink-0">
                            <Bot className="w-5 h-5" />
                        </div>
                        <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-tl-none p-3 text-sm text-main">
                            <p>嗨！告诉我这笔账单的详情，或者上传一张图片，我会帮你自动填好。</p>
                            <p className="text-xs text-muted mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                试着说: "昨天午饭吃了麦当劳 35元"
                            </p>
                        </div>
                    </div>

                    <div className="relative">
                        <textarea 
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder={ocrContext ? "请补充金额或修正信息..." : "输入交易详情..."}
                            className={`w-full h-32 bg-background border rounded-xl p-4 text-sm text-main outline-none focus:ring-2 focus:ring-purple-500 resize-none ${ocrContext ? 'border-purple-300 dark:border-purple-800' : 'border-border'}`}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleTextSubmit();
                                }
                            }}
                        />
                        {isProcessing && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-[1px] rounded-xl flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
                            </div>
                        )}
                    </div>
                </div>

                {aiError && (
                    <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-900 animate-in fade-in">
                        {aiError}
                    </p>
                )}

                <div className="flex gap-2">
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isProcessing}
                        className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-muted hover:text-main transition-colors border border-transparent hover:border-border"
                        title="上传图片"
                    >
                        <ImagePlus className="w-5 h-5" />
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
                    
                    <button 
                        onClick={handleTextSubmit}
                        disabled={isProcessing || !chatInput.trim()}
                        className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-purple-500/25 transition-all disabled:opacity-50 disabled:shadow-none"
                    >
                        {isProcessing ? '分析中...' : '发送'}
                        {!isProcessing && <Send className="w-4 h-4" />}
                    </button>
                </div>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-5 animate-in slide-in-from-left-4 duration-300">
                {/* Manual Form */}
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
                        <label className="block text-sm font-medium text-muted mb-1">备注</label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-main outline-none focus:ring-2 focus:ring-primary"
                            placeholder="可选..."
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
        )}
      </div>
    </div>
  );
};

export default TransactionModal;
