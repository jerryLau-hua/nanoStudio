<template>
  <div class="auth-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="circle circle-1"></div>
      <div class="circle circle-2"></div>
      <div class="circle circle-3"></div>
    </div>

    <div class="auth-card">
      <!-- Logo -->
      <div class="logo-container">
        <div class="logo">
          <img src="@/assets/main.png" alt="Nano Studio Logo" />
        </div>
        <h1 class="title">{{ isLogin ? '登录' : '注册' }} Nano Studio</h1>
        <p class="subtitle">微空间，大智能</p>
      </div>
      
      <form @submit.prevent="handleSubmit" class="auth-form">
        <!-- 邮箱 -->
        <div class="form-group" :class="{ 'has-error': emailTouched && emailError }">
          <label>邮箱</label>
          <input 
            v-model="formData.email" 
            @blur="emailTouched = true"
            type="email" 
            placeholder="your@email.com"
            :class="{ 'error': emailTouched && emailError, 'success': emailTouched && !emailError }"
          />
          <span v-if="emailTouched && emailError" class="error-hint">{{ emailError }}</span>
        </div>

        <!-- 用户名（注册时） -->
        <div v-if="!isLogin" class="form-group" :class="{ 'has-error': usernameTouched && usernameError }">
          <label>用户名</label>
          <input 
            v-model="formData.username" 
            @blur="usernameTouched = true"
            type="text" 
            placeholder="字母数字下划线，3-30字符"
            :class="{ 'error': usernameTouched && usernameError, 'success': usernameTouched && !usernameError }"
          />
          <span v-if="usernameTouched && usernameError" class="error-hint">{{ usernameError }}</span>
          <span v-else class="hint">只能包含字母、数字、下划线和连字符</span>
        </div>

        <!-- 密码 -->
        <div class="form-group" :class="{ 'has-error': passwordTouched && passwordError }">
          <label>密码</label>
          <input 
            v-model="formData.password" 
            @blur="passwordTouched = true"
            type="password" 
            placeholder="至少8位，含大小写字母和数字"
            :class="{ 'error': passwordTouched && passwordError, 'success': passwordTouched && !passwordError }"
          />
          <span v-if="passwordTouched && passwordError" class="error-hint">{{ passwordError }}</span>
          <span v-else-if="!isLogin" class="hint">密码必须包含大写字母、小写字母和数字</span>
        </div>

        <!-- 确认密码（注册时） -->
        <div v-if="!isLogin" class="form-group" :class="{ 'has-error': confirmPasswordTouched && confirmPasswordError }">
          <label>确认密码</label>
          <input 
            v-model="formData.confirmPassword" 
            @blur="confirmPasswordTouched = true"
            type="password" 
            placeholder="再次输入密码"
            :class="{ 'error': confirmPasswordTouched && confirmPasswordError, 'success': confirmPasswordTouched && !confirmPasswordError }"
          />
          <span v-if="confirmPasswordTouched && confirmPasswordError" class="error-hint">{{ confirmPasswordError }}</span>
        </div>

        <button type="submit" class="submit-btn" :disabled="loading || !isFormValid">
          <span v-if="loading" class="loading-spinner"></span>
          {{ loading ? '处理中...' : (isLogin ? '登录' : '注册') }}
        </button>

        <div v-if="error" class="error-message">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.6 0 0 3.6 0 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8zm1 13H7V7h2v6zm0-8H7V3h2v2z"/>
          </svg>
          {{ error }}
        </div>
      </form>

      <div class="toggle-mode">
        <span>{{ isLogin ? '还没有账号？' : '已有账号？' }}</span>
        <a @click="toggleMode" href="javascript:;">
          {{ isLogin ? '立即注册' : '前往登录' }}
        </a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { authApi } from '@/api';
import { useFormValidation } from '@/composables/useFormValidation';
import { getErrorMessage } from '@/utils/errorMessages';

const router = useRouter();
const { validateEmail, validateUsername, validatePassword, validateConfirmPassword } = useFormValidation();

const isLogin = ref(true);
const loading = ref(false);
const error = ref('');

// 输入框是否已被触碰（用于控制错误提示时机）
const emailTouched = ref(false);
const usernameTouched = ref(false);
const passwordTouched = ref(false);
const confirmPasswordTouched = ref(false);

const formData = reactive({
  email: '',
  username: '',
  password: '',
  confirmPassword: ''
});

// 实时验证
const emailError = computed(() => {
  const result = validateEmail(formData.email);
  return result.valid ? '' : result.error;
});

const usernameError = computed(() => {
  if (isLogin.value) return '';
  const result = validateUsername(formData.username);
  return result.valid ? '' : result.error;
});

const passwordError = computed(() => {
  const result = validatePassword(formData.password);
  return result.valid ? '' : result.error;
});

