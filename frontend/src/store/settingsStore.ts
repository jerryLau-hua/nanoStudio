import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const STORAGE_KEY = 'app-api-settings';

export interface ApiSettings {
    apiKey: string;
    apiUrl: string;
    model: string;
}

export const useSettingsStore = defineStore('settings', () => {
    // 从 localStorage 加载或使用环境变量默认值
    const loadSettings = (): ApiSettings => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // 合并默认值，确保所有字段都存在
                return {
                    apiKey: parsed.apiKey || import.meta.env.VITE_API_KEY || '',
                    apiUrl: parsed.apiUrl || import.meta.env.VITE_API_URL || 'https://api.deepseek.com/chat/completions',
                    model: parsed.model || 'deepseek-chat'
                };
            }
        } catch (e) {
            console.error('Failed to load settings from localStorage:', e);
        }

        // 默认值
        return {
            apiKey: import.meta.env.VITE_API_KEY || '',
            apiUrl: import.meta.env.VITE_API_URL || 'https://api.deepseek.com/chat/completions',
            model: 'deepseek-chat'
        };
    };

    const settings = ref<ApiSettings>(loadSettings());

    // 计算属性：检查设置是否有效
    const isValid = computed(() => {
        return !!(settings.value.apiKey &&
            settings.value.apiUrl &&
            settings.value.model &&
            !settings.value.apiKey.startsWith('sk-xxx'));
    });

    // 更新设置并保存到 localStorage
    const updateSettings = (newSettings: Partial<ApiSettings>) => {
        settings.value = {
            ...settings.value,
            ...newSettings
        };

        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value));
        } catch (e) {
            console.error('Failed to save settings to localStorage:', e);
        }
    };

    // 重置为默认值
    const resetSettings = () => {
        settings.value = {
            apiKey: import.meta.env.VITE_API_KEY || '',
            apiUrl: import.meta.env.VITE_API_URL || 'https://api.deepseek.com/chat/completions',
            model: 'deepseek-chat'
        };

        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            console.error('Failed to remove settings from localStorage:', e);
        }
    };

    return {
        settings,
        isValid,
        updateSettings,
        resetSettings
    };
});
