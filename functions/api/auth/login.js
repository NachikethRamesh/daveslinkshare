// Cloudflare Pages Function - User Login
export async function onRequest(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  };

  try {
    const { request, env } = context;

    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    // Handle GET requests for testing
    if (request.method === 'GET') {
      return new Response(JSON.stringify({
        message: 'Login endpoint is working!',
        method: 'GET',
        timestamp: new Date().toISOString(),
        path: '/api/auth/login'
      }), { status: 200, headers });
    }

    // Handle POST requests
    if (request.method === 'POST') {
      let requestData = {};
      
      try {
        requestData = await request.json();
      } catch (parseError) {
        // If JSON parsing fails, still return a test response
        requestData = { username: 'test', password: 'test' };
      }

      const { username, password } = requestData;

      // Basic validation
      if (!username || !password) {
        return new Response(JSON.stringify({ 
          error: 'Username and password required' 
        }), {
          status: 400,
          headers
        });
      }

      // Access environment variables
      const apiKey = env?.JSONBIN_API_KEY;
      const authBinId = env?.AUTH_BIN_ID;
      const jwtSecret = env?.JWT_SECRET;
      
      // Return test response
      const response = {
        success: true,
        message: 'Login POST endpoint working!',
        user: { username: username || 'test' },
        token: 'test-token-' + Date.now(),
        method: 'POST',
        timestamp: new Date().toISOString(),
        path: '/api/auth/login',
        environment: {
          hasApiKey: !!apiKey,
          hasBinId: !!authBinId,
          hasJwtSecret: !!jwtSecret
        }
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers
      });
    }

    // Method not allowed
    return new Response(JSON.stringify({
      error: 'Method not allowed',
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
      path: '/api/auth/login'
    }), {
      status: 405,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString(),
      path: '/api/auth/login'
    }), {
      status: 500,
      headers
    });
  }
}

// Handle OPTIONS requests for CORS
export async function onRequestOptions(context) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
