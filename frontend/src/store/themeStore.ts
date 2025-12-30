import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'app-theme-mode';

export const useThemeStore = defineStore('theme', () => {
    // 从 localStorage 读取保存的主题，默认为 light
    const loadTheme = (): ThemeMode => {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'light' || stored === 'dark') {
            return stored;
        }
        // 也可以检测系统主题偏好
        // return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        return 'light';
    };

    const theme = ref<ThemeMode>(loadTheme());

    // 切换主题
    const toggleTheme = () => {
        theme.value = theme.value === 'light' ? 'dark' : 'light';
    };

    // 设置指定主题
    const setTheme = (mode: ThemeMode) => {
        theme.value = mode;
    };

    // 监听主题变化，自动保存到 localStorage 和应用到 body
    watch(theme, (newTheme) => {
        localStorage.setItem(STORAGE_KEY, newTheme);

        // 应用到 body 和 html 的 class
        document.body.classList.remove('light-theme', 'dark-theme');
        document.body.classList.add(`${newTheme}-theme`);
        document.documentElement.classList.remove('light-theme', 'dark-theme');
        document.documentElement.classList.add(`${newTheme}-theme`);

        // 同时设置 data 属性，方便 CSS 选择器
        document.body.setAttribute('data-theme', newTheme);

        // 为 Arco Design 设置主题
        if (newTheme === 'dark') {
            document.body.setAttribute('arco-theme', 'dark');
        } else {
            document.body.removeAttribute('arco-theme');
        }
    }, { immediate: true });

    return {
        theme,
        toggleTheme,
        setTheme
    };
});
