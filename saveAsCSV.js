const fs = require("fs");

/**
 * Converts an array of character objects into CSV format and saves to a file.
 * @param {Array} characters - Array like [{ Id, Name, DateLeft }]
 * @param {string} filename - Output file name (default: "departed_characters.csv")
 */
function saveCharactersToCSV(characters, filename = "departed_characters.csv") {
  if (!characters.length) {
    console.log("No characters to save.");
    return;
  }

  // CSV header
  const headers = [
    "Id",
    "Name",
    "DateLeft",
    "EveWhoLink",
    "DestroyedShips",
    "Efficiency",
    "ZKillboardLink",
  ];
  const rows = characters.map((char) =>
    headers.map((h) => `"${(char[h] || "").replace(/"/g, '""')}"`).join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");

  fs.writeFileSync(`./csv/${filename}`, csv, "utf8");
}

module.exports = {
  saveCharactersToCSV,
};
