// js/app.js
import { RoomModule } from './room.js';
import { AuthModule } from './auth.js';
import { PWAModule } from './pwa.js';
import { Security } from './security.js';
import { MessagesModule } from './messages.js';
import { TypingModule } from './typing.js';
import { CleanupModule } from './cleanup.js';
import { db, doc, getDoc } from './firebase.js';
import { SoundModule } from './sound.js';

PWAModule.init();

// Premium Custom UI Modal System
const CustomUI = {
    createModalHTML() {
        if (document.getElementById('custom-modal-root')) return;
        const root = document.createElement('div');
        root.id = 'custom-modal-root';
        root.className = 'fixed inset-0 z-[9999] hidden items-center justify-center p-4 sm:p-6';
        root.innerHTML = `
            <div id="custom-modal-backdrop" class="absolute inset-0 bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm opacity-0 transition-opacity duration-300"></div>
            <div id="custom-modal-card" class="relative bg-white dark:bg-slate-900 rounded-[24px] w-full max-w-sm shadow-2xl transform scale-95 opacity-0 transition-all duration-300 border border-slate-200 dark:border-slate-800 p-6 flex flex-col items-center text-center">
                <div id="custom-modal-icon" class="w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 transition-colors"></div>
                <h3 id="custom-modal-title" class="text-xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight"></h3>
                <p id="custom-modal-desc" class="text-[14.5px] leading-relaxed text-slate-500 dark:text-slate-400 mb-8"></p>
                <div id="custom-modal-buttons" class="w-full flex gap-3"></div>
            </div>
        `;
        document.body.appendChild(root);
    },

    show({ type = 'info', title, message, confirmText = 'OK', cancelText = 'Cancel', isConfirm = false, isDestructive = false }) {
        return new Promise((resolve) => {
            this.createModalHTML();
            const root = document.getElementById('custom-modal-root');
            const backdrop = document.getElementById('custom-modal-backdrop');
            const card = document.getElementById('custom-modal-card');
            const icon = document.getElementById('custom-modal-icon');
            const titleEl = document.getElementById('custom-modal-title');
            const descEl = document.getElementById('custom-modal-desc');
            const btnContainer = document.getElementById('custom-modal-buttons');

            let iconSVG = '';
            let iconBg = '';
            let iconColor = '';
            
            if (type === 'error' || isDestructive) {
                iconSVG = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
                iconBg = 'bg-red-100 dark:bg-red-900/30';
                iconColor = 'text-red-600 dark:text-red-500';
            } else if (type === 'success') {
                iconSVG = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>`;
                iconBg = 'bg-emerald-100 dark:bg-emerald-900/30';
                iconColor = 'text-emerald-600 dark:text-emerald-500';
            } else {
                iconSVG = `<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
                iconBg = 'bg-blue-100 dark:bg-blue-900/30';
                iconColor = 'text-blue-600 dark:text-blue-500';
            }

            icon.className = `w-20 h-20 rounded-full flex items-center justify-center mb-5 ${iconBg} ${iconColor}`;
            icon.innerHTML = iconSVG;
            titleEl.textContent = title;
            descEl.textContent = message;

            btnContainer.innerHTML = '';
            const btnClass = "flex-1 py-3.5 px-4 rounded-xl text-[14.5px] font-semibold transition-all active:scale-95 tracking-wide";
            
            if (isConfirm) {
                const cancelBtn = document.createElement('button');
                cancelBtn.className = `${btnClass} bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700`;
                cancelBtn.textContent = cancelText;
                cancelBtn.onclick = () => close(false);
                btnContainer.appendChild(cancelBtn);
            }

            const confirmBtnColor = isDestructive 
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-md shadow-red-500/20' 
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = `${btnClass} ${confirmBtnColor}`;
            confirmBtn.textContent = confirmText;
            confirmBtn.onclick = () => close(true);
            btnContainer.appendChild(confirmBtn);

            root.classList.remove('hidden');
            root.classList.add('flex');
            
            // Trigger reflow for animation
            void root.offsetWidth;
            
            backdrop.classList.add('opacity-100');
            card.classList.remove('scale-95', 'opacity-0');
            card.classList.add('scale-100', 'opacity-100');

            const close = (result) => {
                backdrop.classList.remove('opacity-100');
                card.classList.remove('scale-100', 'opacity-100');
                card.classList.add('scale-95', 'opacity-0');
                setTimeout(() => {
                    root.classList.remove('flex');
                    root.classList.add('hidden');
                    resolve(result);
                }, 300);
            };
        });
    },
    alert(title, message, type = 'info') {
        return this.show({ type, title, message });
    },
    confirm(title, message, confirmText = 'Confirm', isDestructive = false) {
        return this.show({ type: isDestructive ? 'error' : 'info', title, message, confirmText, isConfirm: true, isDestructive });
    }
};

