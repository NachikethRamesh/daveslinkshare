// Cloudflare Pages Function - User Login
export async function onRequestPost(context) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };

  try {
    const { request, env } = context;
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers });
    }

    const body = await request.text();
    let requestData;
    
    try {
      requestData = JSON.parse(body);
    } catch (parseError) {
      return new Response(JSON.stringify({ 
        error: 'Invalid JSON in request body' 
      }), {
        status: 400,
        headers
      });
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
    const apiKey = env.JSONBIN_API_KEY;
    const authBinId = env.AUTH_BIN_ID;
    const jwtSecret = env.JWT_SECRET;
    
    // For now, return a test response that shows the API is working
    return new Response(JSON.stringify({
      message: 'Login successful',
      user: { username },
      token: 'test-token-123',
      debug: {
        hasApiKey: !!apiKey,
        hasBinId: !!authBinId,
        hasJwtSecret: !!jwtSecret
      }
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
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
