// Client-side authentication utilities using localStorage

const TOKEN_KEY = 'eve_tokens';

/**
 * Save tokens to localStorage
 */
export const saveTokens = (tokens) => {
  try {
    localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.error('Failed to save tokens:', error);
  }
};

/**
 * Load tokens from localStorage
 */
export const loadTokens = () => {
  try {
    const tokens = localStorage.getItem(TOKEN_KEY);
    return tokens ? JSON.parse(tokens) : null;
  } catch (error) {
    console.error('Failed to load tokens:', error);
    return null;
  }
};

/**
 * Clear tokens from localStorage
 */
export const clearTokens = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear tokens:', error);
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  const now = Date.now();
  const expiresAtMs = new Date(expiresAt).getTime();
  return now >= expiresAtMs - 60000; // Refresh if expires within 60 seconds
};

/**
 * Get valid access token, refresh if needed
 */
export const getValidAccessToken = async () => {
  const tokens = loadTokens();
  if (!tokens || !tokens.accessToken) {
    return null;
  }

  if (isTokenExpired(tokens.expiresAt)) {
    // Need to refresh
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!response.ok) {
        clearTokens();
        return null;
      }

      const newTokens = await response.json();
      saveTokens(newTokens);
      return newTokens.accessToken;
    } catch (error) {
      console.error('Token refresh failed:', error);
      clearTokens();
      return null;
    }
  }

  return tokens.accessToken;
};

/**
 * Get authorization URL from server
 */
export const getAuthUrl = async () => {
  const response = await fetch('/api/auth/authorize');
  const data = await response.json();
  return data.authUrl;
};

