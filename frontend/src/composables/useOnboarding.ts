/**
 * 新手引导 Hook
 * 检测用户是否需要配置 API Key，并显示引导提示
 */

import { ref } from 'vue';
import { settingsApi } from '@/api/settings';

export function useOnboarding() {
    const showApiKeyGuide = ref(false);
    const isCheckingSettings = ref(false);

    /**
     * 检查用户是否已配置 API Key
     */
    const checkApiKeySetup = async () => {
        try {
            isCheckingSettings.value = true;

            // 检查本地存储是否已关闭引导
            const guideDisabled = localStorage.getItem('onboarding_api_key_dismissed');
            if (guideDisabled === 'true') {
                return;
            }

            // 检查是否已配置 API Key
            const settings = await settingsApi.get();

            if (!settings.apiKey || settings.apiKey.trim() === '') {
                // 延迟显示，等页面加载完成
                setTimeout(() => {
                    showApiKeyGuide.value = true;
                }, 1500);
            }
        } catch (error) {
            console.error('Failed to check API key setup:', error);
            // 出错也显示引导
            setTimeout(() => {
                showApiKeyGuide.value = true;
            }, 1500);
        } finally {
            isCheckingSettings.value = false;
        }
    };

    /**
     * 关闭引导提示
     */
    const dismissGuide = (permanent: boolean = false) => {
        showApiKeyGuide.value = false;
        if (permanent) {
            localStorage.setItem('onboarding_api_key_dismissed', 'true');
        }
    };

    /**
     * 重置引导状态（用于测试）
     */
    const resetGuide = () => {
        localStorage.removeItem('onboarding_api_key_dismissed');
        showApiKeyGuide.value = false;
    };

    return {
        showApiKeyGuide,
        isCheckingSettings,
        checkApiKeySetup,
        dismissGuide,
        resetGuide,
    };
}
