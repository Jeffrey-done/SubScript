import { Subscription, Budget, AIConfig, Transaction } from '../types';

export interface JianguoyunBackupData {
  subscriptions: Subscription[];
  budget: Budget;
  restDays?: string[];
  aiConfig?: AIConfig;
  transactions?: Transaction[];
  lastUpdated: string;
}

export interface JianguoyunBackupConfig {
  account: string;
  appPassword: string;
  fileName: string;
}

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const buildEndpoint = (workerUrl: string, action: 'upload' | 'download') => {
  const base = trimTrailingSlash(workerUrl);
  return `${base}/api/backup/jianguoyun/${action}`;
};

export const jianguoyunService = {
  async uploadBackup(
    workerUrl: string,
    config: JianguoyunBackupConfig & {
      data: {
        subscriptions: Subscription[];
        budget: Budget;
        restDays?: string[];
        aiConfig?: AIConfig;
        transactions?: Transaction[];
      };
    }
  ) {
    if (!workerUrl) throw new Error('请先配置 Cloudflare Worker 地址');
    if (!config.account.trim()) throw new Error('请输入坚果云账号');
    if (!config.appPassword.trim()) throw new Error('请输入坚果云应用密码');

    const response = await fetch(buildEndpoint(workerUrl, 'upload'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account: config.account.trim(),
        appPassword: config.appPassword.trim(),
        fileName: config.fileName.trim() || 'subscript_backup.json',
        data: config.data,
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `坚果云上传失败 (${response.status})`);
    }

    return payload as { success: boolean; data?: JianguoyunBackupData };
  },

  async downloadBackup(workerUrl: string, config: JianguoyunBackupConfig) {
    if (!workerUrl) throw new Error('请先配置 Cloudflare Worker 地址');
    if (!config.account.trim()) throw new Error('请输入坚果云账号');
    if (!config.appPassword.trim()) throw new Error('请输入坚果云应用密码');

    const response = await fetch(buildEndpoint(workerUrl, 'download'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        account: config.account.trim(),
        appPassword: config.appPassword.trim(),
        fileName: config.fileName.trim() || 'subscript_backup.json',
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `坚果云下载失败 (${response.status})`);
    }

    return payload?.data as JianguoyunBackupData;
  },
};
