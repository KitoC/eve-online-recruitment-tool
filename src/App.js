import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Navigation from "./components/Navigation";
import BatchEmailer from "./components/BatchEmailer";
import MemberExtractor from "./components/MemberExtractor";
import "./styles/App.css";
import "./styles/Navigation.css";

function App() {
  return (
    <BrowserRouter>
      <Navigation />
      <Routes>
        <Route path="/" element={<Navigate to="/batch-emailer" replace />} />
        <Route path="/batch-emailer" element={<BatchEmailer />} />
        <Route path="/member-extractor" element={<MemberExtractor />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
