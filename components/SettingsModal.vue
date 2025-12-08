<template>
  <view v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <view class="absolute inset-0 bg-black opacity-60" @click="close"></view>
    
    <!-- Modal Content -->
    <view class="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative z-10 animate-fade-in">
      <view class="flex justify-between items-center p-5 border-b border-border bg-background-50">
        <view class="flex items-center gap-2">
            <BaseIcon name="Settings" class="text-primary" />
            <text class="text-lg font-semibold text-main">数据备份与恢复</text>
        </view>
        <view @click="close" class="text-muted p-1">
          <BaseIcon name="X" :size="20" />
        </view>
      </view>

      <view class="p-6 space-y-5">
          <view class="space-y-4">
             <view class="flex items-center gap-2 mb-2">
                <text class="text-sm font-bold text-main">本地文件管理</text>
             </view>
             
             <view class="grid grid-cols-2 gap-3">
                 <button 
                    @click="handleExport"
                    class="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-xl"
                 >
                    <BaseIcon name="CloudDownload" class="text-primary" />
                    <text class="text-sm font-medium text-main">导出备份</text>
                 </button>

                 <button 
                    @click="handleImport"
                    class="flex flex-col items-center justify-center gap-2 bg-slate-100 dark:bg-slate-800 p-4 rounded-xl"
                 >
                    <BaseIcon name="CloudUpload" class="text-emerald-500" />
                    <text class="text-sm font-medium text-main">导入恢复</text>
                 </button>
             </view>
          </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';
import BaseIcon from './BaseIcon.vue';

const props = defineProps<{
  isOpen: boolean;
  currentData: any; 
}>();

const emit = defineEmits(['close', 'restore']);

const close = () => {
    emit('close');
};

const handleExport = () => {
    // UniApp Export Logic (Simulated for Web)
    // #ifdef H5
    const dataStr = JSON.stringify(props.currentData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SubScript_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    uni.showToast({ title: '已导出', icon: 'success' });
    // #endif

    // #ifndef H5
    uni.setClipboardData({
        data: JSON.stringify(props.currentData),
        success: () => uni.showToast({ title: '数据已复制到剪贴板', icon: 'none' })
    });
    // #endif
};

const handleImport = () => {
    // UniApp Import Logic
    // #ifdef H5
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                emit('restore', json);
                uni.showToast({ title: '恢复成功', icon: 'success' });
                setTimeout(close, 1000);
            } catch (e) {
                uni.showToast({ title: '文件无效', icon: 'error' });
            }
        };
        reader.readAsText(file);
    };
    input.click();
    // #endif

    // #ifndef H5
    uni.showModal({
        title: '导入',
        content: '移动端暂只支持从剪贴板导入JSON',
        editable: true,
        placeholderText: '粘贴JSON数据',
        success: (res) => {
            if (res.confirm && res.content) {
                try {
                    const json = JSON.parse(res.content);
                    emit('restore', json);
                    uni.showToast({ title: '恢复成功', icon: 'success' });
                    close();
                } catch(e) {
                    uni.showToast({ title: 'JSON格式错误', icon: 'error' });
                }
            }
        }
    });
    // #endif
};
</script>

<style scoped>
.animate-fade-in { animation: fadeIn 0.2s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
</style>