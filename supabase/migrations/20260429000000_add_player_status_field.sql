-- Migration: Add status field to players and update existing confirmed players
-- Run this in Firebase Firestore manually or through admin console

-- This script documents the migration needed:
-- 1. Add 'status' field to all existing players
-- 2. Set status='approved' for players where is_confirmed=true
-- 3. Set status='pending' for players where is_confirmed=false but have email
-- 4. Set status=null for placeholder players (no email)

/*
FIRESTORE MIGRATION SCRIPT
==========================

Since Firestore doesn't support bulk SQL-like updates, run this JavaScript 
in your browser console or Node.js script with Firebase Admin SDK:

const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore();

async function migratePlayerStatus() {
  const playersRef = db.collection('players');
  const snapshot = await playersRef.get();
  
  const batch = db.batch();
  let updateCount = 0;
  
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const playerRef = playersRef.doc(docSnap.id);
    
    let status = null;
    
    if (data.is_confirmed === true) {
      status = 'approved';
    } else if (data.email && data.name && !data.name.includes('Player')) {
      status = 'pending';
    } else {
      status = null; // placeholder
    }
    
    batch.update(playerRef, { status: status });
    updateCount++;
    
    // Firestore batch limit is 500
    if (updateCount % 500 === 0) {
      batch.commit();
      console.log(`Updated ${updateCount} players`);
    }
  });
  
  await batch.commit();
  console.log(`Migration complete! Updated ${updateCount} players total`);
}

migratePlayerStatus().catch(console.error);
*/

-- For new tournaments, all players start with:
-- is_confirmed: false
-- status: null (for placeholders)
-- When a player registers: status='pending', is_confirmed=false
-- When admin approves: status='approved', is_confirmed=true
