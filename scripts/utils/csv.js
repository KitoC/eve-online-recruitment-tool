const fs = require("fs");

const makeCSVFileName = (fileNamePrefix, type) => {
  return `${fileNamePrefix.split(" ").join("_")}_${type}.csv`;
};

const parseCSVToJSON = (filePath) => {
  const csv = fs.readFileSync(filePath, "utf8");
  const rows = csv.split("\n");
  const headers = rows[0].split(",").map((header) => header.trim());
  const data = rows
    .slice(1)
    .map((row) => row.split(",").map((cell) => cell.trim()))
    .map((row) => {
      return headers.reduce((acc, header, index) => {
        acc[header] = row[index].replace(/"/g, "");
        return acc;
      }, {});
    });

  return { headers, data };
};

module.exports = {
  makeCSVFileName,
  parseCSVToJSON,
};
