const cheerio = require("cheerio");

/**
 * Extract characters (Id, Name, DateLeft) from HTML string
 */
function extractCharacters(htmlString) {
  const $ = cheerio.load(htmlString);
  const result = [];

  $('a[href^="/character/"]').each((_, el) => {
    const href = $(el).attr("href");
    const idMatch = href.match(/\/character\/(\d+)/);
    const id = idMatch ? idMatch[1] : null;
    const name = $(el).text().trim();

    if (!name) return; // skip image-only links

    // The departed date is the next .departed span after this <a>
    const departed = $(el).nextAll("span.departed").first().text().trim();

    result.push({
      Id: id,
      Name: name,
      DateLeft: departed || null,
      EveWhoLink: `https://evewho.com/character/${id}`,
      ZKillboardLink: `https://zkillboard.com/character/${id}`,
    });
  });

  return result;
}

/**
 * Extract characters (Id, Name, DateLeft) from HTML string
 */
function extractCorpName(htmlString) {
  const $ = cheerio.load(htmlString);

  const corpName = $("h4").first().text().trim();

  return corpName;
}

/**
 * Filter characters who left within the last n days
 */
function filterByDaysSinceLeft(characters, nDays) {
  const now = new Date();

  return characters.filter((char) => {
    if (!char.DateLeft) return false;
    const leftDate = new Date(char.DateLeft.replace(/\//g, "-"));
    const diffDays = (now - leftDate) / (1000 * 60 * 60 * 24);
    return diffDays <= nDays;
  });
}

module.exports = {
  extractCharacters,
  filterByDaysSinceLeft,
  extractCorpName,
};
