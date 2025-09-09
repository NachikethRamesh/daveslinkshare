// Authentication Handlers for Cloudflare D1
// Consolidated auth operations for Dave's Links App

import { 
  createUser, 
  getUserByUsername, 
  verifyUserPassword, 
  updateUserPassword 
} from './database.js';

// CORS headers
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function createResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  });
}

function createErrorResponse(message, status = 400) {
  return createResponse({ success: false, error: message }, status);
}

// Token utilities
function generateToken(userData) {
  const tokenPayload = {
    username: userData.username,
    userId: userData.id,
    userHash: userData.userHash, // For backward compatibility
    timestamp: Date.now()
  };
  return btoa(JSON.stringify(tokenPayload));
}

export function validateToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const tokenData = JSON.parse(atob(token));
    if (!tokenData.username || !tokenData.userId) {
      return null;
    }
    return tokenData;
  } catch (error) {
    return null;
  }
}

// Authentication Handlers
export async function handleAuthLogin(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return createErrorResponse('Username and password required', 400);
      }

      // Verify user credentials
      const authResult = await verifyUserPassword(env.DB, username, password);
      
      if (!authResult.success) {
        return createErrorResponse(authResult.error, authResult.error === 'User not found' ? 404 : 401);
      }

      // Generate token
      const token = generateToken(authResult.user);

      return createResponse({
        success: true,
        message: 'Login successful!',
        user: { username: authResult.user.username },
        token: token
      });

    } catch (error) {
      console.error('Login error:', error);
      return createErrorResponse('Authentication failed', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

export async function handleAuthRegister(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, password } = requestData;

      if (!username || !password) {
        return createErrorResponse('Username and password required', 400);
      }

      // Basic validation
      if (username.length < 3) {
        return createErrorResponse('Username must be at least 3 characters long', 400);
      }

      if (password.length < 6) {
        return createErrorResponse('Password must be at least 6 characters long', 400);
      }

      // Create user in D1 database
      const result = await createUser(env.DB, username, password);

      if (!result.success) {
        return createErrorResponse(result.error, result.error === 'Username already exists' ? 409 : 500);
      }

      // Generate token for immediate login
      const userData = {
        username: username,
        id: result.userId,
        userHash: result.userHash
      };
      const token = generateToken(userData);

      return createResponse({
        success: true,
        message: 'Account created successfully!',
        user: { username: username },
        token: token
      });

    } catch (error) {
      console.error('Registration error:', error);
      return createErrorResponse('Failed to create account', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

export async function handlePasswordReset(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    try {
      const requestData = await request.json();
      const { username, newPassword } = requestData;

      if (!username || !newPassword) {
        return createErrorResponse('Username and new password required', 400);
      }

      if (newPassword.length < 6) {
        return createErrorResponse('Password must be at least 6 characters long', 400);
      }

      // Check if user exists
      const user = await getUserByUsername(env.DB, username);
      if (!user) {
        return createErrorResponse('User not found', 404);
      }

      // Update password
      const result = await updateUserPassword(env.DB, username, newPassword);

      if (!result.success) {
        return createErrorResponse('Failed to reset password', 500);
      }

      // Generate token for immediate login
      const userData = {
        username: user.username,
        id: user.id,
        userHash: user.user_hash
      };
      const token = generateToken(userData);

      return createResponse({
        success: true,
        message: 'Password reset successfully!',
        user: { username: user.username },
        token: token
      });

    } catch (error) {
      console.error('Password reset error:', error);
      return createErrorResponse('Failed to reset password', 500);
    }
  }

  return createErrorResponse('Method not allowed', 405);
}

export async function handleAuthLogout(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  if (request.method === 'POST') {
    // For now, logout is client-side only (remove token)
    // In the future, we could maintain a token blacklist in D1
    return createResponse({
      success: true,
      message: 'Logged out successfully'
    });
  }

  return createErrorResponse('Method not allowed', 405);
}
