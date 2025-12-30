// src/router/index.ts
import type { RouteRecordRaw } from 'vue-router'; //
import { createRouter, createWebHistory } from 'vue-router';
import { authApi } from '@/api';

// 懒加载你的 Notebook 主页
// 注意：确保路径对应你实际的文件位置
const routes: Array<RouteRecordRaw> = [
    {
        path: '/auth',
        name: 'Auth',
        component: () => import('../views/Auth/index.vue'),
        meta: {
            title: '登录 - Nano Studio',
            public: true  // 公开页面，不需要认证
        }
    },
    {
        path: '/',
        name: 'Home',
        component: () => import('../views/Home/index.vue'),
        meta: {
            title: 'Nano Studio - 首页',
            public: true  // 公开页面，不需要登录
        }
    },
    {
        path: '/notebook',
        name: 'Notebook',
        component: () => import('../views/notebook/index.vue'),
        meta: {
            title: 'Notebook LM'
        }
    },
    {
        path: '/code',
        name: 'CodeArchaeologist',
        component: () => import('../views/codeAns/index.vue'),
        meta: {
            title: 'Code Archaeologist'
        }
    },
    {
        path: '/profile',
        name: 'ProfileCenter',
        component: () => import('../views/ProfileCenter/index.vue'),
        meta: {
            title: '个人中心 - Nano Studio'
        }
    },
    {
        path: '/cyber',
        name: 'Cyber',
        component: () => import('../views/cyber/index.vue'),
        meta: {
            title: 'Cyber'
        },
        beforeEnter: (to, _from, next) => {
            // 检查 URL 中是否包含我们在 index.vue 里传的参数
            if (to.query.key === 'cyber_zen_master') {
                next(); // 有钥匙，允许进入
            } else {
                next('/'); // 没钥匙，直接踢回首页
            }
        }
    }
];

const router = createRouter({
    // 使用 HTML5 History 模式 (去掉 URL 中的 # 号)
    history: createWebHistory(),
    routes
});

// 路由守卫：检查认证状态
router.beforeEach((to, _from, next) => {
    const isAuthenticated = authApi.isAuthenticated();
    const isPublicPage = to.meta.public === true;

    // 更新页面标题
    if (to.meta.title) {
        document.title = to.meta.title as string;
    }

    // 如果是公开页面，直接放行
    if (isPublicPage) {
        next();
        return;
    }

    // 如果未认证，重定向到登录页
    if (!isAuthenticated) {
        next({
            name: 'Auth',
            query: { redirect: to.fullPath }  // 记录原始目标，登录后跳转
        });
        return;
    }

    // 已认证，放行
    next();
});

export default router;