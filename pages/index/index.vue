<template>
  <view class="page-container" :class="theme">
    <!-- Header -->
    <view class="sticky top-0 z-30 bg-surface-80 backdrop-blur border-b border-border px-4 py-3 flex justify-between items-center safe-area-top">
       <view class="flex items-center gap-2">
          <view class="w-8 h-8 bg-gradient-to-br from-primary to-indigo-700 rounded-lg flex items-center justify-center shadow-md">
             <BaseIcon name="Wallet" :size="16" color="white" />
          </view>
          <text class="text-lg font-bold text-main">SubScript</text>
       </view>
       <view class="flex gap-3">
           <view @click="isSettingsOpen = true" class="p-2 rounded-full border border-border">
              <BaseIcon name="Settings" :size="20" class="text-main" />
           </view>
           <view @click="toggleTheme" class="p-2 rounded-full border border-border">
              <BaseIcon :name="theme === 'dark' ? 'Moon' : 'Sun'" :size="20" class="text-main" />
           </view>
       </view>
    </view>

    <!-- Content Area -->
    <scroll-view scroll-y class="flex-1 content-scroll" :style="{ height: contentHeight + 'px' }">
       <view class="p-4 pb-24">
          <!-- Dynamic Tab Content -->
          <view v-if="activeTab === 'dashboard'">
             <Dashboard 
                :subscriptions="subscriptions" 
                :budget="budget" 
                @updateBudget="handleUpdateBudget" 
             />
          </view>
          <view v-else>
             <SubscriptionList 
                :subscriptions="subscriptions" 
                :isLoading="isLoading"
                @delete="handleDelete"
                @edit="handleEdit"
             />
          </view>
       </view>
    </scroll-view>

    <!-- Custom Bottom Tab Bar -->
    <view class="fixed bottom-0 left-0 right-0 bg-surface-90 backdrop-blur border-t border-border flex justify-between items-end px-8 pb-safe z-50 h-16">
       <view @click="activeTab = 'dashboard'" class="flex flex-col items-center justify-center pb-2 w-16" :class="activeTab === 'dashboard' ? 'text-primary' : 'text-muted'">
          <BaseIcon name="LayoutDashboard" :size="24" :color="activeTab === 'dashboard' ? 'currentColor' : ''" />
          <text class="text-xs mt-1">概览</text>
       </view>

       <!-- Floating Add Button -->
       <view class="relative -top-6">
          <view @click="openAddModal" class="w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg border-4 border-background text-white">
             <BaseIcon name="Plus" :size="28" color="white" />
          </view>
       </view>

       <view @click="activeTab = 'list'" class="flex flex-col items-center justify-center pb-2 w-16 relative" :class="activeTab === 'list' ? 'text-primary' : 'text-muted'">
          <BaseIcon name="List" :size="24" :color="activeTab === 'list' ? 'currentColor' : ''" />
          <text class="text-xs mt-1">列表</text>
          <view v-if="subscriptions.length > 0" class="absolute top-0 right-2 w-2 h-2 bg-red-500 rounded-full"></view>
       </view>
    </view>

    <!-- Subscription Modal -->
    <SubscriptionModal 
       :isOpen="isModalOpen" 
       :initialData="editingSub"
       @close="isModalOpen = false"
       @save="handleSaveSubscription"
    />

    <!-- Settings/Backup Modal -->
    <SettingsModal
        :isOpen="isSettingsOpen"
        :currentData="{ subscriptions, budget }"
        @close="isSettingsOpen = false"
        @restore="handleDataRestore"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { Subscription, Budget } from '../../common/types';
import BaseIcon from '../../components/BaseIcon.vue';
import Dashboard from '../../components/Dashboard.vue';
import SubscriptionList from '../../components/SubscriptionList.vue';
import SubscriptionModal from '../../components/SubscriptionModal.vue';
import SettingsModal from '../../components/SettingsModal.vue';

// State
const theme = ref<'light' | 'dark'>('light');
const activeTab = ref<'dashboard' | 'list'>('dashboard');
const isModalOpen = ref(false);
const isSettingsOpen = ref(false);
const isLoading = ref(true);
const contentHeight = ref(600);
const editingSub = ref<Subscription | undefined>(undefined);

// Data
const subscriptions = ref<Subscription[]>([]);
const budget = ref<Budget>({ monthly: 2000, yearly: 24000 });

onMounted(() => {
  // Load stored data
  const storedSubs = uni.getStorageSync('subscriptions');
  const storedBudget = uni.getStorageSync('budget');
  const storedTheme = uni.getStorageSync('theme');

  if (storedSubs) {
    subscriptions.value = JSON.parse(storedSubs);
  } else {
    subscriptions.value = [];
  }

  if (storedBudget) budget.value = JSON.parse(storedBudget);
  
  if (storedTheme) theme.value = storedTheme;

  // Screen height calculation
  const sysInfo = uni.getSystemInfoSync();
  contentHeight.value = sysInfo.windowHeight - 64; // Approx header height

  setTimeout(() => isLoading.value = false, 800);
});

// Persistence
watch(subscriptions, (val) => uni.setStorageSync('subscriptions', JSON.stringify(val)), { deep: true });
watch(budget, (val) => uni.setStorageSync('budget', JSON.stringify(val)), { deep: true });
watch(theme, (val) => uni.setStorageSync('theme', val));

// Actions
const toggleTheme = () => theme.value = theme.value === 'dark' ? 'light' : 'dark';

const openAddModal = () => {
    editingSub.value = undefined;
    isModalOpen.value = true;
};

const handleSaveSubscription = (subData: Omit<Subscription, 'id'>) => {
    if (editingSub.value) {
        const index = subscriptions.value.findIndex(s => s.id === editingSub.value!.id);
        if (index !== -1) {
            subscriptions.value[index] = { ...subData, id: editingSub.value.id };
        }
    } else {
        subscriptions.value.push({
            ...subData,
            id: Date.now().toString()
        });
    }
};

const handleEdit = (sub: Subscription) => {
    editingSub.value = sub;
    isModalOpen.value = true;
};

const handleDelete = (id: string) => {
    uni.showModal({
        title: '确认删除',
        content: '确定要删除这个订阅吗？',
        success: (res) => {
            if (res.confirm) {
                subscriptions.value = subscriptions.value.filter(s => s.id !== id);
            }
        }
    });
};

const handleUpdateBudget = (newBudget: Budget) => {
    budget.value = newBudget;
};

const handleDataRestore = (data: any) => {
    if (data.subscriptions) subscriptions.value = data.subscriptions;
    if (data.budget) budget.value = data.budget;
};
</script>

<style>
/* Safe area for bottom tab */
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
/* Custom utility for scroll height */
.content-scroll { height: calc(100vh - 120px); }
</style>