import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import type { ExecutionContext } from '@cloudflare/workers-types';

interface Env {
  FIREBASE_SERVICE_ACCOUNT: string;
}

export interface RequestBody {
  token: string;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    // Only allow POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    try {
      // Initialize Firebase Admin SDK
      if (getApps().length === 0) {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        initializeApp({
          credential: cert(serviceAccount),
        });
      }

      const auth = getAuth();
      const db = getFirestore();

      // Parse request body
      const body = await request.json() as RequestBody;
      const { token } = body;

      if (!token) {
        return new Response(JSON.stringify({ error: 'Token is required' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Verify the Firebase ID token
      const decodedToken = await auth.verifyIdToken(token);
      const uid = decodedToken.uid;
      const email = decodedToken.email;

      if (!email) {
        return new Response(JSON.stringify({ error: 'Email not found in token' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // Check if user is admin (leo.blixt77@gmail.com)
      const ADMIN_EMAIL = 'leo.blixt77@gmail.com';
      
      if (email !== ADMIN_EMAIL) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Admin privileges required' }), {
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      console.log(`✅ Admin verified: ${email} (${uid})`);

      // List all users and delete non-admin users
      let deletedCount = 0;
      let errorCount = 0;

      const listUsersResult = await auth.listUsers(1000);
      
      for (const user of listUsersResult.users) {
        // Skip admin user
        if (user.email === ADMIN_EMAIL) {
          console.log(`⏭️ Skipping admin user: ${user.email}`);
          continue;
        }

        // Delete non-admin user
        try {
          await auth.deleteUser(user.uid);
          deletedCount++;
          console.log(`🗑️ Deleted user: ${user.email || user.uid}`);
        } catch (error) {
          errorCount++;
          console.error(`❌ Error deleting user ${user.email || user.uid}:`, error);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: `Successfully deleted ${deletedCount} users`,
          deletedCount,
          errorCount,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    } catch (error) {
      console.error('❌ Error in delete-firebase-users worker:', error);
      
      return new Response(
        JSON.stringify({
          error: 'Failed to delete users',
          details: error instanceof Error ? error.message : 'Unknown error',
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      );
    }
  },
};
