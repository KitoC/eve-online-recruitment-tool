import React from "react";
import { Link, useLocation } from "react-router-dom";

const Navigation = () => {
  const location = useLocation();

  return (
    <nav className="top-nav">
      <div className="nav-container">
        <div className="nav-logo">
          <h1>🚀 EVE Online Recruitment tools</h1>
        </div>
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
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
