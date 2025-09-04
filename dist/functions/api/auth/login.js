// Cloudflare Pages Function - User Login
export async function onRequest(context) {
  const headers = {
    'Content-Type': 'application/json'
  };

  try {
    const { request, env } = context;
    
    // Only handle POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ 
        error: 'Method not allowed. Use POST.' 
      }), {
        status: 405,
        headers
      });
    }

    let requestData;
    
    try {
      requestData = await request.json();
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body',
        details: parseError.message
      }), {
        status: 400,
        headers
      });
    }

    const { username, password } = requestData || {};

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
      message: 'Login successful',
      user: { username },
      token: 'test-token-' + Date.now(),
      environment: {
        hasApiKey: !!apiKey,
        hasBinId: !!authBinId,
        hasJwtSecret: !!jwtSecret,
        nodeEnv: env?.NODE_ENV
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
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
