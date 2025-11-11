import React, { useState, useEffect, useRef } from "react";
import {
  startMemberExtraction,
  getExtractionProgress,
  downloadExtraction,
} from "../utils/api";
import "../styles/MemberExtractor.css";

function MemberExtractor() {
  // Get date 7 days ago in YYYY-MM-DD format
  const getDate7DaysAgo = () => {
    const date = new Date();
    date.setDate(date.getDate() - 7);
    return date.toISOString().split("T")[0];
  };

  const [config, setConfig] = useState({
    allianceId: "",
    corpIds: "",
    fileNamePrefix: "",
    type: "departed",
    sinceDate: getDate7DaysAgo(),
    shipsKillsThreshold: "",
    efficiencyThreshold: "",
  });

  const dateInputRef = useRef(null);

  // Calculate days from date
  const calculateDaysFromDate = (dateString) => {
    if (!dateString) return 0;
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    message: "Ready to start",
    status: "idle",
  });

  const [isRunning, setIsRunning] = useState(false);

  // Set default date when type changes to departed/joined
  useEffect(() => {
    if (config.type === "departed" || config.type === "joined") {
      setConfig((prev) => {
        // Only set default if sinceDate is empty
        if (!prev.sinceDate) {
          return {
            ...prev,
            sinceDate: getDate7DaysAgo(),
          };
        }
        return prev;
      });
    }
  }, [config.type]);

  // Poll for progress
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      try {
        const progressData = await getExtractionProgress();
        setProgress(progressData);
        if (
          progressData.status === "completed" ||
          progressData.status === "error"
        ) {
          setIsRunning(false);
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Handle date input click to open calendar
  const handleDateInputClick = () => {
    if (dateInputRef.current && !isRunning) {
      // Modern browsers support showPicker()
      if (dateInputRef.current.showPicker) {
        try {
          dateInputRef.current.showPicker();
        } catch (e) {
          // Fallback to focus if showPicker fails
          dateInputRef.current.focus();
        }
      } else {
        // Fallback for older browsers
        dateInputRef.current.focus();
      }
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleStart = async () => {
    // Validation
    if (!config.allianceId && !config.corpIds) {
      alert("Please provide either Alliance ID or Corporation IDs");
      return;
    }

    if (
      (config.type === "departed" || config.type === "joined") &&
      !config.sinceDate
    ) {
      alert("Please provide a date for filtering members");
      return;
    }

    setIsRunning(true);
    setProgress({
      current: 0,
      total: 0,
      message: "Starting extraction...",
      status: "running",
    });

    try {
      // Convert date to nDays for the API
      const nDays = config.sinceDate
        ? calculateDaysFromDate(config.sinceDate)
        : 0;
      const apiConfig = {
        ...config,
        nDays:
          config.type === "departed" || config.type === "joined" ? nDays : 0,
      };
      await startMemberExtraction(apiConfig);
    } catch (error) {
      alert("Error starting extraction: " + error.message);
      setIsRunning(false);
      setProgress((prev) => ({
        ...prev,
        status: "error",
        message: `Error: ${error.message}`,
      }));
    }
  };

  const handleDownload = async () => {
    try {
      const blob = await downloadExtraction();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = blob.filename || "extracted_members.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      alert("Error downloading file: " + error.message);
    }
  };

  const percentage =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="container">
      <div className="header">
        <h1>🔍 Member Extractor</h1>
        <p>Extract corporation members from EVE Online</p>
      </div>

      <div className="content">
        <div className="section">
          <h2>⚙️ Configuration</h2>
          <span className="hint">
            Extracts characters from a corporation or alliance based on the
            provided filters.
            <br />
            <br />
            Corp and Alliance IDs can be found on the{" "}
            <a
              className="link"
              href="https://evewho.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              evewho
            </a>{" "}
            website in the URL.
          </span>

          <div className="config-form">
            <div className="form-group">
              <label>
                Alliance ID{" "}
                <span className="optional">
                  (optional if Corp IDs provided)
                </span>
              </label>
              <input
                type="text"
                value={config.allianceId}
                onChange={(e) =>
                  handleConfigChange("allianceId", e.target.value)
                }
                placeholder="e.g., 99000001"
                disabled={isRunning}
              />
            </div>

            <div className="form-group">
              <label>
                Corporation IDs{" "}
                <span className="optional">
                  (comma-separated, optional if Alliance ID provided)
                </span>
              </label>
              <input
                type="text"
                value={config.corpIds}
                onChange={(e) => handleConfigChange("corpIds", e.target.value)}
                placeholder="e.g., 12345678, 87654321"
                disabled={isRunning}
              />
            </div>

            <div className="form-group">
              <label>Corp movement type</label>
              <select
                value={config.type}
                onChange={(e) => handleConfigChange("type", e.target.value)}
                disabled={isRunning}
              >
                <option value="departed">Departed</option>
                <option value="current">Current</option>
                <option value="joined">Joined</option>
              </select>
            </div>

            {(config.type === "departed" || config.type === "joined") && (
              <div className="form-group">
                <label>
                  {config.type === "departed"
                    ? "Date Since Left"
                    : "Date Since Joined"}
                </label>
                <input
                  ref={dateInputRef}
                  type="date"
                  value={config.sinceDate}
                  onChange={(e) =>
                    handleConfigChange("sinceDate", e.target.value)
                  }
                  onClick={handleDateInputClick}
                  max={new Date().toISOString().split("T")[0]}
                  disabled={isRunning}
                />
                {config.sinceDate && (
                  <span className="date-info">
                    {calculateDaysFromDate(config.sinceDate)} days ago
                  </span>
                )}
              </div>
            )}

            <div className="form-group">
              <label>
                Ship Kills Threshold{" "}
                <span className="hint">
                  filters out characters with less than this number of ship
                  kills
                </span>
                <span className="optional"> (optional filter) </span>
              </label>
              <input
                type="number"
                value={config.shipsKillsThreshold}
                onChange={(e) =>
                  handleConfigChange(
                    "shipsKillsThreshold",
                    e.target.value ? parseInt(e.target.value) : ""
                  )
                }
                min="0"
                placeholder="Minimum ship kills"
                disabled={isRunning}
              />
            </div>

            <div className="form-group">
              <label>
                Efficiency Threshold{" "}
                <span className="hint">
                  filters out characters with less than this efficiency
                  percentage
                </span>
                <span className="optional"> (optional filter, %) </span>
              </label>
              <input
                type="number"
                value={config.efficiencyThreshold}
                onChange={(e) =>
                  handleConfigChange(
                    "efficiencyThreshold",
                    e.target.value ? parseInt(e.target.value) : ""
                  )
                }
                min="0"
                max="100"
                placeholder="Minimum efficiency percentage"
                disabled={isRunning}
              />
            </div>
          </div>
        </div>

        <div className="section progress-section">
          <h2>📊 Progress</h2>
          <div className="progress-info">
            <span>
              Status:{" "}
              <span className={`status status-${progress.status}`}>
                {progress.status.charAt(0).toUpperCase() +
                  progress.status.slice(1)}
              </span>
            </span>
            <span>
              {progress.current} / {progress.total}
            </span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar" style={{ width: `${percentage}%` }}>
              {percentage > 0 ? `${percentage}%` : ""}
            </div>
          </div>
          <div className="progress-message">
            {progress.message || "Ready to start"}
          </div>
          <div className="actions">
            <button
              className="btn btn-success"
              onClick={handleStart}
              disabled={isRunning}
            >
              Start Extraction
            </button>
            {progress.status === "completed" && (
              <button className="btn btn-primary" onClick={handleDownload}>
                Download CSV
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberExtractor;
