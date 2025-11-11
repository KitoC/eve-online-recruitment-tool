import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// Helper to extract character ID from JWT
function getCharacterIdFromToken(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const decoded = JSON.parse(jsonPayload);
    return decoded.sub.split(":")[2];
  } catch (error) {
    return "Unknown";
  }
}

const Navigation = () => {
  const location = useLocation();
  const { tokens, logout } = useAuth();
  const characterId = tokens
    ? getCharacterIdFromToken(tokens.accessToken)
    : null;

  return (
    <nav className="top-nav">
      <div className="nav-container">
        <div className="nav-logo">
          <h1>🚀 EVE Online Recruitment tools</h1>
        </div>
        <div className="nav-right">
          <div className="nav-links">
            <Link
              to="/batch-emailer"
              className={`nav-link ${
                location.pathname === "/batch-emailer" ? "active" : ""
              }`}
            >
              Batch Emailer
            </Link>
            <Link
              to="/member-extractor"
              className={`nav-link ${
                location.pathname === "/member-extractor" ? "active" : ""
              }`}
            >
              Member Extractor
            </Link>
            {tokens && (
              <div className="nav-auth">
                <span className="nav-auth-status">
                  Character ID: {characterId}
                </span>
                <button
                  className="btn btn-secondary nav-logout"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
