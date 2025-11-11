const {
  getAllianceId,
  getFileNamePrefix,
  getType,
  getAllianceName,
  getMessageTemplateName,
  getTemplateVariables,
} = require("../utils/general");
const { makeCSVFileName, parseCSVToJSON } = require("../utils/csv");
const { ProgressDisplay } = require("../utils/progressDisplay");
const { sleep } = require("../utils/general");
const { initializeAuth, getValidAccessToken } = require("../utils/auth");
const axios = require("axios");

let SLEEP_AT_MESSAGE_SENT_COUNT = 75;
let CURRENT_MESSAGE_SENT_COUNT = 0;
let SPAM_SLEEP_TIME_MS = 60000;

// These will be set after authentication
let currentUserJWT = null;
let currentUserId = null;
let API_URL = null;

const messageTemplateName = getMessageTemplateName();
const template = require(`../../templates/${messageTemplateName}.js`);
const templateVariables = getTemplateVariables();

const buildMessage = (member) => {
  let subject = template.subject.replace("%%CHARACTER_NAME%%", member.Name);
  let body = template.body.replace("%%CHARACTER_NAME%%", member.Name);

  Object.entries(templateVariables).forEach(([key, value]) => {
    subject = subject.replace(`%%${key}%%`, value);
    body = body.replace(`%%${key}%%`, value);
  });

  return {
    subject,
    body,
    recipient_id: member.Id,
  };
};

const sendMessage = async ({
  member,
  message,
  retry = false,
  updateProgress,
  total,
}) => {
  try {
    // Get fresh token in case it was refreshed
    const token = await getValidAccessToken();

    const body = {
      approved_cost: 0,
      body: message.body,
      recipients: [
        {
          recipient_id: parseInt(message.recipient_id),
          recipient_type: "character",
        },
      ],
      subject: `${Math.random().toString(36).substring(2, 10)} ${
        message.subject
      }`,
    };

    const response = await axios.post(API_URL, body, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    updateProgress({
      message: `Successfully sent message to ${member.Name}`,
      current: CURRENT_MESSAGE_SENT_COUNT,
      total,
      debug: false,
    });
  } catch (error) {
    const response = error.response;

    // Handle token expiration (401 Unauthorized)
    if (response?.status === 401) {
      updateProgress({
        message: "Token expired. Refreshing...",
        current: CURRENT_MESSAGE_SENT_COUNT,
        total,
        debug: false,
      });

      try {
        // Refresh token and retry
        const newToken = await getValidAccessToken();
        currentUserJWT = newToken;

        // Retry the request
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

        await axios.post(API_URL, body, {
          headers: {
            Authorization: `Bearer ${newToken}`,
          },
        });

        updateProgress({
          message: `Successfully sent message to ${member.Name} (after token refresh)`,
          current: CURRENT_MESSAGE_SENT_COUNT,
          total,
          debug: false,
        });
        return;
      } catch (retryError) {
        console.error(
          "Error after token refresh:",
          retryError.response?.data || retryError.message
        );
        process.exit(1);
      }
    }

    if (
      response?.data?.error?.includes("MailStopSpamming") &&
      response?.data?.error?.includes("remainingTime")
    ) {
      // Sleep for one minute, display countdown timer
      const sleepMs = SPAM_SLEEP_TIME_MS;
      const interval = 1000;
      let remaining = sleepMs / 1000;

      const countdown = setInterval(() => {
        updateProgress({
          message: `Hit spam limit. Waiting for ${remaining--} seconds...`,
          current: CURRENT_MESSAGE_SENT_COUNT,
          total,
          debug: false,
        });
      }, interval);

      await sleep(sleepMs);
      clearInterval(countdown);
      process.stdout.write("\rWait over. Resuming...          \n");
    } else {
      console.error(
        "Error sending message",
        response?.data?.error || error.message
      );
      process.exit(1);
    }
  }
};

const messageCorpMembers = async () => {
  // Initialize authentication first (before progress display)
  console.log("🔐 Authenticating with EVE Online...");
  const auth = await initializeAuth();
  currentUserJWT = auth.accessToken;
  currentUserId = auth.characterId;
  API_URL = `https://esi.evetech.net/characters/${currentUserId}/mail`;
  console.log(`✅ Authenticated as character ID: ${currentUserId}\n`);

  const type = getType();
  const fileNamePrefix = getFileNamePrefix();
  const progress = new ProgressDisplay();
  const AllianceId = getAllianceId();
  const allianceName = await getAllianceName();

  const updateProgress = ({
    message,
    current = 0,
    total = 100,
    debug = false,
  }) => {
    progressBar = progress.createProgressBar({ current, total, debug });

    progress.update(
      `[${
        allianceName || AllianceId
      }] ${progressBar} ${current}/${total} ${message}`
    );
  };

  updateProgress({
    message: "Starting bulk message sending...",
    current: 0,
    total: 100,
    debug: false,
  });

  updateProgress({
    message: "Reading CSV file...",
    current: 0,
    total: 100,
    debug: false,
  });
  const csvFileName = makeCSVFileName(fileNamePrefix, `${type}_members`);
  const csvFilePath = `./csv/${csvFileName}`;

  const { data } = parseCSVToJSON(csvFilePath);

  for (const member of data) {
    updateProgress({
      message: `Sending message to ${member.Name}...`,
      current: CURRENT_MESSAGE_SENT_COUNT,
      total: data.length,
      debug: false,
    });
    if (
      CURRENT_MESSAGE_SENT_COUNT &&
      CURRENT_MESSAGE_SENT_COUNT % SLEEP_AT_MESSAGE_SENT_COUNT === 0
    ) {
      updateProgress(`Sleeping for 600ms...`);
      await sleep(3 * 60 * 1000); // 3 minutes
    }

    const message = buildMessage(member);

    await sendMessage({ member, message, updateProgress, total: data.length });

    updateProgress({
      message: `Sent message to ${member.Name}`,
      current: CURRENT_MESSAGE_SENT_COUNT,
      total: data.length,
      debug: false,
    });
    CURRENT_MESSAGE_SENT_COUNT++;
    await sleep(1000);
  }

  updateProgress({
    message: "Done",
    current: 100,
    total: 100,
    debug: false,
  });
};

messageCorpMembers().catch((error) => {
  console.error("Fatal error:", error.message);
  process.exit(1);
});
