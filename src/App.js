import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Navigation from "./components/Navigation";
import BatchEmailer from "./components/BatchEmailer";
import MemberExtractor from "./components/MemberExtractor";
import ProtectedRoute from "./components/ProtectedRoute";
import AuthPage from "./components/AuthPage";
import "./styles/App.css";
import "./styles/Navigation.css";

const RootRedirect = () => {
  const { isAuthenticated, isInitialized } = useAuth();

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
    <Navigate to={isAuthenticated ? "/batch-emailer" : "/auth"} replace />
  );
};

const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Navigation />
      <div className="content">
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/batch-emailer"
            element={
              <ProtectedRoute>
                <BatchEmailer />
              </ProtectedRoute>
            }
          />
          <Route
            path="/member-extractor"
            element={
              <ProtectedRoute>
                <MemberExtractor />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </BrowserRouter>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