const confirmPasswordError = computed(() => {
  if (isLogin.value) return '';
  const result = validateConfirmPassword(formData.password, formData.confirmPassword);
  return result.valid ? '' : result.error;
});

// 表单是否有效
const isFormValid = computed(() => {
  if (isLogin.value) {
    return !emailError.value && !passwordError.value;
  } else {
    return !emailError.value && !usernameError.value && !passwordError.value && !confirmPasswordError.value;
  }
});

const toggleMode = () => {
  isLogin.value = !isLogin.value;
  error.value = '';
  formData.password = '';
  formData.confirmPassword = '';
  // 重置触碰状态
  emailTouched.value = false;
  usernameTouched.value = false;
  passwordTouched.value = false;
  confirmPasswordTouched.value = false;
};

const handleSubmit = async () => {
  // 标记所有字段为已触碰
  emailTouched.value = true;
  passwordTouched.value = true;
  if (!isLogin.value) {
    usernameTouched.value = true;
    confirmPasswordTouched.value = true;
  }

  // 如果表单无效，不提交
  if (!isFormValid.value) {
    return;
  }

  error.value = '';
  loading.value = true;

  try {
    if (isLogin.value) {
      await authApi.login({
        email: formData.email,
        password: formData.password
      });
    } else {
      await authApi.register({
        email: formData.email,
        username: formData.username,
        password: formData.password
      });
    }

    const redirect = (router.currentRoute.value.query.redirect as string) || '/';
    router.push(redirect);
  } catch (err: any) {
    error.value = getErrorMessage(err);
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.auth-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #b3e9f0 0%, #fcb69f 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
}

/* 背景动画装饰 */
.bg-decoration {
  position: absolute;
  width: 100%;
  height: 100%;
  overflow: hidden;
  z-index: 0;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  animation: float 20s infinite ease-in-out;
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  left: -100px;
  animation-delay: 0s;
}

.circle-2 {
  width: 400px;
  height: 400px;
  bottom: -150px;
  right: -150px;
  animation-delay: 4s;
}

.circle-3 {
  width: 200px;
  height: 200px;
  top: 50%;
  right: 10%;
  animation-delay: 8s;
}

@keyframes float {
  0%, 100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.9);
  }
}

/* 玻璃拟态卡片 */
.auth-card {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-radius: 16px;
  padding: 28px 32px;
  width: 100%;
  max-width: 380px;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.05);
  position: relative;
  z-index: 1;
  animation: slideUp 0.5s ease-out;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Logo 区域 */
.logo-container {
  text-align: center;
  margin-bottom: 24px;
}

.logo {
  display: inline-block;
  margin-bottom: 12px;
  animation: logoFadeIn 0.8s ease-out;
}

.logo img {
  width: 56px;
  height: 56px;
  object-fit: contain;
}

@keyframes logoFadeIn {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.title {
  font-size: 22px;
  font-weight: 700;
  background: linear-gradient(135deg, #72b2fc 0%, #2a68f0 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 13px;
  color: #718096;
  margin: 0;
}

/* 表单 */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 600;
  color: #2d3748;
}

.form-group input {
  padding: 12px 14px;
  border: 2px solid #e2e8f0;
  border-radius: 10px;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: white;
}

.form-group input:focus {
  outline: none;
  border-color: #ff6b6b;
  box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.1);
}

.form-group input.success {
  border-color: #48bb78;
}

.form-group input.error {
  border-color: #f56565;
}

.form-group .hint {
  font-size: 12px;
  color: #a0aec0;
  margin-top: -2px;
}

.form-group .error-hint {
  font-size: 13px;
  color: #f56565;
  margin-top: -2px;
  display: flex;
  align-items: center;
  gap: 4px;
}

/* 提交按钮 */
.submit-btn {
  margin-top: 6px;
  padding: 13px;
  background: linear-gradient(135deg, #72b2fc 0%, #2a68f0 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 107, 107, 0.4);
}

.submit-btn:active:not(:disabled) {
  transform: translateY(0);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 加载动画 */
.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 错误消息 */
.error-message {
  padding: 12px 14px;
  background: #fff5f5;
  border: 1px solid #feb2b2;
  border-radius: 10px;
  color: #c53030;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
  animation: shake 0.4s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

/* 切换模式 */
.toggle-mode {
  margin-top: 16px;
  text-align: center;
  font-size: 13px;
  color: #718096;
}

.toggle-mode a {
  color: #67b2f0;
  font-weight: 600;
  margin-left: 6px;
  text-decoration: none;
  transition: color 0.2s;
}

.toggle-mode a:hover {
  color: #a7e0f7;
  text-decoration: underline;
}

/* 响应式 */
@media (max-width: 480px) {
  .auth-card {
    padding: 24px 20px;
  }

  .title {
    font-size: 20px;
  }

  .submit-btn {
    padding: 12px;
  }
}
</style>
