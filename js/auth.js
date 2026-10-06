// js/auth.js
import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';

export const AuthModule = {
    /**
     * ইমেইল বা পাসওয়ার্ড ছাড়াই ইউজারকে অ্যানোনিমাসলি (Anonymously) 
     * অথেনটিকেট করে এবং একটি টেম্পোরারি UID প্রদান করে।
     */
    async authenticateAnonymousUser() {
        try {
            // যদি আগে থেকেই লগইন করা থাকে, তবে সেই ইউজারকেই রিটার্ন করবে
            if (auth.currentUser) {
                return auth.currentUser;
            }
            
            const userCredential = await signInAnonymously(auth);
            console.log(`[Auth] Secured temporary identity: ${userCredential.user.uid}`);
            return userCredential.user;
            
        } catch (error) {
            console.error("[Auth] Security error during anonymous sign-in:", error);
            throw new Error("Could not securely authenticate. Please check your connection.");
        }
    },
    
    /**
     * বর্তমানে লগইন করা ইউজারের অবজেক্ট রিটার্ন করে।
     */
    getCurrentUser() {
        return auth.currentUser;
    },

    /**
     * ইউজারের অথেনটিকেশন স্টেট পরিবর্তনের জন্য লিসেনার।
     */
    onAuthReady(callback) {
        return onAuthStateChanged(auth, (user) => {
            if (user) {
                callback(user);
            }
        });
    }
};