<template>
  <view class="bg-surface border border-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
    <!-- Background decorative elements -->
    <view class="absolute -top-10 -right-10 w-32 h-32 bg-primary-10 rounded-full blur-3xl pointer-events-none"></view>
    <view class="absolute -bottom-10 -left-10 w-32 h-32 bg-secondary-10 rounded-full blur-3xl pointer-events-none"></view>

    <view class="flex items-center justify-between mb-4 relative z-10">
      <view class="flex items-center gap-2">
        <BaseIcon name="Bot" class="text-primary" />
        <text class="text-xl font-bold text-main">AI 订阅顾问</text>
      </view>
      <button
        @click="handleAnalyze"
        :disabled="loading || subscriptions.length === 0"
        class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-primary to-indigo-600 text-white rounded-lg text-sm shadow-lg disabled-opacity-50"
      >
        <BaseIcon v-if="!loading" name="Sparkles" :size="16" color="white" />
        <text class="font-medium text-white">{{ loading ? '分析中...' : '智能分析' }}</text>
      </button>
    </view>

    <view class="bg-slate-100 dark:bg-slate-900 rounded-xl p-4 min-h-120 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 relative z-10">
      <view v-if="analysis">
        <text class="text-sm leading-6 whitespace-pre-wrap">{{ analysis }}</text>
      </view>
      <view v-else class="flex flex-col items-center justify-center h-full py-4">
        <BaseIcon name="Sparkles" class="text-muted mb-2 opacity-50" :size="32" />
        <text class="text-muted text-sm">点击“智能分析”获取您的个性化支出报告</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { analyzeSubscriptions } from '../services/geminiService';
import { Subscription } from '../common/types';
import BaseIcon from './BaseIcon.vue';

const props = defineProps<{
  subscriptions: Subscription[];
}>();

const analysis = ref<string | null>(null);
const loading = ref(false);

const handleAnalyze = async () => {
  loading.value = true;
  const result = await analyzeSubscriptions(props.subscriptions);
  analysis.value = result;
  loading.value = false;
};
</script>

<style scoped>
/* Scoped styles handled by global utility classes in App.vue mostly */
.min-h-120 { min-height: 120px; }
.disabled-opacity-50 { opacity: 0.5; }
</style>