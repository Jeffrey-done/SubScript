
import React, { useState, useEffect, useRef } from 'react';
import { X, Sparkles, RefreshCw, Zap, Bot } from 'lucide-react';
import { Subscription, Budget, AIConfig } from '../types';
import { analyzeFinances } from '../services/aiService';
// @ts-ignore
import { marked } from 'marked';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: Subscription[];
  budget: Budget;
  aiConfig: AIConfig;
}

const AIAnalysisModal: React.FC<Props> = ({ isOpen, onClose, subscriptions, budget, aiConfig }) => {
  const [content, setContent] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentEndRef = useRef<HTMLDivElement>(null);
  const stopFnRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (isOpen && !content && !isAnalyzing) {
      startAnalysis();
    }
    // Cleanup on unmount or close
    return () => {
        if (stopFnRef.current) stopFnRef.current();
    };
  }, [isOpen]);

  useEffect(() => {
    // Auto-scroll to bottom
    if (contentEndRef.current) {
      contentEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [content]);

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    setContent('');
    
    stopFnRef.current = await analyzeFinances(
      subscriptions,
      budget,
      aiConfig,
      (token) => {
        setContent(prev => prev + token);
      },
      () => {
        setIsAnalyzing(false);
        stopFnRef.current = null;
      },
      (err) => {
        setError(err);
        setIsAnalyzing(false);
        stopFnRef.current = null;
      }
    );
  };

  const handleClose = () => {
     if (stopFnRef.current) stopFnRef.current();
     onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50 sticky top-0 backdrop-blur-md">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-lg text-white shadow-lg shadow-purple-500/20">
                <Bot className="w-5 h-5" />
             </div>
             <div>
                <h3 className="text-lg font-bold text-main flex items-center gap-2">
                    AI 智能财务顾问
                    <span className="text-[10px] bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">Beta</span>
                </h3>
             </div>
          </div>
          <div className="flex items-center gap-2">
            {!isAnalyzing && (
                <button 
                    onClick={startAnalysis}
                    className="p-2 text-muted hover:text-primary transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full"
                    title="重新分析"
                >
                    <RefreshCw className="w-5 h-5" />
                </button>
            )}
            <button onClick={handleClose} className="text-muted hover:text-main transition-colors p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
                <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/30">
            {error ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 mb-4">
                        <Zap className="w-6 h-6" />
                    </div>
                    <h3 className="text-main font-medium mb-2">分析遇到问题</h3>
                    <p className="text-muted text-sm mb-6 max-w-xs">{error}</p>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleClose}
                            className="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            关闭
                        </button>
                        <button 
                            onClick={startAnalysis}
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium shadow-lg hover:bg-indigo-600 transition-colors"
                        >
                            重试
                        </button>
                    </div>
                </div>
            ) : (
                <div className="space-y-4">
                   {content ? (
                        <div 
                            className="markdown-body text-main"
                            dangerouslySetInnerHTML={{ __html: marked.parse(content) }}
                        />
                   ) : (
                       <div className="flex flex-col items-center justify-center py-20 opacity-50">
                           <Sparkles className="w-10 h-10 text-primary animate-pulse mb-4" />
                           <p className="text-sm text-muted">正在连接 DeepSeek 思考您的财务状况...</p>
                       </div>
                   )}
                   
                   {isAnalyzing && (
                       <div className="flex items-center gap-2 text-xs text-muted mt-4 pt-4 border-t border-border border-dashed">
                           <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                           <span>AI 正在输入...</span>
                       </div>
                   )}
                   <div ref={contentEndRef} />
                </div>
            )}
        </div>
        
        {/* Footer info */}
        <div className="p-3 bg-surface border-t border-border text-[10px] text-muted text-center flex justify-between items-center px-6">
            <span>Powered by DeepSeek V3</span>
            <span>仅供参考，不构成专业理财建议</span>
        </div>
      </div>
    </div>
  );
};

export default AIAnalysisModal;
