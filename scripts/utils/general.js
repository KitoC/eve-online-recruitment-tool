#!/usr/bin/env node
const dotenv = require("dotenv");
dotenv.config();

const getArgs = () => {
  function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
      let a = argv[i];
      if (!a.startsWith("--")) continue;
      a = a.slice(2);
      if (a.includes("=")) {
        const [k, ...rest] = a.split("=");
        out[k] = rest.join("="); // keep any '=' inside values
      } else {
        const k = a;
        const next = argv[i + 1];
        if (next && !next.startsWith("--")) {
          out[k] = next;
          i++; // consume value
        } else {
          out[k] = true; // bare flag
        }
      }
    }
    return out;
  }

  const args = parseArgs(process.argv.slice(2));

  return args;
};

const args = getArgs();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getAllianceId = () => {
  return args.allianceId || process.env.ALLIANCE_ID;
};

const getCorpIds = () => {
  const corpIds = args.corpIds || process.env.CORP_IDS;

  return corpIds.split(",");
};

const getFileNamePrefix = () => {
  const fileNamePrefix = args.fileNamePrefix || process.env.FILE_NAME_PREFIX;

  return fileNamePrefix;
};

const getType = () => {
  const type = args.type || process.env.TYPE || "departed";

  if (!["departed", "current", "joined"].includes(type)) {
    console.error("Invalid type. Valid types are: departed, current, joined");
    process.exit(1);
  }

  return type;
};

const getShipsKillsThreshold = () => {
  const shipsKillsThreshold =
    args.shipsKillsThreshold || process.env.SHIPS_KILLS_THRESHOLD;

  return parseInt(shipsKillsThreshold);
};

const getEfficiencyThreshold = () => {
  const efficiencyThreshold =
    args.efficiencyThreshold || process.env.EFFICIENCY_THRESHOLD;

  return parseInt(efficiencyThreshold);
};

const getAllianceName = async () => {
  const corpIds = getCorpIds();

  if (corpIds.length > 0) {
    return args.allianceName || getFileNamePrefix();
  }

  const allianceId = getAllianceId();
  const allianceName = await fetchAllianceName(allianceId);

  if (!allianceName) {
    console.error("Alliance name not found");
    process.exit(1);
  }

  return allianceName;
};

const getMessageTemplateName = () => {
  const messageTemplateName =
    args.messageTemplateName || process.env.MESSAGE_TEMPLATE_NAME;

  if (!messageTemplateName) {
    console.error("Message template name not found");
    process.exit(1);
  }

  return messageTemplateName;
};

const getTemplateVariables = () => {
  const vars = {};

  Object.entries({ ...args, ...process.env }).forEach(([key, value]) => {
    if (key.startsWith("TEMPLATE_")) {
      vars[key] = value;
    }
  });

  return vars;
};

const getESICurrentUserId = () => {
  const esiCurrentUserId =
    args.esiCurrentUserId || process.env.ESI_CURRENT_USER_ID;

  return esiCurrentUserId;
};

const getCurrentUserJWT = () => {
  const currentUserJWT = args.token || process.env.TOKEN;

  return currentUserJWT;
};

module.exports = {
  getArgs,
  getAllianceId,
  getType,
  getFileNamePrefix,
  getShipsKillsThreshold,
  getEfficiencyThreshold,
  getCorpIds,
  getAllianceName,
  getMessageTemplateName,
  getTemplateVariables,
  getESICurrentUserId,
  getCurrentUserJWT,
  sleep,
};
