// Cloudflare Pages Function - Health Check
export async function onRequest(context) {
  const { env } = context;
  
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  };

  try {
    // Check JSONBin connectivity
    let jsonbinStatus = 'not_checked';
    let jsonbinError = null;

    if (env.JSONBIN_API_KEY && env.AUTH_BIN_ID) {
      try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${env.AUTH_BIN_ID}/latest`, {
          method: 'GET',
          headers: {
            'X-Master-Key': env.JSONBIN_API_KEY,
            'X-Bin-Meta': 'false'
          }
        });
        
        if (response.ok) {
          jsonbinStatus = 'connected';
        } else {
          jsonbinStatus = 'error';
          jsonbinError = `HTTP ${response.status}`;
        }
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
        hasJwtSecret: !!env.JWT_SECRET,
        nodeEnv: env.NODE_ENV || 'production'
      },
      jsonbin: {
        status: jsonbinStatus,
        error: jsonbinError,
        authBinId: env.AUTH_BIN_ID ? `${env.AUTH_BIN_ID.substring(0, 8)}...` : 'not_set'
      }
    }), {
      status: 200,
      headers
    });

  } catch (error) {
    return new Response(JSON.stringify({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }), {
      status: 500,
      headers
    });
  }
}
