import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Navigation from "./components/Navigation";
import BatchEmailer from "./components/BatchEmailer";
import MemberExtractor from "./components/MemberExtractor";
import "./styles/App.css";
import "./styles/Navigation.css";

const NavigateWithAuth = ({ children, to }) => {
  const params = new URLSearchParams(window.location.search);
  console.log(params);
  return <Navigate to={{ pathname: to, search: params.toString() }} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navigation />
        <Routes>
          <Route path="/" element={<NavigateWithAuth to="/batch-emailer" />} />
          <Route path="/batch-emailer" element={<BatchEmailer />} />
          <Route path="/member-extractor" element={<MemberExtractor />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
