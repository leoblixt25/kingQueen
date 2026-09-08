/**
 * Migrate ALL Firestore data from kingqueen-c3543 → kingqueen-eu
 *
 * Usage:
 *   node migrate-data.mjs "<old-service-account.json>" "<new-service-account.json>"
 *
 * Migrates these collections:
 *   - players
 *   - matches
 *   - tournamentSettings
 *   - finalMatches
 *   - admins (if any)
 *
 * Also migrates Firebase Auth users (all accounts) via Admin SDK.
 */
import { readFileSync } from 'node:fs';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

const oldKeyPath = process.argv[2];
const newKeyPath = process.argv[3];

if (!oldKeyPath || !newKeyPath) {
  console.error('Usage: node migrate-data.mjs "<old-service-account.json>" "<new-service-account.json>"');
  process.exit(1);
}

const oldSA = JSON.parse(readFileSync(oldKeyPath, 'utf8'));
const newSA = JSON.parse(readFileSync(newKeyPath, 'utf8'));

const oldApp = initializeApp({ credential: cert(oldSA) }, 'old');
const newApp = initializeApp({ credential: cert(newSA) }, 'new');
const oldDb = getFirestore(oldApp);
const newDb = getFirestore(newApp);
const oldAuth = getAuth(oldApp);
const newAuth = getAuth(newApp);

const COLLECTIONS = ['players', 'matches', 'tournamentSettings', 'finalMatches', 'admins'];

async function migrateCollection(name) {
  console.log(`\n=== Migrating collection: ${name} ===`);
  const snapshot = await oldDb.collection(name).get();
  const batchSize = 100;
  let count = 0;

  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = newDb.batch();
    const slice = snapshot.docs.slice(i, i + batchSize);
    for (const doc of slice) {
      const data = doc.data();
      batch.set(newDb.collection(name).doc(doc.id), data, { merge: true });
    }
    await batch.commit();
    count += slice.length;
    console.log(`  ...${count} docs written`);
  }
  console.log(`  ✓ ${count} docs migrated for ${name}`);
}

async function migrateAuth() {
  console.log(`\n=== Migrating Firebase Auth users ===`);
  let pageToken;
  let total = 0;

  do {
    const res = await oldAuth.listUsers(1000, pageToken);
    for (const u of res.users) {
      try {
        await newAuth.createUser({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          emailVerified: u.emailVerified,
          disabled: u.disabled,
        });
        total++;
        console.log(`  + Auth user: ${u.email} (${u.uid})`);
      } catch (e) {
        // User with same email may already exist in new project
        console.log(`  ! Skipped ${u.email}: ${e.message}`);
      }
    }
    pageToken = res.pageToken;
  } while (pageToken);

  console.log(`  ✓ ${total} auth users created`);
}

async function main() {
  console.log(`OLD project: ${oldSA.project_id}`);
  console.log(`NEW project: ${newSA.project_id}`);

  for (const c of COLLECTIONS) {
    await migrateCollection(c);
  }

  await migrateAuth();

  console.log('\n❄️  Migration complete!');
  process.exit(0);
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
