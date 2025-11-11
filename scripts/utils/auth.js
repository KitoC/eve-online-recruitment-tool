#!/usr/bin/env node
const express = require("express");
const axios = require("axios");
const querystring = require("querystring");
const fs = require("fs").promises;
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const TOKEN_FILE = path.join(__dirname, "../../.tokens.json");
const CALLBACK_PORT = 8083;
const CALLBACK_URL = `http://localhost:${CALLBACK_PORT}/callback`;

// EVE Online SSO endpoints
const AUTH_BASE_URL = "https://login.eveonline.com/v2/oauth";
const TOKEN_URL = `${AUTH_BASE_URL}/token`;
const AUTHORIZE_URL = `${AUTH_BASE_URL}/authorize`;

// Required scopes for sending mail
const SCOPES = ["esi-mail.send_mail.v1"].join(" ");

/**
 * Get client ID and secret from environment or args
 */
const getClientCredentials = () => {
  const args = require("./general").getArgs();
  return {
    clientId: args.clientId || process.env.EVE_CLIENT_ID,
    clientSecret: args.clientSecret || process.env.EVE_CLIENT_SECRET,
  };
};

/**
 * Load tokens from file
 */
const loadTokens = async () => {
  try {
    const data = await fs.readFile(TOKEN_FILE, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

/**
 * Save tokens to file
 */
const saveTokens = async (tokens) => {
  await fs.writeFile(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf8");
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
const exchangeCodeForTokens = async (code, clientId, clientSecret) => {
  try {
    const response = await axios.post(
      TOKEN_URL,
      querystring.stringify({
        grant_type: "authorization_code",
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: CALLBACK_URL,
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
 * Start OAuth flow - open browser and listen for callback
 */
const startAuthFlow = () => {
  return new Promise((resolve, reject) => {
    const { clientId, clientSecret } = getClientCredentials();

    if (!clientId || !clientSecret) {
      reject(
        new Error(
          "EVE_CLIENT_ID and EVE_CLIENT_SECRET must be set in environment variables or passed as --clientId and --clientSecret"
        )
      );
      return;
    }

    // Generate a random state parameter for CSRF protection
    const state =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const app = express();
    let server;

    app.get("/callback", async (req, res) => {
      const { code, error, state: returnedState } = req.query;

      console.log(returnedState, state);

      // Verify state parameter to prevent CSRF attacks
      if (returnedState !== state) {
        res.send(
          `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    h1 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authentication Failed</h1>
    <p>Invalid state parameter. Possible CSRF attack.</p>
    <p><small>Please check the terminal for more details.</small></p>
  </div>
</body>
</html>`
        );
        setTimeout(() => {
          server.close();
          reject(new Error("State parameter mismatch"));
        }, 100);
        return;
      }

      if (error) {
        res.send(
          `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    h1 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authentication Failed</h1>
    <p>Error: ${error}</p>
    <p><small>Please check the terminal for more details.</small></p>
  </div>
</body>
</html>`
        );
        setTimeout(() => {
          server.close();
          reject(new Error(`Authentication failed: ${error}`));
        }, 100);
        return;
      }

      if (!code) {
        res.send(
          `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    h1 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authentication Failed</h1>
    <p>No authorization code received</p>
    <p><small>Please check the terminal for more details.</small></p>
  </div>
</body>
</html>`
        );
        setTimeout(() => {
          server.close();
          reject(new Error("No authorization code received"));
        }, 100);
        return;
      }

      try {
        const tokens = await exchangeCodeForTokens(
          code,
          clientId,
          clientSecret
        );
        await saveTokens(tokens);

        // Send success response to browser
        res.send(
          `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Successful</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    h1 { margin-top: 0; }
    .checkmark {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="checkmark">✓</div>
    <h1>Authentication Successful!</h1>
    <p>You can close this window and return to the terminal.</p>
    <p><small>The authentication process will continue in the CLI.</small></p>
  </div>
  <script>
    // Auto-close window after 3 seconds (optional)
    setTimeout(() => {
      window.close();
    }, 3000);
  </script>
</body>
</html>`
        );

        // Wait a moment for response to be sent, then close server and resolve
        setTimeout(() => {
          server.close();
          resolve(tokens);
        }, 100);
      } catch (error) {
        res.send(
          `<!DOCTYPE html>
<html>
<head>
  <title>Authentication Failed</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      color: white;
    }
    .container {
      text-align: center;
      padding: 2rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      backdrop-filter: blur(10px);
    }
    h1 { margin-top: 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Authentication Failed</h1>
    <p>${error.message}</p>
    <p><small>Please check the terminal for more details.</small></p>
  </div>
</body>
</html>`
        );

        setTimeout(() => {
          server.close();
          reject(error);
        }, 100);
      }
    });

    server = app.listen(CALLBACK_PORT, async () => {
      const authUrl = `${AUTHORIZE_URL}/?response_type=code&redirect_uri=${encodeURIComponent(
        CALLBACK_URL
      )}&client_id=${clientId}&scope=${encodeURIComponent(
        SCOPES
      )}&state=${encodeURIComponent(state)}`;

      console.log("\n🔐 Opening browser for EVE Online authentication...");
      console.log(`If the browser doesn't open, visit: ${authUrl}\n`);

      try {
        const { default: open } = await import("open");
        await open(authUrl);
      } catch (error) {
        console.error("Failed to open browser automatically:", error.message);
        console.log(`Please visit: ${authUrl}`);
      }
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (server.listening) {
        server.close();
        reject(new Error("Authentication timeout - no response received"));
      }
    }, 5 * 60 * 1000);
  });
};

/**
 * Get valid access token - refresh if needed
 */
const getValidAccessToken = async () => {
  const tokens = await loadTokens();

  if (!tokens) {
    console.log("No existing tokens found. Starting authentication...");
    const newTokens = await startAuthFlow();
    return newTokens.accessToken;
  }

  if (isTokenExpired(tokens.expiresAt)) {
    console.log("Access token expired. Refreshing...");
    const { clientId, clientSecret } = getClientCredentials();

    if (!clientId || !clientSecret) {
      throw new Error(
        "EVE_CLIENT_ID and EVE_CLIENT_SECRET required for token refresh"
      );
    }

    try {
      const newTokens = await refreshAccessToken(
        tokens.refreshToken,
        clientId,
        clientSecret
      );
      await saveTokens(newTokens);
      return newTokens.accessToken;
    } catch (error) {
      console.log("Token refresh failed. Starting new authentication...");
      const newTokens = await startAuthFlow();
      return newTokens.accessToken;
    }
  }

  return tokens.accessToken;
};

/**
 * Get character ID from stored tokens or JWT
 */
const getCharacterId = async () => {
  const tokens = await loadTokens();
  if (tokens && tokens.characterId) {
    return tokens.characterId;
  }

  // If no stored character ID, decode from current token
  const token = await getValidAccessToken();
  const decoded = decodeJWT(token);
  return decoded.sub.split(":")[2];
};

/**
 * Initialize authentication - ensure we have valid tokens
 */
const initializeAuth = async () => {
  const tokens = await loadTokens();

  if (!tokens) {
    console.log(
      "🔐 No authentication found. Please authenticate with EVE Online."
    );
    await startAuthFlow();
    console.log("✅ Authentication successful!");
  } else if (isTokenExpired(tokens.expiresAt)) {
    console.log("🔄 Refreshing expired token...");
    const { clientId, clientSecret } = getClientCredentials();
    if (!clientId || !clientSecret) {
      throw new Error(
        "EVE_CLIENT_ID and EVE_CLIENT_SECRET required for token refresh"
      );
    }
    const newTokens = await refreshAccessToken(
      tokens.refreshToken,
      clientId,
      clientSecret
    );
    await saveTokens(newTokens);
    console.log("✅ Token refreshed successfully!");
  } else {
    console.log("✅ Using existing authentication");
  }

  return {
    accessToken: await getValidAccessToken(),
    characterId: await getCharacterId(),
  };
};

module.exports = {
  initializeAuth,
  getValidAccessToken,
  getCharacterId,
  startAuthFlow,
  loadTokens,
};
