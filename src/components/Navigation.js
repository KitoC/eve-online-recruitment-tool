import React, { useState, useEffect } from "react";
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
  const { tokens, logout, authenticate } = useAuth();
  const characterId = tokens
    ? getCharacterIdFromToken(tokens.accessToken)
    : null;
  const [characterData, setCharacterData] = useState(null);
  const [portraitUrl, setPortraitUrl] = useState(null);

  // Fetch character data and portrait
  useEffect(() => {
    if (!characterId || characterId === "Unknown") return;

    const fetchCharacterData = async () => {
      try {
        // Fetch character info (name)
        const characterResponse = await fetch(
          `https://esi.evetech.net/latest/characters/${characterId}/`
        );
        if (characterResponse.ok) {
          const characterInfo = await characterResponse.json();
          setCharacterData(characterInfo);
        }

        // Fetch portrait
        const portraitResponse = await fetch(
          `https://esi.evetech.net/latest/characters/${characterId}/portrait/`
        );
        if (portraitResponse.ok) {
          const portraitData = await portraitResponse.json();
          // Use the 256x256 size portrait
          setPortraitUrl(
            portraitData.px256x256 ||
              portraitData.px128x128 ||
              portraitData.px64x64
          );
        }
      } catch (error) {
        console.error("Error fetching character data:", error);
      }
    };

    fetchCharacterData();
  }, [characterId]);

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
            {tokens ? (
              <div className="nav-auth">
                {portraitUrl && (
                  <img
                    src={portraitUrl}
                    alt={characterData?.name || "Character portrait"}
                    className="nav-portrait"
                  />
                )}
                <div className="nav-character-info">
                  {characterData?.name ? (
                    <span className="nav-character-name">
                      {characterData.name}
                    </span>
                  ) : (
                    <span className="nav-auth-status">
                      Character ID: {characterId}
                    </span>
                  )}
                </div>
                <button
                  className="btn btn-secondary nav-logout"
                  onClick={logout}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="nav-auth">
                <button
                  className="btn btn-primary nav-login"
                  onClick={authenticate}
                >
                  Login
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
