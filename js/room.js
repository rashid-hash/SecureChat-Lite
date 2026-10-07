// js/room.js
import { db, doc, setDoc, getDoc, updateDoc, runTransaction, serverTimestamp } from './firebase.js';
import { Security } from './security.js';
import { AuthModule } from './auth.js';

export const RoomModule = {
    
    /**
     * নতুন একটি রুম ক্রিয়েট করে ডেটাবেসে সেভ করে।
     */
    async createRoom(settings) {
        const user = AuthModule.getCurrentUser();
        if (!user) throw new Error("Unauthorized");

        const roomId = Security.generateSecureRoomId(12);
        const roomRef = doc(db, "rooms", roomId);

        const payload = {
            ownerId: user.uid,
            createdAt: new Date(),
            status: "active",
            participantCount: 1,
            maxParticipants: parseInt(settings.maxParticipants) || 5,
            settings: {
                roomType: settings.roomType,
                messageExpiryMins: settings.messageExpiryMins,
                typingEnabled: settings.typingEnabled,
                liveDraftEnabled: settings.liveDraftEnabled
            }
        };

        await setDoc(roomRef, payload);
        return roomId;
    },

    /**
     * ইউজারের কাছে নিকনেম চাওয়ার আগেই রুমটি ভ্যালিড কি না তা চেক করে।
     */
    async validateRoomStatus(roomId) {
        try {
            const roomRef = doc(db, "rooms", roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) {
                throw new Error("ROOM_NOT_FOUND");
            }

            const data = roomSnap.data();

            // ক্লায়েন্ট-সাইড এক্সপায়ারি চেক
            if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
                throw new Error("ROOM_EXPIRED");
            }

            if (data.isLocked) {
                throw new Error("ROOM_LOCKED");
            }

            // রুম ফুল কি না চেক করা
            if (data.participantCount >= data.maxParticipants) {
                const user = AuthModule.getCurrentUser();
                if (user) {
                    // যদি ইউজার আগে থেকেই জয়েন করে থাকে (যেমন পেজ রিলোড দিলে), তবে তাকে ঢুকতে দেওয়া হবে
                    const participantSnap = await getDoc(doc(db, `rooms/${roomId}/participants`, user.uid));
                    if (participantSnap.exists()) return true; 
                }
                throw new Error("ROOM_FULL");
            }

            return true;
        } catch (error) {
            // নেটওয়ার্ক বা কানেকশন এরর চেক
            if (error.code === 'unavailable' || error.message.includes('offline')) {
                throw new Error("CONNECTION_ERROR");
            }
            throw error;
        }
    },

    /**
     * সিকিউর ট্রানজেকশনের মাধ্যমে রুমে নতুন পার্টিসিপেন্ট জয়েন করানো।
     */
    async joinRoom(roomId, nickname) {
        const user = AuthModule.getCurrentUser();
        if (!user) throw new Error("AUTH_REQUIRED");

        const roomRef = doc(db, "rooms", roomId);
        const participantRef = doc(db, `rooms/${roomId}/participants`, user.uid);

        // runTransaction ব্যবহার করা হচ্ছে যাতে একসাথে ২ জন জয়েন করলে ক্যাপাসিটি লিমিট ব্রেক না হয়
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            
            if (!roomDoc.exists()) throw new Error("ROOM_NOT_FOUND");
            const roomData = roomDoc.data();
            if (roomData.isLocked) throw new Error("ROOM_LOCKED");

            const participantDoc = await transaction.get(participantRef);
            
            // যদি ইউজার আগে থেকে রুমে না থাকে
            if (!participantDoc.exists()) {
                if (roomData.participantCount >= roomData.maxParticipants) {
                    throw new Error("ROOM_FULL");
                }
                
                // নতুন ইউজার অ্যাড করা
                transaction.set(participantRef, {
                    nickname: nickname,
                    joinedAt: serverTimestamp(),
                    lastSeen: serverTimestamp(),
                    role: "guest"
                });
                
                // রুমের মেম্বার কাউন্ট ১ বাড়ানো
                transaction.update(roomRef, {
                    participantCount: roomData.participantCount + 1
                });
            } else {
                // আগে থেকেই থাকলে শুধু নিকনেম আপডেট করা
                transaction.update(participantRef, {
                    nickname: nickname,
                    lastSeen: serverTimestamp()
                });
            }
        });
        return true;
    },

    /**
     * রুম লক করা (যাতে আর কেউ লিংক দিয়ে ঢুকতে না পারে)।
     */
    async lockRoom(roomId) {
        const user = AuthModule.getCurrentUser();
        if (!user) return;
        
        const roomRef = doc(db, "rooms", roomId);
        await updateDoc(roomRef, { isLocked: true });
    }
};