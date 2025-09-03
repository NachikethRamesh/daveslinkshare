// Cloudflare Pages Functions middleware
// This file is needed to tell Cloudflare this is a Pages project, not Workers

export async function onRequest(context) {
  // For now, just pass through all requests to static files
  // In the future, this could handle API routes
  return await context.next();
}
