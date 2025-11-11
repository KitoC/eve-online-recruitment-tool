import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  getTemplate,
  sendEmails,
  getProgress,
  pauseSending,
} from "../utils/api";
import AuthStatus from "./AuthStatus";
import FileSelector from "./FileSelector";
import TemplateEditor from "./TemplateEditor";
import ProgressSection from "./ProgressSection";

function BatchEmailer() {
  const { tokens, authenticate } = useAuth();
  const [csvData, setCsvData] = useState(null);
  const [template, setTemplate] = useState({
    subject: "",
    body: "",
    variables: {},
  });
  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    message: "Ready to start",
    status: "idle",
  });

  // Load template on mount
  useEffect(() => {
    const loadTemplate = async () => {
      try {
        const data = await getTemplate();
        setTemplate(data);
      } catch (error) {
        console.error("Error loading template:", error);
      }
    };
    loadTemplate();
  }, []);

  // Poll for progress
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const progressData = await getProgress();
        setProgress(progressData);
      } catch (error) {
        console.error("Error fetching progress:", error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = (uploadedCsvData) => {
    setCsvData(uploadedCsvData);
  };

  const handleStartSending = async () => {
    if (!csvData || !csvData.data || csvData.data.length === 0) {
      alert("Please upload a CSV file first");
      return;
    }

    if (!template.subject || !template.body) {
      alert("Please fill in the subject and body");
      return;
    }

    if (!tokens) {
      alert("Please authenticate first");
      return;
    }

    try {
      await sendEmails(csvData, template, tokens);
    } catch (error) {
      alert("Error starting email sending: " + error.message);
    }
  };

  // Memoize template change handler to prevent infinite loops
  const handleTemplateChange = React.useCallback((newTemplate) => {
    setTemplate(newTemplate);
  }, []);

  const handlePause = async () => {
    try {
      await pauseSending();
    } catch (error) {
      console.error("Error pausing:", error);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <h1>📧 Batch Emailer</h1>
        <p>Send bulk messages to corporation members</p>
      </div>

      <div className="content">
        <AuthStatus />

        <FileSelector csvData={csvData} onFileUpload={handleFileUpload} />

        <TemplateEditor
          template={template}
          csvData={csvData}
          onTemplateChange={handleTemplateChange}
        />

        <ProgressSection
          progress={progress}
          onStart={handleStartSending}
          onPause={handlePause}
        />
      </div>
    </div>
  );
}

export default BatchEmailer;
