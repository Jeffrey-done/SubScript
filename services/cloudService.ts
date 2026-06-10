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

// Helper: Fetch with Timeout to prevent hanging UI (Critical for connectivity issues)
const fetchWithTimeout = async (url: string, options: RequestInit = {}, timeout = 15000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error('请求超时 (15秒)。服务器无响应，请检查 Proxy URL 是否正确，或网络是否通畅。');
        }
        // Handle common network errors clearly
        if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
             throw new Error('无法连接到服务器。请检查：1. 自定义域名是否生效 2. 您的网络是否能访问该域名');
        }
        throw error;
    }
};

export const cloudService = {
  // Register
  async register(proxyUrl: string, username: string, password: string): Promise<CloudResponse> {
    if (!proxyUrl) throw new Error("请先在设置中配置代理 URL (Worker 地址)");
    try {
      const res = await fetchWithTimeout(`${getApiUrl(proxyUrl)}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Login
  async login(proxyUrl: string, username: string, password: string): Promise<CloudResponse<{ token: string }>> {
    if (!proxyUrl) throw new Error("请先在设置中配置代理 URL (Worker 地址)");
    try {
      const res = await fetchWithTimeout(`${getApiUrl(proxyUrl)}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await res.json();
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  // Push Data (Sync to Cloud)
  async pushData(proxyUrl: string, token: string, data: AppData): Promise<CloudResponse> {
    if (!proxyUrl) throw new Error("未配置代理 URL");
    try {
      const res = await fetchWithTimeout(`${getApiUrl(proxyUrl)}/api/sync/push`, {
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
      const res = await fetchWithTimeout(`${getApiUrl(proxyUrl)}/api/sync/pull`, {
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