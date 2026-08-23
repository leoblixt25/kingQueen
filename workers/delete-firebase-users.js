/**
 * Delete All Registered Player Accounts — Cloudflare Worker RELAY.
 *
 * Deployed as "sandy-scorekeeper-workers" via wrangler.toml.
 *
 * Architecture (free-plan friendly — NO crypto in the request path):
 *   1. Verifies the caller's Firebase ID token with Google (Identity Toolkit
 *      accounts:lookup) and requires the admin email. Cheap: one fetch.
 *   2. Triggers the GitHub Actions workflow "Delete registered players"
 *      (repository_dispatch), which performs the actual deletion on GitHub's
 *      infrastructure with unlimited free compute.
 *
 * Required Secret variable: GH_PAT
 *   = a GitHub token with permission to trigger repository_dispatch
 *     (e.g. `gh auth token` output or a fine-grained PAT with Actions write).
 *
 * The app polls the public GitHub Actions runs API for the outcome,
 * so this worker only needs to return "dispatched" quickly.
 */

const GITHUB_REPO = 'leoblixt25/sandy-scorekeeper';
const ADMIN_EMAIL = 'leo.blixt77@gmail.com';
const WEB_API_KEY = 'AIzaSyB59VBp3g79K0yYxcCmxwdp0mvgGTbdxxU';
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, CORS_HEADERS),
  });
}

// ---------- Verify caller via Google (no local crypto) ----------

async function verifyCaller(idToken) {
  const resp = await fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + WEB_API_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: idToken }),
    }
  );
  const data = await resp.json();
  if (!resp.ok || !Array.isArray(data.users) || !data.users[0]) {
    throw new Error('Invalid or expired login token');
  }
  return data.users[0]; // Google-verified account record
}

// ---------- Trigger GitHub Actions deletion ----------

async function dispatchDeletion(githubToken, idToken) {
  const resp = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/dispatches', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + githubToken,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'sandy-scorekeeper-worker',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_type: 'delete-users',
      client_payload: { idToken: idToken },
    }),
  });

  if (resp.status !== 204) {
    const text = await resp.text();
    throw new Error('GitHub dispatch failed (' + resp.status + '): ' + text.slice(0, 300));
  }
}

// ---------- Worker entry point ----------

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return jsonResponse({ status: 'online', hint: 'POST the request to this URL' }, 200);
    }

    try {
      if (!env.GH_PAT) {
        return jsonResponse({ error: 'Worker misconfigured: GH_PAT secret is missing' }, 500);
      }

      const body = await request.json();
      if (!body.token) {
        return jsonResponse({ error: 'Token is required' }, 400);
      }

      // 1. Verify the caller's Firebase identity (Google does the crypto)
      let user;
      try {
        user = await verifyCaller(body.token);
      } catch (err) {
        return jsonResponse({ error: 'Unauthorized: ' + err.message }, 403);
      }

      if (user.email !== ADMIN_EMAIL) {
        return jsonResponse({ error: 'Unauthorized: Admin privileges required' }, 403);
      }

      console.log('Admin verified:', user.email);

      // 2. Kick off the GitHub Action that performs the deletion
      await dispatchDeletion(env.GH_PAT, body.token);

      return jsonResponse({
        success: true,
        started: true,
        message: 'Deletion started on GitHub Actions',
      });
    } catch (error) {
      console.error('Error in delete-firebase-users worker:', error);
      return jsonResponse(
        {
          error: 'Failed to start deletion',
          details: error instanceof Error ? error.message : String(error),
        },
        500
      );
    }
  },
};
