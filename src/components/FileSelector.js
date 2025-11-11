import React, { useRef } from "react";
import { parseCSV, readFileAsText } from "../utils/csvParser";

const FileSelector = ({ csvData, onFileUpload }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check if it's a CSV file
    if (!file.name.endsWith(".csv")) {
      alert("Please upload a CSV file");
      return;
    }

    try {
      // Read file as text
      const csvText = await readFileAsText(file);

      // Parse CSV
      const { headers, data } = parseCSV(csvText);

      if (headers.length === 0 || data.length === 0) {
        alert("CSV file appears to be empty or invalid");
        return;
      }

      // Prepare data for parent component
      const csvData = {
        headers,
        data,
        totalRows: data.length,
        variables: headers,
        firstRow: data[0] || {},
        fileName: file.name,
      };

      onFileUpload(csvData);
    } catch (error) {
      console.error("Error parsing CSV:", error);
      alert("Error parsing CSV file: " + error.message);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="section">
      <h2>📁 Upload CSV File</h2>
      <div className="file-selector">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
        <button
          className="btn btn-primary"
          onClick={handleUploadClick}
          style={{ width: "100%" }}
        >
          Choose CSV File
        </button>
        {csvData && (
          <div
            style={{ marginTop: "10px", color: "#88aacc", fontSize: "0.9rem" }}
          >
            ✓ {csvData.fileName} ({csvData.totalRows} rows)
          </div>
        )}
      </div>
      {csvData && (
        <div
          className="preview-section"
          style={{
            marginTop: "20px",
            padding: "15px",
            background: "rgba(5, 10, 20, 0.6)",
            border: "1px dashed rgba(0, 153, 255, 0.3)",
            borderRadius: "2px",
          }}
        >
          <h3
            style={{
              marginBottom: "10px",
              color: "#00ccff",
              fontWeight: 300,
              textTransform: "uppercase",
              letterSpacing: "1px",
              fontSize: "0.9rem",
            }}
          >
            File Preview ({csvData.totalRows} rows)
          </h3>
          <div
            style={{
              overflow: "auto",
              marginTop: "10px",
              maxHeight: "200px",
              border: "1px solid rgba(0, 153, 255, 0.2)",
              borderRadius: "2px",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontFamily: "'Courier New', monospace",
                fontSize: "0.85rem",
                background: "rgba(0, 0, 0, 0.3)",
              }}
            >
              <thead
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  background: "rgba(0, 20, 40, 0.95)",
                }}
              >
                <tr
                  style={{
                    background: "rgba(0, 102, 255, 0.2)",
                    borderBottom: "2px solid rgba(0, 153, 255, 0.4)",
                  }}
                >
                  {csvData.headers.map((header, idx) => (
                    <th
                      key={idx}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        color: "#00ccff",
                        fontWeight: 600,
                        borderRight:
                          idx < csvData.headers.length - 1
                            ? "1px solid rgba(0, 153, 255, 0.2)"
                            : "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvData.data.map((row, rowIdx) => (
                  <tr
                    key={rowIdx}
                    style={{
                      borderBottom:
                        rowIdx < csvData.data.length - 1
                          ? "1px solid rgba(0, 153, 255, 0.1)"
                          : "none",
                      background:
                        rowIdx % 2 === 0
                          ? "transparent"
                          : "rgba(0, 20, 40, 0.3)",
                    }}
                  >
                    {csvData.headers.map((header, colIdx) => (
                      <td
                        key={colIdx}
                        style={{
                          padding: "6px 12px",
                          color: "#e0e0e0",
                          borderRight:
                            colIdx < csvData.headers.length - 1
                              ? "1px solid rgba(0, 153, 255, 0.1)"
                              : "none",
                          whiteSpace: "nowrap",
                          maxWidth: "200px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={row[header] || ""}
                      >
                        {row[header] || ""}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileSelector;
