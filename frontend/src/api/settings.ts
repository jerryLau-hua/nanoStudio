/**
 * 用户设置 API
 */
import { apiClient } from './client';

export interface UserSettings {
    apiKey?: string;
    apiUrl: string;
    model: string;
}

export const settingsApi = {
    /**
     * 获取用户设置
     */
    get: async (): Promise<UserSettings> => {
        const response = await apiClient.get('/user/settings');
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 更新用户设置
     */
    update: async (settings: UserSettings): Promise<void> => {
        await apiClient.put('/user/settings', settings);
    }
};

export default settingsApi;
