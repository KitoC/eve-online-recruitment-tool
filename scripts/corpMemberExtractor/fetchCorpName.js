const cheerio = require("cheerio");
const { fetchPageHtml } = require("./utils");

/**
 * Extract characters (Id, Name, DateLeft) from HTML string
 */
function extractCorpName(htmlString) {
  const $ = cheerio.load(htmlString);

  const corpName = $("h4").first().text().trim();

  return corpName;
}

async function fetchCorpName(corpId) {
  const url = `https://evewho.com/corporation/${corpId}`;

  const html = await fetchPageHtml(url);

  return extractCorpName(html);
}

module.exports = {
  fetchCorpName,
};
