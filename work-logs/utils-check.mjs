// utils.ts
var formatCurrency = (amount, currency = "CNY") => {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount);
};
var DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
var parseDateOnly = (value) => {
  const trimmed = value.trim();
  const match = trimmed.match(DATE_ONLY_REGEX);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return /* @__PURE__ */ new Date();
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};
var formatDateOnly = (value) => {
  const date = typeof value === "string" ? parseDateOnly(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
var startOfLocalDay = (value) => {
  const date = typeof value === "string" ? parseDateOnly(value) : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};
var addCycle = (date, cycle) => {
  const nextDate = new Date(date);
  if (cycle === "weekly") {
    nextDate.setDate(nextDate.getDate() + 7);
    return nextDate;
  }
  const originalDay = nextDate.getDate();
  nextDate.setDate(1);
  if (cycle === "monthly") {
    nextDate.setMonth(nextDate.getMonth() + 1);
  } else {
    nextDate.setFullYear(nextDate.getFullYear() + 1);
  }
  const lastDayOfTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
  nextDate.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return nextDate;
};
var calculateNextBillingDate = (startDateStr, cycle) => {
  const start = parseDateOnly(startDateStr);
  const today = startOfLocalDay(/* @__PURE__ */ new Date());
  let nextDate = new Date(start);
  if (nextDate > today) return nextDate;
  while (nextDate < today) {
    nextDate = addCycle(nextDate, cycle);
  }
  return nextDate;
};
var advanceBillingDate = (startDateStr, cycle) => {
  return addCycle(calculateNextBillingDate(startDateStr, cycle), cycle);
};
var getDaysUntil = (date) => {
  const today = startOfLocalDay(/* @__PURE__ */ new Date());
  const target = startOfLocalDay(date);
  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
  return diffDays;
};
var getPaydayCountdown = (payday) => {
  const today = /* @__PURE__ */ new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  let targetDate = new Date(currentYear, currentMonth, payday);
  if (currentDay > payday) {
    targetDate = new Date(currentYear, currentMonth + 1, payday);
  }
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  const diffTime = targetDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
  return diffDays;
};
var calculateStats = (subscriptions) => {
  let monthlyTotal = 0;
  let yearlyTotal = 0;
  const categoryMap = {};
  subscriptions.forEach((sub) => {
    let monthlyCost = 0;
    if (sub.cycle === "monthly") {
      monthlyCost = sub.price;
      yearlyTotal += sub.price * 12;
    } else if (sub.cycle === "yearly") {
      monthlyCost = sub.price / 12;
      yearlyTotal += sub.price;
    } else if (sub.cycle === "weekly") {
      monthlyCost = sub.price * 4.33;
      yearlyTotal += sub.price * 52;
    }
    monthlyTotal += monthlyCost;
    if (!categoryMap[sub.category]) {
      categoryMap[sub.category] = 0;
    }
    categoryMap[sub.category] += monthlyCost;
  });
  return {
    monthlyTotal,
    yearlyTotal,
    categoryBreakdown: Object.entries(categoryMap).map(([key, value]) => ({
      name: key,
      value: parseFloat(value.toFixed(2)),
      // @ts-ignore
      color: ""
      // Will be filled in component
    }))
  };
};
var getDaysInMonth = (year, month) => {
  return new Date(year, month + 1, 0).getDate();
};
var countSundaysInMonth = (year, month) => {
  const days = getDaysInMonth(year, month);
  let count = 0;
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 0) {
      count++;
    }
  }
  return count;
};
var countStandardRestDays = (year, month, mode) => {
  const days = getDaysInMonth(year, month);
  let count = 0;
  for (let day = 1; day <= days; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    if (mode === "double") {
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        count++;
      }
    } else {
      if (dayOfWeek === 0) {
        count++;
      }
    }
  }
  return count;
};
export {
  advanceBillingDate,
  calculateNextBillingDate,
  calculateStats,
  countStandardRestDays,
  countSundaysInMonth,
  formatCurrency,
  formatDateOnly,
  getDaysInMonth,
  getDaysUntil,
  getPaydayCountdown,
  parseDateOnly,
  startOfLocalDay
};
