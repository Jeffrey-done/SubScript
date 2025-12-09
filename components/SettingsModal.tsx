
import React, { useRef, useState, useEffect } from 'react';
import { X, Settings, Download, Upload, FileJson, Check, AlertCircle, Cloud, ExternalLink } from 'lucide-react';
import { Subscription, Budget } from '../types';
import { pantryService } from '../services/pantryService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentData: {
    subscriptions: Subscription[];
    budget: Budget;
    restDays: string[];
  };
  onRestore: (data: { subscriptions: Subscription[]; budget: Budget; restDays?: string[] }) => void;
}

const SettingsModal: React.FC<Props> = ({ isOpen, onClose, currentData, onRestore }) => {
  const [status, setStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [pantryId, setPantryId] = useState('');
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'upload' | 'download' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load saved Pantry ID
    const savedId = localStorage.getItem('pantry_id');
    if (savedId) setPantryId(savedId);
  }, []);

  const handleSavePantryId = (val: string) => {
    setPantryId(val);
    localStorage.setItem('pantry_id', val);
  };

  const handleLocalExport = () => {
    try {
      const dataStr = JSON.stringify(currentData, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `SubScript_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setStatus({ type: 'success', msg: '备份文件已成功导出' });
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      setStatus({ type: 'error', msg: '导出失败' });
    }
  };

  const handleLocalImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Remove window.confirm to prevent blocking issues
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json && Array.isArray(json.subscriptions)) {
          setStatus({ type: 'success', msg: `文件解析成功！准备恢复...` });
          
          // UX Sequence: Show Success -> Close Modal -> Trigger Restore Animation
          setTimeout(() => {
            setStatus(null);
            onClose(); // Close modal first
            
            // Trigger the actual data update and loading screen after modal starts closing
            setTimeout(() => {
                onRestore(json);
            }, 300);
          }, 1000);
        } else {
          throw new Error('无效的备份文件结构');
        }
      } catch (err) {
        setStatus({ type: 'error', msg: '文件解析失败，请确保是有效的 JSON 备份' });
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  // Pantry Cloud Handlers
  const handleCloudBackup = async () => {
    if (!pantryId.trim()) {
      setStatus({ type: 'error', msg: '请先填写 Pantry ID' });
      return;
    }

    setIsCloudLoading(true);
    setLoadingType('upload');
    setStatus(null);
    try {
      // Basic validation
      if (!currentData.subscriptions) {
        throw new Error('没有可备份的数据');
      }

      await pantryService.uploadBackup(pantryId, currentData);
      setStatus({ type: 'success', msg: `云端备份成功！包含 ${currentData.subscriptions.length} 条订阅。` });
    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message || '备份失败，请检查 ID 或网络' });
    } finally {
      setIsCloudLoading(false);
      setLoadingType(null);
    }
  };

  const handleCloudRestore = async () => {
    if (!pantryId.trim()) {
      setStatus({ type: 'error', msg: '请先填写 Pantry ID' });
      return;
    }

    // Removed blocking window.confirm to ensure button works on all devices immediately
    setIsCloudLoading(true);
    setLoadingType('download');
    setStatus(null);
    try {
      const data = await pantryService.downloadBackup(pantryId);
      
      if (!Array.isArray(data.subscriptions)) {
          throw new Error('云端数据格式异常：缺少订阅列表');
      }

      setStatus({ 
        type: 'success', 
        msg: `下载成功！正在恢复 ${data.subscriptions.length} 个订阅...` 
      });

      // UX Sequence: Show Success -> Close Modal -> Trigger Restore Animation
      setTimeout(() => {
        setStatus(null);
        onClose(); // Close modal first
        
        // Trigger the actual data update and loading screen after modal starts closing
        setTimeout(() => {
            onRestore(data);
        }, 300);
      }, 1000);

    } catch (e: any) {
      console.error(e);
      setStatus({ type: 'error', msg: e.message || '恢复失败，请检查 ID 或是否已有备份' });
    } finally {
      setIsCloudLoading(false);
      setLoadingType(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b border-border bg-background/50 sticky top-0 backdrop-blur-md z-10 shrink-0">
          <div className="flex items-center gap-2 text-main">
            <Settings className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold">数据备份与恢复</h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-main transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8 overflow-y-auto">
          
          {/* Pantry Cloud Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cloud className="w-5 h-5 text-blue-500" />
                <h4 className="text-sm font-bold text-main">Pantry Cloud (免费云同步)</h4>
              </div>
              <a 
                href="https://getpantry.cloud/" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1"
              >
                获取 ID <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl space-y-3 border border-border">
              <div>
                <label className="text-xs text-muted mb-1 block">Your Pantry ID</label>
                <input 
                  type="text" 
                  value={pantryId}
                  onChange={(e) => handleSavePantryId(e.target.value)}
                  placeholder="例如: 9471f008-..."
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-main focus:ring-2 focus:ring-primary outline-none"
                />
                <p className="text-[10px] text-muted mt-1.5 leading-relaxed">
                  Pantry Cloud 是一个免费的 JSON 存储服务，原生支持跨域，无需代理即可使用。
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <button
                  onClick={handleCloudBackup}
                  disabled={isCloudLoading || !pantryId}
                  className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
                >
                  {isCloudLoading && loadingType === 'upload' ? (
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                        <span>正在上传...</span>
                     </div>
                  ) : (
                     <>
                        <Upload className="w-4 h-4" />
                        <span>上传备份</span>
                     </>
                  )}
                </button>
                <button
                  onClick={handleCloudRestore}
                  disabled={isCloudLoading || !pantryId}
                  className="flex items-center justify-center gap-2 bg-surface border border-border hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-main py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                   {isCloudLoading && loadingType === 'download' ? (
                     <div className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-muted border-t-main rounded-full animate-spin"/>
                        <span>正在恢复...</span>
                     </div>
                  ) : (
                     <>
                        <Download className="w-4 h-4" />
                        <span>从云端恢复</span>
                     </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="h-px bg-border w-full"></div>

          {/* Local Backup Section */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <FileJson className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold text-main">本地文件备份</h4>
             </div>
             
             <div className="grid grid-cols-2 gap-3">
                 <button 
                    onClick={handleLocalExport}
                    className="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-4 rounded-xl transition-all border border-transparent hover:border-border"
                 >
                    <Download className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-medium text-main">导出文件</span>
                 </button>

                 <button 
                    onClick={handleLocalImportClick}
                    className="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 p-4 rounded-xl transition-all border border-transparent hover:border-border"
                 >
                    <Upload className="w-5 h-5 text-emerald-600" />
                    <span className="text-xs font-medium text-main">导入文件</span>
                 </button>
                 <input 
                    type="file" 
                    accept=".json" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                 />
             </div>
          </div>

          {/* Status Bar */}
          {status && (
              <div className={`text-xs p-3 rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 ${
                  status.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-300' : 
                  'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300'
              }`}>
                  {status.type === 'error' ? <AlertCircle className="w-4 h-4 shrink-0" /> : <Check className="w-4 h-4 shrink-0" />}
                  <span className="flex-1 font-medium">{status.msg}</span>
              </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
