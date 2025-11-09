const { extractShipKillsAndEfficiency } = require("./extractShipKillAmount");
const { extractCorpName } = require("./extractChars");
const { filterByDaysSinceLeft, extractCharacters } = require("./extractChars");
const { saveCharactersToCSV } = require("./saveAsCSV");
const { sleep, fetchPageHtml } = require("./utils");

function pageUrl(corpId, page) {
  const raw = `https://evewho.com/pug/list/${corpId}/departed/${page}`;
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

async function fetchCorpName(corpId) {
  const url = `https://evewho.com/corporation/${corpId}`;

  const html = await fetchPageHtml(url);

  return extractCorpName(html);
}

const extractDepartedMembersFromCorp = async ({ corpId, nDays = 7 }) => {
  const corpName = await fetchCorpName(corpId);

  console.log(`\nCorp: ${corpName} | Corp ID: ${corpId} | nDays: ${nDays}`);

  let page = 1;

  const departedCharacters = [];

  while (true) {
    console.log(`\nFetching page ${page}...`);
    let html;
    try {
      html = await fetchPageHtml(pageUrl(corpId, page));
    } catch (e) {
      console.error(e.message);
      break;
    }

    // Ask OpenAI to parse
    let filteredChars = [];
    try {
      const extractedChars = await extractCharacters(html);
      filteredChars = filterByDaysSinceLeft(extractedChars, nDays);
      departedCharacters.push(...filteredChars);
    } catch (e) {
      console.error(`\nOpenAI parse failed on page ${page}: ${e.message}`);
      break;
    }

    // Stop condition: no parseable rows
    if (!filteredChars.length) {
      console.log(`\nNo results on page ${page}. Stopping.`);
      break;
    }

    page += 1;
    await sleep(700); // be polite
  }

  const filename = `${corpName.split(" ").join("_")}.csv`;

  console.log("\n--------------[DONE]------------------");

  console.log(
    `\nFound ${departedCharacters.length} departed characters and saved to CSV: ${filename}`
  );
  console.log("\n----------------------------------------");

  const departedCharactersWithShipKillsAndEfficiency = [];
  for (const character of departedCharacters) {
    sleep(1000);
    const { DestroyedShips, Efficiency, ZKillboardLink } =
      await getShipKillsAndEfficiency(character.Id);

    if (character.Id === "2121720773") {
      console.log("--------------------------------");
      console.log(DestroyedShips);
      console.log(Efficiency);
      console.log(ZKillboardLink);
      console.log("--------------------------------");
    }
    departedCharactersWithShipKillsAndEfficiency.push({
      ...character,
      DestroyedShips,
      Efficiency: Efficiency ? `${Efficiency}%` : "No Data",
      ZKillboardLink,
      CorpName: corpName,
      CorpId: corpId,
    });
  }

  return departedCharactersWithShipKillsAndEfficiency;
};

module.exports = {
  extractDepartedMembersFromCorp,
};
