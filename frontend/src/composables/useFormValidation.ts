/**
 * 表单验证工具 Composable
 */
export function useFormValidation() {
    /**
     * 验证邮箱格式
     */
    const validateEmail = (email: string): { valid: boolean; error: string } => {
        if (!email) {
            return { valid: false, error: '邮箱不能为空' };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: '请输入有效的邮箱地址' };
        }

        return { valid: true, error: '' };
    };

    /**
     * 验证用户名格式
     * 规则：3-30字符，只能包含字母、数字、下划线和连字符
     */
    const validateUsername = (username: string): { valid: boolean; error: string } => {
        if (!username) {
            return { valid: false, error: '用户名不能为空' };
        }

        if (username.length < 3 || username.length > 30) {
            return { valid: false, error: '用户名长度应在 3-30 个字符之间' };
        }

        const usernameRegex = /^[a-zA-Z0-9_-]+$/;
        if (!usernameRegex.test(username)) {
            return { valid: false, error: '用户名只能包含字母、数字、下划线和连字符' };
        }

        return { valid: true, error: '' };
    };

    /**
     * 验证密码强度
     * 规则：至少8位，必须包含大写字母、小写字母和数字
     */
    const validatePassword = (password: string): { valid: boolean; error: string } => {
        if (!password) {
            return { valid: false, error: '密码不能为空' };
        }

        if (password.length < 8) {
            return { valid: false, error: '密码至少需要 8 个字符' };
        }

        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumber = /\d/.test(password);

        if (!hasUpperCase) {
            return { valid: false, error: '密码必须包含至少一个大写字母' };
        }

        if (!hasLowerCase) {
            return { valid: false, error: '密码必须包含至少一个小写字母' };
        }

        if (!hasNumber) {
            return { valid: false, error: '密码必须包含至少一个数字' };
        }

        return { valid: true, error: '' };
    };

    /**
     * 验证确认密码
     */
    const validateConfirmPassword = (password: string, confirmPassword: string): { valid: boolean; error: string } => {
        if (!confirmPassword) {
            return { valid: false, error: '请再次输入密码' };
        }

        if (password !== confirmPassword) {
            return { valid: false, error: '两次输入的密码不一致' };
        }

        return { valid: true, error: '' };
    };

    return {
        validateEmail,
        validateUsername,
        validatePassword,
        validateConfirmPassword,
    };
}
