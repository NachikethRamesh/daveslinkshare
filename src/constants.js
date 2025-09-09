// Shared constants for Dave's Links App - Optimized

export const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// Optimized: Pre-stringify common responses
const ERROR_RESPONSE_TEMPLATE = JSON.stringify({ success: false, error: '' });
const SUCCESS_RESPONSE_TEMPLATE = JSON.stringify({ success: true });

export function createResponse(data, status = 200) {
  // Optimized: Use pre-stringified templates for common responses
  let body;
  if (data.success === false && data.error) {
    body = ERROR_RESPONSE_TEMPLATE.replace('""', `"${data.error}"`);
  } else if (data.success === true && Object.keys(data).length === 1) {
    body = SUCCESS_RESPONSE_TEMPLATE;
  } else {
    body = JSON.stringify(data);
  }
  
  return new Response(body, {
    status,
    headers: CORS_HEADERS
  });
}

export function createErrorResponse(message, status = 400) {
  return createResponse({ success: false, error: message }, status);
}
