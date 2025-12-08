<template>
  <view v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <!-- Backdrop -->
    <view class="absolute inset-0 bg-black opacity-60" @click="close"></view>
    
    <!-- Modal Content -->
    <view class="bg-surface border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden relative z-10 animate-fade-in">
      <view class="flex justify-between items-center p-5 border-b border-border bg-background-50">
        <text class="text-lg font-semibold text-main">{{ initialData ? '编辑订阅' : '添加新订阅' }}</text>
        <view @click="close" class="text-muted p-1">
          <BaseIcon name="X" :size="20" />
        </view>
      </view>

      <view class="p-6 space-y-4">
        <view class="flex gap-4 items-start">
           <!-- Logo Upload -->
           <view class="shrink-0 flex flex-col items-center">
             <view class="w-16 h-16 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden relative bg-background" @click="handleImageUpload">
               <image v-if="form.logoUrl" :src="form.logoUrl" class="w-full h-full" mode="aspectCover" />
               <view v-else class="flex flex-col items-center">
                 <BaseIcon name="Image" class="text-muted" />
                 <text class="text-xs text-muted mt-1">Logo</text>
               </view>
             </view>
             <text v-if="form.logoUrl" class="text-xs text-red-400 mt-1" @click.stop="form.logoUrl = ''">移除</text>
           </view>

           <view class="flex-1">
             <text class="block text-sm font-medium text-muted mb-1">服务名称</text>
             <input
               type="text"
               v-model="form.name"
               placeholder="例如: Netflix"
               class="w-full bg-background border border-border rounded-lg px-4 py-2 text-main"
             />
           </view>
        </view>

        <view class="grid grid-cols-2 gap-4">
          <view>
            <text class="block text-sm font-medium text-muted mb-1">价格 (¥)</text>
            <input
              type="number"
              v-model="form.price"
              placeholder="0.00"
              class="w-full bg-background border border-border rounded-lg px-4 py-2 text-main"
            />
          </view>
          <view>
            <text class="block text-sm font-medium text-muted mb-1">周期</text>
            <picker mode="selector" :range="cycleOptions" range-key="label" @change="onCycleChange">
              <view class="w-full bg-background border border-border rounded-lg px-4 py-2 text-main flex justify-between items-center">
                <text>{{ CYCLES[form.cycle].label }}</text>
                <BaseIcon name="ChevronRight" :size="16" class="text-muted" />
              </view>
            </picker>
          </view>
        </view>

        <view>
          <text class="block text-sm font-medium text-muted mb-1">类别</text>
          <view class="grid grid-cols-3 gap-2">
            <view
              v-for="(config, key) in CATEGORIES"
              :key="key"
              @click="form.category = key"
              class="px-2 py-2 rounded-lg text-xs font-medium border text-center transition-all"
              :style="{
                backgroundColor: form.category === key ? config.color : '',
                borderColor: form.category === key ? config.color : 'var(--border-color)',
                color: form.category === key ? '#fff' : 'var(--text-muted)'
              }"
            >
              {{ config.label }}
            </view>
          </view>
        </view>

        <view>
           <text class="block text-sm font-medium text-muted mb-1">开始日期</text>
           <picker mode="date" :value="form.startDate" @change="onDateChange">
             <view class="w-full bg-background border border-border rounded-lg px-4 py-2 text-main">
               {{ form.startDate || '选择日期' }}
             </view>
           </picker>
        </view>

        <button
          @click="submit"
          class="w-full bg-primary text-white font-semibold py-3 rounded-lg mt-4 flex justify-center items-center gap-2 shadow-lg"
        >
          <BaseIcon name="Check" :size="20" color="white" />
          <text>{{ initialData ? '保存修改' : '添加订阅' }}</text>
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { reactive, watch, computed } from 'vue';
import { Subscription, CycleType, CategoryType, CATEGORIES, CYCLES } from '../common/types';
import BaseIcon from './BaseIcon.vue';

const props = defineProps<{
  isOpen: boolean;
  initialData?: Subscription;
}>();

const emit = defineEmits(['close', 'save']);

const form = reactive({
  name: '',
  price: '',
  cycle: 'monthly' as CycleType,
  category: 'software' as CategoryType,
  startDate: new Date().toISOString().split('T')[0],
  logoUrl: ''
});

const cycleOptions = Object.entries(CYCLES).map(([key, val]) => ({ key, label: val.label }));

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.initialData) {
      form.name = props.initialData.name;
      form.price = props.initialData.price.toString();
      form.cycle = props.initialData.cycle;
      form.category = props.initialData.category;
      form.startDate = props.initialData.startDate.split('T')[0];
      form.logoUrl = props.initialData.logoUrl || '';
    } else {
      form.name = '';
      form.price = '';
      form.cycle = 'monthly';
      form.category = 'software';
      form.startDate = new Date().toISOString().split('T')[0];
      form.logoUrl = '';
    }
  }
});

const close = () => {
  emit('close');
};

const onCycleChange = (e: any) => {
  const index = e.detail.value;
  form.cycle = cycleOptions[index].key as CycleType;
};

const onDateChange = (e: any) => {
  form.startDate = e.detail.value;
};

const handleImageUpload = () => {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      // In UniApp, we often get a temp path. To persist, use FileSystemManager or convert to Base64.
      // For simplicity/web demo, we use File Reader logic if on H5, or temp path on App.
      // Here we assume H5/App compatibility via uni.getFileSystemManager or just using the path.
      // For robust storage, converting to base64 is safer for this local-storage based demo.
      const tempFilePath = res.tempFilePaths[0];
      
      // #ifdef H5
      uni.request({
          url: tempFilePath,
          responseType: 'arraybuffer',
          success: (response) => {
              const base64 = 'data:image/jpeg;base64,' + uni.arrayBufferToBase64(response.data as ArrayBuffer);
              form.logoUrl = base64;
          }
      });
      // #endif
      
      // #ifndef H5
      uni.getFileSystemManager().readFile({
        filePath: tempFilePath,
        encoding: 'base64',
        success: (res) => {
          form.logoUrl = 'data:image/jpeg;base64,' + res.data;
        }
      });
      // #endif
    }
  });
};

const submit = () => {
  if (!form.name || !form.price) return;
  emit('save', {
    name: form.name,
    price: parseFloat(form.price) || 0,
    currency: 'CNY',
    cycle: form.cycle,
    startDate: new Date(form.startDate).toISOString(),
    category: form.category,
    logoUrl: form.logoUrl || undefined
  });
  close();
};
</script>

<style scoped>
/* Utility class simulation */
.grid-cols-2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid-cols-3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
</style>