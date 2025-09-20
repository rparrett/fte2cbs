const { fullLists, PuppeteerBlocker } = require("@cliqz/adblocker-puppeteer");
const puppeteer = require("puppeteer");
const config = require("./config");
const fs = require("fs");
const fetch = require("node-fetch");
const csv = require("csv-parser");
const { Readable } = require("stream");

const modelTeamToCbs = {
  MIA: "Dolphins",
  BUF: "Bills",
  GB: "Packers",
  CLE: "Browns",
  NO: "Saints",
  SEA: "Seahawks",
  NYJ: "Jets",
  TB: "Buccaneers",
  DET: "Lions",
  BAL: "Ravens",
  KC: "Chiefs",
  NYG: "Giants",
  LV: "Raiders",
  WAS: "Commanders",
  ATL: "Falcons",
  CAR: "Panthers",
  LAR: "Rams",
  PHI: "Eagles",
  IND: "Colts",
  TEN: "Titans",
  CIN: "Bengals",
  MIN: "Vikings",
  DEN: "Broncos",
  LAC: "Chargers",
  PIT: "Steelers",
  NE: "Patriots",
  HOU: "Texans",
  JAX: "Jaguars",
  DAL: "Cowboys",
  CHI: "Bears",
  ARI: "Cardinals",
  SF: "49ers",
};

(async () => {
  const blocker = await PuppeteerBlocker.fromLists(fetch, fullLists);
  const browser = await puppeteer.launch({ headless: config.headless });

  const pages = await browser.pages();
  let page = pages[0];

  await page.exposeFunction("fte2cbs_log", (...args) => console.log(...args));
  page.setDefaultNavigationTimeout(120 * 1000);
  await blocker.enableBlockingInPage(page);

  // Grab predictions

  let modelData = await downloadModelData();
  let modelSpreads = getModelSpreads(modelData);

  // Login

  console.log("Logging into CBS");

  await page.goto(config.cbs_login_url);
  await page.type("#name", config.cbs_userid);
  await page.type("input[name=password]", config.cbs_password);
  await page.click("button[type=submit]");
  await page.waitForNavigation();

  // Make Picks

  console.log("Making Picks");

  await page.goto(config.cbs_make_picks_url);

  let cbsSpreads = await extractSpreadsSimple(page);

  for (var i = 0; i < cbsSpreads.length; i++) {
    const cbsSpread = cbsSpreads[i];

    const modelSpread = modelSpreads.find(
      (model) => model.away === cbsSpread.away && model.home === cbsSpread.home
    );

    if (!modelSpread) {
      console.log("Could not find model spread for ", cbsSpread, modelSpread);
    }

    const awayDiff = modelSpread.awaySpread - cbsSpread.awaySpread;
    const absDiff = Math.abs(awayDiff);

    if (awayDiff < 0) {
      console.log(
        `Model predicts diff of ${absDiff} for away team (${modelSpread.away})`
      );
      await clickIfNotSelected(page, cbsSpread.awayButtonSelector);
    } else if (awayDiff > 0) {
      console.log(
        `Model predicts diff of ${absDiff} for home team (${modelSpread.home})`
      );
      await clickIfNotSelected(page, cbsSpread.homeButtonSelector);
    } else {
      if (Math.random() < 0.5) {
        console.log(
          `Model predicts same outcome. Rolled dice for (${modelSpread.away})`
        );
        await clickIfNotSelected(page, cbsSpread.awayButtonSelector);
      } else {
        console.log(
          `Model predicts same outcome. Rolled dice for (${modelSpread.home})`
        );
        await clickIfNotSelected(page, cbsSpread.homeButtonSelector);
      }
    }

    await page.waitForTimeout(500);
  }

  console.log("Submitting");

  await page.click("button[data-testid='save-picks-btn']");

  if (config.headless || config.autoclose) {
    process.exit(0);
  }
})();

async function downloadModelData() {
  const csvUrl =
    "https://raw.githubusercontent.com/greerreNFL/nfelo/refs/heads/main/output_data/prediction_tracker.csv";

  try {
    console.log("Downloading Nfelo prediction data...");

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const csvText = await response.text();
    const data = await parseCSVFromString(csvText);

    console.log(`Downloaded ${data.length} games`);
    return data;
  } catch (error) {
    console.error("Error downloading CSV:", error);
    throw error;
  }
}

function parseCSVFromString(csvText) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from([csvText]);

    stream
      .pipe(csv())
      .on("data", (row) => results.push(row))
      .on("end", () => resolve(results))
      .on("error", reject);
  });
}

function getModelSpreads(data) {
  return data.map((row) => {
    const homeSpread = parseFloat(row.nfelo_projected_home_spread);
    const awaySpread = -homeSpread;

    return {
      away: modelTeamToCbs[row.away_team],
      home: modelTeamToCbs[row.home_team],
      awaySpread: awaySpread,
      homeSpread: homeSpread,
    };
  });
}

async function extractSpreadsSimple(page) {
  try {
    await page.waitForSelector('[data-cy="spread"]', { timeout: 10000 });

    const { spreads, awayTeams, homeTeams } = await page.evaluate(() => {
      // Add indices to elements for later clicking
      const awayElements = Array.from(
        document.querySelectorAll('[data-testid="away-team"]')
      );
      const homeElements = Array.from(
        document.querySelectorAll('[data-testid="home-team"]')
      );

      awayElements.forEach((el, i) => el.setAttribute("data-away-index", i));
      homeElements.forEach((el, i) => el.setAttribute("data-home-index", i));

      return {
        spreads: Array.from(
          document.querySelectorAll('[data-cy="spread"] span')
        ).map((el) => el.textContent.trim()),
        awayTeams: Array.from(
          document.querySelectorAll('[data-testid="away-team"] h3')
        ).map((el) => el.textContent.trim()),
        homeTeams: Array.from(
          document.querySelectorAll('[data-testid="home-team"] h3')
        ).map((el) => el.textContent.trim()),
      };
    });

    // Combine into matchups
    const matchups = awayTeams.map((awayTeam, i) => ({
      away: awayTeam,
      home: homeTeams[i],
      awaySpread: parseFloat(spreads[i * 2]),
      homeSpread: parseFloat(spreads[i * 2 + 1]),
      awayButtonSelector: `[data-testid="away-team"][data-away-index="${i}"]`,
      homeButtonSelector: `[data-testid="home-team"][data-home-index="${i}"]`,
    }));

    return matchups;
  } catch (error) {
    console.error("Error during scraping:", error);
    throw error;
  }
}

async function clickIfNotSelected(page, selector) {
  const selected = (await page.$(selector + ".item-selected")) !== null;
  if (selected) {
    return;
  }
  page.click(selector);
}
