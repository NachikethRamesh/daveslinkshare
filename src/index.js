import { getAssetFromKV } from '@cloudflare/kv-asset-handler'

// Import API handlers
async function handleAuthLogin(request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (request.method === 'GET') {
    return new Response(JSON.stringify({
      message: 'Login endpoint ready',
      method: 'GET',
      timestamp: new Date().toISOString()
    }), { status: 200, headers });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return new Response(JSON.stringify({ 
          error: 'Username and password required' 
        }), { status: 400, headers });
      }

      const apiKey = env.JSONBIN_API_KEY;
      const authBinId = env.AUTH_BIN_ID;

      if (!apiKey || !authBinId) {
        return new Response(JSON.stringify({
          error: 'Server configuration error'
        }), { status: 500, headers });
      }

      // Check JSONBin for user
      const response = await fetch(`https://api.jsonbin.io/v3/b/${authBinId}/latest`, {
        headers: {
          'X-Master-Key': apiKey,
          'X-Bin-Meta': 'false'
        }
      });

      if (!response.ok) {
        return new Response(JSON.stringify({
          error: 'Authentication service error'
        }), { status: 503, headers });
      }

      const authData = await response.json();
      const userExists = authData && authData[username];

      if (!userExists) {
        return new Response(JSON.stringify({
          error: 'Invalid credentials'
        }), { status: 401, headers });
      }

      const token = btoa(JSON.stringify({ username, timestamp: Date.now() }));

      return new Response(JSON.stringify({
        success: true,
        message: 'Login successful!',
        user: { username },
        token: token,
        timestamp: new Date().toISOString()
      }), { status: 200, headers });

    } catch (error) {
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), { status: 500, headers });
    }
  }

  return new Response(JSON.stringify({
    error: 'Method not allowed'
  }), { status: 405, headers });
}

async function handleHealth(request, env) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  let jsonbinStatus = 'not_checked';
  let jsonbinError = null;

  if (env.JSONBIN_API_KEY && env.AUTH_BIN_ID) {
    try {
      const response = await fetch(`https://api.jsonbin.io/v3/b/${env.AUTH_BIN_ID}/latest`, {
        headers: {
          'X-Master-Key': env.JSONBIN_API_KEY,
          'X-Bin-Meta': 'false'
        }
      });
      
      jsonbinStatus = response.ok ? 'connected' : 'error';
      if (!response.ok) jsonbinError = `HTTP ${response.status}`;
    } catch (error) {
      jsonbinStatus = 'error';
      jsonbinError = error.message;
    }
  } else {
    jsonbinStatus = 'missing_config';
  }

  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: {
      hasApiKey: !!env.JSONBIN_API_KEY,
      hasLinksBin: !!env.LINKS_BIN_ID,
      hasAuthBin: !!env.AUTH_BIN_ID,
      hasJwtSecret: !!env.JWT_SECRET
    },
    jsonbin: {
      status: jsonbinStatus,
      error: jsonbinError
    }
  }), { status: 200, headers });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API Routes
    if (path.startsWith('/api/auth/login')) {
      return handleAuthLogin(request, env);
    }
    
    if (path.startsWith('/api/health')) {
      return handleHealth(request, env);
    }

    // Static assets
    try {
      return await getAssetFromKV({
        request,
        waitUntil: ctx.waitUntil.bind(ctx),
      }, {
        ASSET_NAMESPACE: env.__STATIC_CONTENT,
        ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
      });
    } catch (e) {
      // Fallback to index.html for SPA routing
      try {
        return await getAssetFromKV({
          request: new Request(`${url.origin}/index.html`, request),
          waitUntil: ctx.waitUntil.bind(ctx),
        }, {
          ASSET_NAMESPACE: env.__STATIC_CONTENT,
          ASSET_MANIFEST: env.__STATIC_CONTENT_MANIFEST,
        });
      } catch (e) {
        return new Response('Not Found', { status: 404 });
      }
    }
  },
};
