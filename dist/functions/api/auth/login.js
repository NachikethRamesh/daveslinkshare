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

      // Validate environment variables
      if (!apiKey || !authBinId || !jwtSecret) {
        return new Response(JSON.stringify({
          error: 'Server configuration error',
          details: 'Missing required environment variables',
          environment: {
            hasApiKey: !!apiKey,
            hasBinId: !!authBinId,
            hasJwtSecret: !!jwtSecret
          }
        }), {
          status: 500,
          headers
        });
      }

      try {
        // Read from JSONBin to verify user credentials
        const jsonbinResponse = await fetch(`https://api.jsonbin.io/v3/b/${authBinId}/latest`, {
          method: 'GET',
          headers: {
            'X-Master-Key': apiKey,
            'X-Bin-Meta': 'false'
          }
        });

        if (!jsonbinResponse.ok) {
          throw new Error(`JSONBin API error: ${jsonbinResponse.status}`);
        }

        const authData = await jsonbinResponse.json();
        
        // Simple authentication check (for now, just verify user exists)
        const userExists = authData && authData[username];
        
        if (!userExists) {
          return new Response(JSON.stringify({
            error: 'Invalid credentials',
            message: 'User not found'
          }), {
            status: 401,
            headers
          });
        }

        // Generate a simple JWT-like token (for testing)
        const tokenPayload = {
          username,
          timestamp: Date.now()
        };
        const token = btoa(JSON.stringify(tokenPayload));

        const response = {
          success: true,
          message: 'Login successful!',
          user: { username },
          token: token,
          timestamp: new Date().toISOString(),
          jsonbinStatus: 'connected'
        };

      } catch (jsonbinError) {
        // If JSONBin fails, return error with details
        return new Response(JSON.stringify({
          error: 'Authentication service error',
          details: jsonbinError.message,
          timestamp: new Date().toISOString(),
          jsonbinStatus: 'failed'
        }), {
          status: 503,
          headers
        });
      }

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
