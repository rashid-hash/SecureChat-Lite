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

    initObserver(roomId) {
        if (this.observer) return;
        this.observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const msgId = entry.target.dataset.msgId;
                    const isBurn = entry.target.dataset.burn === "true"; // চেক করবে Burn Mode অন কি না
                    this.markAsSeen(roomId, msgId, isBurn);
                    this.observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });
    },

    async markAsSeen(roomId, msgId, isBurn) {
        const user = AuthModule.getCurrentUser();
        const nickname = sessionStorage.getItem('sc_nickname') || "Anonymous";
        if (!user) return;
        
        try {
            const msgRef = doc(db, `rooms/${roomId}/messages`, msgId);
            const updateData = { seenBy: arrayUnion(`${user.uid}|${nickname}`) };
            
            // যদি Burn Message হয়, তাহলে মেয়াদ কমিয়ে ৫ সেকেন্ড করে দেবে!
            if (isBurn) {
                updateData.expiresAt = new Date(Date.now() + 5000); 
            }
            
            await updateDoc(msgRef, updateData);
        } catch (e) {}
    },

    // isBurnOnRead প্যারামিটার রিসিভ করছে
    async sendMessage(roomId, textOrBase64, nickname, expiryMins = 10, isBurnOnRead = false, msgType = "text") {
        const user = AuthModule.getCurrentUser();
        if (!user || !this.sharedKey) throw new Error("Missing auth or encryption key");

        if (Date.now() - this.lastSendTime < 500) return;
        this.lastSendTime = Date.now();

        const messageId = Security.generateSecureRoomId(20);
        const msgRef = doc(db, `rooms/${roomId}/messages`, messageId);
        
        const now = Date.now();
        // মেসেজটি টেক্সট হোক বা ছবির Base64, পুরোটাই এনক্রিপ্ট হয়ে যাবে!
        const { ciphertext, iv } = await Security.encryptText(textOrBase64.trim(), this.sharedKey, user.uid);
        const expiryMs = expiryMins * 60000; 

        const payload = {
            senderId: user.uid,
            senderNickname: nickname,
            ciphertext: ciphertext,
            iv: iv,
            createdAt: new Date(now),
            expiresAt: new Date(now + expiryMs),
            type: msgType, // "text" অথবা "image" সেভ হবে
            status: "sent",
            seenBy: [],
            isBurnOnRead: isBurnOnRead
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
                
                let expiresMs = Date.now() + 600000; 
                if (data.expiresAt) {
                    if (data.expiresAt.toDate) expiresMs = data.expiresAt.toDate().getTime();
                    else if (data.expiresAt.seconds) expiresMs = data.expiresAt.seconds * 1000;
                    else if (typeof data.expiresAt === 'number') expiresMs = data.expiresAt;
                }

                if (change.type === "added") {
                    if (expiresMs <= Date.now()) continue; 
                    let plaintext = await Security.decryptText(data.ciphertext, data.iv, this.sharedKey, data.senderId);
                    data.plaintext = plaintext; 
                    onNewMessage(change.doc.id, data, change.doc.metadata.hasPendingWrites, expiresMs);
                }
                if (change.type === "modified") {
                    // মডিফাই হলে নতুন expiresMs পাঠিয়ে দেওয়া হবে (যাতে ৫ সেকেন্ডের টাইমার UI তে শুরু হয়)
                    onModify(change.doc.id, data, change.doc.metadata.hasPendingWrites, expiresMs); 
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
        wrapper.className = `flex w-full message-enter ${isSelf ? 'justify-end' : 'justify-start'} ${showNickname ? 'mt-4' : 'mt-1'} relative`;
        wrapper.dataset.expiresAt = expiresMs; 

        const statusClass = isPending ? 'opacity-70' : 'opacity-100';
        
        let seenHTML = '';
        if (isSelf && data.seenBy && data.seenBy.length > 0) {
            const seenNames = data.seenBy.filter(s => !s.startsWith(user.uid)).map(s => s.split('|')[1]).filter(name => name).join(', ');
            if (seenNames) seenHTML = `👁️ Seen by: ${seenNames}`;
        }

        // Burn Mode ব্যাজ
        const burnBadge = data.isBurnOnRead ? `
            <span class="absolute -top-3 ${isSelf ? 'right-0' : 'left-0'} bg-orange-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse flex items-center gap-1 z-10 border border-white dark:border-slate-800">
                <svg class="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z" clip-rule="evenodd"></path></svg>
                VIEW ONCE
            </span>
        ` : '';

        let contentHTML = '';
        if (data.type === 'image') {
            // যদি ছবি হয়, তাহলে Base64 দিয়ে <img> ট্যাগ রেন্ডার করবে
            contentHTML = `<img src="${data.plaintext}" class="rounded-xl max-w-full h-auto max-h-56 object-cover cursor-pointer hover:opacity-90 transition-opacity border border-slate-200 dark:border-slate-700/50" onclick="window.open(this.src, '_blank')">`;
        } else {
            // সাধারণ টেক্সট হলে আগের মতোই থাকবে
            contentHTML = this.escapeHTML(data.plaintext);
        }

        wrapper.innerHTML = `
            <div class="max-w-[85%] sm:max-w-[70%] flex flex-col ${isSelf ? 'items-end' : 'items-start'} relative">
                ${(!isSelf && showNickname) ? `<span class="text-[11px] font-medium text-slate-500 mb-1 ml-1">${data.senderNickname}</span>` : ''}
                
                ${burnBadge}
                
                <div class="relative px-4 py-2.5 shadow-sm text-[15px] leading-relaxed break-words
                    ${isSelf ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-sm' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm text-slate-900 dark:text-white'} 
                    ${data.isBurnOnRead ? 'border-orange-500/50 dark:border-orange-500/50 ring-1 ring-orange-500/30' : ''}
                    ${data.type === 'image' ? 'p-1.5' : ''} /* ছবির জন্য প্যাডিং কমানো */
                    ${statusClass}" 
                    ${!isSelf ? `data-observe="true" data-msg-id="${id}" data-burn="${data.isBurnOnRead || false}"` : ''}>
                    ${contentHTML} 
                </div>
                
                <div class="flex flex-col items-${isSelf ? 'end' : 'start'} mt-1 px-1 min-h-[16px]">
                    <div class="flex items-center gap-2 text-[10px] ${data.isBurnOnRead ? 'text-orange-500 font-bold' : 'text-slate-400 font-medium'} tracking-wide">
                        ${isSelf ? `<span class="msg-status">${isPending ? 'Sending...' : 'Sent ✓'}</span>` : ''}
                        <span class="countdown-timer"></span>
                    </div>
                    ${isSelf ? `<span class="msg-seen-by text-[10.5px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 empty:hidden">${seenHTML}</span>` : ''}
                </div>
            </div>
        `;
        
        container.appendChild(wrapper);

        if (!isSelf && this.observer) {
            const bubble = wrapper.querySelector('[data-observe="true"]');
            if (bubble) this.observer.observe(bubble);
        }
    },

    updateMessageState(id, data, isPending, expiresMs) {
        const msgEl = document.getElementById(`msg-${id}`);
        if (!msgEl) return;
        
        const user = AuthModule.getCurrentUser();
        const isSelf = data.senderId === user.uid;

        const bubble = msgEl.querySelector('.opacity-70');
        if (bubble && !isPending) bubble.classList.replace('opacity-70', 'opacity-100');
        
        // কাউন্টডাউন টাইমার ৫ সেকেন্ডে আপডেট করার লজিক
        if (expiresMs) {
            msgEl.dataset.expiresAt = expiresMs;
        }
        
        if (isSelf) {
            const statusEl = msgEl.querySelector('.msg-status');
            if (statusEl) statusEl.textContent = isPending ? 'Sending...' : 'Sent ✓';
            
            const seenEl = msgEl.querySelector('.msg-seen-by');
            if (seenEl && data.seenBy && data.seenBy.length > 0) {
                const seenNames = data.seenBy.filter(s => !s.startsWith(user.uid)).map(s => s.split('|')[1]).filter(name => name).join(', ');
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