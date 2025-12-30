/**
 * 根据模型提供商返回对应的图标组件名称
 * @param ownedBy - 模型提供商标识
 * @returns Arco Design 图标名称
 */
export function getProviderIcon(ownedBy?: string): string {
    if (!ownedBy) {
        return 'icon-apps'; // 默认图标
    }

    const provider = ownedBy.toLowerCase();

    // 提供商图标映射
    const iconMap: Record<string, string> = {
        'openai': 'icon-robot',
        'google': 'icon-google',
        'deepseek': 'icon-code',
        'anthropic': 'icon-mind-mapping',
        'meta': 'icon-facebook',
        'mistral': 'icon-fire',
        'cohere': 'icon-message',
        'alibaba': 'icon-aliyun',
        'baidu': 'icon-branch',
        'zhipu': 'icon-compass'
    };

    return iconMap[provider] || 'icon-apps';
}

/**
 * 根据模型提供商返回对应的颜色
 * @param ownedBy - 模型提供商标识
 * @returns CSS 颜色值
 */
export function getProviderColor(ownedBy?: string): string {
    if (!ownedBy) {
        return 'var(--color-text-3)';
    }

    const provider = ownedBy.toLowerCase();

    // 提供商颜色映射
    const colorMap: Record<string, string> = {
        'openai': '#10a37f',
        'google': '#4285f4',
        'deepseek': '#6366f1',
        'anthropic': '#cc785c',
        'meta': '#0668e1',
        'mistral': '#ff7000',
        'cohere': '#39594d',
        'alibaba': '#ff6a00',
        'baidu': '#2932e1',
        'zhipu': '#165dff'
    };

    return colorMap[provider] || 'var(--color-text-3)';
}
