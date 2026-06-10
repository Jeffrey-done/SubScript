import { AIConfig, AIModelConfig, Budget, CATEGORIES, CycleType, Subscription, TRANSACTION_CATEGORIES, Transaction, TransactionType } from '../types';
import { formatDateOnly, parseDateOnly } from '../utils';
import type { AppData } from './cloudService';

const VALID_CYCLE_SET = new Set<CycleType>(['weekly', 'monthly', 'yearly']);
const VALID_TRANSACTION_TYPES = new Set<TransactionType>(['expense', 'income']);
const VALID_TRANSACTION_SOURCES = new Set(['manual', 'renewal', 'ai']);
const VALID_SUBSCRIPTION_CATEGORIES = new Set(Object.keys(CATEGORIES));
const VALID_TRANSACTION_CATEGORIES = new Set(Object.keys(TRANSACTION_CATEGORIES));

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const getString = (source: Record<string, unknown>, key: string, fallback = '') =>
  typeof source[key] === 'string' ? source[key] as string : fallback;

const getNumber = (source: Record<string, unknown>, key: string, fallback: number) =>
  typeof source[key] === 'number' && Number.isFinite(source[key]) ? source[key] as number : fallback;

const parseSubscription = (value: unknown): Subscription | null => {
  if (!isRecord(value)) return null;
  const name = getString(value, 'name').trim();
  const cycle = getString(value, 'cycle') as CycleType;
  const category = getString(value, 'category') as string;
  const price = typeof value.price === 'number' && Number.isFinite(value.price) && value.price >= 0 ? value.price : NaN;
  const startDate = getString(value, 'startDate');

  if (!name || !VALID_CYCLE_SET.has(cycle) || !VALID_SUBSCRIPTION_CATEGORIES.has(category) || Number.isNaN(price)) {
    return null;
  }

  return {
    id: typeof value.id === 'string' && value.id ? value.id : crypto.randomUUID(),
    name,
    price,
    currency: getString(value, 'currency', 'CNY') || 'CNY',
    cycle,
    startDate: startDate ? formatDateOnly(startDate) : formatDateOnly(new Date()),
    category: category as Subscription['category'],
    description: typeof value.description === 'string' ? value.description : undefined,
    logoUrl: typeof value.logoUrl === 'string' ? value.logoUrl : undefined,
  };
};

const parseTransaction = (value: unknown): Transaction | null => {
  if (!isRecord(value)) return null;
  const amount = typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount >= 0 ? value.amount : NaN;
  const type = getString(value, 'type') as TransactionType;
  const category = getString(value, 'category', 'other');

  if (Number.isNaN(amount) || !VALID_TRANSACTION_TYPES.has(type)) {
    return null;
  }

  const normalizedCategory = VALID_TRANSACTION_CATEGORIES.has(category) ? category : 'other';
  const source = getString(value, 'source');

  return {
    id: typeof value.id === 'string' && value.id ? value.id : crypto.randomUUID(),
    amount,
    date: formatDateOnly(typeof value.date === 'string' ? value.date : new Date()),
    category: normalizedCategory,
    description: typeof value.description === 'string' ? value.description : undefined,
    type,
    source: VALID_TRANSACTION_SOURCES.has(source) ? source as Transaction['source'] : undefined,
  };
};

const parseBudget = (value: unknown, fallback: Budget): Budget | null => {
  if (!isRecord(value)) return null;
  return {
    monthly: getNumber(value, 'monthly', fallback.monthly),
    yearly: getNumber(value, 'yearly', fallback.yearly),
    baseSalary: getNumber(value, 'baseSalary', fallback.baseSalary),
    commission: getNumber(value, 'commission', fallback.commission),
    payday: getNumber(value, 'payday', fallback.payday),
    salaryDelay: getNumber(value, 'salaryDelay', fallback.salaryDelay),
    workMode: value.workMode === 'double' ? 'double' : 'single',
  };
};

const parseModelConfig = (value: unknown, fallback: AIModelConfig): AIModelConfig => {
  const source = isRecord(value) ? value : {};
  return {
    appId: getString(source, 'appId', fallback.appId),
    apiSecret: getString(source, 'apiSecret', fallback.apiSecret),
    apiKey: getString(source, 'apiKey', fallback.apiKey),
    domain: getString(source, 'domain', fallback.domain),
  };
};

