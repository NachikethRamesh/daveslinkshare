// Cloudflare Pages Function - Health Check
export async function onRequest(context) {
  const { env } = context;
  
  return new Response(JSON.stringify({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: {
      hasApiKey: !!env.JSONBIN_API_KEY,
      hasLinksBin: !!env.LINKS_BIN_ID,
      hasAuthBin: !!env.AUTH_BIN_ID,
      hasJwtSecret: !!env.JWT_SECRET,
      nodeEnv: env.NODE_ENV
    }
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
