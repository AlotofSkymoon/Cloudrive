import { createApp } from 'vue';
import App from './App.vue';
import './style.css';

// 服务端（Worker）把首屏需要的数据注入到 window.__FILECOVE__，
// 前端据此决定渲染哪个视图，避免多一次往返请求。
declare global {
  interface Window {
    __FILECOVE__?: {
      view: 'admin' | 'login' | 'share' | 'error';
      version: string;
      status?: any;
      share?: any;
      error?: { code: string; msg: string };
      driver?: string;
      bucket?: string;
    };
  }
}

createApp(App).mount('#app');
