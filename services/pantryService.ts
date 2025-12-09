
import { Subscription, Budget, AIConfig } from '../types';

const BASE_URL = 'https://getpantry.cloud/apiv1/pantry';
const BASKET_NAME = 'subscript_backup'; // The storage bucket name

export interface BackupData {
  subscriptions: Subscription[];
  budget: Budget;
  restDays?: string[];
  aiConfig?: AIConfig;
  lastUpdated: string;
}

export const pantryService = {
  /**
   * Upload backup to Pantry Cloud
   * @param pantryId The user's Pantry ID
   * @param data The data to backup
   */
  async uploadBackup(pantryId: string, data: { subscriptions: Subscription[]; budget: Budget; restDays?: string[]; aiConfig?: AIConfig }) {
    if (!pantryId) throw new Error('请输入 Pantry ID');

    const payload: BackupData = {
      ...data,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const response = await fetch(`${BASE_URL}/${pantryId}/basket/${BASKET_NAME}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('Pantry ID 无效或不存在');
        throw new Error(`上传失败: ${response.statusText}`);
      }
      
      return true;
    } catch (error) {
      console.error('Pantry Upload Error:', error);
      throw error;
    }
  },

  /**
   * Download backup from Pantry Cloud
   * @param pantryId The user's Pantry ID
   */
  async downloadBackup(pantryId: string) {
    if (!pantryId) throw new Error('请输入 Pantry ID');

    try {
      // Use timestamp query param to force cache busting effectively
      const response = await fetch(`${BASE_URL}/${pantryId}/basket/${BASKET_NAME}?t=${Date.now()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
      });

      if (!response.ok) {
        if (response.status === 404) throw new Error('找不到备份数据 (或 Pantry ID 错误)');
        throw new Error(`下载失败: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate structure roughly
      if (!data.subscriptions && !data.budget) {
        throw new Error('云端数据格式不正确');
      }

      return data as BackupData;
    } catch (error) {
      console.error('Pantry Download Error:', error);
      throw error;
    }
  }
};
