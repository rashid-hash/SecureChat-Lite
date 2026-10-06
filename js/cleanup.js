// js/cleanup.js
export const CleanupModule = {
    intervalId: null,

    startSweeper() {
        if (this.intervalId) clearInterval(this.intervalId);
        
        this.intervalId = setInterval(() => {
            const now = Date.now();
            const messages = document.querySelectorAll('[data-expires-at]');
            
            messages.forEach(msg => {
                const expiresAt = parseInt(msg.dataset.expiresAt, 10);
                const remainingSecs = Math.floor((expiresAt - now) / 1000);
                
                if (remainingSecs <= 0) {
                    if (!msg.classList.contains('message-expire')) {
                        msg.classList.add('message-expire');
                        setTimeout(() => msg.remove(), 300);
                    }
                } else {
                    const m = Math.floor(remainingSecs / 60).toString().padStart(2, '0');
                    const s = (remainingSecs % 60).toString().padStart(2, '0');
                    
                    const timerEl = msg.querySelector('.countdown-timer');
                    if (timerEl) {
                        timerEl.textContent = `Expires in ${m}:${s}`;
                        
                        if (remainingSecs <= 60) {
                            timerEl.classList.add('text-amber-500');
                            timerEl.classList.remove('text-slate-400');
                        }
                    }
                }
            });
        }, 1000);
    },

    stopSweeper() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
};