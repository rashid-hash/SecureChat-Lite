const CACHE_NAME = 'securechat-lite-v1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/create.html',
    '/join.html',
    '/chat.html',
    '/css/style.css',
    '/css/responsive.css',
    '/js/app.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
    );
});

// Cache-first strategy for static assets to ensure fast loads on mobile
self.addEventListener('fetch', (event) => {
    // Exclude Firebase API calls and room URLs from cache
    if (event.request.url.includes('firestore') || event.request.url.includes('?roomId=')) return;
    
    event.respondWith(
        caches.match(event.request).then((response) => {
            return response || fetch(event.request);
        })
    );
});