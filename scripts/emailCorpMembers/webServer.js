#!/usr/bin/env node
const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const {
  exchangeCodeForTokens,
  refreshAccessToken,
  getValidAccessToken,
  getCharacterIdFromToken,
  getClientCredentials,
  AUTHORIZE_URL,
  SCOPES,
} = require("../utils/authServer");
const { parseCSVToJSON, makeCSVFileName } = require("../utils/csv");
const { sleep } = require("../utils/general");
const axios = require("axios");
const {
  extractCharactersFromCorp,
} = require("../corpMemberExtractor/extractDepartedMembersFromCorp");
const { fetchCorpName } = require("../corpMemberExtractor/fetchCorpName");
const {
  getAllianceCorpIds,
  fetchAllianceName,
} = require("../corpMemberExtractor/getAllianceCorpIds");

const app = express();

// CORS middleware for development
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "http://localhost:3006");
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}

app.use(express.json());

// Serve React build in production, public folder in development
const isProduction = process.env.NODE_ENV === "production";
if (isProduction) {
  app.use(express.static(path.join(__dirname, "../../build")));
} else {
  app.use(express.static(path.join(__dirname, "../../public")));
}

// Global state for email sending
let emailJob = {
  isRunning: false,
  progress: {
    current: 0,
    total: 0,
    message: "",
    status: "idle", // idle, running, paused, completed, error
  },
  currentUserId: null,
  apiUrl: null,
  tokens: null, // Store tokens for the job
};

// Global state for member extraction
let extractionJob = {
  isRunning: false,
  progress: {
    current: 0,
    total: 0,
    message: "Ready to start",
    status: "idle", // idle, running, completed, error
  },
  result: null, // CSV data
  filename: null,
};

const SLEEP_AT_MESSAGE_SENT_COUNT = 75;
const SPAM_SLEEP_TIME_MS = 60000;

// Middleware to extract tokens from Authorization header
const getTokensFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  // For now, we'll get tokens from body or header
  // In production, tokens should come from the request body for email sending
  return req.body.tokens || null;
};

// Build message from template
const buildMessage = (member, template) => {
  let subject = template.subject;
  let body = template.body;

  // Replace all template variables
  Object.keys(member).forEach((key) => {
    const placeholder = `%%${key}%%`;
    subject = subject.replace(new RegExp(placeholder, "g"), member[key] || "");
    body = body.replace(new RegExp(placeholder, "g"), member[key] || "");
  });

  // Replace custom template variables
  if (template.variables) {
    Object.entries(template.variables).forEach(([key, value]) => {
      const placeholder = `%%${key}%%`;
      subject = subject.replace(new RegExp(placeholder, "g"), value);
      body = body.replace(new RegExp(placeholder, "g"), value);
    });
  }

  return { subject, body, recipient_id: member.Id };
};

