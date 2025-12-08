import { CycleType, Subscription } from './types';

export const formatCurrency = (amount: number, currency: string = 'CNY') => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
  }).format(amount);
};

export const calculateNextBillingDate = (startDateStr: string, cycle: CycleType): Date => {
  const start = new Date(startDateStr);
  const today = new Date();
  
  // Reset hours for accurate date comparison
  today.setHours(0, 0, 0, 0);
  
  let nextDate = new Date(start);
  
  // If start date is in the future, that's the next billing date
  if (nextDate > today) return nextDate;

  while (nextDate < today) {
    if (cycle === 'weekly') {
      nextDate.setDate(nextDate.getDate() + 7);
    } else if (cycle === 'monthly') {
      nextDate.setMonth(nextDate.getMonth() + 1);
    } else if (cycle === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }
  }
  
  return nextDate;
};

export const getDaysUntil = (date: Date): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

export const calculateStats = (subscriptions: Subscription[]) => {
  let monthlyTotal = 0;
  let yearlyTotal = 0;
  const categoryMap: Record<string, number> = {};

  subscriptions.forEach(sub => {
    let monthlyCost = 0;
    
    if (sub.cycle === 'monthly') {
      monthlyCost = sub.price;
      yearlyTotal += sub.price * 12;
    } else if (sub.cycle === 'yearly') {
      monthlyCost = sub.price / 12;
      yearlyTotal += sub.price;
    } else if (sub.cycle === 'weekly') {
      monthlyCost = sub.price * 4.33;
      yearlyTotal += sub.price * 52;
    }

    monthlyTotal += monthlyCost;

    if (!categoryMap[sub.category]) {
      categoryMap[sub.category] = 0;
    }
    categoryMap[sub.category] += monthlyCost; // Store monthly normalized cost for comparison
  });

  return {
    monthlyTotal,
    yearlyTotal,
    categoryBreakdown: Object.entries(categoryMap).map(([key, value]) => ({
      name: key,
      value: parseFloat(value.toFixed(2)),
      color: '', // Will be filled in component
    })),
  };
};