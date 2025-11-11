const { extractShipKillsAndEfficiency } = require("./extractShipKillAmount");
const { filterByDaysSinceLeft, extractCharacters } = require("./extractChars");
const { fetchPageHtml } = require("./utils");
const { sleep } = require("../utils/general");

function pageUrl(corpId, page, type) {
  const raw = `https://evewho.com/pug/list/${corpId}/${type}/${page}`;
  return raw;
}

const getShipKillsAndEfficiency = async (characterId) => {
  const ZKillboardLink = `https://zkillboard.com/character/${characterId}`;

  try {
    const html = await fetchPageHtml(ZKillboardLink);

    // if (characterId === "2121720773") {
    //   console.log(html);
    // }

    return { ...(await extractShipKillsAndEfficiency(html)), ZKillboardLink };
  } catch (e) {
    return {
      DestroyedShips: undefined,
      Efficiency: undefined,
      ZKillboardLink,
    };
  }
};

const extractCharactersFromCorp = async ({
  corpId,
  nDays = 7,
  progressCallback,
  corpName,
  type = "departed",
}) => {
  const updateProgress = progressCallback || (() => {});

  updateProgress(`Fetching corporation info...`);

  let page = 1;
  const characters = [];

  while (true) {
    let html;
    const url = pageUrl(corpId, page, type);
    updateProgress(`Fetching ${type} page ${page} (${url})...`);

    try {
      html = await fetchPageHtml(url);
    } catch (e) {
      if (e.message.includes("404")) {
        break; // No more pages
      }
      updateProgress(`Error: ${e.message}`);
      break;
    }

    // Parse characters
    let filteredChars = [];

    try {
      const extractedChars = await extractCharacters(html);

      if (nDays) {
        filteredChars = filterByDaysSinceLeft(extractedChars, nDays);
        characters.push(...filteredChars);
      } else {
        characters.push(...extractedChars);
      }
    } catch (e) {
      updateProgress(`Parse failed on page ${page}: ${e.message}`);
      break;
    }

    // Stop condition: no parseable rows
    if (!filteredChars.length) {
      break;
    }

    page += 1;
    await sleep(700); // be polite
  }

  updateProgress(`Processing ${type} ${characters.length} characters...`);

  const totalChars = characters.length;

  console.log("\nTOTAL CHARS", totalChars);

  const charactersWithShipKillsAndEfficiency = await Promise.all(
    characters.map(async (character, index) => {
      if (progressCallback && index % 5 === 0) {
        updateProgress(`Fetching kill data: ${index + 1}/${totalChars}...`);
      }

      const { DestroyedShips, Efficiency, ZKillboardLink } =
        await getShipKillsAndEfficiency(character.Id);

      return {
        ...character,
        DestroyedShips,
        Efficiency: Efficiency ? `${Efficiency}%` : "No Data",
        ZKillboardLink,
        CorpName: corpName,
        CorpId: corpId,
      };
    })
  );

  return {
    characters: charactersWithShipKillsAndEfficiency,
    corpName,
    corpId,
  };
};

module.exports = {
  extractCharactersFromCorp,
};
