// coi-serviceworker.js
// 跨域隔离 Service Worker，用于解决 GitHub Pages 线上环境无法设置跨域头的问题

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./coi-serviceworker.js')
      .then(registration => {
        console.log('COI Service Worker 注册成功:', registration.scope);
      })
      .catch(error => {
        console.error('COI Service Worker 注册失败:', error);
      });
  });
}

// Service Worker 逻辑
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // 为所有响应添加跨域隔离头
        const headers = new Headers(response.headers);
        headers.set('Cross-Origin-Opener-Policy', 'same-origin');
        headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: headers
        });
      })
      .catch(error => {
        console.error('Fetch error:', error);
        return new Response('Network error occurred', {
          status: 408,
          headers: {
            'Content-Type': 'text/plain'
          }
        });
      })
  );
});
