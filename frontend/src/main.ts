// src/main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ArcoVue from '@arco-design/web-vue';
import '@arco-design/web-vue/dist/arco.css';
import ArcoVueIcon from '@arco-design/web-vue/es/icon';

import App from './App.vue'
import router from './router' // <--- 新增引入 router

const app = createApp(App)

app.use(createPinia())
app.use(router) // <--- 新增注册 router
app.use(ArcoVue)
app.use(ArcoVueIcon)

app.mount('#app')