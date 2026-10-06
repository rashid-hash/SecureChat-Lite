// js/firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, collection, 
    runTransaction, serverTimestamp, increment, onSnapshot, query, orderBy, where,
    arrayUnion // <-- নতুন অ্যাড করা হয়েছে
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { 
    app, auth, db, signInAnonymously, onAuthStateChanged, 
    doc, setDoc, getDoc, updateDoc, deleteDoc, collection, 
    runTransaction, serverTimestamp, increment, onSnapshot, query, orderBy, where,
    arrayUnion // <-- নতুন অ্যাড করা হয়েছে
};