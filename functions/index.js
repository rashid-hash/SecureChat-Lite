const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

/**
 * Runs every 1 minute.
 * Sweeps the entire database for any message where expiresAt has passed.
 * Hard deletes them in batches of 500 (Firestore limit).
 */
exports.reaper = functions.pubsub.schedule("every 1 minutes").onRun(async (context) => {
    const now = admin.firestore.Timestamp.now();
    
    try {
        // Query across ALL rooms for expired messages
        const expiredSnapshot = await db.collectionGroup("messages")
            .where("expiresAt", "<=", now)
            .limit(500)
            .get();

        if (expiredSnapshot.empty) {
            console.log("No expired messages found.");
            return null;
        }

        const batch = db.batch();
        expiredSnapshot.forEach((doc) => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`Successfully destroyed ${expiredSnapshot.size} expired messages.`);
        
        return null;
    } catch (error) {
        console.error("Reaper failed:", error);
        return null;
    }
});