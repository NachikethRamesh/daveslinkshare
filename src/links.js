import { 
  getUserLinks, 
  createLink, 
  deleteLink, 
  markLinkAsRead,
  toggleFavorite
} from './database.js';
import { validateToken } from './auth.js';
import { CORS_HEADERS, createResponse, createErrorResponse } from './constants.js';

export async function handleLinks(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  // Validate authorization
  const authHeader = request.headers.get('Authorization');
  const tokenData = validateToken(authHeader);
  
  if (!tokenData) {
    return createErrorResponse('Authorization required', 401);
  }

  const { username, userId } = tokenData;

  if (request.method === 'GET') {
    // Get user's links from D1
    try {
      const result = await getUserLinks(env.DB, userId);
      
      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to fetch links', 500);
      }

      return createResponse({
        success: true,
        links: result.links
      });

    } catch (error) {
      return createErrorResponse('Failed to fetch links', 500);
    }
  }

  if (request.method === 'POST') {
    // Add new link
    try {
      const requestData = await request.json();
      const { url, title, category } = requestData;

      if (!url) {
        return createErrorResponse('URL is required', 400);
      }

      // Validate URL format
      try {
        new URL(url);
      } catch (urlError) {
        return createErrorResponse('Invalid URL format', 400);
      }

      // Create link in D1
      const result = await createLink(env.DB, userId, {
        url,
        title,
        category: category || 'general'
      });

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to save link', 500);
      }

      return createResponse({
        success: true,
        message: 'Link saved successfully!',
        link: result.link
      });

    } catch (error) {
      return createErrorResponse('Failed to save link', 500);
    }
  }

  if (request.method === 'DELETE') {
    // Delete link
    try {
      const url = new URL(request.url);
      const linkId = url.searchParams.get('id');

      if (!linkId) {
        return createErrorResponse('Link ID is required', 400);
      }

      const result = await deleteLink(env.DB, userId, linkId);

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to delete link', 500);
      }

      if (result.changes === 0) {
        return createErrorResponse('Link not found or not owned by user', 404);
      }

      return createResponse({
        success: true,
        message: 'Link deleted successfully!'
      });

    } catch (error) {
      return createErrorResponse('Failed to delete link', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

export async function handleMarkRead(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    // Validate authorization
    const authHeader = request.headers.get('Authorization');
    const tokenData = validateToken(authHeader);
    
    if (!tokenData) {
      return createErrorResponse('Authorization required', 401);
    }

    try {
      const requestData = await request.json();
      const { linkId, isRead } = requestData;

      if (!linkId) {
        return createErrorResponse('Link ID is required', 400);
      }

      const result = await markLinkAsRead(env.DB, tokenData.userId, linkId, isRead ? 1 : 0);

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to update link', 500);
      }

      if (result.changes === 0) {
        return createErrorResponse('Link not found or not owned by user', 404);
      }

      return createResponse({
        success: true,
        message: `Link marked as ${isRead ? 'read' : 'unread'}!`
      });

    } catch (error) {
      return createErrorResponse('Failed to update link', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

export async function handleToggleFavorite(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      // Validate authorization
      const authHeader = request.headers.get('Authorization');
      const tokenData = validateToken(authHeader);
      
      if (!tokenData) {
        return createErrorResponse('Authorization required', 401);
      }

      const requestData = await request.json();
      const { linkId, isFavorite } = requestData;

      if (!linkId) {
        return createErrorResponse('Link ID required', 400);
      }

      // Toggle favorite status
      const result = await toggleFavorite(env.DB, tokenData.userId, linkId, isFavorite ? 1 : 0);

      if (!result.success) {
        return createErrorResponse('Failed to update favorite status', 500);
      }

      return createResponse({
        success: true,
        message: `Link ${isFavorite ? 'added to' : 'removed from'} favorites!`
      });

    } catch (error) {
      return createErrorResponse('Failed to update favorite status', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}
