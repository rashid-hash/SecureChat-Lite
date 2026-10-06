// js/messages.js
import { db, doc, collection, setDoc, updateDoc, onSnapshot, query, orderBy, arrayUnion } from './firebase.js';
import { AuthModule } from './auth.js';
import { Security } from './security.js';

export const MessagesModule = {
    lastSenderId: null,
    unsubscribeFn: null,
    lastSendTime: 0, 
    sharedKey: null,
    currentRoomId: null,
    observer: null,

    setEncryptionKey(cryptoKey) {
        this.sharedKey = cryptoKey;
    },

    // ইউজার মেসেজ দেখলো কি না তা ট্র্যাক করা
    initObserver(roomId) {
        if (this.observer) return;
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const msgId = entry.target.dataset.msgId;
                    this.markAsSeen(roomId, msgId);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
    },

    // ডেটাবেসে Seen আপডেট করা
    async markAsSeen(roomId, msgId) {
        const user = AuthModule.getCurrentUser();
        const nickname = sessionStorage.getItem('sc_nickname') || "Anonymous";
        if (!user) return;
        
        try {
            const msgRef = doc(db, `rooms/${roomId}/messages`, msgId);
            await updateDoc(msgRef, {
                seenBy: arrayUnion(`${user.uid}|${nickname}`)
            });
        } catch (e) {}
    },

    async sendMessage(roomId, text, nickname) {
        const user = AuthModule.getCurrentUser();
        if (!user || !this.sharedKey) throw new Error("Missing auth or encryption key");

        if (Date.now() - this.lastSendTime < 500) return;
        this.lastSendTime = Date.now();

        const messageId = Security.generateSecureRoomId(20);
        const msgRef = doc(db, `rooms/${roomId}/messages`, messageId);
        
        const now = Date.now();
        const { ciphertext, iv } = await Security.encryptText(text.trim(), this.sharedKey, user.uid);

        const payload = {
            senderId: user.uid,
            senderNickname: nickname,
            ciphertext: ciphertext,
            iv: iv,
            createdAt: new Date(now),
            expiresAt: new Date(now + 600000),
            type: "text",
            status: "sent",
            seenBy: [] // Seen ট্র্যাকিং ফিল্ড
        };

        try {
            await setDoc(msgRef, payload);
        } catch (error) {
            throw new Error(messageId); 
        }
    },

    listenForMessages(roomId, onNewMessage, onModify, onRemove) {
        this.currentRoomId = roomId;
        this.initObserver(roomId);
        
        const q = query(collection(db, `rooms/${roomId}/messages`), orderBy("createdAt", "asc"));
        
        this.unsubscribeFn = onSnapshot(q, { includeMetadataChanges: true }, async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                const data = change.doc.data();
                const expiresMs = data.expiresAt ? (data.expiresAt.seconds ? data.expiresAt.seconds * 1000 : data.expiresAt.getTime()) : (Date.now() + 600000);

                if (change.type === "added") {
                    if (expiresMs <= Date.now()) continue; 
                    let plaintext = await Security.decryptText(data.ciphertext, data.iv, this.sharedKey, data.senderId);
                    data.plaintext = plaintext; 
                    onNewMessage(change.doc.id, data, change.doc.metadata.hasPendingWrites, expiresMs);
                }
                if (change.type === "modified") {
                    onModify(change.doc.id, data, change.doc.metadata.hasPendingWrites); // Pass data for Seen UI
                }
                if (change.type === "removed") {
                    onRemove(change.doc.id);
                }
            }
        });
    },

    stopListening() {
        if (this.unsubscribeFn) this.unsubscribeFn();
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },

    renderMessage(container, id, data, isPending, expiresMs) {
        const user = AuthModule.getCurrentUser();
        const isSelf = data.senderId === user.uid;
        
        const showNickname = this.lastSenderId !== data.senderId;
        this.lastSenderId = data.senderId;

        const wrapper = document.createElement('div');
        wrapper.id = `msg-${id}`;
        wrapper.className = `flex w-full message-enter ${isSelf ? 'justify-end' : 'justify-start'} ${showNickname ? 'mt-4' : 'mt-1'}`;
        wrapper.dataset.expiresAt = expiresMs; 

        const statusClass = isPending ? 'opacity-70' : 'opacity-100';
        
        let seenHTML = '';
        if (isSelf && data.seenBy && data.seenBy.length > 0) {
            const seenNames = data.seenBy
                .filter(s => !s.startsWith(user.uid))
                .map(s => s.split('|')[1])
                .filter(name => name)
                .join(', ');
            if (seenNames) seenHTML = `👁️ Seen by: ${seenNames}`;
        }
        
        wrapper.innerHTML = `
            <div class="max-w-[85%] sm:max-w-[70%] flex flex-col ${isSelf ? 'items-end' : 'items-start'}">
                ${(!isSelf && showNickname) ? `<span class="text-[11px] font-medium text-slate-500 mb-1 ml-1">${data.senderNickname}</span>` : ''}
                
                <div class="relative px-4 py-2.5 shadow-sm text-[15px] leading-relaxed break-words
                    ${isSelf ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm text-slate-900 dark:text-white'} 
                    ${statusClass}" 
                    ${!isSelf ? `data-observe="true" data-msg-id="${id}"` : ''}>
                    ${this.escapeHTML(data.plaintext)} 
                </div>
                
                <div class="flex flex-col items-${isSelf ? 'end' : 'start'} mt-1 px-1 min-h-[16px]">
                    <div class="flex items-center gap-2 text-[10px] text-slate-400 font-medium tracking-wide">
                        ${isSelf ? `<span class="msg-status">${isPending ? 'Sending...' : 'Sent ✓'}</span>` : ''}
                        <span class="countdown-timer"></span>
                    </div>
                    ${isSelf ? `<span class="msg-seen-by text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 empty:hidden">${seenHTML}</span>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(wrapper);

        // অন্য কারো মেসেজ স্ক্রিনে আসলে Observer সেটা ধরে markAsSeen কল করবে
        if (!isSelf && this.observer) {
            const bubble = wrapper.querySelector('[data-observe="true"]');
            if (bubble) this.observer.observe(bubble);
        }
    },

    updateMessageState(id, data, isPending) {
        const msgEl = document.getElementById(`msg-${id}`);
        if (!msgEl) return;
        
        const user = AuthModule.getCurrentUser();
        const isSelf = data.senderId === user.uid;

        const bubble = msgEl.querySelector('.opacity-70');
        if (bubble && !isPending) bubble.classList.replace('opacity-70', 'opacity-100');
        
        if (isSelf) {
            const statusEl = msgEl.querySelector('.msg-status');
            if (statusEl) statusEl.textContent = isPending ? 'Sending...' : 'Sent ✓';
            
            const seenEl = msgEl.querySelector('.msg-seen-by');
            if (seenEl && data.seenBy && data.seenBy.length > 0) {
                const seenNames = data.seenBy
                    .filter(s => !s.startsWith(user.uid))
                    .map(s => s.split('|')[1])
                    .filter(name => name)
                    .join(', ');
                if (seenNames) seenEl.textContent = `👁️ Seen by: ${seenNames}`;
            }
        }
    },

    markMessageFailed(id, text, nickname, retryCallback) {
        const msgEl = document.getElementById(`msg-${id}`);
        if (!msgEl) return;
        const bubble = msgEl.querySelector('.bg-emerald-600');
        if (bubble) bubble.classList.replace('bg-emerald-600', 'bg-red-500');
        const statusEl = msgEl.querySelector('.msg-status');
        if (statusEl) {
            statusEl.innerHTML = `<span class="text-red-500">Failed.</span> <button class="text-emerald-500 underline ml-1 retry-btn">Retry</button>`;
            statusEl.querySelector('.retry-btn').addEventListener('click', () => retryCallback(text, id));
        }
    },

    escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};