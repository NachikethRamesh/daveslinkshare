// Simple test function to verify Cloudflare Functions are working
export async function onRequest(context) {
  return new Response(JSON.stringify({
    message: "Hello from Cloudflare Functions!",
    timestamp: new Date().toISOString(),
    method: context.request.method,
    url: context.request.url
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
