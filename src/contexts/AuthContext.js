import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { loadTokens, saveTokens, clearTokens, getAuthUrl } from "../utils/auth";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [tokens, setTokens] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize tokens from localStorage and URL params
  useEffect(() => {
    // Check for tokens in URL (from OAuth callback)
    const urlParams = new URLSearchParams(window.location.search);
    const tokensParam = urlParams.get("tokens");
    const error = urlParams.get("error");

    console.log(tokensParam);

    if (tokensParam) {
      try {
        const parsedTokens = JSON.parse(decodeURIComponent(tokensParam));
        saveTokens(parsedTokens);
        setTokens(parsedTokens);
        // Clean URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      } catch (e) {
        console.error("Failed to parse tokens from URL:", e);
      }
    }

    if (error) {
      alert(`Authentication error: ${error}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Load tokens from localStorage
    const storedTokens = loadTokens();
    if (storedTokens) {
      setTokens(storedTokens);
    }

    setIsInitialized(true);
  }, []);

  const authenticate = useCallback(async () => {
    try {
      const authUrl = await getAuthUrl();
      window.location.href = authUrl;
    } catch (error) {
      alert("Failed to get authorization URL: " + error.message);
    }
  }, []);

  const logout = useCallback(() => {
    clearTokens();
    setTokens(null);
  }, []);

  const updateTokens = useCallback((newTokens) => {
    if (newTokens) {
      saveTokens(newTokens);
      setTokens(newTokens);
    } else {
      clearTokens();
      setTokens(null);
    }
  }, []);

  const value = {
    tokens,
    isAuthenticated: !!tokens,
    isInitialized,
    authenticate,
    logout,
    updateTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
