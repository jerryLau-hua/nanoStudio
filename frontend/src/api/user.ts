/**
 * 用户资料和签到 API
 */
import { apiClient } from './client';

export interface UserProfile {
    id: number;
    username: string;
    email: string;
    createdAt: string;
}

export interface CheckInStats {
    totalCheckIns: number;
    checkInStreak: number;
    hasCheckedInToday: boolean;
    lastCheckInDate: string | null;
}

export const userApi = {
    /**
     * 获取用户资料
     */
    getProfile: async (): Promise<UserProfile> => {
        const response = await apiClient.get('/user/profile');
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 更新用户资料
     */
    updateProfile: async (profile: { username: string }): Promise<UserProfile> => {
        const response = await apiClient.patch('/user/profile', profile);
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 每日签到
     */
    checkIn: async (): Promise<{ checkIn: any; stats: CheckInStats }> => {
        const response = await apiClient.post('/user/check-in', {});
        const data = await response.json();
        return data.data || data;
    },

    /**
     * 获取签到统计
     */
    getCheckInStats: async (): Promise<CheckInStats> => {
        const response = await apiClient.get('/user/check-in/stats');
        const data = await response.json();
        return data.data || data;
    }
};

export default userApi;
