// js/sound.js
export const SoundModule = {
    audioCtx: null,

    init() {
        // ব্রাউজারের অডিও কন্টেক্সট ইনিশিয়ালাইজ করা
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            this.audioCtx = new AudioContext();
        }
    },

    // প্রিমিয়াম সফট পপ সাউন্ড জেনারেট করার ফাংশন
    playPopSound() {
        try {
            if (!this.audioCtx) this.init();
            if (this.audioCtx && this.audioCtx.state === 'suspended') {
                this.audioCtx.resume();
            }

            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(400, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(800, this.audioCtx.currentTime + 0.05);

            gain.gain.setValueAtTime(0.15, this.audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + 0.05);

            osc.connect(gain);
            gain.connect(this.audioCtx.destination);

            osc.start();
            osc.stop(this.audioCtx.currentTime + 0.05);
        } catch (e) {}
    },

    // ছোট ভাইব্রেশন বা হ্যাপটিক ফিডব্যাক দেওয়ার ফাংশন
    triggerHaptic(pattern = 30) {
        if ('vibrate' in navigator) {
            try {
                navigator.vibrate(pattern);
            } catch (e) {}
        }
    }
};