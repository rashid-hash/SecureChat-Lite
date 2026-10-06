const CACHE_NAME = 'securechat-lite-v2';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/create.html',
    '/join.html',
    '/chat.html',
    '/css/style.css',
    '/manifest.json',
    '/js/app.js',
    '/js/auth.js',
    '/js/cleanup.js',
    '/js/firebase-config.js',
    '/js/firebase.js',
    '/js/messages.js',
    '/js/pwa.js',
    '/js/room.js',
    '/js/security.js',
    '/js/typing.js'
];

// ১. Install Event - ফাইলগুলো অফলাইনের জন্য ক্যাশ করে রাখবে
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Caching all assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// ২. Activate Event - পুরনো ক্যাশ ডিলেট করে নতুন ভার্সন আপডেট করবে
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// ৩. Fetch Event (Network First Strategy) - আগে ইন্টারনেট থেকে নতুন কোড আনবে, ইন্টারনেট না থাকলে ক্যাশ থেকে দেখাবে
self.addEventListener('fetch', (event) => {
    // শুধুমাত্র নিজেদের ডোমেইনের রিকোয়েস্টগুলো ক্যাশ করবে (ফায়ারবেস ডাটাবেসের রিকোয়েস্ট নয়)
    if (!event.request.url.startsWith(self.location.origin)) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const resClone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});