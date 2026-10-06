// js/pwa.js

export const PWAModule = {
    deferredPrompt: null,

    init() {
        this.registerServiceWorker();
        this.setupInstallPrompt();
        this.setupNetworkListeners();
    },

    /**
     * Service Worker রেজিস্টার করা এবং অ্যাপের নতুন আপডেট চেক করা
     */
    registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/service-worker.js')
                    .then((registration) => {
                        console.log('[PWA] Service Worker registered.');
                        
                        // নতুন ভার্সন আপলোড হলে আপডেট অ্যালার্ট দেওয়া
                        registration.addEventListener('updatefound', () => {
                            const newWorker = registration.installing;
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    this.showUpdateNotification();
                                }
                            });
                        });
                    })
                    .catch((err) => console.log('[PWA] SW Registration failed:', err));
            });
        }
    },

    /**
     * নেটিভ "Add to Home Screen" বা ইনস্টল প্রম্পট হ্যান্ডল করা
     */
    setupInstallPrompt() {
        // ব্রাউজার যখন ইনস্টলের জন্য প্রস্তুত হয়
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            
            // Landing Page-এ ইনস্টল বাটন থাকলে সেটি দৃশ্যমান করা
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) {
                installBtn.classList.remove('hidden');
                installBtn.addEventListener('click', async () => {
                    installBtn.classList.add('hidden');
                    this.deferredPrompt.prompt();
                    const { outcome } = await this.deferredPrompt.userChoice;
                    console.log(`[PWA] Install prompt outcome: ${outcome}`);
                    this.deferredPrompt = null;
                });
            }
        });

        // ইনস্টল হয়ে গেলে
        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed successfully');
            this.deferredPrompt = null;
            const installBtn = document.getElementById('btn-install-pwa');
            if (installBtn) installBtn.classList.add('hidden');
        });
    },

    /**
     * ইউজারের ইন্টারনেট কানেকশন রিয়েল-টাইমে মনিটর করা
     */
    setupNetworkListeners() {
        const offlineBanner = document.getElementById('offline-banner');
        
        const updateNetworkStatus = () => {
            if (navigator.onLine) {
                if (offlineBanner) offlineBanner.classList.add('hidden');
            } else {
                if (offlineBanner) offlineBanner.classList.remove('hidden');
            }
        };

        window.addEventListener('online', updateNetworkStatus);
        window.addEventListener('offline', updateNetworkStatus);
        
        // অ্যাপ লোড হওয়ার সময় একবার চেক করা
        updateNetworkStatus();
    },

    /**
     * নতুন ভার্সন রিলিজ হলে স্ক্রিনের নিচে একটি পপআপ দেওয়া
     */
    showUpdateNotification() {
        const updateDiv = document.createElement('div');
        updateDiv.className = 'fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-5 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-4 text-sm font-medium slide-up border border-slate-700 dark:border-slate-200';
        updateDiv.innerHTML = `
            <span>New version available!</span>
            <button id="btn-reload-app" class="bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold active:scale-95 transition-transform shadow-sm">Update</button>
        `;
        document.body.appendChild(updateDiv);

        document.getElementById('btn-reload-app').addEventListener('click', () => {
            window.location.reload();
        });
    }
};