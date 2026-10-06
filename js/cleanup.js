// js/cleanup.js

export const CleanupModule = {
    intervalId: null,

    /**
     * প্রতি ১ সেকেন্ড পর পর মেসেজগুলোর এক্সপায়ারি টাইম চেক করবে
     */
    startSweeper() {
        if (this.intervalId) clearInterval(this.intervalId);
        
        this.intervalId = setInterval(() => {
            const now = Date.now();
            // ডাটা অ্যাট্রিবিউট ধরে সব মেসেজ খুঁজে বের করা
            const messages = document.querySelectorAll('[data-expires-at]');
            
            messages.forEach(msg => {
                const expiresAt = parseInt(msg.dataset.expiresAt, 10);
                const remainingSecs = Math.floor((expiresAt - now) / 1000);
                
                // সময় শেষ হয়ে গেলে রিমুভ করা
                if (remainingSecs <= 0) {
                    if (!msg.classList.contains('message-expire')) {
                        msg.classList.add('message-expire');
                        setTimeout(() => msg.remove(), 300); // CSS অ্যানিমেশনের সাথে মিল রেখে
                    }
                } else {
                    // MM:SS ফরম্যাটে সময় দেখানো
                    const m = Math.floor(remainingSecs / 60).toString().padStart(2, '0');
                    const s = (remainingSecs % 60).toString().padStart(2, '0');
                    
                    const timerEl = msg.querySelector('.countdown-timer');
                    
                    // Sending বা Failed স্টেটের লেখাকে যেন মুছে না ফেলে
                    if (timerEl && !timerEl.innerHTML.includes('Sending') && !timerEl.innerHTML.includes('Failed')) {
                        timerEl.textContent = `Expires in ${m}:${s}`;
                        
                        // শেষ ৬০ সেকেন্ডে টেক্সটের কালার ওয়ার্নিং (অ্যাম্বার) করে দেওয়া
                        if (remainingSecs <= 60) {
                            timerEl.classList.add('text-amber-500');
                            timerEl.classList.remove('text-slate-400');
                        }
                    }
                }
            });
        }, 1000); // ১-সেকেন্ড প্রিসিশন
    },

    /**
     * চ্যাট রুম থেকে বের হয়ে গেলে সুইপার বন্ধ করা
     */
    stopSweeper() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
};