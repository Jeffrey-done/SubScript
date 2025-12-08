<template>
  <view class="space-y-6">
    <!-- Summary Card -->
    <view class="bg-gradient-indigo rounded-2xl p-6 shadow-xl relative overflow-hidden text-white">
       <view class="absolute top-0 right-0 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></view>
       <view class="relative z-10">
          <view class="flex items-center gap-2 mb-6">
            <BaseIcon name="Wallet" color="white" />
            <text class="text-lg font-semibold">支出总览</text>
          </view>
          
          <view class="flex flex-col md:flex-row justify-between gap-4">
             <view>
                <text class="text-sm text-indigo-200 block mb-1">每月总固定支出</text>
                <text class="text-3xl font-bold">{{ formatCurrency(stats.monthlyTotal) }}</text>
             </view>
             <view>
                <text class="text-sm text-indigo-200 block mb-1">年度总支出预测</text>
                <text class="text-3xl font-bold">{{ formatCurrency(stats.yearlyTotal) }}</text>
             </view>
             <view>
                <text class="text-sm text-indigo-200 block mb-1">平均单项成本</text>
                <text class="text-3xl font-bold">{{ formatCurrency(averageCost) }} <text class="text-sm text-indigo-300 font-normal">/ 月</text></text>
             </view>
          </view>
       </view>
    </view>

    <!-- Budget Cards (Simplified Layout) -->
    <view class="grid grid-cols-1 gap-4">
      <view class="bg-surface p-4 rounded-2xl border border-border flex flex-col">
        <view class="flex justify-between items-center mb-2">
            <view class="flex items-center gap-2">
                <view class="p-2 bg-indigo-500 bg-opacity-10 rounded-lg text-indigo-500">
                    <BaseIcon name="Calculator" :size="18" />
                </view>
                <text class="text-sm font-medium text-muted">月度预算</text>
            </view>
            <view @click="startEditing('monthly', budget.monthly)" class="p-1">
                <BaseIcon name="Settings2" :size="16" class="text-muted" />
            </view>
        </view>
        
        <view v-if="editingTarget === 'monthly'" class="flex items-center gap-2">
            <input type="number" v-model="tempBudgetValue" class="bg-background border border-border rounded px-2 py-1 text-main flex-1" />
            <view @click="saveBudget" class="text-emerald-500 p-1"><BaseIcon name="Check" :size="18" /></view>
        </view>
        <view v-else>
             <text class="text-2xl font-bold text-main">{{ formatCurrency(stats.monthlyTotal) }}</text>
             <view class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full mt-2 overflow-hidden">
                 <view class="h-full rounded-full bg-indigo-500 transition-all" :style="{ width: Math.min((stats.monthlyTotal / budget.monthly) * 100, 100) + '%' }"></view>
             </view>
             <text class="text-xs text-muted mt-1">预算目标: {{ formatCurrency(budget.monthly) }}</text>
        </view>
      </view>
    </view>

    <!-- Chart Section (CSS Pie Chart) -->
    <view class="bg-surface p-6 rounded-2xl border border-border">
        <text class="text-lg font-semibold text-main mb-6 block">支出构成</text>
        <view class="flex flex-col items-center">
            <!-- CSS Conic Gradient Pie Chart -->
            <view 
                class="w-48 h-48 rounded-full mb-6 relative"
                :style="{ background: pieChartGradient }"
            >
                <!-- Inner hole for Donut effect -->
                <view class="absolute inset-0 m-auto w-32 h-32 bg-surface rounded-full flex items-center justify-center">
                    <text class="text-xs text-muted">分类占比</text>
                </view>
            </view>

            <!-- Legend -->
            <view class="w-full space-y-3">
                <view v-for="cat in sortedBreakdown" :key="cat.name" class="flex justify-between items-center">
                    <view class="flex items-center gap-2">
                        <view class="w-3 h-3 rounded-full" :style="{ backgroundColor: cat.color }"></view>
                        <text class="text-sm text-main">{{ CATEGORIES[cat.name].label }}</text>
                    </view>
                    <text class="text-sm font-semibold text-main">{{ formatCurrency(cat.value) }}</text>
                </view>
            </view>
        </view>
    </view>

    <!-- Calendar View -->
    <view class="bg-surface p-6 rounded-2xl border border-border">
        <view class="flex justify-between items-center mb-4">
            <view class="flex items-center gap-2">
                 <BaseIcon name="CalendarDays" class="text-primary" />
                 <text class="text-lg font-semibold text-main">订阅日历</text>
            </view>
            <view class="flex items-center gap-2 bg-background p-1 rounded-lg border border-border">
                <view @click="prevMonth" class="p-1"><BaseIcon name="ChevronLeft" :size="18" /></view>
                <text class="text-sm text-main w-20 text-center">{{ viewDate.getFullYear() }}.{{ viewDate.getMonth() + 1 }}</text>
                <view @click="nextMonth" class="p-1"><BaseIcon name="ChevronRight" :size="18" /></view>
            </view>
        </view>

        <view class="calendar-grid bg-border border border-border rounded-lg overflow-hidden">
             <!-- Headers -->
             <view v-for="day in ['日', '一', '二', '三', '四', '五', '六']" :key="day" class="bg-slate-100 dark:bg-slate-900 p-2 text-center text-xs text-muted font-bold">
                 {{ day }}
             </view>
             <!-- Empty Start -->
             <view v-for="n in firstDayOfMonth" :key="'empty-'+n" class="bg-surface min-h-20"></view>
             <!-- Days -->
             <view v-for="d in daysInMonth" :key="'day-'+d" class="bg-surface p-1 min-h-20 border-t border-r border-slate-100 dark:border-slate-800 relative">
                 <text :class="['text-xs w-5 h-5 flex items-center justify-center rounded-full mb-1', isToday(d) ? 'bg-primary text-white' : 'text-muted']">{{ d }}</text>
                 <view class="flex flex-col gap-1">
                     <view v-for="sub in (calendarData[d] || [])" :key="sub.id" class="flex items-center gap-1 px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xxs">
                         <view class="w-1.5 h-1.5 rounded-full" :style="{ backgroundColor: CATEGORIES[sub.category].color }"></view>
                         <text class="text-slate-600 dark:text-slate-300 truncate max-w-full block">{{ sub.name }}</text>
                     </view>
                 </view>
             </view>
        </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, defineProps, defineEmits } from 'vue';
