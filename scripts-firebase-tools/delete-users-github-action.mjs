/**
 * Delete All Registered Player Accounts — standalone Node script for GitHub Actions.
 *
 * Zero npm dependencies (Node 20+: global fetch + node:crypto).
 *
 * Usage: node delete-users-github-action.mjs <callerIdToken>
 * Env:   SA_JSON = FULL contents of the Firebase service-account JSON.
 *
 * Security:
 *   - Verifies the caller's Firebase ID token with Google (Identity Toolkit)
 *     and aborts unless it belongs to ADMIN_EMAIL. Anyone able to trigger this
 *     workflow without a valid admin login can do nothing.
 *   - Deletes ONLY Authentication accounts except ADMIN_EMAIL.
 *   - Never touches Firestore data.
 */

import { createSign } from 'node:crypto';

const PROJECT_ID = 'kingqueen-eu';
const ADMIN_EMAIL = 'leo.blixt77@gmail.com';
const WEB_API_KEY = 'AIzaSyBmLIUYNdvR1DIlVPjVpkU003zC6UyRzgY';
const UA = 'sandy-scorekeeper-deletion/1.0';

function b64Url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function fail(msg) {
  console.error('ERROR:', msg);
  process.exit(1);
}

// ---------- robust HTTP helpers ----------

async function fetchJson(url, options, label, attempts = 4) {
  const opts = Object.assign({}, options, { headers: Object.assign({ 'User-Agent': UA }, options.headers) });

  for (let i = 1; i <= attempts; i++) {
    let resp;
    try {
      resp = await fetch(url, opts);
    } catch (e) {
      console.log(`${label}: network error (${e.message}), attempt ${i}/${attempts}`);
      await new Promise(r => setTimeout(r, 2000 * i));
      continue;
    }

    const text = await resp.text();

    if (text.trimStart().startsWith('<')) {
      // HTML page (block page / interstitial / error page) — retry
      console.log(
        `${label}: got HTML (${resp.status}) instead of JSON, attempt ${i}/${attempts}. Snippet: ` +
          text.replace(/\s+/g, ' ').slice(0, 180)
      );
      await new Promise(r => setTimeout(r, 3000 * i));
      continue;
    }

    let json;
    try {
      json = JSON.parse(text);
    } catch {
      console.log(`${label}: non-JSON (${resp.status}), attempt ${i}/${attempts}. Snippet: ` + text.slice(0, 180));
      await new Promise(r => setTimeout(r, 3000 * i));
      continue;
    }

    if (!resp.ok) {
      fail(`${label} failed (${resp.status}): ${text.slice(0, 400)}`);
    }
    return json;
  }

  fail(`${label}: kept receiving non-JSON responses after ${attempts} attempts`);
}

async function postJson(url, body, headers, label) {
  return fetchJson(
    url,
    { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, headers), body: JSON.stringify(body) },
    label
  );
}

// ---------- arguments ----------
const idToken = process.argv[2] || '';
const saRaw = process.env.SA_JSON || '';

if (!idToken) fail('Missing caller ID token');
if (!saRaw) fail('SA_JSON secret is not configured');

let sa;
try {
  sa = JSON.parse(saRaw);
} catch {
  fail('SA_JSON secret is not valid JSON');
}

// ---------- 1. Verify caller ----------
console.log('Step 1/5: verifying admin...');
const lookup = await postJson(
  'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + WEB_API_KEY,
  { idToken },
  {},
  'Token verification'
);

const callerEmail = lookup.users && lookup.users[0] ? lookup.users[0].email : null;
if (callerEmail !== ADMIN_EMAIL) {
  fail('Unauthorized: caller is not the admin (' + callerEmail + ')');
}
console.log('Admin verified:', callerEmail);

// ---------- 2. Service-account JWT -> access token ----------
console.log('Step 2/5: exchanging service account for access token...');
const now = Math.floor(Date.now() / 1000);
const header = { alg: 'RS256', typ: 'JWT' };
const claim = {
  iss: sa.client_email,
  scope:
    'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
};

const unsigned = b64Url(JSON.stringify(header)) + '.' + b64Url(JSON.stringify(claim));

let signature;
try {
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signature = signer.sign(sa.private_key);
} catch (e) {
  fail('Failed to sign service-account JWT: ' + e.message);
}

const jwt = unsigned + '.' + b64Url(signature);

const tokenData = await fetchJson(
  'https://oauth2.googleapis.com/token',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  },
  'Google token exchange'
);

if (!tokenData.access_token) {
  fail('Could not obtain Google access token: ' + JSON.stringify(tokenData));
}
const accessToken = tokenData.access_token;
console.log('Access token acquired (expires_in=' + tokenData.expires_in + ')');

// ---------- 3. List every auth account ----------
console.log('Step 3/5: listing auth accounts...');
const allUsers = [];
let nextPageToken;
do {
  // accounts:batchGet is a GET method (query params), not POST
  let url =
    'https://identitytoolkit.googleapis.com/v1/projects/' +
    PROJECT_ID +
    '/accounts:batchGet?maxResults=1000';
  if (nextPageToken) url += '&nextPageToken=' + encodeURIComponent(nextPageToken);

  const data = await fetchJson(
    url,
    { method: 'GET', headers: { Authorization: 'Bearer ' + accessToken } },
    'List users'
  );

  if (Array.isArray(data.users)) allUsers.push(...data.users);
  nextPageToken = data.nextPageToken;
} while (nextPageToken);
console.log('Listed ' + allUsers.length + ' account(s)');

// ---------- 4. Collect everyone except admin ----------
const toDelete = [];
let skippedAdmin = 0;
for (const u of allUsers) {
  if (u.email === ADMIN_EMAIL) {
    skippedAdmin++;
    continue;
  }
  toDelete.push(u.localId);
}

if (toDelete.length === 0) {
  console.log('No registered player accounts to delete. Admin kept: ' + skippedAdmin);
  process.exit(0);
}

// ---------- 5. Delete in chunks of up to 1000 ----------
console.log(`Step 4/5: deleting ${toDelete.length} account(s)...`);
let deletedCount = 0;
let errorCount = 0;

for (let i = 0; i < toDelete.length; i += 1000) {
  const chunk = toDelete.slice(i, i + 1000);

  const data = await postJson(
    'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT_ID + '/accounts:batchDelete',
    { localIds: chunk, force: true },
    { Authorization: 'Bearer ' + accessToken },
    'Delete users'
  );

  if (Array.isArray(data.results)) {
    for (const r of data.results) {
      if (!r.status || r.status === 'OK') deletedCount++;
      else {
        errorCount++;
        console.error('Failed to delete user ' + r.localId + ': ' + r.status);
      }
    }
  } else {
    deletedCount += chunk.length;
  }
}

console.log(
  `Step 5/5 done. Deleted: ${deletedCount} | Failed: ${errorCount} | Admin kept: ${skippedAdmin}`
);
console.log(
  'RESULT Deleted=' + deletedCount + ' Failed=' + errorCount + ' AdminKept=' + skippedAdmin
);

process.exit(errorCount > 0 ? 1 : 0);
