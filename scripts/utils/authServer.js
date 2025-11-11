#!/usr/bin/env node
const axios = require("axios");
const querystring = require("querystring");
const dotenv = require("dotenv");

dotenv.config();

// EVE Online SSO endpoints
const AUTH_BASE_URL = "https://login.eveonline.com/v2/oauth";
const TOKEN_URL = `${AUTH_BASE_URL}/token`;
const AUTHORIZE_URL = `${AUTH_BASE_URL}/authorize`;

// Required scopes for sending mail
const SCOPES = ["esi-mail.send_mail.v1"].join(" ");

/**
 * Get client ID and secret from environment
 */
const getClientCredentials = () => {
  return {
    clientId: process.env.EVE_CLIENT_ID,
    clientSecret: process.env.EVE_CLIENT_SECRET,
  };
};

/**
 * Decode JWT token to extract user ID
 */
const decodeJWT = (token) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, "base64")
        .toString()
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch (error) {
    throw new Error("Failed to decode JWT token");
  }
};

/**
 * Check if token is expired or will expire soon (within 60 seconds)
 */
const isTokenExpired = (expiresAt) => {
  if (!expiresAt) return true;
  const now = Date.now();
  const expiresAtMs = new Date(expiresAt).getTime();
  // Refresh if expired or will expire within 60 seconds
  return now >= expiresAtMs - 60000;
};

/**
 * Exchange authorization code for tokens
 */
const exchangeCodeForTokens = async (code, clientId, clientSecret, redirectUri) => {
  try {
    const response = await axios.post(
      TOKEN_URL,
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const decoded = decodeJWT(access_token);
    const characterId = decoded.sub.split(":")[2]; // Format: "CHARACTER:EVE:123456"

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt,
      characterId,
    };
  } catch (error) {
    throw new Error(
      `Failed to exchange code for tokens: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};

/**
 * Refresh access token using refresh token
 */
const refreshAccessToken = async (refreshToken, clientId, clientSecret) => {
  try {
    const response = await axios.post(
      TOKEN_URL,
      querystring.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const { access_token, refresh_token, expires_in } = response.data;
    const expiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

    const decoded = decodeJWT(access_token);
    const characterId = decoded.sub.split(":")[2];

    return {
      accessToken: access_token,
      refreshToken: refresh_token || refreshToken, // Use new refresh token if provided
      expiresAt,
      characterId,
    };
  } catch (error) {
    throw new Error(
      `Failed to refresh token: ${
        error.response?.data?.error_description || error.message
      }`
    );
  }
};

/**
 * Get valid access token - refresh if needed
 */
const getValidAccessToken = async (tokens) => {
  if (!tokens || !tokens.accessToken) {
    throw new Error("No access token provided");
  }

  if (isTokenExpired(tokens.expiresAt)) {
    const { clientId, clientSecret } = getClientCredentials();
    if (!clientId || !clientSecret) {
      throw new Error("EVE_CLIENT_ID and EVE_CLIENT_SECRET required for token refresh");
    }

    const newTokens = await refreshAccessToken(
      tokens.refreshToken,
      clientId,
      clientSecret
    );
    return newTokens;
  }

  return tokens;
};

/**
 * Extract character ID from token
 */
const getCharacterIdFromToken = (accessToken) => {
  try {
    const decoded = decodeJWT(accessToken);
    return decoded.sub.split(":")[2];
  } catch (error) {
    throw new Error("Failed to extract character ID from token");
  }
};

module.exports = {
  getClientCredentials,
  decodeJWT,
  isTokenExpired,
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
  getCharacterIdFromToken,
  AUTHORIZE_URL,
  SCOPES,
};

