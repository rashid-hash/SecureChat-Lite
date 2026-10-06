// js/messages.js
import { db, doc, collection, setDoc, onSnapshot, query, orderBy } from './firebase.js';
import { AuthModule } from './auth.js';
import { Security } from './security.js';

export const MessagesModule = {
    lastSenderId: null,
    unsubscribeFn: null,
    lastSendTime: 0, 
    sharedKey: null, // URL থেকে পাওয়া এনক্রিপশন কী এখানে সেভ থাকবে

    /**
     * চ্যাট রুমের এনক্রিপশন কী সেট করার ফাংশন
     */
    setEncryptionKey(cryptoKey) {
        this.sharedKey = cryptoKey;
    },

    /**
     * মেসেজ এনক্রিপ্ট করে ফায়ারবেসে পাঠানো
     */
    async sendMessage(roomId, text, nickname) {
        const user = AuthModule.getCurrentUser();
        if (!user || !this.sharedKey) throw new Error("Missing auth or encryption key");

        // Anti-spam (500ms Debounce) - খুব দ্রুত মেসেজ পাঠানো আটকাতে
        if (Date.now() - this.lastSendTime < 500) return;
        this.lastSendTime = Date.now();

        const messageId = Security.generateSecureRoomId(20);
        const msgRef = doc(db, `rooms/${roomId}/messages`, messageId);
        
        const now = Date.now();
        const createdAtDate = new Date(now);
        const expiresAtDate = new Date(now + 600000); // ঠিক ১০ মিনিট পর

        // ডেটাবেসে যাওয়ার আগেই প্লেইনটেক্সট এনক্রিপ্ট করা হচ্ছে
        const { ciphertext, iv } = await Security.encryptText(text.trim(), this.sharedKey, user.uid);

        const payload = {
            senderId: user.uid,
            senderNickname: nickname,
            ciphertext: ciphertext,
            iv: iv,
            createdAt: createdAtDate,
            expiresAt: expiresAtDate,
            type: "text",
            status: "sent"
        };

        try {
            await setDoc(msgRef, payload);
        } catch (error) {
            console.error("[Messages] Send Failed:", error);
            throw new Error(messageId); 
        }
    },

    /**
     * রিয়েল-টাইমে মেসেজ লিসেন করা এবং ডিক্রিপ্ট করা
     */
    listenForMessages(roomId, onNewMessage, onModify, onRemove) {
        const q = query(collection(db, `rooms/${roomId}/messages`), orderBy("createdAt", "asc"));
        
        this.unsubscribeFn = onSnapshot(q, { includeMetadataChanges: true }, async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                const data = change.doc.data();
                
                // এক্সপায়ারি টাইম ক্যালকুলেট করা
                const expiresMs = data.expiresAt ? (data.expiresAt.seconds ? data.expiresAt.seconds * 1000 : data.expiresAt.getTime()) : (Date.now() + 600000);

                if (change.type === "added") {
                    // যদি ক্লায়েন্টের ঘড়ি অনুযায়ী মেসেজের মেয়াদ শেষ হয়ে গিয়ে থাকে, তবে তা রেন্ডার হবে না
                    if (expiresMs <= Date.now()) continue; 
                    
                    // UI-তে দেখানোর জন্য মেসেজটি ডিক্রিপ্ট করা হচ্ছে
                    let plaintext = await Security.decryptText(data.ciphertext, data.iv, this.sharedKey, data.senderId);
                    data.plaintext = plaintext; 
                    
                    onNewMessage(change.doc.id, data, change.doc.metadata.hasPendingWrites, expiresMs);
                }
                if (change.type === "modified") {
                    onModify(change.doc.id, data, change.doc.metadata.hasPendingWrites);
                }
                if (change.type === "removed") {
                    // সার্ভার থেকে মেসেজ ডিলিট হলে UI থেকে সরিয়ে দেওয়া
                    onRemove(change.doc.id);
                }
            }
        });
    },

    stopListening() {
        if (this.unsubscribeFn) this.unsubscribeFn();
    },

    /**
     * মেসেজের UI রেন্ডার করা (Premium Design)
     */
    renderMessage(container, id, data, isPending, expiresMs) {
        const user = AuthModule.getCurrentUser();
        const isSelf = data.senderId === user.uid;
        
        // Grouping: পরপর একই ইউজারের মেসেজ হলে বারবার নাম দেখাবে না
        const showNickname = this.lastSenderId !== data.senderId;
        this.lastSenderId = data.senderId;

        const wrapper = document.createElement('div');
        wrapper.id = `msg-${id}`;
        wrapper.className = `flex w-full message-enter ${isSelf ? 'justify-end' : 'justify-start'} ${showNickname ? 'mt-4' : 'mt-1'}`;
        wrapper.dataset.expiresAt = expiresMs; 

        const statusClass = isPending ? 'opacity-70' : 'opacity-100';
        
        wrapper.innerHTML = `
            <div class="max-w-[85%] sm:max-w-[70%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}">
                ${(!isSelf && showNickname) ? `<span class="text-[11px] font-medium text-slate-500 mb-1 ml-1">${data.senderNickname}</span>` : ''}
                
                <div class="relative px-4 py-2.5 shadow-sm text-[15px] leading-relaxed break-words
                    ${isSelf ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm text-slate-900 dark:text-white'} 
                    ${statusClass}">
                    ${this.escapeHTML(data.plaintext)} 
                </div>
                
                <div class="flex items-center gap-1.5 mt-1 px-1">
                    <span class="text-[10px] text-slate-400 font-medium tracking-wide countdown-timer">
                        ${isPending ? 'Sending...' : 'Expires in --:--'}
                    </span>
                </div>
            </div>
        `;
        
        container.appendChild(wrapper);
    },

    /**
     * মেসেজ সেন্ড হওয়ার পর Pending স্টেট আপডেট করা
     */
    updateMessageState(id, isPending) {
        const msgEl = document.getElementById(`msg-${id}`);
        if (!msgEl) return;
        
        const bubble = msgEl.querySelector('.opacity-70');
        if (bubble && !isPending) bubble.classList.replace('opacity-70', 'opacity-100');
        
        const statusEl = msgEl.querySelector('.countdown-timer');
        if (statusEl && !isPending) statusEl.textContent = 'Calculating...'; // cleanup.js এর দায়িত্ব নেবে
    },

    /**
     * মেসেজ সেন্ড ফেইল হলে লাল রঙের এরর দেখানো
     */
    markMessageFailed(id, text, nickname, retryCallback) {
        const msgEl = document.getElementById(`msg-${id}`);
        if (!msgEl) return;
        
        const bubble = msgEl.querySelector('.bg-emerald-600');
        if (bubble) bubble.classList.replace('bg-emerald-600', 'bg-red-500');

        const statusEl = msgEl.querySelector('.countdown-timer');
        if (statusEl) {
            statusEl.innerHTML = `<span class="text-red-500">Failed.</span> <button class="text-emerald-500 underline ml-1 retry-btn">Retry</button>`;
            statusEl.querySelector('.retry-btn').addEventListener('click', () => retryCallback(text, id));
        }
    },

    /**
     * XSS অ্যাটাক আটকাতে HTML এস্কেপ করা
     */
    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};