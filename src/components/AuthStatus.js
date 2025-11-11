import React from 'react';
import { useAuth } from '../contexts/AuthContext';

// Helper to extract character ID from JWT
function getCharacterIdFromToken(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    return decoded.sub.split(':')[2];
  } catch (error) {
    return 'Unknown';
  }
}

const AuthStatus = () => {
  const { tokens, authenticate } = useAuth();
  const characterId = tokens ? getCharacterIdFromToken(tokens.accessToken) : null;

  return (
    <div className={`auth-status ${tokens ? '' : 'not-authenticated'}`}>
      <span>
        {tokens ? (
          <>✓ Authenticated as Character ID: {characterId}</>
        ) : (
          <>Not authenticated</>
        )}
      </span>
      {!tokens && (
        <button className="btn btn-primary" onClick={authenticate}>
          Authenticate
        </button>
      )}
    </div>
  );
};

export default AuthStatus;

