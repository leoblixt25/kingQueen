import * as functions from "firebase-functions";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Admin email to protect from deletion
const ADMIN_EMAIL = "leo.blixt77@gmail.com";

interface ResetResult {
  success: boolean;
  message: string;
  details: {
    usersDeleted: number;
    usersSkipped: number;
    documentsDeleted: number;
    errors: string[];
  };
}

/**
 * Admin-Only: Reset Everything
 * 
 * This callable function:
 * 1. Deletes ALL users from Firebase Authentication EXCEPT the admin
 * 2. Deletes ALL documents from the "players" collection in Firestore
 * 
 * Security: Only the admin email can call this function
 */
export const resetEverything = functions.https.onCall(
  async (data, context): Promise<ResetResult> => {
    // ==========================================
    // SECURITY CHECK: Verify caller is admin
    // ==========================================
    
    // Check if user is authenticated
    if (!context.auth) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "You must be logged in to perform this action."
      );
    }

    const callerEmail = context.auth.token.email;

    // Check if caller is the admin
    if (callerEmail !== ADMIN_EMAIL) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "Only the admin can perform this action."
      );
    }

    // Verify confirmation flag
    if (data.confirm !== true) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Confirmation flag must be set to true."
      );
    }

    functions.logger.info(`🔴 Admin ${callerEmail} initiated full reset`);

    const result: ResetResult = {
      success: false,
      message: "",
      details: {
        usersDeleted: 0,
        usersSkipped: 0,
        documentsDeleted: 0,
        errors: [],
      },
    };

    try {
      // ==========================================
      // STEP 1: Delete all Auth users except admin
      // ==========================================
      
      functions.logger.info("🔍 Step 1: Deleting Firebase Auth users...");
      
      let nextPageToken: string | undefined;
      let deletedCount = 0;
      let skippedCount = 0;

      do {
        // List users in batches (max 1000 per call)
        const listUsersResult = await admin.auth().listUsers(1000, nextPageToken);
        
        for (const user of listUsersResult.users) {
          // Skip the admin account
          if (user.email === ADMIN_EMAIL) {
            functions.logger.info(`⏭️  Skipped admin: ${user.email}`);
            skippedCount++;
            continue;
          }

          try {
            // Delete the user
            await admin.auth().deleteUser(user.uid);
            functions.logger.info(`✅ Deleted user: ${user.email || user.uid}`);
            deletedCount++;
          } catch (error: any) {
            const errorMsg = `Failed to delete user ${user.email || user.uid}: ${error.message}`;
            functions.logger.error(errorMsg);
            result.details.errors.push(errorMsg);
          }
        }

        // Check if there are more users to process
        nextPageToken = listUsersResult.pageToken;
      } while (nextPageToken);

      result.details.usersDeleted = deletedCount;
      result.details.usersSkipped = skippedCount;

      functions.logger.info(`✅ Auth cleanup complete: ${deletedCount} deleted, ${skippedCount} skipped`);

      // ==========================================
      // STEP 2: Delete all Firestore documents
      // ==========================================
      
      functions.logger.info("🔍 Step 2: Deleting Firestore players collection...");

      const playersRef = admin.firestore().collection("players");
      const snapshot = await playersRef.get();

      // Delete all documents in the collection
      const batch = admin.firestore().batch();
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });

      if (snapshot.size > 0) {
        await batch.commit();
        result.details.documentsDeleted = snapshot.size;
        functions.logger.info(`✅ Deleted ${snapshot.size} player documents`);
      } else {
        functions.logger.info("ℹ️  No player documents to delete");
      }

      // ==========================================
      // STEP 3: Return success
      // ==========================================
      
      result.success = true;
      result.message = `✅ Reset complete! Deleted ${deletedCount} users and ${snapshot.size} player documents.`;

      functions.logger.info(`🎉 Reset completed successfully:`, result.details);

      return result;
    } catch (error: any) {
      functions.logger.error("❌ Reset failed:", error);
      
      result.message = `❌ Reset failed: ${error.message}`;
      result.details.errors.push(error.message);

      throw new functions.https.HttpsError(
        "internal",
        result.message,
        result.details
      );
    }
  }
);