// Send a single message
const sendMessage = async ({ member, message, token }) => {
  const body = {
    approved_cost: 0,
    body: message.body,
    recipients: [
      {
        recipient_id: parseInt(message.recipient_id),
        recipient_type: "character",
      },
    ],
    subject: message.subject,
  };

  const response = await axios.post(emailJob.apiUrl, body, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response;
};

// Process email sending
const processEmailSending = async (csvData, template, tokens) => {
  emailJob.isRunning = true;
  emailJob.progress.status = "running";
  emailJob.progress.message = "Initializing...";
  emailJob.tokens = tokens;

  try {
    // Get character ID from token
    emailJob.progress.message = "Authenticating with EVE Online...";
    emailJob.currentUserId = getCharacterIdFromToken(tokens.accessToken);
    emailJob.apiUrl = `https://esi.evetech.net/characters/${emailJob.currentUserId}/mail`;

    // Use CSV data from request
    emailJob.progress.message = "Processing CSV data...";
    const data = csvData.data || [];
    emailJob.progress.total = data.length;
    emailJob.progress.current = 0;

    let currentMessageSentCount = 0;
    let currentTokens = tokens;

    for (const member of data) {
      if (!emailJob.isRunning) {
        emailJob.progress.status = "paused";
        break;
      }

      emailJob.progress.message = `Sending message to ${member.Name}...`;
      emailJob.progress.current = currentMessageSentCount;

      // Sleep every N messages
      if (
        currentMessageSentCount &&
        currentMessageSentCount % SLEEP_AT_MESSAGE_SENT_COUNT === 0
      ) {
        emailJob.progress.message = "Rate limit pause (3 minutes)...";
        await sleep(3 * 60 * 1000);
      }

      const message = buildMessage(member, template);

      // Get valid token (refresh if needed)
      try {
        currentTokens = await getValidAccessToken(currentTokens);
        await sendMessage({
          member,
          message,
          token: currentTokens.accessToken,
        });
        emailJob.progress.message = `Successfully sent to ${member.Name}`;
        currentMessageSentCount++;
        emailJob.progress.current = currentMessageSentCount;
        await sleep(1000);
      } catch (error) {
        const response = error.response;

        // Handle token expiration
        if (response?.status === 401) {
          emailJob.progress.message = "Token expired. Refreshing...";
          try {
            currentTokens = await getValidAccessToken(currentTokens);
            await sendMessage({
              member,
              message,
              token: currentTokens.accessToken,
            });
            emailJob.progress.message = `Successfully sent to ${member.Name} (after refresh)`;
            currentMessageSentCount++;
            emailJob.progress.current = currentMessageSentCount;
            await sleep(1000);
            continue;
          } catch (refreshError) {
            throw new Error("Failed to refresh token: " + refreshError.message);
          }
        }

        // Handle spam limit
        if (
          response?.data?.error?.includes("MailStopSpamming") &&
          response?.data?.error?.includes("remainingTime")
        ) {
          emailJob.progress.message = "Hit spam limit. Waiting 60 seconds...";
          await sleep(SPAM_SLEEP_TIME_MS);
          // Retry
          currentTokens = await getValidAccessToken(currentTokens);
          await sendMessage({
            member,
            message,
            token: currentTokens.accessToken,
          });
          emailJob.progress.message = `Successfully sent to ${member.Name}`;
          currentMessageSentCount++;
          emailJob.progress.current = currentMessageSentCount;
          await sleep(1000);
          continue;
        }

        throw error;
      }
    }

    emailJob.progress.status = "completed";
    emailJob.progress.message = `Completed! Sent ${currentMessageSentCount} messages.`;
  } catch (error) {
    emailJob.progress.status = "error";
    emailJob.progress.message = `Error: ${error.message}`;
    console.error("Email sending error:", error);
  } finally {
    emailJob.isRunning = false;
  }
};

// API Routes

// OAuth callback endpoint
app.get("/api/auth/callback", async (req, res) => {
  try {
    const { code, error, state } = req.query;

    const frontendUrl =
      process.env.REACT_APP_URL ||
      (process.env.NODE_ENV === "production"
        ? `${req.protocol}://${req.get("host")}`
        : "http://localhost:3006");

    if (error) {
      return res.redirect(`${frontendUrl}/?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/?error=no_code`);
    }

    const { clientId, clientSecret } = getClientCredentials();
    if (!clientId || !clientSecret) {
      return res.redirect(`${frontendUrl}/?error=missing_credentials`);
    }

    // Get redirect URI from environment or use current host
    const redirectUri =
      process.env.CALLBACK_URL ||
      `https://${req.get("host")}/api/auth/callback`;

    const tokens = await exchangeCodeForTokens(
      code,
      clientId,
      clientSecret,
      redirectUri
    );

    // Redirect to frontend with tokens
    // In development, redirect to React app (localhost:3006)
    // In production, redirect to root (same origin)
    const tokenData = encodeURIComponent(JSON.stringify(tokens));
    res.redirect(`${frontendUrl}/?tokens=${tokenData}`);
  } catch (error) {
    console.error("OAuth callback error:", error);
    res.redirect(`${frontendUrl}/?error=${encodeURIComponent(error.message)}`);
  }
});

// Get OAuth authorization URL
app.get("/api/auth/authorize", (req, res) => {
  try {
    const { clientId } = getClientCredentials();
    if (!clientId) {
      return res.status(500).json({ error: "EVE_CLIENT_ID not configured" });
    }

    // Generate state
    const state =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    const redirectUri =
      process.env.CALLBACK_URL ||
      `${req.protocol}://${req.get("host")}/api/auth/callback`;

    const authUrl = `${AUTHORIZE_URL}/?response_type=code&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&client_id=${clientId}&scope=${encodeURIComponent(
      SCOPES
    )}&state=${encodeURIComponent(state)}`;

    res.json({ authUrl, state });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Refresh token endpoint
app.post("/api/auth/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const { clientId, clientSecret } = getClientCredentials();
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Server not configured" });
    }

    const tokens = await refreshAccessToken(
      refreshToken,
      clientId,
      clientSecret
    );
    res.json(tokens);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get list of CSV files
app.get("/api/csv-files", async (req, res) => {
  try {
    const csvDir = path.join(__dirname, "../../csv");
    const files = await fs.readdir(csvDir);
    const csvFiles = files.filter((f) => f.endsWith(".csv"));
    res.json({ files: csvFiles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get CSV file preview
app.get("/api/csv-preview/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const csvPath = path.join(__dirname, "../../csv", filename);
    const { headers, data } = parseCSVToJSON(csvPath);
    res.json({
      headers,
      preview: data.slice(0, 5), // First 5 rows
      totalRows: data.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available template variables from CSV
app.get("/api/csv-variables/:filename", async (req, res) => {
  try {
    const filename = req.params.filename;
    const csvPath = path.join(__dirname, "../../csv", filename);
    const { headers } = parseCSVToJSON(csvPath);
    res.json({ variables: headers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get default template
app.get("/api/template", async (req, res) => {
  try {
    const templatePath = path.join(
      __dirname,
      "../../templates/xelrac_recruitment_message.js"
    );

    // Try to require the template file
    try {
      delete require.cache[require.resolve(templatePath)];
      const templateModule = require(templatePath);
      res.json({
        subject: templateModule.subject || "",
        body: templateModule.body || "",
        variables: {},
      });
    } catch (requireError) {
      // Fallback to file reading if require fails
      const templateContent = await fs.readFile(templatePath, "utf8");

      // Extract subject and body from template file (handle template literals)
      const subjectMatch =
        templateContent.match(/const subject\s*=\s*`([^`]+)`/s) ||
        templateContent.match(/const subject\s*=\s*["']([^"']+)["']/);
      const bodyMatch =
        templateContent.match(/const body\s*=\s*`([^`]+)`/s) ||
        templateContent.match(/const body\s*=\s*["']([^"']+)["']/);

      const subject = subjectMatch ? subjectMatch[1] : "";
      const body = bodyMatch ? bodyMatch[1] : "";

      res.json({ subject, body, variables: {} });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save template
app.post("/api/template", async (req, res) => {
  try {
    const { subject, body, variables } = req.body;
    // Template is stored in memory for this session
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start email sending
app.post("/api/send-emails", async (req, res) => {
  if (emailJob.isRunning) {
    return res
      .status(400)
      .json({ error: "Email sending is already in progress" });
  }

  const { csvData, template, tokens } = req.body;

  if (
    !csvData ||
    !csvData.data ||
    !Array.isArray(csvData.data) ||
    csvData.data.length === 0
  ) {
    return res.status(400).json({ error: "Valid CSV data is required" });
  }

  if (!template || !tokens) {
    return res.status(400).json({ error: "Template and tokens are required" });
  }

  // Start sending in background
  processEmailSending(csvData, template, tokens).catch((error) => {
    console.error("Background email error:", error);
  });

  res.json({ success: true, message: "Email sending started" });
});

// Get progress
app.get("/api/progress", (req, res) => {
  res.json(emailJob.progress);
});

// Pause email sending
app.post("/api/pause", (req, res) => {
  emailJob.isRunning = false;
  emailJob.progress.status = "paused";
  res.json({ success: true });
});

// Resume email sending
app.post("/api/resume", async (req, res) => {
  // Resume logic would go here
  res.json({ success: true });
});

// Member Extraction API

// Process member extraction
const processMemberExtraction = async (config) => {
  extractionJob.isRunning = true;
  extractionJob.progress.status = "running";
  extractionJob.progress.message = "Initializing...";
  extractionJob.result = null;
  extractionJob.filename = null;

  try {
    const {
      allianceId,
      corpIds,
      fileNamePrefix,
      type = "departed",
      nDays = 7,
      shipsKillsThreshold,
      efficiencyThreshold,
    } = config;

    // Get corporation IDs
    let corpIdList = [];
    if (corpIds && corpIds.trim()) {
      corpIdList = corpIds.split(",").map((id) => id.trim());
    } else if (allianceId) {
      extractionJob.progress.message = "Fetching alliance corporations...";
      corpIdList = await getAllianceCorpIds(allianceId);
    } else {
      throw new Error("Either allianceId or corpIds must be provided");
    }

    // Get alliance name for file prefix
    let allianceName = fileNamePrefix;
    if (!allianceName && allianceId) {
      allianceName = await fetchAllianceName(allianceId);
    }
    if (!allianceName) {
      allianceName = "extracted";
    }

    extractionJob.progress.total = corpIdList.length;
    extractionJob.progress.current = 0;

    const allMembers = [];
    let completedCorps = 0;

    for (const corpId of corpIdList) {
      if (!extractionJob.isRunning) {
        break;
      }

      const corpName = await fetchCorpName(corpId);
      extractionJob.progress.message = `Extracting from ${corpName}...`;
      extractionJob.progress.current = completedCorps;

      const { characters } = await extractCharactersFromCorp({
        corpName,
        corpId,
        nDays: type === "departed" ? nDays : 0,
        progressCallback: (message) => {
          extractionJob.progress.message = `[${corpName}] ${message}`;
        },
        type,
      });

      completedCorps++;
      allMembers.push(...characters);

      extractionJob.progress.message = `Found ${characters.length} characters in ${corpName}`;
      extractionJob.progress.current = completedCorps;
    }

    // Filter by thresholds if provided
    let worthyCharacters = allMembers;
    if (shipsKillsThreshold || efficiencyThreshold) {
      worthyCharacters = allMembers.filter((member) => {
        if (shipsKillsThreshold) {
          const kills = parseInt(member.DestroyedShips) || 0;
          if (kills < shipsKillsThreshold) return false;
        }
        if (efficiencyThreshold) {
          const eff = parseInt(member.Efficiency?.replace("%", "") || "0");
          if (eff <= efficiencyThreshold) return false;
        }
        return true;
      });
    }

    // Generate CSV
    const headers = [
      "Name",
      "CorpName",
      "DestroyedShips",
      "Efficiency",
      "DateLeft",
      "EveWhoLink",
      "ZKillboardLink",
      "Id",
      "CorpId",
    ];

    const csvRows = worthyCharacters.map((char) =>
      headers.map((h) => `"${(char[h] || "").replace(/"/g, '""')}"`).join(",")
    );

    const csv = [headers.join(","), ...csvRows].join("\n");

    const filename = makeCSVFileName(allianceName, `${type}_members`);
    extractionJob.result = csv;
    extractionJob.filename = filename;
    extractionJob.progress.status = "completed";
    extractionJob.progress.message = `Completed! Found ${worthyCharacters.length} members.`;
  } catch (error) {
    extractionJob.progress.status = "error";
    extractionJob.progress.message = `Error: ${error.message}`;
    console.error("Member extraction error:", error);
  } finally {
    extractionJob.isRunning = false;
  }
};

// Start member extraction
app.post("/api/extract-members", async (req, res) => {
  if (extractionJob.isRunning) {
    return res.status(400).json({ error: "Extraction is already in progress" });
  }

  const config = req.body;

  // Start extraction in background
  processMemberExtraction(config).catch((error) => {
    console.error("Background extraction error:", error);
  });

  res.json({ success: true, message: "Extraction started" });
});

// Get extraction progress
app.get("/api/extraction-progress", (req, res) => {
  res.json(extractionJob.progress);
});

// Download extracted CSV
app.get("/api/download-extraction", (req, res) => {
  if (!extractionJob.result) {
    return res.status(404).json({ error: "No extraction result available" });
  }

  const filename = extractionJob.filename || "extracted_members.csv";
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(extractionJob.result);
});

// Catch-all: serve React app for client-side routing (production only)
if (isProduction) {
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../../build/index.html"));
  });
}

const PORT = process.env.PORT || 8088;

app.listen(PORT, () => {
  console.log(`🚀 Web UI running at http://localhost:${PORT}`);
  console.log(`📧 Email sending interface ready!`);
  if (isProduction) {
    console.log(`📦 Serving React build`);
  }
});
