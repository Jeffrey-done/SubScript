import { UserAuth, CloudResponse, Subscription, Budget, AIConfig, Transaction } from '../types';

export interface AppData {
  subscriptions: Subscription[];
  budget: Budget;
  restDays: string[];
  aiConfig: AIConfig;
  transactions: Transaction[];
  lastUpdated: number;
}

// Get API base URL (User's Worker Proxy URL)
const getApiUrl = (proxyUrl?: string) => {
    if (proxyUrl) return proxyUrl.replace(/\/$/, '');
    return '';
};

export const cloudService = {
  // Register
  async register(proxyUrl: string, username: string, password: string): Promise<CloudResponse> {
    if (!proxyUrl) throw new Error("请先在设置中配置代理 URL (Worker 地址)");
    try {
      const res = await fetch(`${getApiUrl(proxyUrl)}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || '网络连接失败' };
    }
  },

  // Login
  async login(proxyUrl: string, username: string, password: string): Promise<CloudResponse<{ token: string }>> {
    if (!proxyUrl) throw new Error("请先在设置中配置代理 URL (Worker 地址)");
    try {
      const res = await fetch(`${getApiUrl(proxyUrl)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message || '网络连接失败' };
    }
  },

  // Push Data (Sync to Cloud)
  async pushData(proxyUrl: string, token: string, data: AppData): Promise<CloudResponse> {
    if (!proxyUrl) throw new Error("未配置代理 URL");
    try {
      const res = await fetch(`${getApiUrl(proxyUrl)}/api/sync/push`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        },
        body: JSON.stringify(data)
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Pull Data (Sync from Cloud)
  async pullData(proxyUrl: string, token: string): Promise<CloudResponse<AppData>> {
    if (!proxyUrl) throw new Error("未配置代理 URL");
    try {
      const res = await fetch(`${getApiUrl(proxyUrl)}/api/sync/pull`, {
        method: 'GET',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': token 
        }
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
};