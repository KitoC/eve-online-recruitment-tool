const cheerio = require("cheerio");
const { fetchPageHtml } = require("./utils");

const getAllianceCorpIds = async (allianceId) => {
  const alliance = await fetchPageHtml(
    `https://evewho.com/alliance/${allianceId}`
  );
  const $ = cheerio.load(alliance);
  const corpIds = [];
  $('a[href^="/corporation/"]').each((_, el) => {
    const href = $(el).attr("href");
    const idMatch = href.match(/\/corporation\/(\d+)/);
    const id = idMatch ? idMatch[1] : null;
    corpIds.push(id);
  });
  return corpIds;
};

const fetchAllianceName = async (allianceId) => {
  const alliance = await fetchPageHtml(
    `https://evewho.com/alliance/${allianceId}`
  );
  const $ = cheerio.load(alliance);
  const allianceName = $("h4").first().text().trim();
  return allianceName;
};

module.exports = {
  fetchAllianceName,
  getAllianceCorpIds,
};
