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
        timestamp: new Date().toISOString()
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

      // Return test response
      const response = {
        success: true,
        message: 'Login POST endpoint working!',
        user: { username: username || 'test' },
        token: 'test-token-' + Date.now(),
        method: 'POST',
        timestamp: new Date().toISOString(),
        environment: {
          hasApiKey: !!env?.JSONBIN_API_KEY,
          hasBinId: !!env?.AUTH_BIN_ID,
          hasJwtSecret: !!env?.JWT_SECRET
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
      allowedMethods: ['GET', 'POST', 'OPTIONS']
    }), {
      status: 405,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      timestamp: new Date().toISOString()
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
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}
