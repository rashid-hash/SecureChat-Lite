// js/security.js

export const Security = {
    /**
     * একটি সিকিউর রেন্ডম রুম আইডি তৈরি করে।
     */
    generateSecureRoomId(length = 16) {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    },

    // --- Web Crypto API E2EE Implementation ---

    /**
     * AES-256-GCM ক্রিপ্টোগ্রাফিক কী (Key) তৈরি করে।
     */
    async generateEncryptionKey() {
        return await window.crypto.subtle.generateKey(
            { name: "AES-GCM", length: 256 },
            true,
            ["encrypt", "decrypt"]
        );
    },

    /**
     * তৈরি করা কী-টিকে URL-এ শেয়ার করার জন্য Base64 স্ট্রিংয়ে কনভার্ট করে।
     */
    async exportKeyToURL(key) {
        const raw = await window.crypto.subtle.exportKey("raw", key);
        const base64 = btoa(String.fromCharCode(...new Uint8Array(raw)));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // URL safe
    },

    /**
     * URL থেকে পাওয়া Base64 স্ট্রিং কী-কে আবার ক্রিপ্টো কী অবজেক্টে রূপান্তর করে।
     */
    async importKeyFromURL(keyString) {
        try {
            // Re-pad and decode URL-safe base64
            let base64 = keyString.replace(/-/g, '+').replace(/_/g, '/');
            while (base64.length % 4) base64 += '=';
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return await window.crypto.subtle.importKey(
                "raw",
                bytes,
                { name: "AES-GCM" },
                false,
                ["encrypt", "decrypt"]
            );
        } catch (e) {
            throw new Error("Invalid encryption key.");
        }
    },

    bufferToBase64(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)));
    },

    base64ToBuffer(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
        return bytes.buffer;
    },

    /**
     * মেসেজ বা ড্রাফট এনক্রিপ্ট করে।
     */
    async encryptText(plaintext, key, senderUid) {
        const enc = new TextEncoder();
        const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV recommended for GCM
        
        // AAD (Additional Authenticated Data) ব্যবহার করে মেসেজটি সেন্ডারের সাথে বাইন্ড করা হয়
        // এতে কেউ মেসেজ কপি করে রি-প্লে (Replay attack) করতে পারবে না
        const aad = enc.encode(senderUid); 

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv, additionalData: aad },
            key,
            enc.encode(plaintext)
        );

        return {
            ciphertext: this.bufferToBase64(ciphertextBuffer),
            iv: this.bufferToBase64(iv)
        };
    },

    /**
     * এনক্রিপ্ট করা মেসেজ ডিক্রিপ্ট করে।
     */
    async decryptText(ciphertextBase64, ivBase64, key, senderUid) {
        try {
            const dec = new TextDecoder();
            const iv = this.base64ToBuffer(ivBase64);
            const ciphertext = this.base64ToBuffer(ciphertextBase64);
            const aad = new TextEncoder().encode(senderUid);

            const decryptedBuffer = await window.crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv, additionalData: aad },
                key,
                ciphertext
            );
            return dec.decode(decryptedBuffer);
        } catch (e) {
            return "[Decryption Failed - Tampering Detected]";
        }
    }
};