const {
  extractCharactersFromCorp,
} = require("./extractDepartedMembersFromCorp");
const { fetchCorpName } = require("./fetchCorpName");
const { getAllianceCorpIds } = require("./getAllianceCorpIds");
const { ProgressDisplay } = require("../utils/progressDisplay");
const { saveCharactersToCSV } = require("./saveAsCSV");
const {
  getAllianceId,
  getArgs,
  getFileNamePrefix,
  getCorpIds,
  getType,
  getShipsKillsThreshold,
  getEfficiencyThreshold,
  getAllianceName,
} = require("../utils/general");
const { makeCSVFileName } = require("../utils/csv");

// -------- Main --------
(async () => {
  const progress = new ProgressDisplay();
  const args = getArgs();

  console.log(args);

  progress.update("Initializing...");

  const AllianceId = getAllianceId();

  const corpIds = getCorpIds() || (await getAllianceCorpIds(AllianceId));

  const allianceName = await getAllianceName();
  const fileNamePrefix = getFileNamePrefix() || allianceName;

  const type = getType();

  const efficiencyThreshold = getEfficiencyThreshold();
  const shipKillsThreshold = getShipsKillsThreshold();

  const AllianceMembers = [];
  let completedCorps = 0;

  const updateProgress = ({ message, currentCorpName, debug = false }) => {
    const extractedCorpCount = completedCorps + 1;
    const totalCorpCount = corpIds.length;

    progressBar = progress.createProgressBar({
      current: extractedCorpCount - 1,
      total: totalCorpCount,
      debug,
    });

    progress.update(
      `[${
        allianceName || fileNamePrefix
      }] ${progressBar} extracting ${extractedCorpCount}/${totalCorpCount} corps [${currentCorpName}]: ${message}`
    );
  };

  for (const corpId of corpIds) {
    const corpName = await fetchCorpName(corpId);

    updateProgress({
      message: `Starting to extract departed members...`,
      currentCorpName: corpName,
    });

    const { characters } = await extractCharactersFromCorp({
      corpName,
      corpId,
      nDays: args.nDays || process.env.N_DAYS || 7,
      progressCallback: (message) => {
        updateProgress({ message, currentCorpName: corpName });
      },
      type,
      nDays: args.type === "departed" ? args.nDays || 7 : 0,
    });

    completedCorps++;
    AllianceMembers.push(...characters);

    updateProgress({
      message: `Found ${characters.length} characters in ${corpName}`,
      currentCorpName: corpName,
      debug: true,
    });
  }

  progress.finish(`\n✓ Processed ${corpIds.length} corporations`);

  const worthyCharacters = AllianceMembers.filter((member) => {
    if (!shipKillsThreshold) {
      return true;
    }

    if (!efficiencyThreshold) {
      return true;
    }

    return (
      member.DestroyedShips >= shipKillsThreshold &&
      parseInt(member.Efficiency.replace("%", "")) > efficiencyThreshold
    );
  });

  progress.finish(`Found ${worthyCharacters.length} worthy characters`);

  saveCharactersToCSV(
    worthyCharacters,
    makeCSVFileName(fileNamePrefix, `${type}_members`)
  );

  progress.finish(
    `✓ Saved to ${makeCSVFileName(fileNamePrefix, `${type}_members`)}`
  );
})().catch((err) => {
  console.error("\nError:", err.message);
  process.exit(1);
});
