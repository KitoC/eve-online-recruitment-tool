const cheerio = require("cheerio");

const extractShipKillsAndEfficiency = async (htmlString) => {
  const $ = cheerio.load(htmlString);
  const result = [];

  const statsTable = $("#statsbox tbody");

  const thirdRow = statsTable.find("tr").eq(2);

  const DestroyedShips = thirdRow.find("td").eq(0).text().trim();
  const Efficiency = thirdRow.find("td").eq(4).text().trim();

  return {
    DestroyedShips,
    Efficiency,
  };
};

module.exports = {
  extractShipKillsAndEfficiency,
};