import { Subscription, CATEGORIES, Budget } from '../common/types';
import { calculateStats, formatCurrency } from '../common/utils';
import BaseIcon from './BaseIcon.vue';

const props = defineProps<{
  subscriptions: Subscription[];
  budget: Budget;
}>();

const emit = defineEmits(['updateBudget']);

const editingTarget = ref<'monthly' | 'yearly' | null>(null);
const tempBudgetValue = ref('');
const viewDate = ref(new Date());

const stats = computed(() => {
  const data = calculateStats(props.subscriptions);
  data.categoryBreakdown = data.categoryBreakdown.map(item => ({
      ...item,
      color: CATEGORIES[item.name as keyof typeof CATEGORIES]?.color || '#cbd5e1'
  }));
  return data;
});

const sortedBreakdown = computed(() => [...stats.value.categoryBreakdown].sort((a, b) => b.value - a.value));
const averageCost = computed(() => props.subscriptions.length > 0 ? stats.value.monthlyTotal / props.subscriptions.length : 0);

// CSS Conic Gradient for Pie Chart
const pieChartGradient = computed(() => {
  if (sortedBreakdown.value.length === 0) return 'conic-gradient(#cbd5e1 0% 100%)';
  
  let currentPercentage = 0;
  const segments = sortedBreakdown.value.map(cat => {
      const percentage = (cat.value / stats.value.monthlyTotal) * 100;
      const start = currentPercentage;
      currentPercentage += percentage;
      return `${cat.color} ${start}% ${currentPercentage}%`;
  });
  return `conic-gradient(${segments.join(', ')})`;
});

// Budget Logic
const startEditing = (type: 'monthly' | 'yearly', current: number) => {
  editingTarget.value = type;
  tempBudgetValue.value = current.toString();
};

const saveBudget = () => {
  if (editingTarget.value && tempBudgetValue.value) {
      const val = parseFloat(tempBudgetValue.value);
      if (!isNaN(val) && val >= 0) {
          emit('updateBudget', { ...props.budget, [editingTarget.value]: val });
      }
  }
  editingTarget.value = null;
};

// Calendar Logic
const firstDayOfMonth = computed(() => new Date(viewDate.value.getFullYear(), viewDate.value.getMonth(), 1).getDay());
const daysInMonth = computed(() => new Date(viewDate.value.getFullYear(), viewDate.value.getMonth() + 1, 0).getDate());

const calendarData = computed(() => {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth();
    const data: Record<number, Subscription[]> = {};
    const totalDays = daysInMonth.value;

    props.subscriptions.forEach(sub => {
        const start = new Date(sub.startDate);
        start.setHours(0, 0, 0, 0);
        
        if (sub.cycle === 'monthly') {
             let day = start.getDate();
             if (day > totalDays) day = totalDays;
             const dateToCheck = new Date(year, month, day);
             if (dateToCheck >= start) {
                 if (!data[day]) data[day] = [];
                 data[day].push(sub);
             }
        } else if (sub.cycle === 'yearly') {
             if (start.getMonth() === month) {
                 const day = start.getDate();
                 if (day >= 1) { // simple check
                    if (!data[day]) data[day] = [];
                    data[day].push(sub);
                 }
             }
        } else if (sub.cycle === 'weekly') {
             // Simplified weekly logic for example
             for (let d = 1; d <= totalDays; d++) {
                 const dateToCheck = new Date(year, month, d);
                 if (dateToCheck >= start) {
                     const diff = Math.floor((dateToCheck.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                     if (diff % 7 === 0) {
                        if (!data[d]) data[d] = [];
                        data[d].push(sub);
                     }
                 }
             }
        }
    });
    return data;
});

const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === viewDate.value.getMonth() && today.getFullYear() === viewDate.value.getFullYear();
};

const nextMonth = () => {
    const d = new Date(viewDate.value);
    d.setMonth(d.getMonth() + 1);
    viewDate.value = d;
};
const prevMonth = () => {
    const d = new Date(viewDate.value);
    d.setMonth(d.getMonth() - 1);
    viewDate.value = d;
};
</script>

<style scoped>
.bg-gradient-indigo { background: linear-gradient(135deg, #4f46e5 0%, #3730a3 100%); }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 1px; }
.min-h-20 { min-height: 80px; }
.text-xxs { font-size: 10px; }
</style>