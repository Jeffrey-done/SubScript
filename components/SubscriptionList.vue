<template>
  <view class="space-y-4">
    <view v-if="isLoading" class="grid grid-cols-1 gap-4">
       <!-- Skeleton Loader -->
       <view v-for="i in 3" :key="i" class="bg-surface border border-border rounded-xl p-5 h-36 animate-pulse"></view>
    </view>

    <view v-else-if="subscriptions.length === 0" class="text-center py-20 bg-surface rounded-2xl border border-border border-dashed">
       <view class="flex justify-center mb-4">
          <view class="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center">
              <BaseIcon name="Calendar" class="text-muted" :size="32" />
          </view>
       </view>
       <text class="text-lg font-medium text-main block">没有订阅</text>
       <text class="text-muted mt-1 text-sm block">点击“+”按钮添加您的第一个订阅</text>
    </view>

    <view v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
       <view 
          v-for="sub in sortedSubs" 
          :key="sub.id" 
          class="bg-surface border border-border rounded-xl p-5 shadow-sm relative overflow-hidden"
       >
          <!-- Urgency Strip -->
          <view :class="['absolute top-0 left-0 w-1 h-full', getUrgencyColor(sub)]"></view>

          <view class="flex justify-between items-start mb-4 pl-3">
             <view class="flex items-center gap-3">
                <image v-if="sub.logoUrl" :src="sub.logoUrl" class="w-10 h-10 rounded-lg bg-slate-100" mode="aspectFill" />
                <view v-else class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" :style="{ backgroundColor: CATEGORIES[sub.category].color }">
                   {{ sub.name.charAt(0).toUpperCase() }}
                </view>
                <view>
                   <text class="block font-semibold text-main text-lg">{{ sub.name }}</text>
                   <text class="text-xs text-muted px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 border border-border inline-block mt-1">
                      {{ CATEGORIES[sub.category].label }}
                   </text>
                </view>
             </view>
             <view class="text-right">
                <text class="block text-lg font-bold text-main">{{ formatCurrency(sub.price) }}</text>
                <text class="text-xs text-muted">/ {{ CYCLES[sub.cycle].label }}</text>
             </view>
          </view>

          <view class="flex items-center justify-between mt-4 pl-3 pt-4 border-t border-border">
              <view>
                 <text class="text-xs text-muted block">下次扣款</text>
                 <view class="flex items-center gap-1 mt-1">
                    <BaseIcon name="CalendarClock" :size="14" class="text-muted" />
                    <text class="text-sm font-medium text-main">{{ getNextDateStr(sub) }}</text>
                    <text class="text-xs text-muted">({{ getDaysLeftStr(sub) }})</text>
                 </view>
              </view>
              <view class="flex gap-4">
                  <view @click="emit('edit', sub)" class="text-blue-500"><BaseIcon name="Edit2" :size="18" /></view>
                  <view @click="emit('delete', sub.id)" class="text-red-500"><BaseIcon name="Trash2" :size="18" /></view>
              </view>
          </view>
       </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Subscription, CATEGORIES, CYCLES } from '../common/types';
import { calculateNextBillingDate, getDaysUntil, formatCurrency } from '../common/utils';
import BaseIcon from './BaseIcon.vue';

const props = defineProps<{
  subscriptions: Subscription[];
  isLoading: boolean;
}>();

const emit = defineEmits(['delete', 'edit']);

const sortedSubs = computed(() => {
  return [...props.subscriptions].sort((a, b) => {
    const daysA = getDaysUntil(calculateNextBillingDate(a.startDate, a.cycle));
    const daysB = getDaysUntil(calculateNextBillingDate(b.startDate, b.cycle));
    return daysA - daysB;
  });
});

const getNextDateStr = (sub: Subscription) => {
    return calculateNextBillingDate(sub.startDate, sub.cycle).toLocaleDateString('zh-CN');
};

const getDaysLeftStr = (sub: Subscription) => {
    const d = getDaysUntil(calculateNextBillingDate(sub.startDate, sub.cycle));
    return d === 0 ? '今天' : `${d}天后`;
};

const getUrgencyColor = (sub: Subscription) => {
    const d = getDaysUntil(calculateNextBillingDate(sub.startDate, sub.cycle));
    if (d <= 3) return 'bg-red-500';
    if (d <= 7) return 'bg-yellow-500';
    return 'bg-slate-300 dark:bg-slate-700';
};
</script>

<style scoped>
.animate-pulse { opacity: 0.7; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
</style>