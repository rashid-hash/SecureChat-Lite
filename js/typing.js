// js/typing.js
import { db, doc, updateDoc, collection, onSnapshot, query, where } from './firebase.js';
import { AuthModule } from './auth.js';
import { Security } from './security.js';

export const TypingModule = {
    typingTimeout: null,
    throttleTimeout: null,
    isTypingLocal: false,
    lastSentDraft: "",
    sharedKey: null,

    setEncryptionKey(cryptoKey) {
        this.sharedKey = cryptoKey;
    },

    async broadcastTyping(roomId, text, liveDraftEnabled) {
        const user = AuthModule.getCurrentUser();
        if (!user) return;

        const isCurrentlyTyping = text.trim().length > 0;
        const currentDraft = liveDraftEnabled && isCurrentlyTyping ? text : "";

        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            this.clearTypingState(roomId);
        }, 2000);

        if (this.throttleTimeout) return;

        if (this.isTypingLocal !== isCurrentlyTyping || this.lastSentDraft !== currentDraft) {
            this.isTypingLocal = isCurrentlyTyping;
            this.lastSentDraft = currentDraft;
            
            let draftCiphertext = "";
            let draftIv = "";

            if (currentDraft && this.sharedKey) {
                const enc = await Security.encryptText(currentDraft, this.sharedKey, user.uid);
                draftCiphertext = enc.ciphertext;
                draftIv = enc.iv;
            }

            try {
                const participantRef = doc(db, `rooms/${roomId}/participants`, user.uid);
                await updateDoc(participantRef, {
                    isTyping: isCurrentlyTyping,
                    draftCiphertext: draftCiphertext,
                    draftIv: draftIv
                });
            } catch (error) {}
        }

        this.throttleTimeout = setTimeout(() => {
            this.throttleTimeout = null;
        }, 750);
    },

    async clearTypingState(roomId) {
        const user = AuthModule.getCurrentUser();
        if (!user) return;

        if (this.typingTimeout) clearTimeout(this.typingTimeout);
        if (this.throttleTimeout) clearTimeout(this.throttleTimeout);
        this.throttleTimeout = null;
        
        this.isTypingLocal = false;
        this.lastSentDraft = "";

        try {
            const participantRef = doc(db, `rooms/${roomId}/participants`, user.uid);
            await updateDoc(participantRef, {
                isTyping: false,
                draftCiphertext: "",
                draftIv: ""
            });
        } catch (error) {}
    },

    // isHost ভ্যারিয়েবলটি এখানে রিসিভ করা হচ্ছে
    listenForTyping(roomId, containerElement, isHost = false) {
        const user = AuthModule.getCurrentUser();
        const q = query(collection(db, `rooms/${roomId}/participants`), where("isTyping", "==", true));

        return onSnapshot(q, async (snapshot) => {
            containerElement.innerHTML = ''; 

            for (const document of snapshot.docs) {
                if (document.id === user.uid) continue; 

                const data = document.data();
                const div = window.document.createElement('div');
                div.className = 'text-[12px] text-slate-500 dark:text-slate-400 animate-pulse flex flex-col items-start mt-1';

                // শুধুমাত্র হোস্ট হলেই ড্রাফট ডিক্রিপ্ট করে দেখাবে
                if (isHost && data.draftCiphertext && data.draftIv && this.sharedKey) {
                    const decryptedDraft = await Security.decryptText(data.draftCiphertext, data.draftIv, this.sharedKey, document.id);
                    
                    div.innerHTML = `
                        <span class="text-[10px] uppercase font-bold text-amber-500 mb-0.5 tracking-wider">${data.nickname} is drafting:</span>
                        <div class="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-xl rounded-tl-sm text-slate-500 dark:text-slate-400 italic opacity-80 max-w-[70%] break-words shadow-sm">
                            ${this.escapeHTML(decryptedDraft)}
                        </div>
                    `;
                } else {
                    // সাধারণ মেম্বাররা শুধু টাইপিং ইন্ডিকেটর দেখবে
                    div.innerHTML = `<span class="italic font-medium">${data.nickname} is typing...</span>`;
                }
                
                containerElement.appendChild(div);
            }
        });
    },

    escapeHTML(str) {
        const div = window.document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};