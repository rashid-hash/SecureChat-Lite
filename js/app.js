// js/app.js
import { RoomModule } from './room.js';
import { AuthModule } from './auth.js';
import { PWAModule } from './pwa.js';
import { Security } from './security.js';
import { MessagesModule } from './messages.js';
import { TypingModule } from './typing.js';
import { CleanupModule } from './cleanup.js';
import { db, doc, getDoc } from './firebase.js';

// PWA এবং অফলাইন ফিচার চালু করা
PWAModule.init();

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

    // --- ১. Landing Page ---
    initIndexPage() {
        const btnCreate = document.getElementById('btn-create');
        if(btnCreate) {
            btnCreate.addEventListener('click', () => {
                window.location.href = 'create.html';
            });
        }
    }

    // --- ২. Create Room Page ---
    async initCreatePage() {
        const formContainer = document.getElementById('create-form-container');
        const successContainer = document.getElementById('create-success-container');
        const createForm = document.getElementById('form-create-room');
        const submitBtn = document.getElementById('btn-submit-create');
        const radioType = document.querySelectorAll('input[name="roomType"]');
        const groupSettings = document.getElementById('group-settings');
        
        let generatedRoomId = null;

        // Group সিলেক্ট করলে Max Participants অপশন দেখানো
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
                    typingEnabled: document.getElementById('toggle-typing').checked,
                    liveDraftEnabled: document.getElementById('toggle-draft').checked
                };

                // রুম ক্রিয়েট করা
                generatedRoomId = await RoomModule.createRoom(settings);
                
                // এনক্রিপশন কী (E2EE) তৈরি করা
                const rawCryptoKey = await Security.generateEncryptionKey();
                const keyFragment = await Security.exportKeyToURL(rawCryptoKey);
                
                formContainer.classList.add('hidden');
                successContainer.classList.remove('hidden');

                // URL-এর শেষে হ্যাশ (#) দিয়ে কী যুক্ত করা
                const linkStr = `${window.location.origin}/join.html?roomId=${generatedRoomId}#key=${keyFragment}`;
                document.getElementById('room-link').value = linkStr;

            } catch (err) {
                alert("Failed to create room. Please check your internet connection.");
                submitBtn.disabled = false;
                submitBtn.innerHTML = "Generate Secure Room";
            }
        });

        // Copy Link Button
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
            // হোস্টকে চ্যাট পেজে পাঠানোর আগে কী-টি লোকালি সেভ করা
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
                alert("Could not lock room.");
                btn.disabled = false;
            }
        });
    }

    // --- ৩. Join Room Page ---
    async initJoinPage() {
        const loadingUI = document.getElementById('loading-container');
        const errorUI = document.getElementById('error-container');
        const formUI = document.getElementById('join-form-container');
        
        let roomId = this.urlParams.get('roomId') || this.urlParams.get('r');
        if (!roomId && this.path.includes('/r/')) {
            roomId = this.path.split('/r/')[1].replace('/', ''); // URL Rewrite সাপোর্ট
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
                    msg = "This room's 10-minute lifecycle has ended.";
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
                    sessionStorage.setItem(`sc_key_${roomId}`, keyFragment); // Key Save
                    window.location.href = `chat.html?roomId=${roomId}`;
                } catch (err) {
                    showError(err.message);
                }
            });

        } catch (err) {
            showError(err.message);
        }
    }

    // --- ৪. Chat Page ---
    async initChatPage() {
        const roomId = this.urlParams.get('roomId');
        const keyFragment = sessionStorage.getItem(`sc_key_${roomId}`);
        
        if (!roomId || !keyFragment) window.location.href = 'index.html';

        let nickname = sessionStorage.getItem('sc_nickname') || "Anonymous";
        let liveDraftEnabled = false;

        const chatContainer = document.getElementById('chat-container');
        const emptyState = document.getElementById('empty-state');
        const typingContainer = document.getElementById('typing-indicator-container');
        const messageInput = document.getElementById('message-input');
        const chatForm = document.getElementById('chat-form');
        
        let messageCount = 0;

        const scrollToBottom = (force = false) => {
            const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop <= chatContainer.clientHeight + 150;
            if (force || isAtBottom) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        };

        // Bottom Sheet Logic
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

        // Emoji Focus
        document.getElementById('btn-emoji').addEventListener('click', () => messageInput.focus());

        try {
            await AuthModule.authenticateAnonymousUser();
            
            // Web Crypto Key ইমপোর্ট করা
            const cryptoKey = await Security.importKeyFromURL(keyFragment);
            MessagesModule.setEncryptionKey(cryptoKey);
            TypingModule.setEncryptionKey(cryptoKey);

            // কানেকশন স্ট্যাটাস আপডেট
            const connDot = document.getElementById('ui-connection-dot');
            const connText = document.getElementById('ui-connection-text');
            connDot.classList.replace('bg-yellow-500', 'bg-emerald-500');
            connDot.classList.remove('animate-pulse');
            connText.textContent = "Secure connection";
            
            // রুম সেটিংস ফেচ করা (Live Draft চেক করার জন্য)
            const roomSnap = await getDoc(doc(db, "rooms", roomId));
            if (roomSnap.exists()) {
                const roomData = roomSnap.data();
                document.getElementById('ui-participant-count').textContent = `👥 ${roomData.participantCount}/${roomData.maxParticipants}`;
                
                liveDraftEnabled = roomData.settings?.liveDraftEnabled === true;
                if (liveDraftEnabled) {
                    document.getElementById('live-draft-warning').classList.remove('hidden');
                }
            }

            CleanupModule.startSweeper();

            // রিয়েল-টাইম মেসেজ লিসেনার
            MessagesModule.listenForMessages(roomId, 
                (id, data, isPending, expiresMs) => {
                    if(emptyState) emptyState.style.display = 'none';
                    messageCount++;
                    MessagesModule.renderMessage(chatContainer, id, data, isPending, expiresMs);
                    scrollToBottom(data.senderId === AuthModule.getCurrentUser().uid);
                },
                (id, data, isPending) => {
                    MessagesModule.updateMessageState(id, data, isPending);
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

            // টাইপিং লিসেনার
            const unsubscribeTyping = TypingModule.listenForTyping(roomId, typingContainer);

            // Input Events
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

            // Submit Handler
            const handleSend = async (textToSubmit, overrideId = null) => {
                if (!textToSubmit || textToSubmit.length > 2000) return;
                try {
                    if (overrideId) document.getElementById(`msg-${overrideId}`)?.remove();
                    await MessagesModule.sendMessage(roomId, textToSubmit, nickname);
                    TypingModule.clearTypingState(roomId);
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

            // Settings Sheet Actions
            document.getElementById('btn-copy-link').addEventListener('click', () => {
                const link = `${window.location.origin}/join.html?roomId=${roomId}#key=${keyFragment}`;
                navigator.clipboard.writeText(link);
                alert("Invite link copied to clipboard!");
            });

            document.getElementById('btn-lock').addEventListener('click', async () => {
                await RoomModule.lockRoom(roomId);
                alert("Room is now locked.");
            });

            const cleanupAndLeave = async () => {
                await TypingModule.clearTypingState(roomId);
                unsubscribeTyping();
                MessagesModule.stopListening();
                CleanupModule.stopSweeper();
                sessionStorage.removeItem('sc_nickname');
                sessionStorage.removeItem(`sc_key_${roomId}`);
            };

            document.getElementById('btn-destroy').addEventListener('click', async () => {
                if(confirm("Leave this room permanently?")) {
                    await cleanupAndLeave();
                    window.location.href = 'index.html';
                }
            });

            window.addEventListener('beforeunload', () => TypingModule.clearTypingState(roomId));

        } catch (error) {
            alert("Security Error: " + error.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => new AppController());