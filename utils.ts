import { CycleType, Subscription } from './types';

export const formatCurrency = (amount: number, currency: string = 'CNY') => {
  return new Intl.NumberFormat('zh-CN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
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

export const getPaydayCountdown = (payday: number): number => {
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Create date object for this month's payday
  let targetDate = new Date(currentYear, currentMonth, payday);

  // If today is strictly past the payday, calculate for next month
  // If today IS the payday, diffDays will be 0
  if (currentDay > payday) {
    targetDate = new Date(currentYear, currentMonth + 1, payday);
  }

  // Handle month rollover (e.g. payday is 31st but next month only has 30 days)
  // JS Date handles this automatically (e.g. Feb 30 becomes Mar 2), 
  // but usually for payday logic we might want the last day of month if overflow.
  // For simplicity, we let JS standard behavior apply or clamp it.
  // Ideally: Math.min(payday, daysInMonth)
  
  // Reset hours to compare dates properly
  today.setHours(0,0,0,0);
  targetDate.setHours(0,0,0,0);

  const diffTime = targetDate.getTime() - today.getTime();
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
      // @ts-ignore
      color: '', // Will be filled in component
    })),
  };
};

// --- Salary Calculation Helpers ---

export const getDaysInMonth = (year: number, month: number) => {
  return new Date(year, month + 1, 0).getDate();
};

export const countSundaysInMonth = (year: number, month: number) => {
  const days = getDaysInMonth(year, month);
  let count = 0;
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 0) { // 0 represents Sunday
      count++;
    }
  }
  return count;
};