class AppController {
    constructor() {
        this.path = window.location.pathname;
        this.urlParams = new URLSearchParams(window.location.search);
        this.init();
    }

    async init() {
        if (this.path.includes('create.html')) {
            this.initCreatePage();
        } else if (this.path.includes('join.html')) {
            this.initJoinPage();
        } else if (this.path.includes('chat.html')) {
            this.initChatPage();
        } else {
            this.initIndexPage();
        }
    }

    initIndexPage() {
        const btnCreate = document.getElementById('btn-create');
        if(btnCreate) {
            btnCreate.addEventListener('click', () => {
                window.location.href = 'create.html';
            });
        }
    }

    async initCreatePage() {
        const btnCreate = document.getElementById('btn-create-room');
        const formCreate = document.getElementById('form-create-room');

        if(formCreate) {
            formCreate.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                // Button Loading Animation
                const originalText = btnCreate.innerHTML;
                btnCreate.innerHTML = `<svg class="animate-spin h-5 w-5 mx-auto text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>`;
                btnCreate.disabled = true;

                try {
                    // ১. ইউজারকে আগে অথেনটিকেট করা হচ্ছে (যাতে Unauthorized এরর না আসে)
                    await AuthModule.authenticateAnonymousUser();

                    // ২. ফ্রেশ সেটিংস রিড করা
                    const settings = {
                        roomType: document.querySelector('input[name="roomType"]:checked').value,
                        maxParticipants: document.getElementById('select-max-users').value,
                        messageExpiryMins: parseInt(document.getElementById('select-expiry').value) || 10,
                        typingEnabled: document.getElementById('toggle-typing').checked,
                        liveDraftEnabled: document.getElementById('toggle-draft').checked
                    };

                    // ৩. রুম তৈরি এবং এনক্রিপশন কি (Key) জেনারেট করা
                    const roomId = await RoomModule.createRoom(settings);
                    const cryptoKey = await Security.generateEncryptionKey();
                    const keyFragment = await Security.exportKeyToURL(cryptoKey);
                    
                    // Key সেভ করে চ্যাট পেজে রিডাইরেক্ট
                    sessionStorage.setItem(`sc_key_${roomId}`, keyFragment);
                    window.location.href = `chat.html?roomId=${roomId}`;

                } catch (error) {
                    console.error("Room Creation Error:", error); // কনসোলে এরর প্রিন্ট হবে
                    await CustomUI.alert("Creation Failed", "Failed to create room. Please check your internet connection.", "error");
                    
                    btnCreate.innerHTML = originalText;
                    btnCreate.disabled = false;
                }
            });
        }
    }

    async initJoinPage() {
        const loadingUI = document.getElementById('loading-container');
        const errorUI = document.getElementById('error-container');
        const formUI = document.getElementById('join-form-container');
        
        let roomId = this.urlParams.get('roomId') || this.urlParams.get('r');
        if (!roomId && this.path.includes('/r/')) {
            roomId = this.path.split('/r/')[1].replace('/', ''); 
        }

        const keyFragment = window.location.hash.replace('#key=', '');

        const showError = (code) => {
            loadingUI.classList.add('hidden');
            formUI.classList.add('hidden');
            
            let title = "Access Denied";
            let msg = "The room could not be accessed.";
            let icon = "🚫";

            switch(code) {
                case "ROOM_NOT_FOUND":
                case "INVALID_LINK":
                    title = "Invalid Link";
                    msg = "This link is incomplete or the room never existed.";
                    icon = "❓";
                    break;
                case "ROOM_EXPIRED":
                    title = "Room Expired";
                    msg = "This room's lifecycle has ended.";
                    icon = "⏳";
                    break;
                case "ROOM_FULL":
                    title = "Room Full";
                    msg = "This room has reached its maximum capacity.";
                    icon = "👥";
                    break;
                case "ROOM_LOCKED":
                    title = "Room Locked";
                    msg = "The host has locked this room.";
                    icon = "🔒";
                    break;
                case "CONNECTION_ERROR":
                    title = "Connection Error";
                    msg = "Could not connect to secure servers.";
                    icon = "📶";
                    break;
            }

            document.getElementById('error-title').textContent = title;
            document.getElementById('error-message').textContent = msg;
            document.getElementById('error-icon').textContent = icon;
            errorUI.classList.remove('hidden');
        };

        if (!roomId || !keyFragment) return showError("INVALID_LINK");

        try {
            await AuthModule.authenticateAnonymousUser();
            await RoomModule.validateRoomStatus(roomId);

            loadingUI.classList.add('hidden');
            formUI.classList.remove('hidden');

            const joinForm = document.getElementById('form-join-room');
            const submitBtn = document.getElementById('btn-confirm-join');

            joinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<span class="animate-pulse">Joining...</span>`;

                const nickname = document.getElementById('input-nickname').value.trim();

                try {
                    await RoomModule.joinRoom(roomId, nickname);
                    sessionStorage.setItem('sc_nickname', nickname);
                    sessionStorage.setItem(`sc_key_${roomId}`, keyFragment); 
                    window.location.href = `chat.html?roomId=${roomId}`;
                } catch (err) {
                    showError(err.message);
                }
            });

        } catch (err) {
            showError(err.message);
        }
    }

    async initChatPage() {
        const roomId = this.urlParams.get('roomId');
        const keyFragment = sessionStorage.getItem(`sc_key_${roomId}`);
        
        if (!roomId || !keyFragment) {
            window.location.href = 'index.html';
            return;
        }

        let nickname = sessionStorage.getItem('sc_nickname') || "Anonymous";
        let liveDraftEnabled = false;
        let messageExpiryMins = 10;
        let isHost = false;
        let isBurnMode = false; // Burn Mode State

        const chatContainer = document.getElementById('chat-container');
        const emptyState = document.getElementById('empty-state');
        const typingContainer = document.getElementById('typing-indicator-container');
        const messageInput = document.getElementById('message-input');
        const chatForm = document.getElementById('chat-form');
        const btnBurn = document.getElementById('btn-burn-toggle');
        
        let messageCount = 0;

        const scrollToBottom = (force = false) => {
            if (!chatContainer) return;
            const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 150;
            if (force || isAtBottom) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        };

        // --- ENHANCED UNIVERSAL VIEWPORT FIX ---
        const appContainer = document.querySelector('.app-container');
        
        const adjustViewport = () => {
            if (window.visualViewport && appContainer) {
                // কীবোর্ড ওপেন হলে শুধু app-container এর সাইজ ছোট হবে
                appContainer.style.height = window.visualViewport.height + 'px';
                
                // ব্রাউজারকে জোর করে ঠেলে উপরে ওঠা থেকে বিরত রাখা
                window.scrollTo(0, 0);
                document.body.scrollTop = 0;
            }
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                adjustViewport();
                setTimeout(() => scrollToBottom(true), 100);
            });
            
            // কীবোর্ড ওপেন হওয়ার সময় ব্রাউজার যেন স্ক্রল করতে না পারে
            window.visualViewport.addEventListener('scroll', () => {
                window.scrollTo(0, 0);
            });
        } else {
            window.addEventListener('resize', () => {
                if(appContainer) appContainer.style.height = window.innerHeight + 'px';
                setTimeout(() => scrollToBottom(true), 100);
            });
        }
        
        // Page load হওয়ার সাথে সাথে height adjust করে নেবে
        adjustViewport();
        // ----------------------------------------

        messageInput.addEventListener('focus', () => {
            setTimeout(() => {
                adjustViewport();
                scrollToBottom(true);
            }, 300);
        });

        // ----------------------------------------

        const settingsOverlay = document.getElementById('settings-overlay');
        const settingsSheet = document.getElementById('settings-sheet');
        
        document.getElementById('btn-open-settings').addEventListener('click', () => {
            settingsOverlay.classList.add('active');
            settingsSheet.classList.add('active');
        });
        
        settingsOverlay.addEventListener('click', () => {
            settingsOverlay.classList.remove('active');
            settingsSheet.classList.remove('active');
        });

        const btnEmoji = document.getElementById('btn-emoji');
        if (btnEmoji) {
            btnEmoji.addEventListener('click', () => messageInput.focus());
        }

        // Burn Mode Toggle Logic
        if (btnBurn) {
            btnBurn.addEventListener('click', () => {
                isBurnMode = !isBurnMode;
                if (isBurnMode) {
                    btnBurn.classList.add('text-orange-500', 'bg-orange-100', 'dark:bg-orange-900/40');
                    btnBurn.classList.remove('text-slate-400');
                    CustomUI.alert("Burn Mode ON 🔥", "This message will self-destruct 5 seconds after they read it.", "info");
                } else {
                    btnBurn.classList.remove('text-orange-500', 'bg-orange-100', 'dark:bg-orange-900/40');
                    btnBurn.classList.add('text-slate-400');
                }
                messageInput.focus();
            });
        }

        try {
            SoundModule.init();
            const currentUser = await AuthModule.authenticateAnonymousUser();
            

            // --- ANTI-SCREENSHOT WATERMARK (NEW) ---
            const applyWatermark = (userName) => {
                // একটি ডাইনামিক SVG জলছাপ তৈরি করা হচ্ছে
                const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="250" height="150">
                    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="15" font-weight="bold" fill="gray" opacity="0.12" transform="rotate(-35, 125, 75)">${userName}</text>
                </svg>`;
                // SVG টিকে Base64 এ কনভার্ট করে ব্যাকগ্রাউন্ডে সেট করা
                const encoded = btoa(unescape(encodeURIComponent(svg)));
                chatContainer.style.backgroundImage = `url("data:image/svg+xml;base64,${encoded}")`;
                chatContainer.style.backgroundRepeat = 'repeat';
                chatContainer.style.backgroundPosition = 'center';
            };
            // ইউজারের নিকনেম দিয়ে জলছাপটি চালু করে দিন
            applyWatermark(nickname);
            
            const cryptoKey = await Security.importKeyFromURL(keyFragment);
            MessagesModule.setEncryptionKey(cryptoKey);
            TypingModule.setEncryptionKey(cryptoKey);

            const connDot = document.getElementById('ui-connection-dot');
            const connText = document.getElementById('ui-connection-text');
            if (connDot && connText) {
                connDot.classList.replace('bg-yellow-500', 'bg-emerald-500');
                connDot.classList.remove('animate-pulse');
                connText.textContent = "Secure connection";
            }
            
            const roomSnap = await getDoc(doc(db, "rooms", roomId));
            if (roomSnap.exists()) {
                const roomData = roomSnap.data();
                
                const countEl = document.getElementById('ui-participant-count');
                if (countEl) countEl.textContent = `👥 ${roomData.participantCount}/${roomData.maxParticipants}`;
                
                isHost = roomData.ownerId === currentUser.uid;

                messageExpiryMins = roomData.settings?.messageExpiryMins || 10;
                const expiryTag = document.getElementById('ui-expiry-tag');
                if (expiryTag) expiryTag.textContent = `E2E ENCRYPTED • ${messageExpiryMins} MIN EXPIRY`;
                
                liveDraftEnabled = roomData.settings?.liveDraftEnabled === true;
                const draftWarning = document.getElementById('live-draft-warning');
                if (liveDraftEnabled && isHost && draftWarning) {
                    draftWarning.classList.remove('hidden');
                }
            }

            CleanupModule.startSweeper();

            MessagesModule.listenForMessages(roomId, 
                (id, data, isPending, expiresMs) => {
                    if(emptyState) emptyState.style.display = 'none';
                    messageCount++;
                    MessagesModule.renderMessage(chatContainer, id, data, isPending, expiresMs);
                    if (data.senderId !== currentUser.uid && !isPending) {
                        SoundModule.playPopSound();
                        SoundModule.triggerHaptic(40);
                    }

                    scrollToBottom(data.senderId === AuthModule.getCurrentUser().uid);
                },
                (id, data, isPending, expiresMs) => { 
                    MessagesModule.updateMessageState(id, data, isPending, expiresMs);
                },
                (id) => {
                    const msgEl = document.getElementById(`msg-${id}`);
                    if (msgEl) {
                        msgEl.classList.add('message-expire');
                        setTimeout(() => {
                            msgEl.remove();
                            messageCount--;
                            if(messageCount === 0 && emptyState) emptyState.style.display = 'flex';
                        }, 300);
                    }
                }
            );

            const unsubscribeTyping = TypingModule.listenForTyping(roomId, typingContainer, isHost);

            messageInput.addEventListener('input', (e) => {
                messageInput.style.height = 'auto';
                messageInput.style.height = Math.min(messageInput.scrollHeight, 112) + 'px';
                TypingModule.broadcastTyping(roomId, e.target.value, liveDraftEnabled);
            });
            messageInput.addEventListener('blur', () => {
                if(messageInput.value.trim() === '') TypingModule.clearTypingState(roomId);
            });
            messageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    chatForm.dispatchEvent(new Event('submit'));
                }
            });

            // ১. আপডেটেড handleSend ফাংশন (ইমেজ সাপোর্ট সহ)
            const handleSend = async (textToSubmit, overrideId = null, msgType = "text") => {
                if (!textToSubmit) return;
                // সাধারণ টেক্সটের ক্ষেত্রে লিমিট চেক, ইমেজের Base64 অনেক বড় হবে তাই সেটি স্কিপ করা হলো
                if (msgType === "text" && textToSubmit.length > 2000) return;
                
                try {
                    if (overrideId) document.getElementById(`msg-${overrideId}`)?.remove();
                    
                    // msgType (text বা image) ডেটাবেসে পাঠানো হচ্ছে
                    await MessagesModule.sendMessage(roomId, textToSubmit, nickname, messageExpiryMins, isBurnMode, msgType);
                    TypingModule.clearTypingState(roomId);
                    
                    // মেসেজ সেন্ড করার সাউন্ড ও হ্যাপটিক ফিডব্যাক
                    if (typeof SoundModule !== 'undefined') {
                        SoundModule.playPopSound();
                        SoundModule.triggerHaptic(20);
                    }
                    
                    if(isBurnMode && btnBurn) btnBurn.click(); 
                } catch (failedId) {
                    MessagesModule.markMessageFailed(failedId.message, textToSubmit, nickname, handleSend);
                }
            };

            // ২. ইমেজ প্রসেসিং ও কম্প্রেশন লজিক
            const btnAttach = document.getElementById('btn-attach');
            const inputImage = document.getElementById('input-image');

            if (btnAttach && inputImage) {
                btnAttach.addEventListener('click', () => {
                    inputImage.click(); // অ্যাটাচ বাটনে ক্লিক করলে হিডেন ফাইল ইনপুট ওপেন হবে
                });

                inputImage.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    // ছবি সেন্ড হওয়ার সময় বাটনটিকে একটু অপাসিটি কমিয়ে বোঝানো হবে যে কাজ চলছে
                    btnAttach.style.opacity = '0.5';
                    btnAttach.classList.add('animate-pulse');

                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const img = new Image();
                        img.onload = () => {
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');

                            // ছবির সাইজ ছোট করার লজিক (Max width/height 800px)
                            const MAX_SIZE = 800;
                            let width = img.width;
                            let height = img.height;

                            if (width > height) {
                                if (width > MAX_SIZE) {
                                    height = Math.round(height * (MAX_SIZE / width));
                                    width = MAX_SIZE;
                                }
                            } else {
                                if (height > MAX_SIZE) {
                                    width = Math.round(width * (MAX_SIZE / height));
                                    height = MAX_SIZE;
                                }
                            }

                            canvas.width = width;
                            canvas.height = height;
                            ctx.drawImage(img, 0, 0, width, height);

                            // WebP ফরম্যাটে ছবি কম্প্রেস করা (Quality: 0.6 বা ৬০% - যা ফায়ারবেস লিমিট বাঁচাবে)
                            const compressedBase64 = canvas.toDataURL('image/webp', 0.6);

                            // এনক্রিপ্ট ও সেন্ড করার জন্য handleSend-কে কল করা (msgType = 'image')
                            handleSend(compressedBase64, null, 'image');
                            
                            // কাজ শেষ হলে ইনপুট ক্লিয়ার ও বাটন ঠিক করা
                            inputImage.value = '';
                            btnAttach.style.opacity = '1';
                            btnAttach.classList.remove('animate-pulse');
                        };
                        img.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                });
            }

            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const text = messageInput.value.trim();
                messageInput.value = '';
                messageInput.style.height = 'auto';
                messageInput.focus();
                handleSend(text);
            });

            const btnCopyLink = document.getElementById('btn-copy-link');
            if (btnCopyLink) {
                btnCopyLink.addEventListener('click', async () => {
                    const link = `${window.location.origin}/join.html?roomId=${roomId}#key=${keyFragment}`;
                    navigator.clipboard.writeText(link);
                    await CustomUI.alert("Link Copied", "Invite link has been copied to clipboard!", "success");
                });
            }

            const btnLock = document.getElementById('btn-lock');
            if (btnLock) {
                btnLock.addEventListener('click', async () => {
                    await RoomModule.lockRoom(roomId);
                    settingsOverlay.classList.remove('active');
                    settingsSheet.classList.remove('active');
                    await CustomUI.alert("Room Locked", "This room is now locked. No one else can join.", "success");
                });
            }

            const cleanupAndLeave = async () => {
                await TypingModule.clearTypingState(roomId);
                unsubscribeTyping();
                MessagesModule.stopListening();
                CleanupModule.stopSweeper();
                sessionStorage.removeItem('sc_nickname');
                sessionStorage.removeItem(`sc_key_${roomId}`);
            };

            const btnDestroy = document.getElementById('btn-destroy');
            if (btnDestroy) {
                btnDestroy.addEventListener('click', async () => {
                    settingsOverlay.classList.remove('active');
                    settingsSheet.classList.remove('active');
                    
                    const confirmed = await CustomUI.confirm(
                        "Leave Room?", 
                        "Are you sure you want to leave this room permanently? You cannot rejoin.", 
                        "Leave & Destroy", 
                        true 
                    );
                    
                    if(confirmed) {
                        await cleanupAndLeave();
                        window.location.href = 'index.html';
                    }
                });
            }

            window.addEventListener('beforeunload', () => TypingModule.clearTypingState(roomId));

        } catch (error) {
            await CustomUI.alert("Security Error", error.message, "error");
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new AppController());