const parseAIConfig = (value: unknown, fallback: AIConfig, builtInProxyUrl: string): AIConfig | null => {
  const source = isRecord(value) ? value : {};

  if (typeof source.appId === 'string') {
    return {
      chat: parseModelConfig(source, fallback.chat),
      image: fallback.image,
      ocr: fallback.ocr,
      proxyUrl: builtInProxyUrl || fallback.proxyUrl || '',
    };
  }

  const config: AIConfig = {
    chat: parseModelConfig(source.chat, fallback.chat),
    image: parseModelConfig(source.image, fallback.image),
    ocr: parseModelConfig(source.ocr, fallback.ocr),
    proxyUrl: getString(source, 'proxyUrl', fallback.proxyUrl || builtInProxyUrl),
  };

  if (!config.proxyUrl && builtInProxyUrl) {
    config.proxyUrl = builtInProxyUrl;
  }

  const hasBundledDefaultShape =
    config.chat.appId &&
    config.chat.appId === config.image.appId &&
    config.chat.appId === config.ocr.appId &&
    config.chat.apiSecret === config.image.apiSecret &&
    config.chat.apiSecret === config.ocr.apiSecret &&
    config.chat.apiKey === config.image.apiKey &&
    config.chat.apiKey === config.ocr.apiKey &&
    config.chat.domain === fallback.chat.domain &&
    config.image.domain === fallback.image.domain &&
    config.ocr.domain === fallback.ocr.domain;

  if (hasBundledDefaultShape) {
    return { ...fallback, proxyUrl: config.proxyUrl };
  }

  return config;
};

const parseRestDays = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  return value
    .filter((item): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.trim()))
    .map((item) => formatDateOnly(item));
};

export interface NormalizeImportedDataOptions {
  budgetFallback: Budget;
  aiConfigFallback: AIConfig;
  builtInProxyUrl: string;
}

export interface NormalizeImportedDataResult {
  data: Partial<AppData>;
  hasUsableData: boolean;
  droppedFields: string[];
}

export const normalizeImportedData = (value: unknown, options: NormalizeImportedDataOptions): NormalizeImportedDataResult => {
  const source = isRecord(value) ? value : {};
  const data: Partial<AppData> = {};
  const droppedFields: string[] = [];

  if (Array.isArray(source.subscriptions)) {
    const subscriptions = source.subscriptions
      .map(parseSubscription)
      .filter((item): item is Subscription => Boolean(item));
    if (subscriptions.length > 0) {
      data.subscriptions = subscriptions;
    } else {
      droppedFields.push('subscriptions');
    }
  }

  if (hasOwn(source, 'budget')) {
    const budget = parseBudget(source.budget, options.budgetFallback);
    if (budget) {
      data.budget = budget;
    } else {
      droppedFields.push('budget');
    }
  }

  if (Array.isArray(source.restDays)) {
    const restDays = parseRestDays(source.restDays);
    if (restDays && restDays.length > 0) {
      data.restDays = restDays;
    } else {
      droppedFields.push('restDays');
    }
  }

  if (hasOwn(source, 'aiConfig')) {
    const aiConfig = parseAIConfig(source.aiConfig, options.aiConfigFallback, options.builtInProxyUrl);
    if (aiConfig) {
      data.aiConfig = aiConfig;
    } else {
      droppedFields.push('aiConfig');
    }
  }

  if (Array.isArray(source.transactions)) {
    const transactions = source.transactions
      .map(parseTransaction)
      .filter((item): item is Transaction => Boolean(item));
    if (transactions.length > 0) {
      data.transactions = transactions;
    } else {
      droppedFields.push('transactions');
    }
  }

  if (typeof source.lastUpdated === 'number' && Number.isFinite(source.lastUpdated)) {
    data.lastUpdated = source.lastUpdated;
  }

  return {
    data,
    hasUsableData: Boolean(data.subscriptions?.length || data.budget || data.restDays?.length || data.aiConfig || data.transactions?.length || data.lastUpdated),
    droppedFields,
  };
};

function hasOwn(value: object, key: string) {
  return Object.prototype.hasOwnProperty.call(value, key);
}
