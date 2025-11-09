#!/usr/bin/env node
const dotenv = require("dotenv");
dotenv.config();

const {
  extractDepartedMembersFromCorp,
} = require("./extractDepartedMembersFromCorp");
const { getAllianceCorpIds, getAllianceName } = require("./getAllianceCorpIds");
// -------- CONFIG via CLI or env --------
// --- replace the old args parsing with this ---
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

// -------- Main --------
(async () => {
  const AllianceId = "99005338";
  const corpIds = await getAllianceCorpIds(AllianceId);
  const allianceName = await getAllianceName(AllianceId);

  const AllianceMembers = [];
  for (const corpId of corpIds) {
    const departedMembers = await extractDepartedMembersFromCorp({
      corpId: corpId,
      nDays: args.nDays || process.env.N_DAYS || 7,
    });

    AllianceMembers.push(...departedMembers);
  }

  saveCharactersToCSV(
    AllianceMembers.filter(
      (member) =>
        member.DestroyedShips > 0 &&
        parseInt(member.Efficiency.replace("%", "")) > 50
    ),
    `${allianceName.split(" ").join("_")}_departed_members.csv`
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
