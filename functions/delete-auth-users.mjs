/**
 * Delete All Registered Player Accounts — local one-shot script
 *
 * Usage (from the functions folder):
 *   node delete-auth-users.mjs "C:\path\to\serviceAccountKey.json"
 *
 * - Deletes every Firebase Auth account EXCEPT leo.blixt77@gmail.com
 * - Touches ONLY Authentication — Firestore data stays untouched
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const ADMIN_EMAIL = 'leo.blixt77@gmail.com';

const keyPath = process.argv[2];
if (!keyPath) {
  console.error('Usage: node delete-auth-users.mjs "<path-to-serviceAccount.json>"');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });

const auth = getAuth();

let pageToken;
let deleted = 0;
let failed = 0;
let adminKept = 0;

do {
  const res = await auth.listUsers(1000, pageToken);

  const uids = [];
  for (const u of res.users) {
    if ((u.email || '').toLowerCase() === ADMIN_EMAIL) {
      adminKept++;
      continue;
    }
    uids.push(u.uid);
  }

  if (uids.length > 0) {
    const result = await auth.deleteUsers(uids);
    deleted += result.successCount;
    failed += result.failureCount;
    for (const err of result.errors || []) {
      console.error('Failed to delete', err.index, err.error?.message);
    }
  }

  pageToken = res.pageToken;
} while (pageToken);

console.log('');
console.log('=== DONE ===');
console.log('Deleted :', deleted);
console.log('Failed  :', failed);
console.log('Admin kept:', adminKept);
