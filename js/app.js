// js/app.js
import { RoomModule } from './room.js';
import { AuthModule } from './auth.js';
import { PWAModule } from './pwa.js';
import { Security } from './security.js';
import { MessagesModule } from './messages.js';
import { TypingModule } from './typing.js';
import { CleanupModule } from './cleanup.js';
import { db, doc, getDoc } from './firebase.js';

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
        const formContainer = document.getElementById('create-form-container');
        const successContainer = document.getElementById('create-success-container');
        const createForm = document.getElementById('form-create-room');
        const submitBtn = document.getElementById('btn-submit-create');
        const radioType = document.querySelectorAll('input[name="roomType"]');
        const groupSettings = document.getElementById('group-settings');
        
        let generatedRoomId = null;

        radioType.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'group') {
                    groupSettings.classList.remove('hidden');
                } else {
                    groupSettings.classList.add('hidden');
                }
            });
        });

        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            submitBtn.disabled = true;
            submitBtn.innerHTML = `<span class="animate-pulse">Generating Secure Keys...</span>`;

            try {
                await AuthModule.authenticateAnonymousUser();

                const settings = {
                    roomType: document.querySelector('input[name="roomType"]:checked').value,
                    maxParticipants: document.getElementById('select-max-users').value,
                    messageExpiryMins: parseInt(document.getElementById('select-expiry').value) || 10,
                    typingEnabled: document.getElementById('toggle-typing').checked,
                    liveDraftEnabled: document.getElementById('toggle-draft').checked
                };

                generatedRoomId = await RoomModule.createRoom(settings);
                const rawCryptoKey = await Security.generateEncryptionKey();
                const keyFragment = await Security.exportKeyToURL(rawCryptoKey);
                
                formContainer.classList.add('hidden');
                successContainer.classList.remove('hidden');

                const linkStr = `${window.location.origin}/join.html?roomId=${generatedRoomId}#key=${keyFragment}`;
                document.getElementById('room-link').value = linkStr;

            } catch (err) {
                await CustomUI.alert("Creation Failed", "Failed to create room. Please check your internet connection.", "error");
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Generate Secure Room";
            }
        });

        document.getElementById('btn-copy').addEventListener('click', (e) => {
            const input = document.getElementById('room-link');
            input.select();
            input.setSelectionRange(0, 99999); 
            navigator.clipboard.writeText(input.value);
            
            const btn = e.target;
            btn.textContent = "Copied!";
            btn.classList.add('bg-emerald-100', 'text-emerald-700');
            setTimeout(() => {
                btn.textContent = "Copy Invite Link";
                btn.classList.remove('bg-emerald-100', 'text-emerald-700');
            }, 2000);
        });

        document.getElementById('btn-open-chat').addEventListener('click', () => {
            const keyFragment = document.getElementById('room-link').value.split('#key=')[1];
            sessionStorage.setItem(`sc_key_${generatedRoomId}`, keyFragment);
            window.location.href = `chat.html?roomId=${generatedRoomId}`;
        });

        document.getElementById('btn-lock-early').addEventListener('click', async (e) => {
            const btn = e.target;
            btn.disabled = true;
            try {
                await RoomModule.lockRoom(generatedRoomId);
                btn.innerHTML = "🔒 Room Locked";
                btn.classList.add('text-amber-600', 'border-amber-200', 'bg-amber-50');
            } catch (err) {
                await CustomUI.alert("Lock Failed", "Could not lock room.", "error");
                btn.disabled = false;
            }
        });
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
        const adjustViewport = () => {
            // Android, iOS, PWA shobkicchu te perfect vabe height adjust korar master logic
            const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            document.body.style.height = vh + 'px';
            document.documentElement.style.height = vh + 'px'; 
            window.scrollTo(0, 0);
        };

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', () => {
                adjustViewport();
                setTimeout(() => scrollToBottom(true), 100);
            });
        } else {
            window.addEventListener('resize', () => {
                adjustViewport();
                setTimeout(() => scrollToBottom(true), 100);
            });
        }
        
        // Page load howar shathe shathei height adjust kore nebe
        adjustViewport();
        // ----------------------------------------

        messageInput.addEventListener('focus', () => {
            setTimeout(() => scrollToBottom(true), 300);
        });

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
            const currentUser = await AuthModule.authenticateAnonymousUser();
            
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

            const handleSend = async (textToSubmit, overrideId = null) => {
                if (!textToSubmit || textToSubmit.length > 2000) return;
                try {
                    if (overrideId) document.getElementById(`msg-${overrideId}`)?.remove();
                    
                    await MessagesModule.sendMessage(roomId, textToSubmit, nickname, messageExpiryMins, isBurnMode);
                    TypingModule.clearTypingState(roomId);
                    
                    if(isBurnMode && btnBurn) btnBurn.click(); 
                } catch (failedId) {
                    MessagesModule.markMessageFailed(failedId.message, textToSubmit, nickname, handleSend);
                }
            };

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