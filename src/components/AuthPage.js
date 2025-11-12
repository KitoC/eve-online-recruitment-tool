import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { Navigate } from "react-router-dom";

const AuthPage = () => {
  const { isAuthenticated, isInitialized, authenticate } = useAuth();

  // If already authenticated, redirect to Batch Eve Mailer
  if (isInitialized && isAuthenticated) {
    return <Navigate to="/batch-emailer" replace />;
  }

  // Wait for auth to initialize
  if (!isInitialized) {
    return (
      <div className="container">
        <div className="header">
          <h1>Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>🔐 Authentication Required</h1>
        <p>Please authenticate with EVE Online to access this application</p>
      </div>

      <div className="content">
        <div className="section">
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p style={{ marginBottom: "2rem", fontSize: "1.1rem" }}>
              You need to authenticate with EVE Online to use the Member
              Extractor and Batch Eve Mailer tools.
            </p>
            <button className="btn btn-primary" onClick={authenticate}>
              Authenticate with EVE Online
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
