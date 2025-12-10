

export type CycleType = 'monthly' | 'yearly' | 'weekly';

export type CategoryType = 'entertainment' | 'utilities' | 'software' | 'insurance' | 'other';

export interface Subscription {
  id: string;
  name: string;
  price: number;
  currency: string;
  cycle: CycleType;
  startDate: string; // ISO Date string
  category: CategoryType;
  description?: string;
  logoUrl?: string; // Optional custom logo
}

export interface Budget {
  monthly: number;
  yearly: number;
  baseSalary: number; // Added base salary
  commission: number; // Added commission
  payday: number; // Day of the month (1-31)
  salaryDelay: number; // 0 = Current month, 1 = Next month
}

export interface SpendingStats {
  monthlyTotal: number;
  yearlyTotal: number;
  categoryBreakdown: { name: string; value: number; color: string }[];
}

export interface AIModelConfig {
  appId: string;
  apiSecret: string;
  apiKey: string;
  domain: string;
}

export interface AIConfig {
  chat: AIModelConfig;
  image: AIModelConfig;
  proxyUrl?: string; // Optional Proxy URL to bypass CORS
}

export const CATEGORIES: Record<CategoryType, { label: string; color: string }> = {
  entertainment: { label: '娱乐', color: '#8b5cf6' }, // Violet
  utilities: { label: '生活缴费', color: '#f59e0b' }, // Amber
  software: { label: '软件/SaaS', color: '#3b82f6' }, // Blue
  insurance: { label: '保险', color: '#10b981' }, // Emerald
  other: { label: '其他', color: '#64748b' }, // Slate
};

export const CYCLES: Record<CycleType, { label: string; multiplier: number }> = {
  weekly: { label: '每周', multiplier: 52 },
  monthly: { label: '每月', multiplier: 12 },
  yearly: { label: '每年', multiplier: 1 },
};